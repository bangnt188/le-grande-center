import test from "node:test";
import assert from "node:assert/strict";
import { createDemoRepository } from "../src/features/admin/demo/repository";
import { createHttpRepository } from "../src/features/admin/http-repository";
import { STORAGE_LIMIT_BYTES, storageUploadIssue } from "../src/shared/admin/storage-policy";
import { vietnamToday } from "../src/features/admin/demo/validation";

test("merge/split retains slot identity, status and uploaded media association", async t => {
  const repo = createDemoRepository();
  t.after(() => repo.dispose());
  const initial = await repo.read();
  const ids = initial.slots.map((slot) => slot.id);
  const joined = await repo.execute({ type: "merge", floor: 2, slotIds: ["T2-B2", "T2-B3"], name: "Mặt bằng thử" });
  const group = joined.groups.find((item) => item.name === "Mặt bằng thử")!;
  assert.deepEqual(joined.slots.map((slot) => slot.id), ids);
  const uploaded = await repo.upload([new File(["%PDF-1.7\n%%EOF"], "plan.pdf", { type: "application/pdf" })], `group:${group.id}`);
  const mediaId = uploaded.media.find(item => item.hasUploadedFile)!.id;
  const updated = await repo.execute({ type: "update-group", groupId: group.id, name: "Đổi tên", status: "Đang thuê" });
  assert.deepEqual(updated.slots.filter(slot => group.slotIds.includes(slot.id)).map(slot => slot.status), ["Đang thuê", "Đang thuê"]);
  const split = await repo.execute({ type: "split", groupId: group.id });
  assert.equal(split.media.find(item => item.id === mediaId)?.scope, "Tầng 2");
  assert.equal(split.slots.find((item) => item.id === "T2-B2")?.status, "Đang thuê");
  assert.deepEqual(split.slots.map((slot) => slot.id), ids);
});

test("rejects cross-floor, cross-core, nonadjacent and duplicate memberships without mutation", async () => {
  const repo = createDemoRepository();
  for (const slotIds of [["T2-B2","T3-B3"], ["T2-B5","T2-B6"], ["T2-B7","T2-B10"], ["T2-B8","T2-B9"]]) {
    await assert.rejects(repo.execute({ type: "merge", floor: 2, slotIds, name: "Invalid" }));
  }
  assert.equal((await repo.read()).revision, 0);
  const snapshot = await repo.read(); snapshot.slots.length = 0;
  assert.equal((await repo.read()).slots.length, 66);
});

test("HTTP adapter rejects invalid snapshot states/config/media, unsafe URLs and conflicts", async () => {
  const originalFetch = globalThis.fetch;
  const data = await createDemoRepository().read();
  globalThis.fetch = async () => new Response(JSON.stringify(data), { status: 200 });
  try {
    const repo = createHttpRepository("https://api.example.test/admin");
    await repo.read();
    globalThis.fetch = async () => Response.json({ ...data, slots: data.slots.map((slot, index) => index === 0 ? { ...slot, status: "Đang giữ chỗ" } : slot) });
    await assert.rejects(repo.read(), /Trống hoặc Đang thuê/);
    globalThis.fetch = async () => Response.json({ ...data, groups: data.groups.map(group => ({ ...group, status: "Đã đặt cọc" })) });
    await assert.rejects(repo.read(), /Trống hoặc Đang thuê/);
    globalThis.fetch = async () => Response.json({ ...data, floors: data.floors.slice(1) });
    await assert.rejects(repo.read(), /cấu hình tầng/);
    globalThis.fetch = async () => Response.json({ ...data, settings: { ...data.settings, defaultHoldHours: 0 } });
    await assert.rejects(repo.read(), /cấu hình tầng/);
    globalThis.fetch = async () => Response.json({ ...data, media: data.media.map(({ hasUploadedFile: _uploaded, ...item }) => item) });
    await assert.rejects(repo.read(), /tệp đã upload/);
    globalThis.fetch = async () => new Response("", { status: 409 });
    await assert.rejects(repo.execute({ type: "split", groupId: "a" }), /Dữ liệu đã thay đổi/);
    assert.throws(() => createHttpRepository("http://api.example.test"), /HTTPS/);
    assert.throws(() => createHttpRepository("https://user:pass@api.example.test"), /credentials/);
  } finally { globalThis.fetch = originalFetch; }
});

