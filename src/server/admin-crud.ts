import "server-only";
import {
  AccessError, BackendError, createAccessBackend, createCrud, createPostgresRepository,
  type AccessAdapters, type CrudRepository, type CrudRow, type CrudUnit, type PgQuery,
} from "@shared/backend";
import type { Company, CompanyInput, Appointment, AppointmentInput } from "../shared/admin/b2b-model";
import type { Lead, LeadInput } from "../shared/admin/contracts";
import { parseAppointmentInput, parseCompanyInput, parseCompanyPatch, parseLeadInput } from "../shared/admin/parse-command";
import { initials } from "../shared/admin/validation";
import { assertAdmin, withTransaction, type AdminIdentity, type PoolClient } from "./database";
import { verifyAuthSession } from "./auth";
import { siteUrl } from "../config/site";

type DbRow = Record<string, unknown>;
const dbRow = (value: unknown): DbRow => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BackendError("UNAVAILABLE");
  return value as DbRow;
};
const text = (value: unknown): string => {
  if (typeof value !== "string") throw new BackendError("UNAVAILABLE");
  return value;
};
const integer = (value: unknown, min = 0): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min) throw new BackendError("UNAVAILABLE");
  return parsed;
};
const nullableText = (value: unknown): string | undefined => value == null || value === "" ? undefined : text(value);
const iso = (value: unknown): string => {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.valueOf())) throw new BackendError("UNAVAILABLE");
  return date.toISOString();
};
const clientQuery = (client: PoolClient): PgQuery => async (statement, values) => {
  const result = await client.query(statement, [...values]);
  return { rows: result.rows };
};

function accessFor(identity: AdminIdentity, client: PoolClient, reverifySession: boolean) {
  const session = identity.verifiedSession;
  if (!session || !session.issuer || !session.subject || session.expiresAt <= Date.now()) throw new AccessError("UNAUTHENTICATED");
  const permissions = ["companies", "leads", "appointments"].flatMap(type => ["view", "create", "update", "delete"].map(action => ({
    permission: `${type}:${action}`, effect: "allow" as const, scope: { tenantId: identity.propertyId },
  })));
  const recordDecisions: NonNullable<AccessAdapters["recordDecisions"]> = async events => {
    try {
      await withTransaction(identity.id, async auditClient => {
        for (const event of events) await auditClient.query(`INSERT INTO leasing.backend_access_decisions
          (property_id,actor_user_id,policy_version,permission,resource_type,resource_id,allowed,reason,recorded_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,to_timestamp($9 / 1000.0))`, [identity.propertyId,event.actorId,event.policyVersion,event.permission,event.resource.type,event.resource.id ?? null,event.allowed,event.reason,event.at]);
      });
    } catch { throw new AccessError("UNAVAILABLE"); }
  };
  return createAccessBackend({
    verifySession: async request => {
      if(!reverifySession)return session.expiresAt>Date.now()?session:null;
      try { const current=await verifyAuthSession(request);if(!current?.emailVerified||current.issuer!==session.issuer||current.subject!==session.subject)return null;return {issuer:current.issuer,subject:current.subject,expiresAt:current.expiresAt}; }
      catch { throw new AccessError("UNAVAILABLE"); }
    },
    loadPrincipal: async verified => {
      if (verified.issuer !== session.issuer || verified.subject !== session.subject) return null;
      try { await assertAdmin(client, identity); } catch { return null; }
      return { actorId: identity.id, issuer: session.issuer, subject: session.subject, disabled: false,
        policyVersion: `mall-admin:${identity.propertyId}:${identity.role}`, grants: permissions };
    },
    recordDecision: async event => recordDecisions([event]),
    recordDecisions,
  });
}

