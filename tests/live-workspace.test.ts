import test from "node:test";
import assert from "node:assert/strict";
import { parseAdminCommand } from "../src/shared/admin/parse-command";
import { mergeIssue } from "../src/shared/admin/space-model";
import { getDatabase, resolveAdminIdentity, withAdminTransaction, withTransaction, WorkspaceError, type AdminIdentity } from "../src/server/database";
import { executeCommand } from "../src/server/workspace";
import { readAdminScreen, parseScreenQuery } from "../src/server/admin-screens";
import { readMediaDetail, readMediaPage } from "../src/server/media/queries";
import { uploadMedia, reviewMedia, reconcileMedia } from "../src/server/media/repository";
import { prepareFiles } from "../src/server/media/prepare";
import { sha256 } from "../src/server/media/neon-origin";
import { AdminSessionError } from "../src/server/admin-session";
import { listStaffAccounts, revokeStaffAccount, saveStaffAccount } from "../src/server/staff-accounts";
import { submitContact } from "../src/server/public";
import { readPublicWebsiteData } from "../src/server/public-data";
import { createAdminCrudServices } from "../src/server/admin-crud";
import { BackendError } from "@shared/backend";
import type { AdminCommand } from "../src/shared/admin/contracts";
import { verifyOwnedLocalDatabase } from "../scripts/local-database-guard.mjs";
import { parseCollectionName, parseCollectionQuery, readAdminCollection, readAdminCollectionItem } from "../src/server/admin-collections";

// Test-only aggregation lets existing cross-screen invariant assertions share a fixture.
// Production has no aggregate endpoint or aggregate mutation response.
async function readWorkspace(identity: AdminIdentity) {
 const floors=await readAdminScreen(identity,"floors"),settings=await readAdminScreen(identity,"settings");
 const spaces=await Promise.all(([1,2,3,4,5,6] as const).map(floor=>readAdminScreen(identity,"spaces",{floor})));
 const requests=await readAdminScreen(identity,"requests",{pageSize:100}),leases=await readAdminScreen(identity,"leases",{pageSize:100});
 const companies=await readAdminCollection(identity,"companies",{}),leads=await readAdminCollection(identity,"leads",{}),appointments=await readAdminCollection(identity,"appointments",{});
 const media=await readMediaPage(identity,{pageSize:100});
 return {revision:floors.revision,floors:floors.floors,settings:settings.settings,slots:spaces.flatMap(item=>item.slots),groups:spaces.flatMap(item=>item.groups),requests:requests.requests,reservations:requests.reservations,leases:leases.leases,companies:companies.items,leads:leads.items,appointments:appointments.items,media:media.items,storage:media.storage,collections:{companies,leads,appointments}};
}
// Mutating regressions require the owned local PostgreSQL wrapper, never an arbitrary DATABASE_URL.
test("bounded commands reject extra fields, invalid types and fabricated adjacency", () => {
 const id=crypto.randomUUID();
 for(const value of [{type:'delete-media',mediaId:id,propertyId:id},{type:'update-slot',slotId:id,status:'Đang chọn',tenant:''},{type:'merge',floor:2,slotIds:[id,id],name:'x'},{type:'approve-request',requestId:id,holdHours:721,note:''},{type:'save-company',companyId:id,note:'x'.repeat(601)},{type:'save-request',values:null},{type:'constructor'}]) assert.throws(()=>parseAdminCommand(value));
 const a={id:'a',floor:1 as const,code:'A.1',order:1,side:null,area:190,width:10,status:'Trống' as const,tenant:''},b={...a,id:'b',code:'A.2',order:2};
 assert.notEqual(mergeIssue([a,b],[],['a','b'],1),null);
 assert.equal(mergeIssue([{...a,connectedSlotIds:['b']},{...b,connectedSlotIds:['a']}],[],['a','b'],1),null);
});

test("collection input rejects unbounded, duplicate and unsupported filters", () => {
 assert.throws(()=>parseCollectionName("media"));
 for(const query of ["page=0","page=1&page=2","pageSize=101","page=9007199254740991&pageSize=100","query="+"x".repeat(201),"ids=not-a-uuid","companyId=not-a-uuid","status=unknown","unexpected=true"]){
  assert.throws(()=>parseCollectionQuery("leads",new URLSearchParams(query)));
 }
 assert.throws(()=>parseCollectionQuery("companies",new URLSearchParams("status=Mới")));
 assert.throws(()=>parseCollectionQuery("companies",new URLSearchParams("companyId="+crypto.randomUUID())));
 assert.deepEqual(parseCollectionQuery("companies",new URLSearchParams()),{page:1,pageSize:20});
 const ids=[crypto.randomUUID(),crypto.randomUUID()];
 assert.deepEqual(parseCollectionQuery("companies",new URLSearchParams({ids:ids.join(",")})),{page:1,pageSize:2,ids});
});

test("screen boundaries reject unsupported dependencies and legacy document commands", () => {
 for(const query of ["page=0","pageSize=101","floor=7","id=invalid","status=unknown","page=1&page=2","query=%00"])assert.throws(()=>parseScreenQuery("requests",new URLSearchParams(query)));
 for(const query of ["page=1","companyId="+crypto.randomUUID(),"query=company"])assert.throws(()=>parseScreenQuery("floors",new URLSearchParams(query)));
 assert.throws(()=>parseScreenQuery("slot",new URLSearchParams()));
 assert.throws(()=>parseAdminCommand({type:"attach-lease-document",leaseId:crypto.randomUUID(),mediaId:crypto.randomUUID()}));
 assert.throws(()=>parseAdminCommand({type:"record-lease",reservationId:crypto.randomUUID(),mediaId:crypto.randomUUID()}));
 assert.equal(parseAdminCommand({type:"record-lease",reservationId:crypto.randomUUID()}).type,"record-lease");
});