test("slot fixtures agree with lease occupancy and reject unsupported statuses atomically", async () => {
  const repo = createDemoRepository();
  const initial = await repo.read();
  for (const slot of initial.slots) {
    const lease = initial.leases.find(item => item.slotIds.includes(slot.id));
    assert.equal(slot.status, lease ? "Đang thuê" : "Trống");
    assert.equal(slot.tenant, lease ? initial.companies.find(item => item.id === lease.companyId)?.name : "");
  }
  for (const group of initial.groups) assert.ok(initial.slots.filter(slot => group.slotIds.includes(slot.id)).every(slot => slot.status === group.status));
  await assert.rejects(repo.execute(JSON.parse('{"type":"update-slot","slotId":"T2-B4","status":"Đang đàm phán","tenant":""}')), /Trống hoặc Đang thuê/);
  assert.deepEqual(await repo.read(), initial);
  const joined = await repo.execute({ type: "merge", floor: 2, slotIds: ["T2-B2", "T2-B3"], name: "Nhóm kiểm tra" });
  const group = joined.groups.find(item => item.name === "Nhóm kiểm tra")!;
  await assert.rejects(repo.execute({ ...JSON.parse('{"type":"update-group","name":"Tên lỗi","status":"Đã đặt cọc"}'), groupId: group.id }), /Trống hoặc Đang thuê/);
  assert.deepEqual(await repo.read(), joined);
  const rented = await repo.execute({ type: "update-slot", slotId: "T2-B4", status: "Đang thuê", tenant: "Đối tác thử" });
  assert.equal(rented.slots.find(slot => slot.id === "T2-B4")?.tenant, "Đối tác thử");
  const vacant = await repo.execute({ type: "update-slot", slotId: "T2-B4", status: "Trống", tenant: "Đối tác thử" });
  assert.equal(vacant.slots.find(slot => slot.id === "T2-B4")?.tenant, "");
});

test("holds protect vacant slots without becoming a third occupancy status", async () => {
  const repo = createDemoRepository();
  const held = await repo.execute({ type: "approve-request", requestId: "YC-2026-016", holdHours: 24, note: "Giữ chỗ kiểm tra" });
  const hold = held.reservations.find(item => item.requestId === "YC-2026-016")!;
  assert.equal(held.slots.find(slot => slot.id === "T3-B7")?.status, "Trống");
  assert.equal(held.slots.find(slot => slot.id === "T3-B7")?.tenant, "");
  await assert.rejects(repo.execute({ type: "merge", floor: 3, slotIds: ["T3-B6", "T3-B7"], name: "Không được ghép" }), /cam kết/);
  await assert.rejects(repo.execute({ type: "update-slot", slotId: "T3-B7", status: "Đang thuê", tenant: "Sai luồng" }), /cam kết/);
  assert.deepEqual(await repo.read(), held);
  await assert.rejects(repo.execute({ type: "record-lease", reservationId: hold.id, mediaId: "sample-brochure" }));
  const file = new File(["%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF"], "lease.pdf", { type: "application/pdf" });
  const uploaded = await repo.upload([file], "Toàn dự án");
  const converted = await repo.execute({ type: "record-lease", reservationId: hold.id, mediaId: uploaded.media[0].id });
  assert.equal(converted.slots.find(slot => slot.id === "T3-B7")?.status, "Đang thuê");
  assert.equal(converted.slots.find(slot => slot.id === "T3-B7")?.tenant, held.companies.find(item => item.id === hold.companyId)?.name);
  assert.equal(converted.leases.find(lease => lease.reservationId === hold.id)?.signedOn, undefined);
  repo.dispose();
});

