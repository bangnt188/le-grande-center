import "server-only";
import type { AdminCommand, AdminSnapshot, AdminSettings } from "../shared/admin/contracts";
import type { Slot, FloorConfiguration } from "../shared/admin/space-model";
import type { WebsiteSettings } from "../shared/admin/website-settings";
import { parseAdminCommand } from "../shared/admin/parse-command";
import { initials, record, AdminValidationError } from "../shared/admin/validation";
import { assertAdmin, withTransaction, WorkspaceError, type AdminIdentity, type PoolClient } from "./database";
import { readMedia, readStorageUsage, deleteMedia, renameMedia, linkMedia } from "./media/repository";

export async function readSettings(client:PoolClient,propertyId:string):Promise<{revision:number;settings:AdminSettings}> {
 const {rows}=await client.query(`SELECT p.workspace_revision,p.name,p.contact_email,p.contact_phone,p.default_hold_hours,p.appointment_minutes,p.appointment_location,w.* FROM leasing.properties p JOIN leasing.website_settings w ON w.property_id=p.id WHERE p.id=$1`,[propertyId]);
 const p=rows[0];if(!p)throw new WorkspaceError("Property is not initialized",503);
 const website:WebsiteSettings={logoMediaId:p.logo_media_id??"",email:p.email,hotline:p.hotline,secondaryPhone:p.secondary_phone,managementPhone:p.management_phone,address:p.address,zaloUrl:p.zalo_url};
 return {revision:Number(p.workspace_revision),settings:{propertyName:p.name,contactEmail:p.contact_email,contactPhone:p.contact_phone,defaultHoldHours:p.default_hold_hours,appointmentMinutes:p.appointment_minutes,appointmentLocation:p.appointment_location,website}};
}
export async function readFloors(client:PoolClient,propertyId:string):Promise<FloorConfiguration[]> {
 return (await client.query(`SELECT floor_number AS number,purpose,public_title AS "publicTitle",public_description AS "publicDescription" FROM leasing.floors WHERE property_id=$1 ORDER BY floor_number`,[propertyId])).rows;
}
export async function readSlots(client:PoolClient,propertyId:string):Promise<Slot[]> {
 return (await client.query(`SELECT s.id,f.floor_number AS floor,s.code,s.display_order AS "order",s.core_zone AS side, m.area_m2::float8 AS area,coalesce(fr.width_m,0)::float8 AS width,
 CASE WHEN l.id IS NOT NULL THEN 'Đang thuê' ELSE s.operational_status END AS status,coalesce(o.legal_name,s.tenant_label) AS tenant, ARRAY(SELECT CASE WHEN c.slot_a_id=s.id THEN c.slot_b_id ELSE c.slot_a_id END FROM leasing.slot_connections c WHERE c.property_id=s.property_id AND c.approval_state='approved' AND (c.slot_a_id=s.id OR c.slot_b_id=s.id)) AS "connectedSlotIds"
 FROM leasing.slots s JOIN leasing.floors f ON f.id=s.floor_id
 JOIN LATERAL(SELECT * FROM leasing.slot_versions WHERE slot_id=s.id ORDER BY version_number DESC LIMIT 1) v ON true
 JOIN leasing.slot_measurements m ON m.slot_version_id=v.id AND m.area_kind='commercial_reference'
 LEFT JOIN LATERAL(SELECT width_m FROM leasing.slot_frontages WHERE slot_version_id=v.id AND frontage_kind='external' LIMIT 1) fr ON true
 LEFT JOIN leasing.slot_allocations a ON a.slot_id=s.id AND a.lease_id IS NOT NULL AND a.released_at IS NULL
 LEFT JOIN leasing.leases l ON l.id=a.lease_id AND l.status='executed' LEFT JOIN leasing.organizations o ON o.id=l.organization_id
 WHERE s.property_id=$1 AND s.retired_at IS NULL ORDER BY f.floor_number,s.display_order`,[propertyId])).rows;
}
export async function readWorkspaceInTransaction(client:PoolClient,identity:AdminIdentity):Promise<AdminSnapshot> {
 await assertAdmin(client,identity);const p=identity.propertyId;
 const {revision,settings}=await readSettings(client,p),floors=await readFloors(client,p),slots=await readSlots(client,p);
 const companies=(await client.query(`SELECT o.id,o.legal_name AS name,o.industry,coalesce(b.name,'') AS brand,coalesce(c.display_name,'') AS contact,coalesce(c.email,'') AS email,coalesce(c.phone,'') AS phone,o.account_owner AS owner,o.internal_note AS note,o.registration_number AS "taxId",o.registered_address AS address FROM leasing.organizations o JOIN leasing.property_customers pc ON pc.organization_id=o.id LEFT JOIN LATERAL(SELECT * FROM leasing.brands WHERE organization_id=o.id ORDER BY created_at LIMIT 1)b ON true LEFT JOIN LATERAL(SELECT * FROM leasing.contacts WHERE organization_id=o.id ORDER BY created_at LIMIT 1)c ON true WHERE pc.property_id=$1 ORDER BY o.created_at`,[p])).rows.map(c=>({...c,initials:initials(c.name)}));
 const groups=(await client.query(`SELECT s.id,f.floor_number AS floor,s.display_name AS name,array_agg(m.slot_id ORDER BY sl.display_order) AS "slotIds" FROM leasing.spaces s JOIN leasing.floors f ON f.id=s.floor_id JOIN LATERAL(SELECT id FROM leasing.space_versions WHERE space_id=s.id ORDER BY version_number DESC LIMIT 1)v ON true JOIN leasing.space_members m ON m.space_version_id=v.id JOIN leasing.slots sl ON sl.id=m.slot_id WHERE s.property_id=$1 AND s.is_admin_group AND s.retired_at IS NULL GROUP BY s.id,f.floor_number`,[p])).rows.map(g=>({...g,status:slots.some(s=>g.slotIds.includes(s.id)&&s.status==='Đang thuê')?'Đang thuê' as const:'Trống' as const}));
 const requests=(await client.query(`SELECT q.id,q.organization_id AS "companyId",f.floor_number AS floor,array_agg(m.slot_id ORDER BY sl.display_order) AS "slotIds",v.area_m2::float8 AS area,lower(q.requested_period)::text AS start,(upper(q.requested_period)-1)::text AS "end",CASE q.status WHEN 'under_review' THEN 'reviewing' ELSE q.status END AS status,q.customer_note AS note,q.submitted_at::text AS received FROM leasing.leasing_requests q JOIN leasing.request_spaces rs ON rs.request_id=q.id JOIN leasing.space_versions v ON v.id=rs.space_version_id JOIN leasing.floors f ON f.id=v.floor_id JOIN leasing.space_members m ON m.space_version_id=v.id JOIN leasing.slots sl ON sl.id=m.slot_id WHERE q.property_id=$1 GROUP BY q.id,f.floor_number,v.area_m2`,[p])).rows;
 const reservations=(await client.query(`SELECT r.id,r.request_id AS "requestId",r.organization_id AS "companyId",f.floor_number AS floor,array_agg(m.slot_id ORDER BY sl.display_order) AS "slotIds",v.area_m2::float8 AS area,lower(r.occupancy_period)::text AS start,(upper(r.occupancy_period)-1)::text AS "end",r.expires_at::text AS "expiresAt",CASE r.status WHEN 'expired' THEN 'cancelled' ELSE r.status END AS status,r.internal_note AS note FROM leasing.reservations r JOIN leasing.request_spaces rs ON rs.id=r.request_space_id JOIN leasing.space_versions v ON v.id=rs.space_version_id JOIN leasing.floors f ON f.id=v.floor_id JOIN leasing.space_members m ON m.space_version_id=v.id JOIN leasing.slots sl ON sl.id=m.slot_id WHERE r.property_id=$1 GROUP BY r.id,f.floor_number,v.area_m2`,[p])).rows;
 const leases=(await client.query(`SELECT l.id,l.organization_id AS "companyId",l.reservation_id AS "reservationId",f.floor_number AS floor,array_agg(m.slot_id ORDER BY sl.display_order) AS "slotIds",v.area_m2::float8 AS area,lower(l.occupancy_period)::text AS start,(upper(l.occupancy_period)-1)::text AS "end",l.status,lv.rent_note AS "rentNote",d.title AS "documentName",dv.id AS "documentMediaId" FROM leasing.leases l JOIN leasing.space_versions v ON v.id=l.space_version_id JOIN leasing.floors f ON f.id=v.floor_id JOIN leasing.space_members m ON m.space_version_id=v.id JOIN leasing.slots sl ON sl.id=m.slot_id JOIN LATERAL(SELECT * FROM leasing.lease_versions WHERE lease_id=l.id ORDER BY version_number DESC LIMIT 1) lv ON true JOIN leasing.lease_documents ld ON ld.lease_version_id=lv.id AND ld.purpose='recorded_original' JOIN leasing.document_versions dv ON dv.id=ld.document_version_id JOIN leasing.documents d ON d.id=dv.document_id WHERE l.property_id=$1 AND l.status='executed' GROUP BY l.id,f.floor_number,v.area_m2,lv.rent_note,d.title,dv.id`,[p])).rows;
 const appointments=(await client.query(`SELECT id,organization_id AS "companyId",purpose,lower(scheduled_period)::text AS "startsAt",status,meeting_location AS location,(extract(epoch FROM upper(scheduled_period)-lower(scheduled_period))/60)::integer AS "durationMinutes" FROM leasing.appointments WHERE property_id=$1 ORDER BY lower(scheduled_period)`,[p])).rows;
 const leads=(await client.query(`SELECT l.id,l.name,l.interest,l.floor_number AS floor,l.source,l.created_at::text AS time,l.status,l.note,l.organization_id AS "companyId",l.email,l.phone,CASE WHEN ci.id IS NULL THEN NULL ELSE jsonb_strip_nulls(jsonb_build_object('intent',ci.intent,'company',ci.company_name,'business',ci.business,'area',ci.area_preference,'timing',ci.timing,'space',ci.space_code,'scope',ci.scope,'visitDate',ci.visit_date::text,'visitTime',ci.visit_time)) END AS "contactDetails" FROM leasing.leads l LEFT JOIN leasing.contact_intake ci ON ci.lead_id=l.id WHERE l.property_id=$1 ORDER BY l.created_at DESC`,[p])).rows.map(l=>({...l,companyId:l.companyId??undefined,contactDetails:l.contactDetails??undefined,initials:initials(l.name)}));
 return {revision,settings,floors,slots,companies,groups,requests,reservations,leases,appointments,leads,media:await readMedia(client,p),storage:await readStorageUsage(client,p)};
}
export async function readWorkspace(identity:AdminIdentity) {return withTransaction(identity.id,async client=>{await client.query('SELECT id FROM leasing.properties WHERE id=$1 FOR SHARE',[identity.propertyId]);return readWorkspaceInTransaction(client,identity);});}

