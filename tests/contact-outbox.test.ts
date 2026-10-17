import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { verifyOwnedLocalDatabase } from "../scripts/local-database-guard.mjs";
import { getDatabase, withTransaction } from "../src/server/database";
import { submitContact } from "../src/server/public";
import { dispatchContactNotifications } from "../src/server/contact-notifications";
import { POST as contact } from "../src/app/api/contact/route";

// Real PostgreSQL + loopback HTTP transport; never send regression PII to live services.
test("contact outbox commits atomically, retries durable receipts, fences overlapping claims and recovers expired leases", { skip: process.env.RUN_LOCAL_DATABASE_TESTS !== "1" }, async () => {
  await verifyOwnedLocalDatabase();
  const previous = { url: process.env.NOTIFICATIONS_URL, key: process.env.NOTIFICATIONS_API_KEY, rate: process.env.CONTACT_RATE_LIMIT_SECRET };
  const originalFetch = globalThis.fetch;
  const input = { intent: "callback" as const, name: "Durable outbox " + crypto.randomUUID(), company: "", phone: "0973879563", email: "", business: "", area: "", timing: "", space: "", note: "Private note must not leave source", consent: true };
  const idempotencyKey = crypto.randomUUID(), ipHash = "a".repeat(64), actor = "system:notification-dispatch";
  const seen: { key: string; text: string }[] = [];
  const accepted = new Map<string, string>();
  let mode: "hold" | "lost-ack" | "accept" | "invalid" | "unknown" | "failure" = "failure";
  let failureStatus = 409;
  let release: (() => void) | undefined;
  let incoming: (() => void) | undefined;
  const arrived = new Promise<void>(resolve => { incoming = resolve; });
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const key = String(request.headers["idempotency-key"]);
    assert.equal(request.url, "/v1/notifications");
    assert.equal(request.headers.authorization, "Bearer test-website-key");
    assert.deepEqual(Object.keys(body).sort(), ["channel", "text"]);
    assert.equal(body.channel, "zalo");
    assert.equal(body.text.includes(input.note), false);
    seen.push({ key, text: body.text });
    if (mode === "hold") { incoming?.(); await new Promise<void>(resolve => { release = resolve; }); }
    if (mode === "failure") { response.writeHead(failureStatus); response.end('{"error":"website_unlinked"}'); return; }
    if (mode === "invalid") { response.writeHead(200, { "Content-Type": "application/json" }); response.end('{"ok":true}'); return; }
    const remoteId = accepted.get(key) ?? crypto.randomUUID();
    accepted.set(key, remoteId);
    if (mode === "lost-ack") { response.destroy(); return; }
    response.writeHead(202, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ id: remoteId, channel: "zalo", status: mode === "unknown" ? "unknown" : "queued", createdAt: new Date().toISOString(), sentAt: null }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string");
  process.env.NOTIFICATIONS_URL = "https://owned-notification-fixture.invalid/v1/notifications";
  process.env.NOTIFICATIONS_API_KEY = "test-website-key";
  process.env.CONTACT_RATE_LIMIT_SECRET = "outbox-rate-test-".repeat(4);
  // Only the owned fake hostname is remapped; use native fetch and real sockets.
  globalThis.fetch = (url, init) => new URL(String(url)).hostname === "owned-notification-fixture.invalid"
    ? originalFetch(`http://127.0.0.1:${address.port}${new URL(String(url)).pathname}`, init)
    : originalFetch(url, init);
  const owner = getDatabase();
  try {
    // An enqueue failure rolls back the business lead and intake as well.
    await owner.query(`CREATE FUNCTION leasing.test_outbox_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned outbox rollback regression'; END $$;
      CREATE TRIGGER test_outbox_reject BEFORE INSERT ON leasing.contact_notification_outbox FOR EACH ROW EXECUTE FUNCTION leasing.test_outbox_reject()`);
    try {
      await assert.rejects(submitContact(input, { idempotencyKey, ipHash }));
      await withTransaction("test:outbox-rollback", async client => {
        assert.equal(Number((await client.query("SELECT count(*) AS n FROM leasing.leads WHERE name=$1", [input.name])).rows[0].n), 0);
        assert.equal(Number((await client.query("SELECT count(*) AS n FROM leasing.contact_intake WHERE idempotency_key=$1", [idempotencyKey])).rows[0].n), 0);
      });
    } finally {
      await owner.query("DROP TRIGGER test_outbox_reject ON leasing.contact_notification_outbox; DROP FUNCTION leasing.test_outbox_reject()");
    }
    // Public response commits while the notification service is unlinked/offline; no network call.
    const response = await contact(new Request("https://example.test/api/contact", { method: "POST", headers: { Origin: "https://example.test", "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify(input) }));
    assert.equal(response.status, 201);
    assert.equal(seen.length, 0);
    const intake = await withTransaction("test:contact-receipt", async client => (await client.query("SELECT id FROM leasing.contact_intake WHERE idempotency_key=$1", [idempotencyKey])).rows[0]);
    assert.ok(intake);
    const replay = await submitContact(input, { idempotencyKey, ipHash });
    assert.equal(replay.created, false); assert.equal(replay.id, intake.id);
    await withTransaction(actor, async client => {
      const rows = (await client.query("SELECT * FROM leasing.contact_notification_outbox WHERE intake_id=$1", [intake.id])).rows;
      assert.equal(rows.length, 1); assert.equal(rows[0].request_key, `contact:${intake.id}:zalo`); assert.equal(rows[0].forwarded_at, null);
      // Isolate pending rows made by other regression files without deleting their evidence.
      await client.query("UPDATE leasing.contact_notification_outbox SET available_at=now()+interval '1 day' WHERE intake_id<>$1 AND forwarded_at IS NULL", [intake.id]);
    });
    await withTransaction("public:intake", async client => {
      assert.equal((await client.query("SELECT * FROM leasing.contact_notification_outbox WHERE intake_id=$1", [intake.id])).rowCount, 0);
      assert.equal((await client.query("UPDATE leasing.contact_notification_outbox SET payload='tamper' WHERE intake_id=$1", [intake.id])).rowCount, 0);
    });
    // No failure or malformed ACK is allowed to erase the source event.
    for (const failure of [409, 401, 503, "invalid", "unknown", "lost-ack"] as const) {
      mode = typeof failure === "number" ? "failure" : failure;
      if (typeof failure === "number") failureStatus = failure;
      await withTransaction(actor, client => client.query("UPDATE leasing.contact_notification_outbox SET available_at=now() WHERE intake_id=$1", [intake.id]));
      assert.deepEqual(await dispatchContactNotifications(), { claimed: 1, forwarded: 0 });
      await withTransaction(actor, async client => {
        const row = (await client.query("SELECT * FROM leasing.contact_notification_outbox WHERE intake_id=$1", [intake.id])).rows[0];
        assert.equal(row.forwarded_at, null); assert.ok(row.payload); assert.equal(row.lease_token, null); assert.ok(new Date(row.available_at).getTime() > Date.now());
      });
    }
    mode = "hold";
    await withTransaction(actor, client => client.query("UPDATE leasing.contact_notification_outbox SET available_at=now() WHERE intake_id=$1", [intake.id]));
    const running = dispatchContactNotifications();
    await arrived;
    try {
      // This write would block if the network request still held a database transaction/row lock.
      await withTransaction(actor, async client => {
        await client.query("SET LOCAL lock_timeout='1s'");
        await client.query("UPDATE leasing.contact_notification_outbox SET available_at=now() WHERE intake_id=$1", [intake.id]);
        const row = (await client.query("SELECT lease_until FROM leasing.contact_notification_outbox WHERE intake_id=$1", [intake.id])).rows[0];
        assert.ok(new Date(row.lease_until).getTime() > Date.now() + 120_000);
      });
      assert.deepEqual(await dispatchContactNotifications(), { claimed: 0, forwarded: 0 });
    } finally { release?.(); }
    assert.deepEqual(await running, { claimed: 1, forwarded: 1 });
    await withTransaction(actor, async client => {
      const row = (await client.query("SELECT * FROM leasing.contact_notification_outbox WHERE intake_id=$1", [intake.id])).rows[0];
      assert.ok(row.forwarded_at); assert.equal(row.payload, null); assert.equal(row.remote_id, accepted.get(`contact:${intake.id}:zalo`));
      // Simulate an abandoned process claim: the next scheduled run must recover it.
      await client.query("UPDATE leasing.contact_notification_outbox SET forwarded_at=NULL,payload=$2,remote_id=NULL,lease_token=$3,lease_until=now()-interval '1 second',available_at=now() WHERE intake_id=$1", [intake.id, seen[0].text, crypto.randomUUID()]);
    });
    mode = "accept";
    assert.deepEqual(await dispatchContactNotifications(), { claimed: 1, forwarded: 1 });
    assert.equal(new Set(seen.map(row => row.key)).size, 1);
    assert.equal(new Set(seen.map(row => row.text)).size, 1);
    assert.equal(accepted.size, 1, "uncertain HTTP ACK retries reuse the remote receipt");
    assert.deepEqual(await dispatchContactNotifications(), { claimed: 0, forwarded: 0 });
  } finally {
    release?.();
    globalThis.fetch = originalFetch;
    if (previous.url === undefined) delete process.env.NOTIFICATIONS_URL; else process.env.NOTIFICATIONS_URL = previous.url;
    if (previous.key === undefined) delete process.env.NOTIFICATIONS_API_KEY; else process.env.NOTIFICATIONS_API_KEY = previous.key;
    if (previous.rate === undefined) delete process.env.CONTACT_RATE_LIMIT_SECRET; else process.env.CONTACT_RATE_LIMIT_SECRET = previous.rate;
    await owner.end();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