test("floor/settings/lead CRUD enforce bounds and roll back invalid mutations", async () => {
  const repo = createDemoRepository(), initial = await repo.read();
  assert.equal(repo.initialSnapshot, null);
  assert.equal(initial.floors.length, 6);
  assert.equal(initial.storage?.usedBytes, 0);
  await assert.rejects(repo.execute({ type: "update-floor", floor: 1, purpose: "x".repeat(121), publicTitle: "Tên", publicDescription: "Mô tả" }));
  await assert.rejects(repo.execute({ type: "update-floor", floor: 1, purpose: "TMD", publicTitle: "Tên tầng", publicDescription: "x".repeat(601) }));
  await assert.rejects(repo.execute({ type: "update-settings", values: { ...initial.settings, defaultHoldHours: 721 } }));
  await assert.rejects(repo.execute({ type: "update-settings", values: { ...initial.settings, appointmentMinutes: 14 } }));
  await assert.rejects(repo.execute({ type: "update-settings", values: { ...initial.settings, contactEmail: "not-email" } }));
  assert.deepEqual(await repo.read(), initial);
  const floor = await repo.execute({ type: "update-floor", floor: 3, purpose: "Văn phòng mới", publicTitle: "Không gian dịch vụ", publicDescription: "Mô tả đã cập nhật." });
  assert.deepEqual(floor.floors[2], { number: 3, purpose: "Văn phòng mới", publicTitle: "Không gian dịch vụ", publicDescription: "Mô tả đã cập nhật." });
  const settings = await repo.execute({ type: "update-settings", values: { ...initial.settings, defaultHoldHours: 72, contactEmail: "" } });
  assert.equal(settings.settings.defaultHoldHours, 72);
  const values = { name: "Khách mới", interest: "Thuê văn phòng", floor: 3, source: "Hotline", status: "Mới", note: "", companyId: "company-an", email: "test@example.com", phone: "0901234567" } as const;
  await assert.rejects(repo.execute({ type: "save-lead", values: { ...values, companyId: "missing" } }));
  await assert.rejects(repo.execute({ type: "save-lead", values: { ...values, phone: "wrong" } }));
  await assert.rejects(repo.execute(JSON.parse(JSON.stringify({ type: "save-lead", values: { ...values, status: "unknown" } }))));
  const created = await repo.execute({ type: "save-lead", values });
  const lead = created.leads[0];
  const edited = await repo.execute({ type: "save-lead", leadId: lead.id, values: { ...values, status: "Đã xử lý", note: "Hoàn tất" } });
  assert.equal(edited.leads[0].id, lead.id); assert.equal(edited.leads[0].status, "Đã xử lý");
});

test("company CRUD validates contacts and refreshes leased tenant names", async () => {
  const repo = createDemoRepository(), initial = await repo.read();
  const company = initial.companies[1];
  await assert.rejects(repo.execute({ type: "upsert-company", companyId: company.id, values: { ...company, email: "invalid" } }));
  await assert.rejects(repo.execute({ type: "upsert-company", companyId: company.id, values: { ...company, name: "x".repeat(81) } }));
  assert.deepEqual(await repo.read(), initial);
  const renamed = await repo.execute({ type: "upsert-company", companyId: company.id, values: { ...company, name: "Lam Mới" } });
  assert.equal(renamed.slots.find(slot => slot.id === "T1-B1")?.tenant, "Lam Mới");
});

test("request CRUD derives area and rejects invalid geometry, dates and decided edits", async () => {
  const repo = createDemoRepository();
  const start = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), end = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const values = { companyId: "company-an", floor: 5, slotIds: ["T5-B2", "T5-B3"], start, end, note: "" } as const;
  const input = { ...values, slotIds: [...values.slotIds] };
  for (const slotIds of [["T5-B2", "T5-B2"], ["T5-B2", "T6-B3"], ["T5-B5", "T5-B6"], ["T5-B2", "T5-B4"]]) await assert.rejects(repo.execute({ type: "save-request", values: { ...input, slotIds } }));
  await assert.rejects(repo.execute({ type: "save-request", values: { ...input, start: "2026-02-30" } }));
  await assert.rejects(repo.execute({ type: "save-request", values: { ...input, start: "2020-01-01" } }));
  const created = await repo.execute({ type: "save-request", values: input }), request = created.requests.at(-1)!;
  assert.equal(request.area, 328);
  const changed = await repo.execute({ type: "update-slot", slotId: "T5-B2", status: "Trống", tenant: "", area: 200 });
  assert.equal(changed.requests.at(-1)?.area, 364);
  await assert.rejects(repo.execute({ type: "update-slot", slotId: "T5-B2", status: "Trống", tenant: "", area: 100001 }));
  const reviewed = await repo.execute({ type: "review-request", requestId: request.id });
  assert.equal(reviewed.requests.at(-1)?.status, "reviewing");
  const held = await repo.execute({ type: "approve-request", requestId: request.id, holdHours: 24, note: "" });
  assert.equal(held.reservations.at(-1)?.area, 364);
  await assert.rejects(repo.execute({ type: "save-request", requestId: request.id, values: input }));
  await assert.rejects(repo.execute({ type: "update-slot", slotId: "T5-B2", status: "Trống", tenant: "", area: 210 }), /cam kết/);
  await repo.execute({ type: "cancel-hold", reservationId: held.reservations.at(-1)!.id, reason: "Đổi phương án" });
  await repo.execute({ type: "cancel-hold", reservationId: "GC-2026-009", reason: "Đổi phương án" });
  await assert.rejects(repo.execute({ type: "save-request", values: { ...input, floor: 2, slotIds: ["T2-B8"] } }), /toàn bộ/);
  const whole = await repo.execute({ type: "save-request", values: { ...input, floor: 2, slotIds: ["T2-B8", "T2-B9"] } });
  assert.equal(whole.requests.at(-1)?.area, 328);
});