export type CompanyRow = Company & { tenantId: string };
type CompanyLink = CrudRow;
type CompanyLinkChange = { updatedAt: string };
function decodeCompanyLink(input: unknown): CompanyLink {
  const row = dbRow(input);
  return { id: text(row.organization_id), version: integer(row.revision, 1), tenantId: text(row.property_id) };
}
async function loadCompanies(client: PoolClient, scopeId: string, ids: string[]): Promise<CompanyRow[]> {
  if (!ids.length) return [];
  const rows = (await client.query(`SELECT pc.organization_id AS id,pc.revision AS version,pc.property_id AS tenant_id,
      o.legal_name AS name,o.industry,coalesce(b.name,'') AS brand,coalesce(c.display_name,'') AS contact,
      coalesce(c.email,'') AS email,coalesce(c.phone,'') AS phone,o.account_owner AS owner,o.internal_note AS note,
      o.registration_number AS tax_id,o.registered_address AS address
    FROM leasing.property_customers pc JOIN leasing.organizations o ON o.id=pc.organization_id
    LEFT JOIN LATERAL(SELECT name FROM leasing.brands WHERE organization_id=o.id ORDER BY created_at LIMIT 1)b ON true
    LEFT JOIN LATERAL(SELECT display_name,email,phone FROM leasing.contacts WHERE organization_id=o.id ORDER BY created_at LIMIT 1)c ON true
    WHERE pc.property_id=$1 AND pc.organization_id=ANY($2::uuid[]) AND pc.deleted_at IS NULL`,[scopeId,ids])).rows;
  return rows.map(input => {
    const row=dbRow(input),name=text(row.name);
    return { id:text(row.id),version:integer(row.version,1),tenantId:text(row.tenant_id),name,initials:initials(name),
      industry:text(row.industry),brand:text(row.brand),contact:text(row.contact),email:text(row.email),phone:text(row.phone),
      owner:text(row.owner),note:text(row.note),taxId:nullableText(row.tax_id),address:nullableText(row.address) };
  });
}
function companyRepository(client: PoolClient): CrudRepository<CompanyRow, CompanyInput, Partial<CompanyInput>> {
  const query=clientQuery(client);
  const links=createPostgresRepository<CompanyLink,CompanyLinkChange,CompanyLinkChange>({
    query,schema:"leasing",table:"property_customers",idColumn:"organization_id",versionColumn:"revision",
    columns:{updatedAt:"updated_at"},scopeColumns:{tenantId:"property_id"},softDelete:{column:"deleted_at"},decode:decodeCompanyLink,
  });
  const expand=async (rows:CompanyLink[],scope:{tenantId:string})=>{
    const mapped=await loadCompanies(client,scope.tenantId,rows.map(row=>row.id));
    const byId=new Map(mapped.map(row=>[row.id,row]));
    return rows.map(row=>byId.get(row.id)).filter((row):row is CompanyRow=>!!row);
  };
  const find=async(id:string,scope:{tenantId:string})=>{const link=await links.find(id,scope);return link?(await expand([link],scope))[0]??null:null;};
  return {
    find,
    async list(scope,page){const result=await links.list(scope,page);return {items:await expand(result.items,scope),totalItems:result.totalItems};},
    async listAuthorized(scope,page,selection){const result=await links.listAuthorized!(scope,page,selection);return {items:await expand(result.items,scope),totalItems:result.totalItems};},
    async insert(data,scope){
      const id=crypto.randomUUID();
      await client.query(`INSERT INTO leasing.organizations(id,legal_name,industry,account_owner,internal_note,registration_number,registered_address)
        VALUES($1,$2,$3,$4,$5,$6,$7)`,[id,data.name,data.industry,data.owner,data.note,data.taxId||null,data.address||null]);
      await client.query("INSERT INTO leasing.property_customers(property_id,organization_id,revision) VALUES($1,$2,1)",[scope.tenantId,id]);
      await client.query("INSERT INTO leasing.brands(organization_id,name) VALUES($1,$2)",[id,data.brand]);
      await client.query("INSERT INTO leasing.contacts(organization_id,display_name,email,phone) VALUES($1,$2,$3,$4)",[id,data.contact,data.email,data.phone]);
      const created=await find(id,scope);if(!created)throw new BackendError("UNAVAILABLE");return created;
    },
    async update(id,data,expectedVersion,scope){
      const changed=await links.update(id,{updatedAt:new Date().toISOString()},expectedVersion,scope);if(!changed)return null;
      const orgFields:[keyof CompanyInput,string][]=[["name","legal_name"],["industry","industry"],["owner","account_owner"],["note","internal_note"],["taxId","registration_number"],["address","registered_address"]];
      const updates=orgFields.filter(([key])=>Object.hasOwn(data,key));
      if(updates.length){const values:unknown[]=[id];const sets=updates.map(([key,column])=>{values.push(key==="taxId"||key==="address"?(data[key]||null):data[key]);return `${column}=$${values.length}`;});await client.query(`UPDATE leasing.organizations SET ${sets.join(",")} WHERE id=$1`,values);}
      if(Object.hasOwn(data,"brand")){const result=await client.query("SELECT id FROM leasing.brands WHERE organization_id=$1 ORDER BY created_at LIMIT 1",[id]);if(result.rows[0])await client.query("UPDATE leasing.brands SET name=$2 WHERE id=$1",[dbRow(result.rows[0]).id,data.brand]);else await client.query("INSERT INTO leasing.brands(organization_id,name) VALUES($1,$2)",[id,data.brand]);}
      if(["contact","email","phone"].some(key=>Object.hasOwn(data,key))){const result=await client.query("SELECT id,coalesce(display_name,'') AS display_name,coalesce(email,'') AS email,coalesce(phone,'') AS phone FROM leasing.contacts WHERE organization_id=$1 ORDER BY created_at LIMIT 1",[id]);const current=result.rows[0]?dbRow(result.rows[0]):null;const contact=data.contact??(current?text(current.display_name):"");const email=data.email??(current?text(current.email):"");const phone=data.phone??(current?text(current.phone):"");if(current)await client.query("UPDATE leasing.contacts SET display_name=$2,email=$3,phone=$4 WHERE id=$1",[current.id,contact,email,phone]);else await client.query("INSERT INTO leasing.contacts(organization_id,display_name,email,phone) VALUES($1,$2,$3,$4)",[id,contact,email,phone]);}
      return find(id,scope);
    },
    async delete(id,expectedVersion,scope){
      const refs=await client.query(`SELECT EXISTS(SELECT 1 FROM leasing.leads WHERE property_id=$1 AND organization_id=$2)
        OR EXISTS(SELECT 1 FROM leasing.leasing_requests WHERE property_id=$1 AND organization_id=$2)
        OR EXISTS(SELECT 1 FROM leasing.reservations WHERE property_id=$1 AND organization_id=$2)
        OR EXISTS(SELECT 1 FROM leasing.leases WHERE property_id=$1 AND organization_id=$2)
        OR EXISTS(SELECT 1 FROM leasing.appointments WHERE property_id=$1 AND organization_id=$2) AS referenced`,[scope.tenantId,id]);
      if(dbRow(refs.rows[0]).referenced===true)throw new BackendError("CONFLICT");
      return links.delete(id,expectedVersion,scope);
    },
  };
}