async function assertVacant(client:PoolClient,p:string,ids:string[]) {
 const {rows}=await client.query(`SELECT s.id FROM leasing.slots s WHERE s.property_id=$1 AND s.id=ANY($2::uuid[]) AND (s.operational_status<>'Trống' OR s.tenant_label<>'' OR EXISTS(SELECT 1 FROM leasing.slot_allocations a WHERE a.slot_id=s.id AND a.released_at IS NULL))`,[p,ids]);
 if(rows.length)throw new WorkspaceError('Mặt bằng đang có cam kết hoặc đang thuê.',409);
}
async function expireHolds(client:PoolClient,p:string) {
 const expired=(await client.query(`UPDATE leasing.reservations SET status='expired',revision=revision+1 WHERE property_id=$1 AND status='active' AND expires_at<=now() RETURNING id`,[p])).rows;
 if(expired.length)await client.query(`UPDATE leasing.slot_allocations SET released_at=now() WHERE reservation_id=ANY($1::uuid[]) AND released_at IS NULL`,[expired.map(r=>r.id)]);
}
async function createSpace(client:PoolClient,p:string,floor:number,ids:string[],name:string,isGroup=false) {
 const members=(await client.query(`SELECT s.id,s.floor_id,v.id AS version_id,m.area_m2,v.plan_version_id FROM leasing.slots s JOIN leasing.floors f ON f.id=s.floor_id JOIN LATERAL(SELECT * FROM leasing.slot_versions WHERE slot_id=s.id ORDER BY version_number DESC LIMIT 1)v ON true JOIN leasing.slot_measurements m ON m.slot_version_id=v.id AND m.area_kind='commercial_reference' WHERE s.property_id=$1 AND f.floor_number=$2 AND s.id=ANY($3::uuid[]) AND s.retired_at IS NULL ORDER BY s.display_order`,[p,floor,ids])).rows;
 if(members.length!==ids.length)throw new WorkspaceError('Slot không thuộc tầng đã chọn.');
 if(ids.length>1) {
  const connections=(await client.query(`SELECT slot_a_id,slot_b_id FROM leasing.slot_connections WHERE property_id=$1 AND approval_state='approved' AND slot_a_id=ANY($2::uuid[]) AND slot_b_id=ANY($2::uuid[])`,[p,ids])).rows;
  const reached=new Set([ids[0]]);let changed=true;while(changed){changed=false;for(const c of connections)if(reached.has(c.slot_a_id)||reached.has(c.slot_b_id)){const before=reached.size;reached.add(c.slot_a_id);reached.add(c.slot_b_id);changed||=before!==reached.size;}}
  if(reached.size!==ids.length)throw new WorkspaceError('Chưa có cạnh nối được phê duyệt cho các slot này. Không suy diễn topology từ số thứ tự.',409);
 }
 const area=members.reduce((sum,m)=>sum+Number(m.area_m2),0),id=crypto.randomUUID(),version=crypto.randomUUID();
 await client.query(`INSERT INTO leasing.spaces(id,property_id,floor_id,code,display_name,is_admin_group) VALUES($1::uuid,$2,$3,$1::uuid::text,$4,$5)`,[id,p,members[0].floor_id,name,isGroup]);
 await client.query(`INSERT INTO leasing.space_versions(id,property_id,floor_id,space_id,version_number,area_m2,area_basis,measurement_state,geometry,frontage_snapshot,inventory_basis) VALUES($1,$2,$3,$4,1,$5,'Brochure reference','provisional',NULL,'[]','approved_brochure')`,[version,p,members[0].floor_id,id,area]);
 for(const m of members)await client.query(`INSERT INTO leasing.space_members(space_version_id,property_id,floor_id,slot_id,slot_version_id) VALUES($1,$2,$3,$4,$5)`,[version,p,m.floor_id,m.id,m.version_id]);
 return {id,version,area};
}
async function saveWebsite(client:PoolClient,p:string,v:WebsiteSettings) {
 const logo=(await client.query(`SELECT dv.id FROM leasing.document_versions dv JOIN leasing.documents d ON d.id=dv.document_id JOIN leasing.media_object_state os ON os.document_version_id=dv.id WHERE dv.id=$1 AND dv.property_id=$2 AND dv.storage_provider='neon' AND dv.content_type LIKE 'image/%' AND dv.scan_state='clean' AND os.state='ready' AND d.classification='public_media'`,[v.logoMediaId,p])).rows;
 if(!logo.length)throw new WorkspaceError('Logo phải là ảnh đã lưu trên Neon.');
 await client.query(`UPDATE leasing.website_settings SET logo_media_id=$2,email=$3,hotline=$4,secondary_phone=$5,management_phone=$6,address=$7,zalo_url=$8 WHERE property_id=$1`,[p,v.logoMediaId,v.email,v.hotline,v.secondaryPhone,v.managementPhone,v.address,v.zaloUrl]);
}