test("PDF attachment protects association, allows replacement, and accounts for bytes", async t => {
  const repo = createDemoRepository(); t.after(() => repo.dispose());
  const first = new File(["%PDF-1.7\nfirst\n%%EOF"], "first.pdf", { type: "application/pdf" });
  const second = new File(["%PDF-1.7\nsecond\n%%EOF"], "second.pdf", { type: "application/pdf" });
  const uploaded = await repo.upload([first, second], "Toàn dự án");
  const firstId = uploaded.media.find(item => item.name === "first.pdf")!.id, secondId = uploaded.media.find(item => item.name === "second.pdf")!.id;
  assert.equal(uploaded.storage?.usedBytes, first.size + second.size);
  const linked = await repo.execute({ type: "attach-lease-document", leaseId: "HD-2026-004", mediaId: firstId });
  await assert.rejects(repo.execute({ type: "delete-media", mediaId: firstId }));
  await assert.rejects(repo.execute({ type: "link-media", mediaId: firstId, scope: "Tầng 3" }));
  await assert.rejects(repo.execute({ type: "attach-lease-document", leaseId: "HD-2026-003", mediaId: firstId }), /khác/);
  assert.deepEqual(await repo.read(), linked);
  const renamed = await repo.execute({ type: "rename-media", mediaId: firstId, name: "Đổi tên PDF" });
  assert.equal(renamed.leases.find(lease => lease.id === "HD-2026-004")?.documentName, "Đổi tên PDF");
  const replaced = await repo.execute({ type: "attach-lease-document", leaseId: "HD-2026-004", mediaId: secondId });
  assert.equal(replaced.media.find(item => item.id === firstId)?.scope, "Tầng 1");
  await assert.rejects(repo.execute({ type: "delete-media", mediaId: "contract-sample-pdf" }), /Asset website/);
  assert.equal((await repo.read()).storage?.usedBytes, first.size + second.size);
  const removed = await repo.execute({ type: "delete-media", mediaId: firstId });
  assert.equal(removed.storage?.usedBytes, second.size);
  const oldUrl = removed.media.find(item => item.id === secondId)?.url;
  repo.dispose();
  const rehydrated = await repo.read();
  assert.notEqual(rehydrated.media.find(item => item.id === secondId)?.url, oldUrl);
  assert.equal(await (await fetch(rehydrated.media.find(item => item.id === secondId)!.url!)).text(), await second.text());
  await assert.rejects(repo.execute({ type: "delete-media", mediaId: "plan-reference" }), /Asset website/);
});

test("upload validates actual content atomically and quota policy has exact byte bounds", async t => {
  const repo = createDemoRepository(); t.after(() => repo.dispose()); const initial = await repo.read();
  const valid = new File(["%PDF-1.7\n%%EOF"], "ok.pdf", { type: "application/pdf" });
  const fake = new File(["not a pdf"], "fake.pdf", { type: "application/pdf" });
  await assert.rejects(repo.upload([valid, fake], "Toàn dự án"));
  await assert.rejects(repo.upload([new File([new Uint8Array(10 * 1024 * 1024 + 1)], "too-big.pdf", { type: "application/pdf" })], "Toàn dự án"));
  await assert.rejects(repo.upload([new File([""], "empty.pdf", { type: "application/pdf" })], "Toàn dự án"));
  await assert.rejects(repo.upload([valid], "Tầng 7"));
  assert.deepEqual(await repo.read(), initial);
  assert.equal(storageUploadIssue({ usedBytes: STORAGE_LIMIT_BYTES - valid.size, reservedBytes: 0 }, [valid]), null);
  assert.match(storageUploadIssue({ usedBytes: STORAGE_LIMIT_BYTES - valid.size + 1, reservedBytes: 0 }, [valid])!, /8,5 GB/);
  const uploaded = await repo.upload([valid], "Toàn dự án");
  assert.equal(uploaded.media[0].mimeType, "application/pdf"); assert.equal(uploaded.media[0].sizeBytes, valid.size);
  const removed = await repo.execute({ type: "delete-media", mediaId: uploaded.media[0].id });
  assert.equal(removed.storage?.usedBytes, 0);
});

