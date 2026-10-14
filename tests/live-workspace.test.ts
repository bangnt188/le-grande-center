import test from "node:test";
import assert from "node:assert/strict";
import { parseAdminCommand } from "../src/shared/admin/parse-command";
import { mergeIssue } from "../src/shared/admin/space-model";
import { resolveAdminIdentity, withTransaction, WorkspaceError } from "../src/server/database";
import { readWorkspace, executeCommand } from "../src/server/workspace";
import { readPublicWebsite, submitContact } from "../src/server/public";
import type { AdminCommand } from "../src/shared/admin/contracts";

// Mutating regressions require the owned disposable branch wrapper, never an arbitrary DATABASE_URL.
test("bounded commands reject extra fields, invalid types and fabricated adjacency", () => {
 const id=crypto.randomUUID();
 for(const value of [{type:'delete-media',mediaId:id,propertyId:id},{type:'update-slot',slotId:id,status:'Đang chọn',tenant:''},{type:'merge',floor:2,slotIds:[id,id],name:'x'},{type:'approve-request',requestId:id,holdHours:721,note:''},{type:'save-company',companyId:id,note:'x'.repeat(601)},{type:'save-request',values:null},{type:'constructor'}]) assert.throws(()=>parseAdminCommand(value));
 const a={id:'a',floor:1 as const,code:'A.1',order:1,side:null,area:190,width:10,status:'Trống' as const,tenant:''},b={...a,id:'b',code:'A.2',order:2};
 assert.notEqual(mergeIssue([a,b],[],['a','b'],1),null);
 assert.equal(mergeIssue([{...a,connectedSlotIds:['b']},{...b,connectedSlotIds:['a']}],[],['a','b'],1),null);
});

