import "server-only";
import type { PublicWebsite, ContactSubmission } from "../shared/public/contracts";
import { withTransaction, WorkspaceError } from "./database";
import { readSettings, readFloors, readSlots } from "./workspace";
import { parseContactInput } from "./contact-input";
export async function readPublicWebsite():Promise<PublicWebsite> {
 return withTransaction('public:read',async client=>{
  const property=(await client.query("SELECT id FROM leasing.properties WHERE code='le-grande-centre' FOR SHARE")).rows[0];if(!property)throw new WorkspaceError('Website has not been initialized',503);
  const p=property.id,{settings}=await readSettings(client,p),floors=await readFloors(client,p),slots=await readSlots(client,p);
  let logoUrl:string|null=null;
  if(settings.website.logoMediaId) {
   const logo=(await client.query("SELECT dv.public_url FROM leasing.document_versions dv JOIN leasing.documents d ON d.id=dv.document_id JOIN leasing.media_object_state os ON os.document_version_id=dv.id WHERE dv.id=$1 AND dv.property_id=$2 AND dv.storage_provider='neon' AND dv.scan_state='clean' AND dv.content_type LIKE 'image/%' AND dv.deleted_at IS NULL AND os.state='ready' AND d.classification='public_media'",[settings.website.logoMediaId,p])).rows[0];logoUrl=logo?.public_url??null;
  }
  return {website:settings.website,logoUrl,floors:floors.map(({number,publicTitle,publicDescription})=>({number,publicTitle,publicDescription})),units:slots.map(({id,code,floor,area,status})=>({id,code,floor,area,status}))};
 });
}
export async function submitContact(input:ContactSubmission,options:{idempotencyKey:string;ipHash:string}):Promise<{accepted:true;id:string}> {
 let fields:ContactSubmission;try{fields=parseContactInput(input);}catch(error){throw new WorkspaceError(error instanceof Error?error.message:'Invalid contact');}
 if(!/^[A-Za-z0-9_-]{16,100}$/.test(options.idempotencyKey)||!/^[a-f0-9]{64}$/.test(options.ipHash))throw new WorkspaceError('Invalid intake identity');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(fields))),hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 return withTransaction('public:intake',async client=>{
  const property=(await client.query("SELECT id FROM leasing.properties WHERE code='le-grande-centre' FOR UPDATE")).rows[0];if(!property)throw new WorkspaceError('Website has not been initialized',503);
  const p=property.id,receipt=(await client.query('SELECT id,request_sha256 FROM leasing.contact_intake WHERE idempotency_key=$1 AND property_id=$2',[options.idempotencyKey,p])).rows[0];
  if(receipt){if(receipt.request_sha256!==hash)throw new WorkspaceError('Intake key reused',409);return {accepted:true,id:receipt.id};}
  const rate=(await client.query("SELECT count(*) FILTER(WHERE created_at>now()-interval '5 minutes') AS recent,count(*) AS daily FROM leasing.contact_intake WHERE property_id=$1 AND ip_hash=$2 AND created_at>now()-interval '24 hours'",[p,options.ipHash])).rows[0];
  if(Number(rate.recent)>0||Number(rate.daily)>=20)throw new WorkspaceError('Vui lòng chờ năm phút trước khi gửi yêu cầu khác.',429);
  let floor=1;
  if(fields.unitId){const slot=(await client.query('SELECT f.floor_number FROM leasing.slots s JOIN leasing.floors f ON f.id=s.floor_id WHERE s.property_id=$1 AND s.code=$2 AND s.retired_at IS NULL',[p,fields.unitId])).rows[0];if(!slot)throw new WorkspaceError('Mặt bằng không tồn tại.');floor=slot.floor_number;}
  const lead=crypto.randomUUID(),id=crypto.randomUUID(),interest=[fields.intent,fields.business,fields.area].filter(Boolean).join(' · ');
  await client.query("INSERT INTO leasing.leads(id,property_id,name,interest,floor_number,source,status,note,email,phone) VALUES($1,$2,$3,$4,$5,'Form website','Mới',$6,$7,$8)",[lead,p,fields.name,interest,floor,fields.note,fields.email,fields.phone]);
  await client.query('INSERT INTO leasing.contact_intake(id,property_id,idempotency_key,request_sha256,ip_hash,lead_id,intent,company_name,business,area_preference,timing,space_code,scope,visit_date,visit_time) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',[id,p,options.idempotencyKey,hash,options.ipHash,lead,fields.intent,fields.company,fields.business,fields.area,fields.timing,fields.unitId??fields.space,fields.scope??null,fields.visitDate??null,fields.visitTime??null]);
  await client.query('UPDATE leasing.properties SET workspace_revision=workspace_revision+1 WHERE id=$1',[p]);
  await client.query("INSERT INTO leasing.audit_events(property_id,system_actor,action_code,entity_type,entity_id) VALUES($1,'public:intake','contact.submit','lead',$2)",[p,lead]);
  // A visit request is a lead/intake record, not a booked appointment or a fabricated company.
  return {accepted:true,id};
 });
}
