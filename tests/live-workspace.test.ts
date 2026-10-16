import test from "node:test";
import assert from "node:assert/strict";
import { parseAdminCommand } from "../src/shared/admin/parse-command";
import { mergeIssue } from "../src/shared/admin/space-model";
import { getDatabase, resolveAdminIdentity, withTransaction, WorkspaceError, type AdminIdentity } from "../src/server/database";
import { readWorkspace, executeCommand } from "../src/server/workspace";
import { listStaffAccounts, revokeStaffAccount, saveStaffAccount } from "../src/server/staff-accounts";
import { submitContact } from "../src/server/public";
import { readPublicWebsiteData } from "../src/server/public-data";
import { createAdminCrudServices } from "../src/server/admin-crud";
import { BackendError } from "@shared/backend";
import type { AdminCommand } from "../src/shared/admin/contracts";
import { verifyOwnedLocalDatabase } from "../scripts/local-database-guard.mjs";
import { parseCollectionName, parseCollectionQuery, readAdminCollection, readAdminCollectionItem } from "../src/server/admin-collections";

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
 await assert.rejects(readWorkspace({...identity,propertyId:deniedPropertyId}),error=>error instanceof WorkspaceError&&error.status===403);
 assert.deepEqual(await readDecision("SELECT allowed,reason,policy_version FROM leasing.backend_access_decisions WHERE property_id=$1 ORDER BY recorded_at DESC LIMIT 1",[deniedPropertyId]),{allowed:false,reason:'invalid-context',policy_version:'unresolved'});
 let data=await readWorkspace(identity);
 const staffEmail='staff-invitation-'+crypto.randomUUID()+'@example.test',staffSubject=crypto.randomUUID();
 const invitation=await saveStaffAccount(identity,staffEmail,'editor');assert.equal(invitation.status,'invited');
 let editor=await resolveAdminIdentity({issuer,subject:staffSubject,email:staffEmail,emailVerified:true});
 assert.equal(editor?.role,'editor');assert.ok(editor);editor=trusted(editor,staffSubject);await readWorkspace(editor);
 await assert.rejects(saveStaffAccount(editor,crypto.randomUUID()+'@example.test','administrator'),error=>error instanceof WorkspaceError&&error.status===403);
 await assert.rejects(executeCommand(editor,{command:{type:'update-settings',values:data.settings},expectedRevision:data.revision,idempotencyKey:crypto.randomUUID()}),error=>error instanceof WorkspaceError&&error.status===403);
 assert.deepEqual(await readDecision("SELECT allowed,reason FROM leasing.backend_access_decisions WHERE property_id=$1 AND actor_user_id=$2 AND permission='workspace:configure' ORDER BY recorded_at DESC LIMIT 1",[editor.propertyId,editor.id]),{allowed:false,reason:'no-grant'});
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
 const run=async(command:AdminCommand)=>{data=await executeCommand(identity,{command,expectedRevision:data.revision,idempotencyKey:crypto.randomUUID()});return data;};
 const command:AdminCommand={type:'upsert-company',values:{name:'Disposable regression company '+crypto.randomUUID(),industry:'Retail',brand:'',contact:'Reviewer',email:'',phone:'',owner:'',note:'',taxId:'',address:''}},key=crypto.randomUUID(),revision=data.revision;
 data=await executeCommand(identity,{command,expectedRevision:revision,idempotencyKey:key});
 const company=data.companies.find(c=>c.name===command.values.name)!;assert.ok(company);assert.equal(company.version,1);
 const replay=await executeCommand(identity,{command,expectedRevision:revision,idempotencyKey:key});assert.equal(replay.revision,data.revision);assert.equal(replay.companies.filter(c=>c.id===company.id).length,1);
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
 await assert.rejects(run({type:'record-lease',reservationId:hold.id,mediaId:crypto.randomUUID()}));assert.equal((await readWorkspace(identity)).leases.length,data.leases.length);
 const pdf=crypto.randomUUID(),documentId=crypto.randomUUID();
 // Relational gate fixture only: real PDF bytes/storage delivery require media endpoint integration checks.
 await withTransaction('test:private-pdf-gate',async client=>{
  await client.query("INSERT INTO leasing.documents(id,property_id,classification,title) VALUES($1,$2,'business_private','Disposable DB invariant PDF')",[documentId,identity.propertyId]);
  await client.query("INSERT INTO leasing.document_versions(id,property_id,document_id,version_number,storage_provider,bucket_name,object_key,content_type,byte_size,sha256,original_filename,uploaded_by) VALUES($1::uuid,$2,$3,1,'r2','test-bucket',$1::uuid::text,'application/pdf',5,$4,'regression.pdf',$5)",[pdf,identity.propertyId,documentId,'0'.repeat(64),identity.id]);
  await client.query("INSERT INTO leasing.media_object_state(document_version_id,property_id,state) VALUES($1,$2,'quarantine')",[pdf,identity.propertyId]);
 });
 await assert.rejects(run({type:'record-lease',reservationId:hold.id,mediaId:pdf}));
 await withTransaction('test:manual-reviewed-fixture',async client=>{
  await client.query("UPDATE leasing.document_versions SET manual_reviewed_by=$2,manual_reviewed_at=now(),manual_review_note='DB gate test: external review attestation fixture',sealed_at=now() WHERE id=$1",[pdf,identity.id]);
  await client.query("UPDATE leasing.media_object_state SET state='ready' WHERE document_version_id=$1",[pdf]);
 });
 await run({type:'record-lease',reservationId:hold.id,mediaId:pdf});const lease=data.leases.find(l=>l.reservationId===hold.id)!;assert.ok(lease);assert.equal(data.reservations.find(h=>h.id===hold.id)?.status,'converted');assert.equal(data.slots.find(s=>s.id===a.id)?.status,'Đã thuê');assert.equal(lease.signedOn,undefined);
 await run({type:'attach-lease-document',leaseId:lease.id,mediaId:pdf});await assert.rejects(run({type:'cancel-hold',reservationId:hold.id,reason:'Already converted'}));
 await assert.rejects(run({type:'delete-media',mediaId:pdf}));await assert.rejects(run({type:'link-media',mediaId:pdf,scope:'Toàn dự án'}));
 const cancellationSlot=data.slots.find(s=>s.code==='C.1')!;
 await run({type:'save-request',values:{companyId:company.id,floor:3,slotIds:[cancellationSlot.id],start,end,note:'Cancellation test'}});const cancellingRequest=data.requests.find(q=>q.companyId===company.id&&q.note==='Cancellation test')!;
 await run({type:'approve-request',requestId:cancellingRequest.id,holdHours:48,note:''});const cancellingHold=data.reservations.find(h=>h.requestId===cancellingRequest.id)!;await run({type:'cancel-hold',reservationId:cancellingHold.id,reason:'Test cancellation'});

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
 await withTransaction('test:assertions',async client=>{const receipts=(await client.query('SELECT count(*) AS count FROM leasing.command_receipts WHERE actor_user_id=$1 AND idempotency_key=$2',[identity.id,key])).rows[0];assert.equal(Number(receipts.count),1);const actor=(await client.query('SELECT current_user AS role')).rows[0];assert.equal(actor.role,'leasing_runtime');await client.query('UPDATE leasing.users SET disabled_at=now() WHERE id=$1',[identity.id]);});
 assert.equal(await resolveAdminIdentity({issuer,subject,email,emailVerified:true}),null);await assert.rejects(readWorkspace(identity),error=>error instanceof WorkspaceError&&error.status===403);
 await withTransaction('test:revoke-root',async client=>{await client.query('UPDATE leasing.root_allowlist SET revoked_at=now() WHERE lower(email)=lower($1)',[rootEmail]);});
 await assert.rejects(readWorkspace(rootIdentity),error=>error instanceof WorkspaceError&&error.status===403);
 assert.equal(await resolveAdminIdentity({issuer:rootIssuer,subject:rootSubject,email:rootEmail,emailVerified:true}),null);
});