function decodeContactDetails(input: unknown): NonNullable<Lead["contactDetails"]> {
  const row=dbRow(input),intent=text(row.intent);
  if(!["consultation","visit","callback"].includes(intent))throw new BackendError("UNAVAILABLE");
  const result:NonNullable<Lead["contactDetails"]>={intent:intent as NonNullable<Lead["contactDetails"]>["intent"],company:text(row.company),business:text(row.business),area:text(row.area),timing:text(row.timing),space:text(row.space)};
  for(const key of ["scope","visitDate","visitTime"] as const){const value=nullableText(row[key]);if(value)result[key]=value;}
  return result;
}
export type LeadRow = CrudRow & Omit<Lead,"contactDetails">;
function decodeLead(input: unknown): LeadRow {
  const row=dbRow(input),name=text(row.name),status=text(row.status);
  if(!["Mới","Đang tư vấn","Đã xử lý"].includes(status))throw new BackendError("UNAVAILABLE");
  return {id:text(row.id),version:integer(row.revision,1),tenantId:text(row.property_id),name,initials:initials(name),interest:text(row.interest),floor:integer(row.floor_number,1) as Lead["floor"],source:text(row.source),time:iso(row.created_at),status:status as Lead["status"],note:text(row.note),companyId:nullableText(row.organization_id),email:nullableText(row.email),phone:nullableText(row.phone)};
}
type LeadStored = {name:string;interest:string;floor:Lead["floor"];source:string;status:Lead["status"];note:string;organizationId:string|null;email:string;phone:string};
const storedLead=(input:LeadInput):LeadStored=>({name:input.name,interest:input.interest,floor:input.floor,source:input.source,status:input.status,note:input.note,organizationId:input.companyId??null,email:input.email??"",phone:input.phone??""});
function leadRepository(client: PoolClient): CrudRepository<LeadRow,LeadInput,LeadInput> {
  const stored=createPostgresRepository<LeadRow,LeadStored,LeadStored>({
    query:clientQuery(client),schema:"leasing",table:"leads",versionColumn:"revision",scopeColumns:{tenantId:"property_id"},
    columns:{name:"name",interest:"interest",floor:"floor_number",source:"source",status:"status",note:"note",organizationId:"organization_id",email:"email",phone:"phone"},
    softDelete:{column:"deleted_at"},decode:decodeLead,
  });
  return {...stored,insert:(data,scope)=>stored.insert(storedLead(data),scope),update:(id,data,version,scope)=>stored.update(id,storedLead(data),version,scope),delete:async(id,version,scope)=>{
    const protectedRecord=await client.query("SELECT EXISTS(SELECT 1 FROM leasing.contact_intake WHERE property_id=$1 AND lead_id=$2) AS referenced",[scope.tenantId,id]);
    if(dbRow(protectedRecord.rows[0]).referenced===true)throw new BackendError("CONFLICT");
    return stored.delete(id,version,scope);
  }};
}