test("Neon relational commands: CAS, uncertain-response replay, scope, transitions and public intake", {skip:process.env.RUN_LIVE_DATABASE_TESTS!=='1'}, async()=>{
 assert.ok(process.env.DATABASE_URL,'Provide disposable branch URL');
 assert.ok(process.env.LIVE_TEST_BRANCH_ID && process.env.LIVE_TEST_BRANCH_ID !== process.env.LIVE_TEST_PARENT_ID, "Use npm run test:database; arbitrary database opt-in is refused");
 assert.match(process.env.LIVE_TEST_BRANCH_NAME ?? "", /^owned-database-test-[0-9a-f-]{36}$/);
 const email='workspace-regression-'+crypto.randomUUID()+'@example.test',issuer='https://verified-test-issuer.invalid',subject=crypto.randomUUID();
 await withTransaction('test:setup',async client=>{const p=(await client.query("SELECT id FROM leasing.properties WHERE code='le-grande-centre'")).rows[0];assert.ok(p);await client.query('INSERT INTO leasing.admin_allowlist(property_id,email) VALUES($1,$2)',[p.id,email]);});
 assert.equal(await resolveAdminIdentity({issuer,subject,email,emailVerified:false}),null);
 const identity=await resolveAdminIdentity({issuer,subject,email,emailVerified:true});assert.ok(identity);
 assert.equal(await resolveAdminIdentity({issuer,subject:crypto.randomUUID(),email,emailVerified:true}),null);
 await assert.rejects(readWorkspace({...identity,propertyId:crypto.randomUUID()}),error=>error instanceof WorkspaceError&&error.status===403);
 let data=await readWorkspace(identity);
 const logo = data.media.find(item => item.id === data.settings.website.logoMediaId);
 assert.ok(logo?.hasUploadedFile && logo.mimeType === "image/png" && logo.sizeBytes! > 0);
 assert.equal(logo.url, process.env.APPROVED_LOGO_URL);
 await assert.rejects(executeCommand(identity,{command:{type:"delete-media",mediaId:logo.id},expectedRevision:data.revision,idempotencyKey:crypto.randomUUID()}));
 await executeCommand(identity,{command:{type:'update-settings',values:data.settings},expectedRevision:data.revision,idempotencyKey:crypto.randomUUID()});data=await readWorkspace(identity);
 await executeCommand(identity,{command:{type:'update-floor',floor:1,purpose:data.floors[0].purpose,publicTitle:data.floors[0].publicTitle,publicDescription:data.floors[0].publicDescription},expectedRevision:data.revision,idempotencyKey:crypto.randomUUID()});data=await readWorkspace(identity);
 const run=async(command:AdminCommand)=>{data=await executeCommand(identity,{command,expectedRevision:data.revision,idempotencyKey:crypto.randomUUID()});return data;};
 const command:AdminCommand={type:'upsert-company',values:{name:'Disposable regression company '+crypto.randomUUID(),industry:'Retail',brand:'',contact:'Reviewer',email:'',phone:'',owner:'',note:'',taxId:'',address:''}},key=crypto.randomUUID(),revision=data.revision;
 data=await executeCommand(identity,{command,expectedRevision:revision,idempotencyKey:key});
 const company=data.companies.find(c=>c.name===command.values.name)!;assert.ok(company);
 const replay=await executeCommand(identity,{command,expectedRevision:revision,idempotencyKey:key});assert.equal(replay.revision,data.revision);assert.equal(replay.companies.filter(c=>c.id===company.id).length,1);
 await assert.rejects(executeCommand(identity,{command:{type:'save-company',companyId:company.id,note:'different'},expectedRevision:revision,idempotencyKey:key}),error=>error instanceof WorkspaceError&&error.status===409);
 const raced=await Promise.allSettled(['first','second'].map(note=>executeCommand(identity,{command:{type:'save-company',companyId:company.id,note},expectedRevision:data.revision,idempotencyKey:crypto.randomUUID()})));
 assert.equal(raced.filter(r=>r.status==='fulfilled').length,1);assert.equal(raced.filter(r=>r.status==='rejected').length,1);data=await readWorkspace(identity);
 const a=data.slots.find(s=>s.code==='A.1')!,b=data.slots.find(s=>s.code==='A.2')!,across=data.slots.find(s=>s.code==='A.6')!;
 assert.ok(a&&b&&across);assert.ok(a.connectedSlotIds?.includes(b.id));
 await assert.rejects(run({type:'merge',floor:1,slotIds:[a.id,across.id],name:'Across lobby'}));
 await run({type:'merge',floor:1,slotIds:[a.id,b.id],name:'Regression adjacent group'});const group=data.groups.find(g=>g.name==='Regression adjacent group')!;
 await run({type:'update-group',groupId:group.id,name:'Renamed adjacent group',status:'Đang thuê'});assert.equal(data.slots.find(s=>s.id===a.id)?.status,'Đang thuê');
 await run({type:'update-group',groupId:group.id,name:'Renamed adjacent group',status:'Trống'});await run({type:'split',groupId:group.id});
 const start=new Date(Date.now()+86400000).toISOString().slice(0,10),end=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
 await run({type:'save-request',values:{companyId:company.id,floor:1,slotIds:[a.id],start,end,note:''}});let request=data.requests.find(q=>q.companyId===company.id&&q.slotIds.includes(a.id)&&q.status==='submitted')!;
 await run({type:'review-request',requestId:request.id});await assert.rejects(run({type:'review-request',requestId:request.id}));
 await run({type:'approve-request',requestId:request.id,holdHours:48,note:'Approved test'});const hold=data.reservations.find(h=>h.requestId===request.id)!;
 assert.equal(data.slots.find(s=>s.id===a.id)?.status,'Trống');await assert.rejects(run({type:'update-slot',slotId:a.id,status:'Trống',tenant:''}));
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
 await run({type:'record-lease',reservationId:hold.id,mediaId:pdf});const lease=data.leases.find(l=>l.reservationId===hold.id)!;assert.ok(lease);assert.equal(data.reservations.find(h=>h.id===hold.id)?.status,'converted');assert.equal(data.slots.find(s=>s.id===a.id)?.status,'Đang thuê');assert.equal(lease.signedOn,undefined);
 await run({type:'attach-lease-document',leaseId:lease.id,mediaId:pdf});await assert.rejects(run({type:'cancel-hold',reservationId:hold.id,reason:'Already converted'}));
 await assert.rejects(run({type:'delete-media',mediaId:pdf}));await assert.rejects(run({type:'link-media',mediaId:pdf,scope:'Toàn dự án'}));
 const cancellationSlot=data.slots.find(s=>s.code==='C.1')!;
 await run({type:'save-request',values:{companyId:company.id,floor:3,slotIds:[cancellationSlot.id],start,end,note:'Cancellation test'}});const cancellingRequest=data.requests.find(q=>q.companyId===company.id&&q.note==='Cancellation test')!;
 await run({type:'approve-request',requestId:cancellingRequest.id,holdHours:48,note:''});const cancellingHold=data.reservations.find(h=>h.requestId===cancellingRequest.id)!;await run({type:'cancel-hold',reservationId:cancellingHold.id,reason:'Test cancellation'});

 await run({type:'save-request',values:{companyId:company.id,floor:1,slotIds:[b.id],start,end,note:''}});request=data.requests.find(q=>q.companyId===company.id&&q.slotIds.includes(b.id)&&q.status==='submitted')!;await run({type:'reject-request',requestId:request.id,reason:'Test rejection'});await assert.rejects(run({type:'approve-request',requestId:request.id,holdHours:48,note:''}));
 const startsAt=new Date(Date.now()+7*86400000).toISOString();await run({type:'save-appointment',values:{companyId:company.id,purpose:'Visit',startsAt,location:'Le Grande Centre',durationMinutes:30}});const appointment=data.appointments.find(a=>a.companyId===company.id)!;
 await run({type:'confirm-appointment',appointmentId:appointment.id});await run({type:'cancel-appointment',appointmentId:appointment.id});await assert.rejects(run({type:'confirm-appointment',appointmentId:appointment.id}));
 const publicData=await readPublicWebsite();assert.ok(publicData.units.length===81);assert.ok(!JSON.stringify(publicData).includes(company.name));assert.ok(publicData.units.every(u=>!('tenant' in u)));assert.ok(publicData.floors.every(f=>!('purpose' in f)));
 assert.equal(publicData.logoUrl, logo.url);
 const input={intent:'callback' as const,name:'Public regression',company:'',phone:'0973879563',email:'',business:'',area:'',timing:'',space:'',note:'',consent:true},intakeKey=crypto.randomUUID(),ipHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(crypto.randomUUID()))),b=>b.toString(16).padStart(2,'0')).join('');
 const accepted=await submitContact(input,{idempotencyKey:intakeKey,ipHash});assert.deepEqual(await submitContact(input,{idempotencyKey:intakeKey,ipHash}),accepted);await assert.rejects(submitContact(input,{idempotencyKey:crypto.randomUUID(),ipHash}),error=>error instanceof WorkspaceError&&error.status===429);
 await withTransaction('test:assertions',async client=>{const receipts=(await client.query('SELECT count(*) AS count FROM leasing.command_receipts WHERE actor_user_id=$1 AND idempotency_key=$2',[identity.id,key])).rows[0];assert.equal(Number(receipts.count),1);const actor=(await client.query('SELECT current_user AS role')).rows[0];assert.equal(actor.role,'leasing_runtime');await client.query('UPDATE leasing.users SET disabled_at=now() WHERE id=$1',[identity.id]);});
 assert.equal(await resolveAdminIdentity({issuer,subject,email,emailVerified:true}),null);await assert.rejects(readWorkspace(identity),error=>error instanceof WorkspaceError&&error.status===403);
});