test("Local PostgreSQL relational commands: CAS, uncertain-response replay, scope, transitions and public intake", {skip:process.env.RUN_LOCAL_DATABASE_TESTS!=='1'}, async()=>{
 await verifyOwnedLocalDatabase();
 const readDecision=async(statement:string,values:string[])=>{
  const ownerPool=getDatabase();
  try{return (await ownerPool.query(statement,values)).rows[0];}finally{await ownerPool.end();}
 };
 const trusted=(value:AdminIdentity,authSubject:string):AdminIdentity=>({...value,verifiedSession:{issuer,subject:authSubject,expiresAt:Date.now()+3_600_000}});
 const email='workspace-regression-'+crypto.randomUUID()+'@example.test',issuer='https://owned-local-'+process.env.LOCAL_DATABASE_TEST_NONCE+'.invalid',subject=crypto.randomUUID();
 await withTransaction('test:setup',async client=>{const p=(await client.query("SELECT id FROM leasing.properties WHERE code='le-grande-centre'")).rows[0];assert.ok(p);await client.query('INSERT INTO leasing.admin_allowlist(property_id,email) VALUES($1,$2)',[p.id,email]);});
 assert.equal(await resolveAdminIdentity({issuer,subject,email,emailVerified:false}),null);
 const resolved=await resolveAdminIdentity({issuer,subject,email,emailVerified:true});assert.ok(resolved);const identity=trusted(resolved,subject);assert.equal(identity.verifiedSession?.subject,subject);assert.notEqual(identity.verifiedSession?.subject,identity.id);
 assert.equal(await resolveAdminIdentity({issuer,subject:crypto.randomUUID(),email,emailVerified:true}),null);
 const deniedPropertyId=crypto.randomUUID();
 await assert.rejects(readAdminScreen({...identity,propertyId:deniedPropertyId},"floors"),error=>error instanceof WorkspaceError&&error.status===404);
 const beforeDecisions=await readDecision("SELECT count(*)::text AS count FROM leasing.backend_access_decisions WHERE actor_user_id=$1",[identity.id]);
 let data=await readWorkspace(identity);
 const staffEmail='staff-invitation-'+crypto.randomUUID()+'@example.test',staffSubject=crypto.randomUUID();
 const invitation=await saveStaffAccount(identity,staffEmail,'editor');assert.equal(invitation.status,'invited');
 let editor=await resolveAdminIdentity({issuer,subject:staffSubject,email:staffEmail,emailVerified:true});
 assert.equal(editor?.role,'editor');assert.ok(editor);editor=trusted(editor,staffSubject);await readAdminScreen(editor,"floors");
 await assert.rejects(readAdminScreen(editor,"settings"),error=>error instanceof WorkspaceError&&error.status===403);
 await assert.rejects(saveStaffAccount(editor,crypto.randomUUID()+'@example.test','administrator'),error=>error instanceof WorkspaceError&&error.status===403);
 await assert.rejects(executeCommand(editor,{command:{type:'update-settings',values:data.settings},expectedRevision:data.revision,idempotencyKey:crypto.randomUUID()}),error=>error instanceof WorkspaceError&&error.status===403);
 assert.deepEqual(await readDecision("SELECT count(*)::text AS count FROM leasing.backend_access_decisions WHERE actor_user_id=$1",[identity.id]),beforeDecisions);
 const listed=await listStaffAccounts(identity);assert.ok(listed.some(account=>account.email===staffEmail&&account.role==='editor'&&account.status==='active'));
 await saveStaffAccount(identity,staffEmail,'administrator');
 editor=await resolveAdminIdentity({issuer,subject:staffSubject,email:staffEmail,emailVerified:true});assert.equal(editor?.role,'administrator');
 await revokeStaffAccount(identity,staffEmail);assert.equal(await resolveAdminIdentity({issuer,subject:staffSubject,email:staffEmail,emailVerified:true}),null);
 assert.ok((await listStaffAccounts(identity)).some(account=>account.email===staffEmail&&account.status==='revoked'));
 const rootEmail='root@legrandecentre.vn',rootIssuer=issuer,rootSubject=crypto.randomUUID();
 const resolvedRoot=await resolveAdminIdentity({issuer:rootIssuer,subject:rootSubject,email:rootEmail,emailVerified:true});
 assert.equal(resolvedRoot?.role,'root');assert.ok(resolvedRoot);const rootIdentity=trusted(resolvedRoot,rootSubject);
 assert.equal(await resolveAdminIdentity({issuer:rootIssuer,subject:crypto.randomUUID(),email:rootEmail,emailVerified:true}),null);
 const rootProjection=await readWorkspace(identity);
 assert.ok(!JSON.stringify(rootProjection).includes(rootEmail));
 assert.ok(!JSON.stringify(rootProjection).includes(rootIdentity.id));
 assert.ok(!(await listStaffAccounts(identity)).some(account=>account.email===rootEmail));
 await withTransaction('test:root-separation',async client=>{
  assert.equal(Number((await client.query('SELECT count(*) AS n FROM leasing.admin_allowlist WHERE lower(email)=lower($1) AND deleted_at IS NULL',[rootEmail])).rows[0].n),0);
  assert.equal(Number((await client.query('SELECT count(*) AS n FROM leasing.staff_assignments WHERE user_id=$1',[rootIdentity.id])).rows[0].n),0);
 });
 const rootData=await readWorkspace(rootIdentity);
 await executeCommand(rootIdentity,{command:{type:'update-floor',floor:1,purpose:rootData.floors[0].purpose,publicTitle:rootData.floors[0].publicTitle,publicDescription:rootData.floors[0].publicDescription},expectedRevision:rootData.revision,idempotencyKey:crypto.randomUUID()});
 data=await readWorkspace(identity);
 
 const logo = data.media.find(item => item.id === data.settings.website.logoMediaId);
 assert.ok(logo?.hasUploadedFile && logo.mimeType === "image/png" && logo.sizeBytes! > 0);
 assert.equal(logo.url, process.env.APPROVED_LOGO_URL);
 await assert.rejects(executeCommand(identity,{command:{type:"delete-media",mediaId:logo.id},expectedRevision:data.revision,idempotencyKey:crypto.randomUUID()}));
 await executeCommand(identity,{command:{type:'update-settings',values:data.settings},expectedRevision:data.revision,idempotencyKey:crypto.randomUUID()});data=await readWorkspace(identity);
 await executeCommand(identity,{command:{type:'update-floor',floor:1,purpose:data.floors[0].purpose,publicTitle:data.floors[0].publicTitle,publicDescription:data.floors[0].publicDescription},expectedRevision:data.revision,idempotencyKey:crypto.randomUUID()});data=await readWorkspace(identity);
 const run=async(command:AdminCommand)=>{const receipt=await executeCommand(identity,{command,expectedRevision:data.revision,idempotencyKey:crypto.randomUUID()});assert.deepEqual(Object.keys(receipt).sort(),["entityId","revision"]);data=await readWorkspace(identity);assert.equal(data.revision,receipt.revision);return data;};
 const command:AdminCommand={type:'upsert-company',values:{name:'Disposable regression company '+crypto.randomUUID(),industry:'Retail',brand:'',contact:'Reviewer',email:'',phone:'',owner:'',note:'',taxId:'',address:''}},key=crypto.randomUUID(),revision=data.revision;
 const created=await executeCommand(identity,{command,expectedRevision:revision,idempotencyKey:key});data=await readWorkspace(identity);
 const company=(await readAdminCollectionItem(identity,"companies",created.entityId)).item;assert.equal(company.name,command.values.name);assert.equal(company.version,1);
 const replay=await executeCommand(identity,{command,expectedRevision:revision,idempotencyKey:key});assert.deepEqual(replay,created);assert.deepEqual(Object.keys(replay).sort(),["entityId","revision"]);
 await assert.rejects(executeCommand(identity,{command:{type:'save-company',companyId:company.id,note:'different'},expectedRevision:revision,idempotencyKey:key}),error=>error instanceof WorkspaceError&&error.status===409);
 const raced=await Promise.allSettled(['first','second'].map(note=>executeCommand(identity,{command:{type:'save-company',companyId:company.id,note},expectedRevision:data.revision,idempotencyKey:crypto.randomUUID()})));
 assert.equal(raced.filter(r=>r.status==='fulfilled').length,1);assert.equal(raced.filter(r=>r.status==='rejected').length,1);data=await readWorkspace(identity);
 assert.equal(data.companies.find(c=>c.id===company.id)?.version,2);
 await assert.rejects(withTransaction(identity.id,async client=>{const crud=createAdminCrudServices(identity,client);await crud.companies.update(crud.request,company.id,1,{note:"stale version"});}),error=>error instanceof BackendError&&error.code==="CONFLICT");
 const disposableName="Disposable deletable company "+crypto.randomUUID();
 data=await run({type:"upsert-company",values:{name:disposableName,industry:"",brand:"",contact:"",email:"",phone:"",owner:"",note:"",taxId:"",address:""}});
 const disposable=data.companies.find(row=>row.name===disposableName)!;assert.equal(disposable.version,1);
 data=await run({type:"delete-company",companyId:disposable.id});assert.ok(!data.companies.some(row=>row.id===disposable.id));
 await withTransaction(identity.id,async client=>{const row=(await client.query("SELECT revision,deleted_at FROM leasing.property_customers WHERE property_id=$1 AND organization_id=$2",[identity.propertyId,disposable.id])).rows[0];assert.equal(Number(row.revision),2);assert.ok(row.deleted_at);});
 const leadValues={name:"Disposable CRUD lead "+crypto.randomUUID(),interest:"Retail",floor:1 as const,source:"test",status:"Mới" as const,note:"",email:"test@example.test",phone:""};
 data=await run({type:"save-lead",values:leadValues});
 const lead=data.leads.find(row=>row.name===leadValues.name)!;assert.equal(lead.version,1);assert.equal(lead.referenceCode,"LGC-00001");
 data=await run({type:"save-lead",leadId:lead.id,values:{...leadValues,note:"updated"}});
 assert.equal(data.leads.find(row=>row.id===lead.id)?.version,2);
 data=await run({type:"delete-lead",leadId:lead.id});assert.ok(!data.leads.some(row=>row.id===lead.id));
 await withTransaction(identity.id,async client=>{const row=(await client.query("SELECT revision,deleted_at FROM leasing.leads WHERE property_id=$1 AND id=$2",[identity.propertyId,lead.id])).rows[0];assert.equal(Number(row.revision),3);assert.ok(row.deleted_at);});
 const appointmentStart=new Date(Date.now()+2*60*60*1000).toISOString();
 const appointmentValues={companyId:company.id,purpose:"Tư vấn mặt bằng",startsAt:appointmentStart,location:"Le Grande Centre",durationMinutes:60};
 data=await run({type:"save-appointment",values:appointmentValues});
 const crudAppointment=data.appointments.find(row=>row.companyId===company.id&&row.startsAt===appointmentStart)!;assert.equal(crudAppointment.version,1);
 await assert.rejects(run({type:"save-appointment",values:{...appointmentValues,purpose:"Trùng lịch"}}),error=>error instanceof WorkspaceError&&error.status===409);
 const movedAppointment={...appointmentValues,startsAt:new Date(Date.now()+4*60*60*1000).toISOString()};
 data=await run({type:"save-appointment",appointmentId:crudAppointment.id,values:movedAppointment});
 assert.equal(data.appointments.find(row=>row.id===crudAppointment.id)?.version,2);
 data=await run({type:"delete-appointment",appointmentId:crudAppointment.id});assert.ok(!data.appointments.some(row=>row.id===crudAppointment.id));
 await withTransaction(identity.id,async client=>{const row=(await client.query("SELECT revision,deleted_at FROM leasing.appointments WHERE property_id=$1 AND id=$2",[identity.propertyId,crudAppointment.id])).rows[0];assert.equal(Number(row.revision),3);assert.ok(row.deleted_at);});
 const a=data.slots.find(s=>s.code==='A.1')!,b=data.slots.find(s=>s.code==='A.2')!,across=data.slots.find(s=>s.code==='A.6')!;
 assert.ok(a&&b&&across);assert.ok(a.connectedSlotIds?.includes(b.id));
 await assert.rejects(run({type:'merge',floor:1,slotIds:[a.id,across.id],name:'Across lobby'}));
 await run({type:'merge',floor:1,slotIds:[a.id,b.id],name:'Regression adjacent group'});const group=data.groups.find(g=>g.name==='Regression adjacent group')!;
 await run({type:'update-group',groupId:group.id,name:'Renamed adjacent group',status:'Đang thuê'});assert.equal(data.slots.find(s=>s.id===a.id)?.status,'Đã thuê');
 await run({type:'update-group',groupId:group.id,name:'Renamed adjacent group',status:'Trống'});await run({type:'split',groupId:group.id});
 const start=new Date(Date.now()+86400000).toISOString().slice(0,10),end=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
 await run({type:'save-request',values:{companyId:company.id,floor:1,slotIds:[a.id],start,end,note:''}});let request=data.requests.find(q=>q.companyId===company.id&&q.slotIds.includes(a.id)&&q.status==='submitted')!;
 await run({type:'review-request',requestId:request.id});await assert.rejects(run({type:'review-request',requestId:request.id}));
 await run({type:'approve-request',requestId:request.id,holdHours:48,note:'Approved test'});const hold=data.reservations.find(h=>h.requestId===request.id)!;
 assert.equal(data.slots.find(s=>s.id===a.id)?.status,'Còn trống');await assert.rejects(run({type:'update-slot',slotId:a.id,status:'Trống',tenant:''}));
 const documentsBefore=await readDecision("SELECT count(*)::text AS count FROM leasing.document_versions WHERE property_id=$1",[identity.propertyId]);
 await run({type:'record-lease',reservationId:hold.id,rentNote:"Bản gốc lưu ngoài hệ thống",referenceNumber:"REGRESSION-METADATA"});
 const lease=data.leases.find(l=>l.reservationId===hold.id)!;
 assert.ok(lease);assert.equal(lease.referenceNumber,"REGRESSION-METADATA");assert.equal(lease.rentNote,"Bản gốc lưu ngoài hệ thống");assert.ok(lease.recordedAt);assert.equal(lease.recordedBy,identity.id);
 assert.equal(data.reservations.find(h=>h.id===hold.id)?.status,'converted');assert.equal(data.slots.find(s=>s.id===a.id)?.status,'Đã thuê');assert.equal(lease.signedOn,undefined);assert.equal(lease.documentMediaId,null);
 assert.deepEqual(await readDecision("SELECT count(*)::text AS count FROM leasing.document_versions WHERE property_id=$1",[identity.propertyId]),documentsBefore);
 assert.equal((await readAdminScreen(identity,"leases",{id:lease.id})).leases[0]?.id,lease.id);
 assert.equal((await readAdminScreen(identity,"slot",{id:a.id})).leases[0]?.id,lease.id);
 const companySummary=(await readAdminCollectionItem(identity,"companies",company.id)).item;
 assert.equal(companySummary.category,"Đang thuê");assert.equal(companySummary.leaseCount,1);assert.equal(companySummary.requestCount,1);
 assert.equal((await readAdminScreen(identity,"tenants",{companyId:company.id})).leases[0]?.id,lease.id);
 await assert.rejects(run({type:'cancel-hold',reservationId:hold.id,reason:'Already converted'}));
 await assert.rejects(run({type:'record-lease',reservationId:hold.id}));
 await assert.rejects(withTransaction(identity.id,client=>client.query("UPDATE leasing.slot_allocations SET occupancy_period=daterange($2::date+1,$3::date+1,'[)') WHERE lease_id=$1 AND released_at IS NULL",[lease.id,start,end])));
 await assert.rejects(withTransaction(identity.id,client=>client.query("UPDATE leasing.slot_allocations SET released_at=now() WHERE lease_id=$1 AND released_at IS NULL",[lease.id])));
 await assert.rejects(withTransaction(identity.id,client=>client.query("INSERT INTO leasing.leases(property_id,organization_id,space_version_id,reference_number,occupancy_period,status) SELECT property_id,organization_id,space_version_id,'INVALID-NO-METADATA',occupancy_period,'executed' FROM leasing.leases WHERE id=$1",[lease.id])));
 await assert.rejects(run({type:"save-request",values:{companyId:company.id,floor:1,slotIds:[a.id],start,end,note:"Overlapping occupied lease"}}));
 const manualSlot=data.slots.find(slot=>slot.code==="B.1")!;
 await run({type:"update-slot",slotId:manualSlot.id,status:"Đang thuê",tenant:"Manual occupant without document"});
 const manualTenants=await readAdminScreen(identity,"tenants",{query:"Manual occupant without document"});
 assert.equal(manualTenants.totalItems,1);assert.equal(manualTenants.slots[0]?.id,manualSlot.id);assert.equal(manualTenants.leases.length,0);
 await run({type:"update-slot",slotId:manualSlot.id,status:"Trống",tenant:""});
 const cancellationSlot=data.slots.find(s=>s.code==='C.1')!;
 await run({type:'save-request',values:{companyId:company.id,floor:3,slotIds:[cancellationSlot.id],start,end,note:'Cancellation test'}});const cancellingRequest=data.requests.find(q=>q.companyId===company.id&&q.note==='Cancellation test')!;
 await run({type:'approve-request',requestId:cancellingRequest.id,holdHours:48,note:''});const cancellingHold=data.reservations.find(h=>h.requestId===cancellingRequest.id)!;await run({type:'cancel-hold',reservationId:cancellingHold.id,reason:'Test cancellation'});
 const expiredSlot=data.slots.find(slot=>slot.code==="C.2")!;
 await run({type:"save-request",values:{companyId:company.id,floor:3,slotIds:[expiredSlot.id],start,end,note:"Expired hold test"}});
 const expiredRequest=data.requests.find(item=>item.note==="Expired hold test")!;
 await run({type:"approve-request",requestId:expiredRequest.id,holdHours:1,note:""});
 const expiredHold=data.reservations.find(item=>item.requestId===expiredRequest.id)!;
 await withTransaction(identity.id,client=>client.query("UPDATE leasing.reservations SET held_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE id=$1",[expiredHold.id]));
 await assert.rejects(run({type:"record-lease",reservationId:expiredHold.id}));

 await run({type:'save-request',values:{companyId:company.id,floor:1,slotIds:[b.id],start,end,note:''}});request=data.requests.find(q=>q.companyId===company.id&&q.slotIds.includes(b.id)&&q.status==='submitted')!;await run({type:'reject-request',requestId:request.id,reason:'Test rejection'});await assert.rejects(run({type:'approve-request',requestId:request.id,holdHours:48,note:''}));
 const startsAt=new Date(Date.now()+7*86400000).toISOString();await run({type:'save-appointment',values:{companyId:company.id,purpose:'Visit',startsAt,location:'Le Grande Centre',durationMinutes:30}});const appointment=data.appointments.find(a=>a.companyId===company.id)!;
 await run({type:'confirm-appointment',appointmentId:appointment.id});await run({type:'cancel-appointment',appointmentId:appointment.id});await assert.rejects(run({type:'confirm-appointment',appointmentId:appointment.id}));
 const editable=data.slots.find(slot=>slot.code==="F.1")!;
 await run({type:"update-slot",slotId:editable.id,status:"Trống",tenant:"",area:editable.area+1});
 const publicData=await readPublicWebsiteData();assert.ok(publicData.units.length===81);assert.ok(!JSON.stringify(publicData).includes(company.name));assert.ok(publicData.units.every(u=>!('tenant' in u)));assert.ok(publicData.floors.every(f=>!('purpose' in f)));
 assert.equal(publicData.units.find(unit=>unit.id===a.id)?.status,"Đã thuê");
 assert.equal(publicData.units.find(unit=>unit.id===b.id)?.status,"Còn trống");
 assert.equal(publicData.units.find(unit=>unit.id===editable.id)?.area,editable.area+1);
 assert.equal(publicData.logoUrl, logo.url);
 const input={intent:'callback' as const,name:'Public regression',company:'',phone:'0973879563',email:'',business:'',area:'',timing:'',space:'',note:'',consent:true},intakeKey=crypto.randomUUID(),ipHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(crypto.randomUUID()))),b=>b.toString(16).padStart(2,'0')).join('');
 const accepted=await submitContact(input,{idempotencyKey:intakeKey,ipHash});const contactReplay=await submitContact(input,{idempotencyKey:intakeKey,ipHash});assert.equal(accepted.created,true);assert.equal(contactReplay.created,false);assert.equal(contactReplay.id,accepted.id);assert.equal(contactReplay.referenceCode,accepted.referenceCode);assert.match(accepted.referenceCode,/^LGC-\d{5}$/);await assert.rejects(submitContact(input,{idempotencyKey:crypto.randomUUID(),ipHash}),error=>error instanceof WorkspaceError&&error.status===429);
 const prefix="Boundary "+crypto.randomUUID();
 await withTransaction(identity.id,async client=>{
  await client.query(`WITH inserted AS (INSERT INTO leasing.organizations(legal_name,industry) SELECT $2||' company '||i,'Boundary industry' FROM generate_series(1,105)i RETURNING id) INSERT INTO leasing.property_customers(property_id,organization_id,revision) SELECT $1,id,1 FROM inserted`,[identity.propertyId,prefix]);
  await client.query(`WITH inserted AS (INSERT INTO leasing.leads(property_id,organization_id,name,interest,floor_number,source,status,note,email,phone,revision) SELECT $1,$2,$3||' lead '||i,'Boundary interest',1,'Boundary source','Mới','','boundary@example.test','',1 FROM generate_series(1,105)i RETURNING id)
   INSERT INTO leasing.contact_intake(property_id,idempotency_key,request_sha256,ip_hash,lead_id,intent,company_name,business,area_preference,timing,space_code)
   SELECT $1,gen_random_uuid()::text,repeat('0',64),repeat('0',64),id,'consultation',$3,'Retail','100','Soon','A.1' FROM inserted`,[identity.propertyId,company.id,prefix]);
  await client.query(`INSERT INTO leasing.appointments(property_id,organization_id,purpose,scheduled_period,meeting_location,revision) SELECT $1,$2,$3||' appointment '||i,tstzrange(now()+(365+i)*interval '1 day',now()+(365+i)*interval '1 day'+interval '30 minutes','[)'),'Boundary location',1 FROM generate_series(1,105)i`,[identity.propertyId,company.id,prefix]);
 });
 data=await readWorkspace(identity);
 for(const collection of ["companies","leads","appointments"] as const){
  assert.equal(data[collection].length,20);assert.ok(data.collections[collection].totalItems>100);assert.equal(data.collections[collection].pageSize,20);
  const first=await readAdminCollection(identity,collection,{query:prefix,pageSize:100});
  const second=await readAdminCollection(identity,collection,{query:prefix,page:2,pageSize:100});
  assert.equal(first.totalItems,105);assert.equal(first.items.length,100);assert.equal(second.items.length,5);assert.equal(second.totalPages,2);
  assert.ok(second.items.every(item=>!first.items.some(previous=>previous.id===item.id)));
  const outside=[...first.items,...second.items].find(item=>!data[collection].some(initial=>initial.id===item.id))!;
  assert.ok(outside);
  const detail=await readAdminCollectionItem(identity,collection,outside.id);assert.equal(detail.item.id,outside.id);
  const lookup=await readAdminCollection(identity,collection,{ids:[outside.id],pageSize:100});assert.equal(lookup.totalItems,1);assert.equal(lookup.items[0]?.id,outside.id);
  await assert.rejects(readAdminCollectionItem(identity,collection,crypto.randomUUID()),error=>error instanceof WorkspaceError&&error.status===404);
 }
 const selectedCompany=(await readAdminCollection(identity,"companies",{query:prefix,page:2,pageSize:100})).items[0]!;
 data=await run({type:"save-company",companyId:selectedCompany.id,note:"Outside initial page"});
 assert.equal((await readAdminCollectionItem(identity,"companies",selectedCompany.id)).item.note,"Outside initial page");
 const selectedLead=(await readAdminCollection(identity,"leads",{query:prefix,page:2,pageSize:100})).items[0]!;
 assert.equal(selectedLead.contactDetails?.company,prefix);
 const {id:leadId,referenceCode:_referenceCode,version:_leadVersion,initials:_leadInitials,time:_leadTime,contactDetails:_contactDetails,...selectedLeadInput}=selectedLead;
 await run({type:"save-lead",leadId,values:{...selectedLeadInput,note:"Outside lead page"}});
 assert.equal((await readAdminCollectionItem(identity,"leads",leadId)).item.note,"Outside lead page");
 const selectedAppointment=(await readAdminCollection(identity,"appointments",{query:prefix,page:2,pageSize:100})).items[0]!;
 await run({type:"confirm-appointment",appointmentId:selectedAppointment.id});
 assert.equal((await readAdminCollectionItem(identity,"appointments",selectedAppointment.id)).item.status,"confirmed");
 const scopedLeads=await readAdminCollection(identity,"leads",{companyId:company.id,status:"Mới",query:prefix,pageSize:20});
 assert.equal(scopedLeads.totalItems,105);assert.ok(scopedLeads.items.every(item=>item.companyId===company.id&&item.contactDetails?.company===prefix));
 const confirmed=await readAdminCollection(identity,"appointments",{companyId:company.id,status:"confirmed",query:prefix});
 assert.equal(confirmed.totalItems,1);assert.equal(confirmed.items[0]?.id,selectedAppointment.id);
 const mediaPrefix="Media boundary "+crypto.randomUUID(),mediaIds:string[]=[];
 await withTransaction(identity.id,async client=>{
  for(let i=0;i<60;i++){
   const doc=crypto.randomUUID(),id=crypto.randomUUID();mediaIds.push(id);
   await client.query("INSERT INTO leasing.documents(id,property_id,classification,title,media_scope) VALUES($1,$2,'business_private',$3,'Tầng 1')",[doc,identity.propertyId,mediaPrefix+" "+i]);
   await client.query("INSERT INTO leasing.document_versions(id,property_id,document_id,version_number,storage_provider,bucket_name,object_key,content_type,byte_size,sha256,original_filename,uploaded_by) VALUES($1::uuid,$2,$3,1,'r2','owned-metadata-fixture',$1::uuid::text,$4,5,$5,'fixture',$6)",[id,identity.propertyId,doc,i%2?"image/png":"application/pdf","0".repeat(64),identity.id]);
   await client.query("INSERT INTO leasing.media_object_state(document_version_id,property_id,state) VALUES($1,$2,$3)",[id,identity.propertyId,i%2?"ready":"quarantine"]);
  }
  await client.query("UPDATE leasing.media_storage SET used_bytes=used_bytes+300 WHERE property_id=$1",[identity.propertyId]);
 });
 const uploadedPages=await Promise.all([1,2,3].map(page=>readMediaPage(identity,{source:"uploaded",query:mediaPrefix,page,pageSize:24})));
 assert.deepEqual(uploadedPages.map(page=>page.items.length),[24,24,12]);assert.ok(uploadedPages.every(page=>page.totalItems===60&&page.totalPages===3));
 const uploadedIds=uploadedPages.flatMap(page=>page.items.map(item=>item.id));assert.equal(new Set(uploadedIds).size,60);assert.deepEqual(new Set(uploadedIds),new Set(mediaIds));
 const imagePage=await readMediaPage(identity,{source:"uploaded",query:mediaPrefix,kind:"Ảnh",scope:"Tầng 1",pageSize:100});
 assert.equal(imagePage.totalItems,30);assert.ok(imagePage.items.every(item=>item.kind==="Ảnh"&&item.scope==="Tầng 1"));
 const uploads=await readMediaPage(identity,{source:"uploaded",pageSize:100}),projects=await readMediaPage(identity,{source:"project",pageSize:100});
 const crossingPage=Math.floor(uploads.totalItems/24)+1,crossingOffset=(crossingPage-1)*24;
 const crossing=await readMediaPage(identity,{page:crossingPage,pageSize:24});
 const expected=[...uploads.items.slice(crossingOffset),...projects.items].slice(0,24).map(item=>item.id);
 assert.deepEqual(crossing.items.map(item=>item.id),expected);assert.equal(crossing.totalItems,uploads.totalItems+projects.totalItems);
 const outsideMedia=uploadedPages[2].items[0]!;
 assert.equal((await readMediaDetail(identity,outsideMedia.id)).item.id,outsideMedia.id);
 await withTransaction(identity.id,client=>client.query("INSERT INTO leasing.document_retention(document_version_id,property_id,legal_hold,policy_reference,policy_updated_by) VALUES($1,$2,true,'Owned retention regression',$3)",[outsideMedia.id,identity.propertyId,identity.id]));
 const protectedMedia=(await readMediaDetail(identity,outsideMedia.id)).item;assert.equal(protectedMedia.canDelete,false);assert.ok(protectedMedia.protectedReason);
 await assert.rejects(executeCommand(identity,{command:{type:"delete-media",mediaId:outsideMedia.id},expectedRevision:data.revision,idempotencyKey:crypto.randomUUID()}));
 assert.equal((await readMediaDetail(identity,logo.id)).item.canDelete,false);
 assert.equal((await readMediaPage(identity,{source:"uploaded",page:999})).items.length,0);
 const otherProperty=await withTransaction(identity.id,async client=>(await client.query("INSERT INTO leasing.properties(code,name,owner_organization_id) SELECT $2,'Owned foreign property',owner_organization_id FROM leasing.properties WHERE id=$1 RETURNING id",[identity.propertyId,"foreign-"+crypto.randomUUID()])).rows[0].id as string);
 const foreignIdentity={...identity,propertyId:otherProperty};
 await assert.rejects(readAdminCollectionItem(foreignIdentity,"companies",company.id),error=>error instanceof WorkspaceError&&error.status===404);
 await assert.rejects(readMediaDetail(foreignIdentity,outsideMedia.id),error=>error instanceof WorkspaceError&&error.status===404);
 assert.equal((await readAdminScreen(foreignIdentity,"leases",{companyId:company.id})).leases.length,0);
 // A durable finalized receipt is replayed verbatim even after newer workspace writes.
 const replayRevision=data.revision-1,reconcileKey=crypto.randomUUID(),reviewKey=crypto.randomUUID(),uploadKey=crypto.randomUUID(),batchId=crypto.randomUUID(),receiptMediaId=crypto.randomUUID(),receiptDoc=crypto.randomUUID(),reviewNote="External review already committed";
 const replayFile=new File(["%PDF-1.7\nowned replay proof\n%%EOF"],"owned-replay.pdf",{type:"application/pdf"}),[prepared]=await prepareFiles([replayFile]);
 const quotaDigest=await sha256(new TextEncoder().encode(JSON.stringify({action:"media.quota-reconcile",expectedRevision:replayRevision-1})));
 const reviewDigest=await sha256(new TextEncoder().encode(JSON.stringify({id:receiptMediaId,note:reviewNote,expectedRevision:replayRevision-1})));
 const uploadDigest=await sha256(new TextEncoder().encode(JSON.stringify({scope:"Toàn dự án",expectedRevision:replayRevision-1,files:[[prepared.name,prepared.mime,prepared.sha256,prepared.bytes.length]]})));
 await withTransaction(identity.id,async client=>{
  await client.query("INSERT INTO leasing.command_receipts(property_id,actor_user_id,idempotency_key,request_sha256,command_code,result_entity_id,result_revision) VALUES($1,$2,$3,$4,'media.quota-reconcile',$1,$5),($1,$2,$6,$7,'media.manual-review',$8,$5)",[identity.propertyId,identity.id,reconcileKey,quotaDigest,replayRevision,reviewKey,reviewDigest,receiptMediaId]);
  await client.query("INSERT INTO leasing.media_batches(id,property_id,actor_user_id,request_key,request_sha256,expected_revision,state,result_revision) VALUES($1,$2,$3,$4,$5,$6,'finalized',$7)",[batchId,identity.propertyId,identity.id,uploadKey,uploadDigest,replayRevision-1,replayRevision]);
  await client.query("INSERT INTO leasing.documents(id,property_id,classification,title,media_scope) VALUES($1,$2,'business_private','Owned replay metadata','Toàn dự án')",[receiptDoc,identity.propertyId]);
  await client.query("INSERT INTO leasing.document_versions(id,property_id,document_id,version_number,storage_provider,bucket_name,object_key,content_type,byte_size,sha256,original_filename,uploaded_by) VALUES($1::uuid,$2,$3,1,'r2','owned-metadata-fixture',$1::uuid::text,'application/pdf',$4,$5,'owned-replay.pdf',$6)",[receiptMediaId,identity.propertyId,receiptDoc,prepared.bytes.length,prepared.sha256,identity.id]);
  await client.query("UPDATE leasing.document_versions SET manual_reviewed_by=$2,manual_reviewed_at=now(),manual_review_note=$3,sealed_at=now() WHERE id=$1",[receiptMediaId,identity.id,reviewNote]);
  await client.query("INSERT INTO leasing.media_object_state(document_version_id,property_id,batch_id,state) VALUES($1,$2,$3,'ready')",[receiptMediaId,identity.propertyId,batchId]);
  await client.query("UPDATE leasing.media_storage SET used_bytes=used_bytes+$2 WHERE property_id=$1",[identity.propertyId,prepared.bytes.length]);
 });
 assert.deepEqual(await reconcileMedia(identity,replayRevision-1,reconcileKey),{revision:replayRevision,entityId:identity.propertyId});
 assert.deepEqual(await reviewMedia(identity,receiptMediaId,reviewNote,replayRevision-1,reviewKey),{revision:replayRevision,entityId:receiptMediaId});
 assert.deepEqual(await uploadMedia(identity,[replayFile],"Toàn dự án",replayRevision-1,uploadKey),{revision:replayRevision,mediaIds:[receiptMediaId]});
 await assert.rejects(reviewMedia(identity,receiptMediaId,"Different review details",replayRevision-1,reviewKey));
 const beforeRollback=await readDecision("SELECT contact_email FROM leasing.properties WHERE id=$1",[identity.propertyId]);
 const expiring={...identity,verifiedSession:{...identity.verifiedSession!,expiresAt:Date.now()+100}};
 await assert.rejects(withAdminTransaction(expiring,async client=>{await client.query("UPDATE leasing.properties SET contact_email='must-rollback@example.test' WHERE id=$1",[identity.propertyId]);await client.query("SELECT pg_sleep(0.15)");}),AdminSessionError);
 assert.deepEqual(await readDecision("SELECT contact_email FROM leasing.properties WHERE id=$1",[identity.propertyId]),beforeRollback);
 await withTransaction('test:assertions',async client=>{const receipts=(await client.query('SELECT count(*) AS count FROM leasing.command_receipts WHERE actor_user_id=$1 AND idempotency_key=$2',[identity.id,key])).rows[0];assert.equal(Number(receipts.count),1);const actor=(await client.query('SELECT current_user AS role')).rows[0];assert.equal(actor.role,'leasing_runtime');await client.query('UPDATE leasing.users SET disabled_at=now() WHERE id=$1',[identity.id]);});
 assert.equal(await resolveAdminIdentity({issuer,subject,email,emailVerified:true}),null);
 // Signed snapshots intentionally survive remote revoke until their fixed expiry.
 await readAdminScreen(identity,"floors");
 const expired={...identity,verifiedSession:{...identity.verifiedSession!,expiresAt:Date.now()-1}};
 await assert.rejects(readAdminScreen(expired,"floors"),error=>error instanceof AdminSessionError&&error.code==="SESSION_EXPIRED");
 await assert.rejects(executeCommand(expired,{command:{type:"delete-company",companyId:company.id},expectedRevision:data.revision,idempotencyKey:crypto.randomUUID()}),error=>error instanceof AdminSessionError);
 await withTransaction('test:revoke-root',async client=>{await client.query('UPDATE leasing.root_allowlist SET revoked_at=now() WHERE lower(email)=lower($1)',[rootEmail]);});
 await readAdminScreen(rootIdentity,"floors");
 assert.equal(await resolveAdminIdentity({issuer:rootIssuer,subject:rootSubject,email:rootEmail,emailVerified:true}),null);
 assert.deepEqual(await readDecision("SELECT count(*)::text AS count FROM leasing.backend_access_decisions WHERE actor_user_id=$1",[identity.id]),beforeDecisions);
});