test("appointment duration intervals, future clock and state transitions are enforced", async () => {
  const repo = createDemoRepository();
  const startsAt = new Date(Date.now() + 5 * 86400000).toISOString();
  const values = { companyId: "company-an", startsAt, durationMinutes: 60, purpose: "Tham quan", location: "Sảnh" };
  await assert.rejects(repo.execute({ type: "save-appointment", values: { ...values, startsAt: new Date(Date.now() - 60000).toISOString() } }));
  await assert.rejects(repo.execute({ type: "save-appointment", values: { ...values, durationMinutes: 241 } }));
  const created = await repo.execute({ type: "save-appointment", values }), appointment = created.appointments.at(-1)!;
  await assert.rejects(repo.execute({ type: "save-appointment", values: { ...values, startsAt: new Date(Date.parse(startsAt) + 45 * 60000).toISOString(), durationMinutes: 30 } }));
  await repo.execute({ type: "save-appointment", values: { ...values, startsAt: new Date(Date.parse(startsAt) + 60 * 60000).toISOString(), durationMinutes: 30 } });
  const confirmed = await repo.execute({ type: "confirm-appointment", appointmentId: appointment.id });
  assert.equal(confirmed.appointments.find(item => item.id === appointment.id)?.status, "confirmed");
  await repo.execute({ type: "save-appointment", appointmentId: appointment.id, values: { ...values, purpose: "Đổi nội dung" } });
  await repo.execute({ type: "cancel-appointment", appointmentId: appointment.id });
  await assert.rejects(repo.execute({ type: "save-appointment", appointmentId: appointment.id, values }));
});

test("hold deadlines use actual clock and expiry no longer locks vacant inventory", async t => {
  const repo = createDemoRepository(); t.after(() => repo.dispose());
  const initial = await repo.read(), hold = initial.reservations[0];
  assert.ok(Date.parse(hold.expiresAt) > Date.now());
  const file = new File(["%PDF-1.7\n%%EOF"], "lease.pdf", { type: "application/pdf" });
  const uploaded = await repo.upload([file], "Toàn dự án");
  const originalNow = Date.now;
  Date.now = () => Date.parse(hold.expiresAt) + 1;
  try {
    await assert.rejects(repo.execute({ type: "record-lease", reservationId: hold.id, mediaId: uploaded.media[0].id }), /hết hạn/);
    assert.deepEqual(await repo.read(), uploaded);
    const split = await repo.execute({ type: "split", groupId: "demo-group-2-8-9" });
    assert.ok(!split.groups.some(group => group.id === "demo-group-2-8-9"));
  } finally { Date.now = originalNow; }
});

test("operations serialize without dropping siblings and node repositories are isolated", async () => {
  const repo = createDemoRepository();
  const results = await Promise.all([repo.execute({ type: "update-floor", floor: 1, purpose: "Một", publicTitle: "Một", publicDescription: "Mô tả một" }), repo.execute({ type: "update-floor", floor: 2, purpose: "Hai", publicTitle: "Hai", publicDescription: "Mô tả hai" })]);
  assert.deepEqual(results.map(item => item.revision), [1, 2]);
  assert.deepEqual((await repo.read()).floors.slice(0, 2).map(item => item.purpose), ["Một", "Hai"]);
  assert.equal((await createDemoRepository().read()).revision, 0);
  await assert.rejects(repo.execute(JSON.parse("{\"type\":\"unknown-operation\"}")), /không được hỗ trợ/);
  assert.equal((await repo.read()).revision, 2);
  assert.equal(vietnamToday(Date.parse("2026-10-12T18:00:00Z")), "2026-10-13");
});

test("browser without IndexedDB fails visibly instead of falling back to memory", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  try {
    const repo = createDemoRepository();
    assert.equal(repo.initialSnapshot, null);
    await assert.rejects(repo.read(), /IndexedDB/);
    await assert.rejects(repo.execute({ type: "update-floor", floor: 1, purpose: "Không được lưu", publicTitle: "Tầng 1", publicDescription: "Mô tả tầng 1" }), /IndexedDB/);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor); else Reflect.deleteProperty(globalThis, "window");
  }
});