export type AppointmentRow = CrudRow & Omit<Appointment,"version">;
function scheduleRange(value: unknown): { startsAt:string; durationMinutes:number; range:string } {
  const range=text(value),match=/^\["([^\"]+)","([^\"]+)"\)$/.exec(range);
  if(!match)throw new BackendError("UNAVAILABLE");
  const start=Date.parse(match[1]!),end=Date.parse(match[2]!);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||(end-start)%60000!==0)throw new BackendError("UNAVAILABLE");
  return {startsAt:new Date(start).toISOString(),durationMinutes:(end-start)/60000,range};
}
function appointmentRange(input: AppointmentInput): string {
  const start=Date.parse(input.startsAt),end=start+input.durationMinutes*60000;
  if(!Number.isFinite(start)||!Number.isFinite(end))throw new BackendError("INVALID_INPUT");
  return `["${new Date(start).toISOString()}","${new Date(end).toISOString()}")`;
}
function decodeAppointment(input: unknown): AppointmentRow {
  const row=dbRow(input),range=scheduleRange(row.scheduled_period),status=text(row.status);
  if(!["requested","confirmed","completed","cancelled","no_show"].includes(status))throw new BackendError("UNAVAILABLE");
  return {id:text(row.id),version:integer(row.revision,1),tenantId:text(row.property_id),companyId:text(row.organization_id),purpose:text(row.purpose),startsAt:range.startsAt,status:status as Appointment["status"],location:row.meeting_location==null?"":text(row.meeting_location),durationMinutes:range.durationMinutes};
}
type AppointmentStored = {companyId:string;purpose:string;scheduledPeriod:string;location:string};
const storedAppointment=(input:AppointmentInput,scheduledPeriod:string):AppointmentStored=>({companyId:input.companyId,purpose:input.purpose,scheduledPeriod,location:input.location});
function appointmentRepository(client:PoolClient):CrudRepository<AppointmentRow,AppointmentInput,AppointmentInput> {
  const query=clientQuery(client);
  const stored=createPostgresRepository<AppointmentRow,AppointmentStored,AppointmentStored>({
    query,schema:"leasing",table:"appointments",versionColumn:"revision",scopeColumns:{tenantId:"property_id"},
    columns:{companyId:"organization_id",purpose:"purpose",scheduledPeriod:"scheduled_period",location:"meeting_location"},
    softDelete:{column:"deleted_at"},decode:decodeAppointment,
  });
  const checkTime=async(input:AppointmentInput,id:string|undefined,scope:{tenantId:string})=>{
    const start=Date.parse(input.startsAt);if(start<=Date.now())throw new BackendError("INVALID_INPUT");
    const range=appointmentRange(input);
    const conflict=await client.query(`SELECT 1 FROM leasing.appointments WHERE property_id=$1 AND deleted_at IS NULL AND status<>'cancelled'
      AND scheduled_period&&$2::tstzrange AND ($3::uuid IS NULL OR id<>$3) LIMIT 1`,[scope.tenantId,range,id??null]);
    if(conflict.rows.length)throw new BackendError("CONFLICT");
    return range;
  };
  return {
    ...stored,
    async insert(data,scope){return stored.insert(storedAppointment(data,await checkTime(data,undefined,scope)),scope);},
    async update(id,data,expectedVersion,scope){return stored.update(id,storedAppointment(data,await checkTime(data,id,scope)),expectedVersion,scope);},
    async delete(id,expectedVersion,scope){const row=await stored.find(id,scope);if(!row)return false;if(row.status==="confirmed"||row.status==="completed"||row.status==="no_show")throw new BackendError("CONFLICT");return stored.delete(id,expectedVersion,scope);},
  };
}

