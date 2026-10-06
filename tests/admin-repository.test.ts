import test from "node:test";
import assert from "node:assert/strict";
import { createDemoRepository } from "../src/features/admin/demo-repository";
import { createHttpRepository } from "../src/features/admin/http-repository";

test("merge/split retains slot identity, status and media association", async () => {
  const repo = createDemoRepository();
  const initial = await repo.read();
  const ids = initial.slots.map((slot) => slot.id);
  const joined = await repo.execute({ type: "merge", floor: 2, slotIds: ["T2-B2", "T2-B3"], name: "Mặt bằng thử" });
  const group = joined.groups.find((item) => item.name === "Mặt bằng thử")!;
  assert.deepEqual(joined.slots.map((slot) => slot.id), ids);
  assert.equal(joined.revision, 1);
  await repo.execute({ type: "link-media", mediaId: "sample-plan", scope: `group:${group.id}` });
  await repo.execute({ type: "update-group", groupId: group.id, name: "Đổi tên", status: "Chờ duyệt" });
  const split = await repo.execute({ type: "split", groupId: group.id });
  assert.equal(split.media.find((item) => item.id === "sample-plan")?.scope, "Tầng 2");
  assert.equal(split.slots.find((item) => item.id === "T2-B2")?.status, "Chờ duyệt");
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

test("HTTP adapter passes revision and idempotency, handles conflicts", async () => {
  const originalFetch = globalThis.fetch;
  const data = await createDemoRepository().read();
  const requests: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    return new Response(JSON.stringify(data), { status: 200 });
  };
  try {
    const repo = createHttpRepository("https://api.example.test/admin");
    await repo.read();
    await repo.execute({ type: "update-lead", leadId: "DEMO-1048", status: "Hẹn khảo sát", note: "" });
    assert.equal(requests[1].url, "https://api.example.test/admin/commands");
    assert.equal(requests[1].init?.credentials, "include");
    assert.equal(JSON.parse(String(requests[1].init?.body)).expectedRevision, 0);
    assert.ok(new Headers(requests[1].init?.headers).get("Idempotency-Key"));
    globalThis.fetch = async () => new Response("", { status: 409 });
    await assert.rejects(repo.execute({ type: "split", groupId: "a" }), /Dữ liệu đã thay đổi/);
    assert.throws(() => createHttpRepository("http://api.example.test"), /HTTPS/);
    assert.throws(() => createHttpRepository("https://user:pass@api.example.test"), /credentials/);
  } finally { globalThis.fetch = originalFetch; }
});
