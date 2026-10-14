import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Pool } from "@neondatabase/serverless";
import { BROCHURE_UNITS } from "../src/features/public/brochure-leasing";
import { DEFAULT_FLOOR_CONTENT } from "../src/shared/admin/space-model";
import { DEFAULT_WEBSITE_SETTINGS } from "../src/shared/admin/website-defaults";

export async function migrateDatabase(connectionString:string) {
 if(new URL(connectionString).hostname.includes('-pooler'))throw new Error('Migrations require a direct DATABASE_URL');
 const pool=new Pool({connectionString,max:1}),client=await pool.connect();
 try {
  await client.query("SELECT pg_advisory_lock(hashtext('le-grande:migrations'))");
  const baseline=await client.query("SELECT to_regclass('leasing.properties') AS present");
  if(!baseline.rows[0].present)await client.query(await readFile('database/schema.sql','utf8'));
  await client.query('CREATE TABLE IF NOT EXISTS leasing.schema_migrations(name text PRIMARY KEY,sha256 char(64) NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
  for(const name of (await readdir('database/migrations')).filter(name=>/^\d{3}[-\w]*\.sql$/.test(name)).sort()) {
   const sql=await readFile('database/migrations/'+name,'utf8'),hash=createHash('sha256').update(sql).digest('hex'),previous=await client.query('SELECT sha256 FROM leasing.schema_migrations WHERE name=$1',[name]);
   if(previous.rows[0]){if(previous.rows[0].sha256!==hash)throw new Error('Applied migration changed: '+name);continue;}
   await client.query(sql);await client.query('INSERT INTO leasing.schema_migrations(name,sha256) VALUES($1,$2)',[name,hash]);
  }
  await client.query('BEGIN');await client.query("SELECT set_config('app.actor_id','system:approved-brochure-seed',true)");
  let property=(await client.query("SELECT id FROM leasing.properties WHERE code='le-grande-centre' FOR UPDATE")).rows[0];
  if(!property) {
   const owner=(await client.query("INSERT INTO leasing.organizations(legal_name) VALUES('Le Grande Centre') RETURNING id")).rows[0];
   property=(await client.query("INSERT INTO leasing.properties(code,name,owner_organization_id,contact_email,contact_phone,appointment_location) VALUES('le-grande-centre','Le Grande Centre',$1,$2,$3,'Le Grande Centre') RETURNING id",[owner.id,DEFAULT_WEBSITE_SETTINGS.email,DEFAULT_WEBSITE_SETTINGS.hotline])).rows[0];
  }
  const p=property.id,w=DEFAULT_WEBSITE_SETTINGS;
  await client.query('INSERT INTO leasing.website_settings(property_id,email,hotline,secondary_phone,management_phone,address,zalo_url) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(property_id) DO NOTHING',[p,w.email,w.hotline,w.secondaryPhone,w.managementPhone,w.address,w.zaloUrl]);
  await client.query("INSERT INTO leasing.admin_allowlist(property_id,email) VALUES($1,'nguyenbang.skyone@gmail.com') ON CONFLICT DO NOTHING",[p]);
  await client.query("INSERT INTO leasing.users(auth_issuer,auth_subject,disabled_at) VALUES('system:asset-import','approved-project-assets',now()) ON CONFLICT(auth_issuer,auth_subject) DO NOTHING");
  const importer=(await client.query("SELECT id FROM leasing.users WHERE auth_issuer='system:asset-import' AND auth_subject='approved-project-assets'")).rows[0];
  for(const content of DEFAULT_FLOOR_CONTENT) {
   await client.query('INSERT INTO leasing.floors(property_id,floor_number,name,purpose,public_title,public_description) VALUES($1,$2,$3,$4,$4,$5) ON CONFLICT(property_id,floor_number) DO NOTHING',[p,content.number,'Tầng '+content.number,content.publicTitle,content.publicDescription]);
   const floor=(await client.query('SELECT id FROM leasing.floors WHERE property_id=$1 AND floor_number=$2',[p,content.number])).rows[0];
   await client.query("INSERT INTO leasing.plan_versions(property_id,floor_id,version_number,coordinate_system) VALUES($1,$2,1,'brochure-reference-no-survey-geometry') ON CONFLICT(floor_id,version_number) DO NOTHING",[p,floor.id]);
   const plan=(await client.query('SELECT id FROM leasing.plan_versions WHERE floor_id=$1 AND version_number=1',[floor.id])).rows[0];
   for(const unit of BROCHURE_UNITS.filter(u=>u.floorId===content.number)) {
    const existing=await client.query('SELECT id FROM leasing.slots WHERE floor_id=$1 AND code=$2',[floor.id,unit.id]);if(existing.rows.length)continue;
    const slot=(await client.query('INSERT INTO leasing.slots(property_id,floor_id,code,display_order) VALUES($1,$2,$3,$4) RETURNING id',[p,floor.id,unit.id,Number(unit.id.split('.')[1])])).rows[0];
    const version=(await client.query('INSERT INTO leasing.slot_versions(property_id,floor_id,slot_id,plan_version_id,version_number,geometry,technical_spec) VALUES($1,$2,$3,$4,1,NULL,$5::jsonb) RETURNING id',[p,floor.id,slot.id,plan.id,JSON.stringify({brochureDiagram:unit.plan,dimensions:unit.dimensions??null,sourcePage:content.number+4,coordinateMeaning:'diagram-only-not-surveyed'})])).rows[0];
    await client.query("INSERT INTO leasing.slot_measurements(slot_version_id,area_kind,area_m2,source_description,verification_state) VALUES($1,'commercial_reference',$2,$3,'provisional')",[version.id,unit.area,'Approved project brochure page '+(content.number+4)+'; printed commercial reference, not survey']);
    if(unit.dimensions?.width)await client.query("INSERT INTO leasing.slot_frontages(slot_version_id,frontage_kind,width_m,source_description) VALUES($1,'external',$2,'Printed brochure width; no inferred azimuth')",[version.id,unit.dimensions.width]);
    const space=(await client.query('INSERT INTO leasing.spaces(property_id,floor_id,code,display_name) VALUES($1,$2,$3,$3) RETURNING id',[p,floor.id,unit.id])).rows[0];
    const sv=(await client.query("INSERT INTO leasing.space_versions(property_id,floor_id,space_id,version_number,area_m2,area_basis,measurement_state,geometry,frontage_snapshot,inventory_basis) VALUES($1,$2,$3,1,$4,'Approved brochure commercial reference','provisional',NULL,'[]','approved_brochure') RETURNING id",[p,floor.id,space.id,unit.area])).rows[0];
    await client.query('INSERT INTO leasing.space_members(space_version_id,property_id,floor_id,slot_id,slot_version_id) VALUES($1,$2,$3,$4,$5)',[sv.id,p,floor.id,slot.id,version.id]);
   }
   const inventory=(await client.query('SELECT id,code FROM leasing.slots WHERE floor_id=$1',[floor.id])).rows;
   const units=BROCHURE_UNITS.filter(u=>u.floorId===content.number);
   for(const a of units)for(const b of units) {
    if(a.id===b.id||a.plan.polygon||b.plan.polygon||Math.abs(a.plan.y-b.plan.y)>.001||Math.abs(a.plan.height-b.plan.height)>.001||Math.abs(a.plan.x+a.plan.width-b.plan.x)>.001)continue;
    const left=inventory.find(s=>s.code===a.id),right=inventory.find(s=>s.code===b.id);if(!left||!right)throw new Error('Brochure inventory missing');
    const pair=[left.id,right.id].sort();
    await client.query("INSERT INTO leasing.slot_connections(property_id,floor_id,slot_a_id,slot_b_id,approval_state,technical_conditions,approved_by) VALUES($1,$2,$3,$4,'approved',$5,$6) ON CONFLICT(slot_a_id,slot_b_id) DO NOTHING",[p,floor.id,pair[0],pair[1],'Approved brochure page '+(content.number+4)+' shared boundary in the same diagram row. Diagram coordinates only; not surveyed geometry or structural permission to remove walls.',importer.id]);
   }

  }
  await client.query('COMMIT');
  console.log('Relational migrations and approved brochure content initialized; no customer transactions seeded.');
 } catch(error){await client.query('ROLLBACK');throw error;}finally{await client.query("SELECT pg_advisory_unlock(hashtext('le-grande:migrations'))").catch(()=>{});client.release();await pool.end();}
}
export async function importApprovedLogo(connectionString:string,metadata:{publicUrl:string;bytes:number;sha256:string}) {
 if(!Number.isSafeInteger(metadata.bytes)||metadata.bytes<=0||!/^[a-f0-9]{64}$/.test(metadata.sha256))throw new Error('Verified logo byte count and SHA-256 required');
 const url=new URL(metadata.publicUrl);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!url.pathname.endsWith('/client-reference/legacy/logo-without-text.png'))throw new Error('Expected approved Neon logo URL');
 const pool=new Pool({connectionString,max:1}),client=await pool.connect();
 try {
  await client.query('BEGIN');await client.query("SELECT set_config('app.actor_id','system:approved-logo-import',true)");
  const p=(await client.query("SELECT id FROM leasing.properties WHERE code='le-grande-centre' FOR UPDATE")).rows[0];if(!p)throw new Error('Seed approved property first');
  await client.query("INSERT INTO leasing.users(auth_issuer,auth_subject,disabled_at) VALUES('system:asset-import','approved-project-assets',now()) ON CONFLICT(auth_issuer,auth_subject) DO NOTHING");
  const uploader=(await client.query("SELECT id FROM leasing.users WHERE auth_issuer='system:asset-import' AND auth_subject='approved-project-assets'")).rows[0];
  let version=(await client.query("SELECT id,sha256,byte_size FROM leasing.document_versions WHERE storage_provider='neon' AND bucket_name='media' AND object_key='client-reference/legacy/logo-without-text.png'")).rows[0];
  if(version&&(version.sha256!==metadata.sha256||Number(version.byte_size)!==metadata.bytes))throw new Error('Stored approved logo metadata differs from verified object');
  if(!version){
   const doc=(await client.query("INSERT INTO leasing.documents(property_id,classification,title) VALUES($1,'public_media','Le Grande Centre logo') RETURNING id",[p.id])).rows[0];
   version=(await client.query("INSERT INTO leasing.document_versions(property_id,document_id,version_number,storage_provider,bucket_name,object_key,content_type,byte_size,sha256,scan_state,original_filename,uploaded_by,public_url) VALUES($1,$2,1,'neon','media','client-reference/legacy/logo-without-text.png','image/png',$3,$4,'clean','logo-without-text.png',$5,$6) RETURNING id",[p.id,doc.id,metadata.bytes,metadata.sha256,uploader.id,metadata.publicUrl])).rows[0];
   await client.query("INSERT INTO leasing.media_object_state(document_version_id,property_id,state) VALUES($1,$2,'ready')",[version.id,p.id]);
   await client.query('INSERT INTO leasing.media_storage(property_id,used_bytes) VALUES($1,$2) ON CONFLICT(property_id) DO UPDATE SET used_bytes=leasing.media_storage.used_bytes+excluded.used_bytes',[p.id,metadata.bytes]);
   await client.query("INSERT INTO leasing.audit_events(property_id,system_actor,action_code,entity_type,entity_id) VALUES($1,'system:approved-logo-import','media.approved-project-import','document',$2)",[p.id,doc.id]);
  }
  await client.query('UPDATE leasing.website_settings SET logo_media_id=$2 WHERE property_id=$1',[p.id,version.id]);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await pool.end();}
}
if(process.argv[1]?.endsWith("migrate-database.ts")) { const connection=process.env.DATABASE_URL_UNPOOLED;if(!connection)throw new Error("DATABASE_URL_UNPOOLED is required for migrations");await migrateDatabase(connection);if(process.env.APPROVED_LOGO_URL)await importApprovedLogo(connection,{publicUrl:process.env.APPROVED_LOGO_URL,bytes:Number(process.env.APPROVED_LOGO_BYTES),sha256:process.env.APPROVED_LOGO_SHA256??""}); }