function transactionFor<Row extends CrudRow,Create,Update>(scope:{tenantId:string},access:ReturnType<typeof createAccessBackend>,repository:CrudRepository<Row,Create,Update>) {
  return async <Result>(_request:Request,work:(unit:CrudUnit<Row,Create,Update>)=>Promise<Result>)=>work({scope,access,repository});
}
export function createAdminCrudServices(identity: AdminIdentity, client: PoolClient, request?:Request) {
  const scope={tenantId:identity.propertyId};
  const access=accessFor(identity,client,!!request);
  const companies=createCrud<CompanyRow,CompanyInput,Partial<CompanyInput>,Company>({type:"companies",transaction:transactionFor(scope,access,companyRepository(client)),parseCreate:parseCompanyInput,parseUpdate:parseCompanyPatch,project:row=>{const {tenantId:_,...company}=row;return company;}});
  const leads=createCrud<LeadRow,LeadInput,LeadInput,Lead>({type:"leads",transaction:transactionFor(scope,access,leadRepository(client)),parseCreate:parseLeadInput,parseUpdate:parseLeadInput,project:async row=>{
    const {rows}=await client.query(`SELECT jsonb_strip_nulls(jsonb_build_object('intent',intent,'company',company_name,'business',business,'area',area_preference,'timing',timing,'space',space_code,'scope',scope,'visitDate',visit_date::text,'visitTime',visit_time)) AS details FROM leasing.contact_intake WHERE lead_id=$1 ORDER BY consented_at DESC LIMIT 1`,[row.id]);
    const details=rows[0]?dbRow(rows[0]).details:undefined;
    const {tenantId:_,propertyId:__,organizationId:___,ownerId:____,dimensions:_____,...lead}=row;
    return {...lead,...(details?{contactDetails:decodeContactDetails(details)}:{})};
  }});
  const appointments=createCrud<AppointmentRow,AppointmentInput,AppointmentInput,Appointment>({type:"appointments",transaction:transactionFor(scope,access,appointmentRepository(client)),parseCreate:parseAppointmentInput,parseUpdate:parseAppointmentInput,project:row=>{const {tenantId:_,propertyId:__,organizationId:___,ownerId:____,dimensions:_____,...appointment}=row;return appointment;}});
  return {request:request??new Request(siteUrl),companies,leads,appointments};
}

export async function listAll<Row>(service:{list(request:Request,pagination:{page?:number;pageSize?:number}):Promise<{items:Row[];totalPages:number}>},request:Request):Promise<Row[]> {
  const items:Row[]=[];let page=1,totalPages=1;
  do {const result=await service.list(request,{page,pageSize:100});items.push(...result.items);totalPages=result.totalPages;page++;} while(page<=totalPages);
  return items;
}