async function recordDocument(client:PoolClient,identity:AdminIdentity,leaseId:string,mediaId:string) {
 const p=identity.propertyId;
 const lease=(await client.query('SELECT * FROM leasing.leases WHERE id=$1 AND property_id=$2',[leaseId,p])).rows[0];
 if(!lease)throw new WorkspaceError('Không tìm thấy hợp đồng.');
 const doc=(await client.query(`SELECT dv.*,d.classification,d.organization_id FROM leasing.document_versions dv JOIN leasing.documents d ON d.id=dv.document_id JOIN leasing.media_object_state os ON os.document_version_id=dv.id WHERE dv.id=$1 AND dv.property_id=$2 AND os.state='ready' FOR UPDATE OF dv,d`,[mediaId,p])).rows[0];
 if(!doc||doc.content_type!=='application/pdf'||(!doc.manual_reviewed_by&&doc.scan_state!=='clean')||!doc.sealed_at||doc.storage_provider!=='r2'||!['business_private','contract_private'].includes(doc.classification)||(doc.organization_id&&doc.organization_id!==lease.organization_id))throw new WorkspaceError('Cần PDF private đã được duyệt thủ công hoặc quét sạch, đúng doanh nghiệp. Không chứng nhận chữ ký.');
 if((await client.query('SELECT 1 FROM leasing.lease_documents ld JOIN leasing.lease_versions lv ON lv.id=ld.lease_version_id WHERE ld.document_version_id=$1 AND lv.lease_id<>$2',[mediaId,leaseId])).rows.length)throw new WorkspaceError('Tệp đã liên kết hợp đồng khác.');
 await client.query("UPDATE leasing.documents SET organization_id=$1,classification='contract_private' WHERE id=$2",[lease.organization_id,doc.document_id]);
 const company=(await client.query('SELECT legal_name,registration_number FROM leasing.organizations WHERE id=$1',[lease.organization_id])).rows[0];
 const version=crypto.randomUUID();
 await client.query(`INSERT INTO leasing.lease_versions(id,lease_id,property_id,version_number,document_kind,contractual_period,party_snapshot,space_snapshot) SELECT $1::uuid,$2::uuid,$3::uuid,coalesce(max(version_number),0)+1,CASE WHEN count(*)=0 THEN 'original' ELSE 'amendment' END,$4::daterange,$5::jsonb,$6::jsonb FROM leasing.lease_versions WHERE lease_id=$2::uuid`,[version,leaseId,p,lease.occupancy_period,JSON.stringify([{organizationId:lease.organization_id,name:company.legal_name}]),JSON.stringify({spaceVersionId:lease.space_version_id})]);
 await client.query("INSERT INTO leasing.lease_documents(lease_version_id,document_version_id,property_id,purpose) VALUES($1,$2,$3,'recorded_original')",[version,mediaId,p]);
 await client.query('UPDATE leasing.lease_versions SET recorded_at=now(),recorded_by=$2 WHERE id=$1',[version,identity.id]);
}
async function applyCommand(client:PoolClient,identity:AdminIdentity,c:AdminCommand,data:AdminSnapshot):Promise<string> {
 const p=identity.propertyId;
 switch(c.type) {
 case 'update-floor':await client.query('UPDATE leasing.floors SET purpose=$3,public_title=$4,public_description=$5 WHERE property_id=$1 AND floor_number=$2',[p,c.floor,c.purpose,c.publicTitle,c.publicDescription]);return p;
 case 'update-website-settings':await saveWebsite(client,p,c.values);return p;
 case 'update-settings':await saveWebsite(client,p,c.values.website);await client.query('UPDATE leasing.properties SET name=$2,contact_email=$3,contact_phone=$4,default_hold_hours=$5,appointment_minutes=$6,appointment_location=$7 WHERE id=$1',[p,c.values.propertyName,c.values.contactEmail,c.values.contactPhone,c.values.defaultHoldHours,c.values.appointmentMinutes,c.values.appointmentLocation]);return p;
 case 'merge':{
  if(c.slotIds.length<2)throw new WorkspaceError('Chọn ít nhất hai slot.');
  await assertVacant(client,p,c.slotIds);
  if(data.groups.some(g=>g.slotIds.some(id=>c.slotIds.includes(id))))throw new WorkspaceError('Slot đã thuộc nhóm.');
  return (await createSpace(client,p,c.floor,c.slotIds,c.name,true)).id;
 }
 case 'split':{
  const g=record(data.groups,c.groupId);await assertUncommitted(client,p,g.slotIds);
  await client.query('UPDATE leasing.spaces SET retired_at=now(),revision=revision+1 WHERE id=$1 AND property_id=$2',[g.id,p]);
  await client.query("UPDATE leasing.documents SET media_scope=$1 WHERE property_id=$2 AND media_scope=$3",['Tầng '+g.floor,p,'group:'+g.id]);return g.id;
 }
 case 'update-slot':{
  const s=record(data.slots,c.slotId);await assertUncommitted(client,p,[s.id]);
  if(data.groups.some(g=>g.slotIds.includes(s.id)))throw new WorkspaceError('Cập nhật nhóm thay vì slot thành viên.');
  await client.query('UPDATE leasing.slots SET operational_status=$3,tenant_label=$4,revision=revision+1 WHERE id=$1 AND property_id=$2',[s.id,p,c.status,c.status==='Trống'?'':c.tenant]);
  if(c.area!==undefined&&c.area!==s.area) {
   const v=(await client.query('SELECT * FROM leasing.slot_versions WHERE slot_id=$1 ORDER BY version_number DESC LIMIT 1',[s.id])).rows[0],id=crypto.randomUUID();
   await client.query('INSERT INTO leasing.slot_versions(id,property_id,floor_id,slot_id,plan_version_id,version_number,geometry,technical_spec) VALUES($1,$2,$3,$4,$5,$6,NULL,$7)',[id,p,v.floor_id,s.id,v.plan_version_id,v.version_number+1,v.technical_spec]);
   await client.query("INSERT INTO leasing.slot_measurements(slot_version_id,area_kind,area_m2,source_description,verification_state) VALUES($1,'commercial_reference',$2,'Administrator entered commercial reference; not surveyed','provisional')",[id,c.area]);
   await client.query('INSERT INTO leasing.slot_frontages(slot_version_id,frontage_kind,width_m,azimuth_deg,source_description) SELECT $1,frontage_kind,width_m,azimuth_deg,source_description FROM leasing.slot_frontages WHERE slot_version_id=$2',[id,v.id]);
   for(const pending of data.requests.filter(q=>['submitted','reviewing'].includes(q.status)&&q.slotIds.includes(s.id))) {
    const revised=await createSpace(client,p,pending.floor,pending.slotIds,'Yêu cầu thuê đã cập nhật diện tích');
    await client.query('DELETE FROM leasing.request_spaces WHERE request_id=$1',[pending.id]);
    await client.query('INSERT INTO leasing.request_spaces(property_id,request_id,space_version_id) VALUES($1,$2,$3)',[p,pending.id,revised.version]);
    await client.query('UPDATE leasing.leasing_requests SET revision=revision+1 WHERE id=$1',[pending.id]);
   }
  }return s.id;
 }
 case 'update-group':{
  const g=record(data.groups,c.groupId);await assertUncommitted(client,p,g.slotIds);
  await client.query('UPDATE leasing.spaces SET display_name=$2,revision=revision+1 WHERE id=$1',[g.id,c.name]);
  await client.query("UPDATE leasing.slots SET operational_status=$2,tenant_label=CASE WHEN $2='Trống' THEN '' ELSE tenant_label END,revision=revision+1 WHERE id=ANY($1::uuid[])",[g.slotIds,c.status]);return g.id;
 }
 case 'save-company':record(data.companies,c.companyId);await client.query('UPDATE leasing.organizations SET internal_note=$2 WHERE id=$1',[c.companyId,c.note]);return c.companyId;
 case 'upsert-company':{
  const v=c.values,id=c.companyId??crypto.randomUUID();if(c.companyId)record(data.companies,c.companyId);
  if(c.companyId)await client.query('UPDATE leasing.organizations SET legal_name=$2,industry=$3,account_owner=$4,internal_note=$5,registration_number=$6,registered_address=$7 WHERE id=$1',[id,v.name,v.industry,v.owner,v.note,v.taxId||null,v.address||null]);
  else {await client.query('INSERT INTO leasing.organizations(id,legal_name,industry,account_owner,internal_note,registration_number,registered_address) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,v.name,v.industry,v.owner,v.note,v.taxId||null,v.address||null]);await client.query('INSERT INTO leasing.property_customers(property_id,organization_id) VALUES($1,$2)',[p,id]);}
  const brand=(await client.query('SELECT id FROM leasing.brands WHERE organization_id=$1 ORDER BY created_at LIMIT 1',[id])).rows[0];
  if(brand)await client.query('UPDATE leasing.brands SET name=$2 WHERE id=$1',[brand.id,v.brand]);else await client.query('INSERT INTO leasing.brands(organization_id,name) VALUES($1,$2)',[id,v.brand]);
  const contact=(await client.query('SELECT id FROM leasing.contacts WHERE organization_id=$1 ORDER BY created_at LIMIT 1',[id])).rows[0];
  if(contact)await client.query('UPDATE leasing.contacts SET display_name=$2,email=$3,phone=$4 WHERE id=$1',[contact.id,v.contact,v.email,v.phone]);else await client.query('INSERT INTO leasing.contacts(organization_id,display_name,email,phone) VALUES($1,$2,$3,$4)',[id,v.contact,v.email,v.phone]);return id;
 }
 case 'save-lead':{
  const v=c.values,id=c.leadId??crypto.randomUUID();if(c.leadId)record(data.leads,id);if(v.companyId)record(data.companies,v.companyId);
  if(c.leadId)await client.query('UPDATE leasing.leads SET organization_id=$3,name=$4,interest=$5,floor_number=$6,source=$7,status=$8,note=$9,email=$10,phone=$11 WHERE id=$1 AND property_id=$2',[id,p,v.companyId||null,v.name,v.interest,v.floor,v.source,v.status,v.note,v.email??'',v.phone??'']);
  else await client.query('INSERT INTO leasing.leads(id,property_id,organization_id,name,interest,floor_number,source,status,note,email,phone) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,p,v.companyId||null,v.name,v.interest,v.floor,v.source,v.status,v.note,v.email??'',v.phone??'']);return id;
 }
 case 'save-request':{
  const v=c.values,id=c.requestId??crypto.randomUUID();record(data.companies,v.companyId);
  if(c.requestId&&!['submitted','reviewing'].includes(record(data.requests,id).status))throw new WorkspaceError('Chỉ sửa yêu cầu đang chờ.');
  await assertVacant(client,p,v.slotIds);
  const partial=data.groups.some(g=>g.slotIds.some(id=>v.slotIds.includes(id))&&(g.slotIds.length!==v.slotIds.length||!g.slotIds.every(id=>v.slotIds.includes(id))));if(partial)throw new WorkspaceError('Chọn toàn bộ nhóm.');
  const space=await createSpace(client,p,v.floor,v.slotIds,'Yêu cầu thuê');
  if(c.requestId){await client.query('DELETE FROM leasing.request_spaces WHERE request_id=$1',[id]);await client.query("UPDATE leasing.leasing_requests SET organization_id=$2,requested_period=daterange($3::date,$4::date+1,'[)'),customer_note=$5,revision=revision+1 WHERE id=$1",[id,v.companyId,v.start,v.end,v.note]);}
  else await client.query("INSERT INTO leasing.leasing_requests(id,property_id,organization_id,requested_period,customer_note) VALUES($1,$2,$3,daterange($4::date,$5::date+1,'[)'),$6)",[id,p,v.companyId,v.start,v.end,v.note]);
  await client.query('INSERT INTO leasing.request_spaces(property_id,request_id,space_version_id) VALUES($1,$2,$3)',[p,id,space.version]);return id;
 }
 case 'review-request':{
  const q=record(data.requests,c.requestId);if(q.status!=='submitted')throw new WorkspaceError('Yêu cầu đã tiếp nhận.');await client.query("UPDATE leasing.leasing_requests SET status='under_review',revision=revision+1 WHERE id=$1",[q.id]);return q.id;
 }
 case 'reject-request':{
  const q=record(data.requests,c.requestId);if(!['submitted','reviewing'].includes(q.status))throw new WorkspaceError('Yêu cầu đã có quyết định.');await client.query("UPDATE leasing.leasing_requests SET status='rejected',decision_by=$2,decision_at=now(),decision_reason=$3,customer_note=$3,revision=revision+1 WHERE id=$1",[q.id,identity.id,c.reason]);return q.id;
 }
 case 'approve-request':{
  const q=record(data.requests,c.requestId);if(!['submitted','reviewing'].includes(q.status))throw new WorkspaceError('Yêu cầu đã có quyết định.');await assertVacant(client,p,q.slotIds);
  const rs=(await client.query('SELECT * FROM leasing.request_spaces WHERE request_id=$1',[q.id])).rows[0];
  if(!rs)throw new WorkspaceError('Yêu cầu chưa có mặt bằng.');
  await client.query('UPDATE leasing.request_spaces SET acknowledged_at=now() WHERE id=$1',[rs.id]);
  await client.query("UPDATE leasing.leasing_requests SET status='approved',decision_by=$2,decision_at=now(),revision=revision+1 WHERE id=$1",[q.id,identity.id]);
  const id=crypto.randomUUID();await client.query("INSERT INTO leasing.reservations(id,property_id,organization_id,request_id,request_space_id,occupancy_period,expires_at,approved_by,internal_note) SELECT $1,property_id,organization_id,id,$2,requested_period,now()+$3*interval '1 hour',$4,$5 FROM leasing.leasing_requests WHERE id=$6",[id,rs.id,c.holdHours,identity.id,c.note,q.id]);
  await client.query('INSERT INTO leasing.slot_allocations(property_id,slot_id,reservation_id,occupancy_period) SELECT r.property_id,m.slot_id,r.id,r.occupancy_period FROM leasing.reservations r JOIN leasing.space_members m ON m.space_version_id=$2 WHERE r.id=$1',[id,rs.space_version_id]);
  if(q.slotIds.length>1&&!data.groups.some(g=>g.slotIds.every(id=>q.slotIds.includes(id))&&g.slotIds.length===q.slotIds.length))await client.query('UPDATE leasing.spaces SET is_admin_group=true WHERE id=(SELECT space_id FROM leasing.space_versions WHERE id=$1)',[rs.space_version_id]);return id;
 }
 case 'cancel-hold':{
  const h=record(data.reservations,c.reservationId);if(h.status!=='active')throw new WorkspaceError('Giữ chỗ đã kết thúc.');await client.query("UPDATE leasing.reservations SET status='cancelled',internal_note=$2,revision=revision+1 WHERE id=$1",[h.id,c.reason]);await client.query('UPDATE leasing.slot_allocations SET released_at=now() WHERE reservation_id=$1 AND released_at IS NULL',[h.id]);return h.id;
 }
 case 'record-lease':{
  const h=record(data.reservations,c.reservationId);if(h.status!=='active'||Date.parse(h.expiresAt)<=Date.now())throw new WorkspaceError('Giữ chỗ hết hạn hoặc đã kết thúc.');
  const id=crypto.randomUUID();await client.query("INSERT INTO leasing.leases(id,property_id,organization_id,reservation_id,space_version_id,reference_number,occupancy_period) SELECT $1::uuid,r.property_id,r.organization_id,r.id,rs.space_version_id,$1::uuid::text,r.occupancy_period FROM leasing.reservations r JOIN leasing.request_spaces rs ON rs.id=r.request_space_id WHERE r.id=$2",[id,h.id]);
  await recordDocument(client,identity,id,c.mediaId);
  await client.query("UPDATE leasing.reservations SET status='converted',revision=revision+1 WHERE id=$1",[h.id]);await client.query('UPDATE leasing.slot_allocations SET reservation_id=NULL,lease_id=$2 WHERE reservation_id=$1 AND released_at IS NULL',[h.id,id]);await client.query("UPDATE leasing.leases SET status='executed',revision=revision+1 WHERE id=$1",[id]);return id;
 }
 case 'attach-lease-document':record(data.leases,c.leaseId);await recordDocument(client,identity,c.leaseId,c.mediaId);return c.leaseId;
 case 'save-appointment':{
  const v=c.values,id=c.appointmentId??crypto.randomUUID();record(data.companies,v.companyId);if(c.appointmentId&&record(data.appointments,id).status==='cancelled')throw new WorkspaceError('Không sửa lịch đã hủy.');
  if(Date.parse(v.startsAt)<=Date.now())throw new WorkspaceError('Chọn lịch trong tương lai.');
  if((await client.query("SELECT 1 FROM leasing.appointments WHERE property_id=$1 AND id<>$2 AND status<>'cancelled' AND scheduled_period&&tstzrange($3::timestamptz,$3::timestamptz+$4*interval '1 minute','[)')",[p,id,v.startsAt,v.durationMinutes])).rows.length)throw new WorkspaceError('Khung giờ đã có lịch.',409);
  if(c.appointmentId)await client.query("UPDATE leasing.appointments SET organization_id=$2,purpose=$3,scheduled_period=tstzrange($4::timestamptz,$4::timestamptz+$5*interval '1 minute','[)'),meeting_location=$6,revision=revision+1 WHERE id=$1",[id,v.companyId,v.purpose,v.startsAt,v.durationMinutes,v.location]);
  else await client.query("INSERT INTO leasing.appointments(id,property_id,organization_id,purpose,scheduled_period,meeting_location) VALUES($1,$2,$3,$4,tstzrange($5::timestamptz,$5::timestamptz+$6*interval '1 minute','[)'),$7)",[id,p,v.companyId,v.purpose,v.startsAt,v.durationMinutes,v.location]);return id;
 }
 case 'confirm-appointment':{
  const a=record(data.appointments,c.appointmentId);if(a.status!=='requested'||Date.parse(a.startsAt)<=Date.now())throw new WorkspaceError('Chỉ xác nhận lịch chờ trong tương lai.');await client.query("UPDATE leasing.appointments SET status='confirmed',revision=revision+1 WHERE id=$1",[a.id]);return a.id;
 }
 case 'cancel-appointment':{
  const a=record(data.appointments,c.appointmentId);if(a.status==='cancelled')throw new WorkspaceError('Lịch đã hủy.');await client.query("UPDATE leasing.appointments SET status='cancelled',revision=revision+1 WHERE id=$1",[a.id]);return a.id;
 }
 case 'delete-media':await deleteMedia(client,identity,c.mediaId);return c.mediaId;
 case 'rename-media':await renameMedia(client,identity,c.mediaId,c.name);return c.mediaId;
 case 'link-media':await linkMedia(client,identity,c.mediaId,c.scope);return c.mediaId;
 }
}
async function assertUncommitted(client:PoolClient,p:string,ids:string[]) {
 if((await client.query('SELECT 1 FROM leasing.slot_allocations WHERE property_id=$1 AND slot_id=ANY($2::uuid[]) AND released_at IS NULL',[p,ids])).rows.length)throw new WorkspaceError('Slot đang có cam kết.',409);
}
export async function executeCommand(identity:AdminIdentity,input:{command:unknown;expectedRevision:number;idempotencyKey:string}):Promise<AdminSnapshot> {
 if(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||typeof input.idempotencyKey!=='string'||!/^[A-Za-z0-9_-]{16,100}$/.test(input.idempotencyKey))throw new WorkspaceError('Invalid revision or idempotency key');
 let command:AdminCommand;try{command=parseAdminCommand(input.command);}catch(error){throw new WorkspaceError(error instanceof Error?error.message:'Invalid command');}
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({command,expectedRevision:input.expectedRevision}))),hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
 return withTransaction(identity.id,async client=>{
  await assertAdmin(client,identity);
  const property=(await client.query('SELECT workspace_revision FROM leasing.properties WHERE id=$1 FOR UPDATE',[identity.propertyId])).rows[0];
  const receipt=(await client.query('SELECT request_sha256 FROM leasing.command_receipts WHERE property_id=$1 AND actor_user_id=$2 AND idempotency_key=$3',[identity.propertyId,identity.id,input.idempotencyKey])).rows[0];
  if(receipt){if(receipt.request_sha256!==hash)throw new WorkspaceError('Idempotency key reused with different command',409);return readWorkspaceInTransaction(client,identity);}
  if(!property||Number(property.workspace_revision)!==input.expectedRevision)throw new WorkspaceError('Workspace revision conflict',409);
  await expireHolds(client,identity.propertyId);
  const snapshot=await readWorkspaceInTransaction(client,identity);let entity:string;
  try{entity=await applyCommand(client,identity,command,snapshot);}catch(error){if(error instanceof AdminValidationError)throw new WorkspaceError(error.message);throw error;}
  await client.query('UPDATE leasing.properties SET workspace_revision=workspace_revision+1 WHERE id=$1',[identity.propertyId]);
  await client.query('INSERT INTO leasing.command_receipts(property_id,actor_user_id,idempotency_key,request_sha256,command_code,result_entity_id,result_revision) VALUES($1,$2,$3,$4,$5,$6,$7)',[identity.propertyId,identity.id,input.idempotencyKey,hash,command.type,entity,input.expectedRevision+1]);
  await client.query("INSERT INTO leasing.audit_events(property_id,actor_user_id,action_code,entity_type,entity_id,metadata) VALUES($1,$2,$3,'workspace',$4,$5::jsonb)",[identity.propertyId,identity.id,command.type,entity,JSON.stringify({revision:input.expectedRevision+1})]);
  return readWorkspaceInTransaction(client,identity);
 });
}

