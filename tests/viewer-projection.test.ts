import assert from "node:assert/strict";
import test from "node:test";
import publication from "../public/model-3d/viewer-projection.json";
import { loadPublicProjection, validatePublicProjection } from "../src/app/model-3d/projection";

const NOW = Date.parse("2026-10-07T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const fixture = () => structuredClone(publication);
const claims = () => ({
  ...fixture(),
  slots: [{
    ...publication.slots[0], area: 164, tenant: "Published tenant", availability: "Subject to confirmation",
    approved: { area: true, tenant: true, availability: true },
  }],
});


test("unknown and private fields are stripped at every level without mutating the input", () => {
  const input = {
    ...fixture(), privateNote: "secret", rent: 99, objectKey: "contract.pdf", permissions: ["admin"],
    camera: { position: [0, -100, 0] },
    floors: [{ ...publication.floors[0], internalNote: "secret" }],
    slots: [{ ...publication.slots[0], tenant: "Private tenant", area: 164, availability: "available",
      approval: true, approved: { tenant: "true" }, contractUrl: "https://private.example/contract", customerEmail: "pii" }],
  };
  const before = structuredClone(input);
  const result = validatePublicProjection(input, NOW);
  assert.equal(result.status, "ready");
  assert.ok(result.projection);
  assert.deepEqual(Object.keys(result.projection).sort(),
    ["allowedPresetIds", "floors", "publicationRevision", "sceneVersion", "schemaVersion", "slots", "updatedAt"]);
  assert.deepEqual(result.projection.floors[0], publication.floors[0]);
  assert.deepEqual(result.projection.slots[0], publication.slots[0]);
  assert.deepEqual(input, before);
});

test("claim fields require individual explicit approval and return only sanitized public fields", () => {
  const input = claims();
  const result = validatePublicProjection(input, NOW);
  assert.equal(result.status, "ready");
  assert.deepEqual(result.projection?.slots[0], {
    ...publication.slots[0], area: 164, tenant: "Published tenant", availability: "Subject to confirmation",
  });
  input.slots[0].approved.tenant = false;
  input.slots[0].approved.availability = false;
  const partial = validatePublicProjection(input, NOW).projection?.slots[0];
  assert.equal(partial?.area, 164);
  assert.equal(partial?.tenant, undefined);
  assert.equal(partial?.availability, undefined);
});

test("incompatible scene/schema, anchors, floor relationships and presets fail closed", () => {
  const invalid: unknown[] = [
    { ...claims(), schemaVersion: 2 }, { ...claims(), sceneVersion: "old-scene" },
    { ...claims(), allowedPresetIds: ["rooftop"] }, { ...claims(), allowedPresetIds: ["rear"] },
    { ...claims(), floors: [{ floorId: "T7", label: "Unknown floor" }] },
    { ...claims(), slots: [{ ...claims().slots[0], slotId: "T1-B12" }] },
    { ...claims(), slots: [{ ...claims().slots[0], floorId: "T2" }] },
    { ...claims(), floors: [publication.floors[1]] },
  ];
  for (const input of invalid) {
    const result = validatePublicProjection(input, NOW);
    assert.equal(result.status, "mismatch");
    assert.equal(result.projection, null);
  }
});

test("malformed types, duplicates, text limits and invalid approved claims fail closed", () => {
  const invalid: unknown[] = [
    null, [], "bad", {},
    { ...claims(), allowedPresetIds: ["front", "front"] },
    { ...claims(), allowedPresetIds: [] },
    { ...claims(), floors: [publication.floors[0], publication.floors[0]] },
    { ...claims(), slots: [claims().slots[0], claims().slots[0]] },
    { ...claims(), floors: [{ ...publication.floors[0], label: "x".repeat(161) }] },
    { ...claims(), publicationRevision: " " }, { ...claims(), publicationRevision: "x".repeat(81) },
    { ...claims(), slots: [{ ...claims().slots[0], label: "bad\nlabel" }] },
    { ...claims(), slots: [{ ...claims().slots[0], confidence: "surveyed" }] },
    { ...claims(), slots: [{ ...claims().slots[0], area: -1 }] },
    { ...claims(), slots: [{ ...claims().slots[0], area: Infinity }] },
    { ...claims(), slots: [{ ...claims().slots[0], tenant: "x".repeat(161) }] },
    { ...claims(), slots: [{ ...claims().slots[0], availability: { status: "available" } }] },
    { ...claims(), updatedAt: "invalid date" }, { ...claims(), updatedAt: "2026-10-07" },
  ];
  for (const input of invalid) {
    const result = validatePublicProjection(input, NOW);
    assert.notEqual(result.status, "ready");
    assert.equal(result.projection, null);
  }
});

test("freshness is bounded to 24 hours with five-minute clock-skew tolerance and no stale claims", () => {
  const input = claims();
  assert.equal(validatePublicProjection({ ...input, updatedAt: "2026-09-31T12:00:00Z" },
    Date.parse("2026-10-01T12:00:00Z")).status, "unavailable");
  input.updatedAt = new Date(NOW - DAY).toISOString();
  assert.equal(validatePublicProjection(input, NOW).status, "ready");
  input.updatedAt = new Date(NOW - DAY - 1).toISOString();
  assert.equal(validatePublicProjection(input, NOW).status, "stale");
  assert.equal(validatePublicProjection(input, NOW).projection, null);
  input.updatedAt = new Date(NOW + 5 * 60 * 1000).toISOString();
  assert.equal(validatePublicProjection(input, NOW).status, "ready");
  input.updatedAt = new Date(NOW + 5 * 60 * 1000 + 1).toISOString();
  assert.equal(validatePublicProjection(input, NOW).status, "unavailable");
  assert.equal(validatePublicProjection(input, NOW).projection, null);
  assert.equal(validatePublicProjection(input, NaN).projection, null);
});

test("loader uses the static same-origin base path and omits credentials; all failures discard claims", async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", { configurable: true, value: new URL("https://example.test/le-grande-center/") });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "location", previous);
    else Reflect.deleteProperty(globalThis, "location");
  });
  t.mock.method(Date, "now", () => NOW);
  let requests = 0;
  let mode: "ok" | "http" | "network" | "json" | "oversize" | "stale" | "mismatch" = "ok";
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    requests++;
    assert.equal(url, "https://example.test/le-grande-center/model-3d/viewer-projection.json");
    assert.equal(init.credentials, "omit");
    assert.equal(init.mode, "same-origin");
    assert.equal(init.redirect, "error");
    if (mode === "network") throw new Error("Private network details");
    if (mode === "http") return new Response("private error", { status: 500 });
    if (mode === "json") return new Response("not json");
    if (mode === "oversize") return new Response(" ".repeat(65537));
    const input = claims();
    if (mode === "stale") input.updatedAt = new Date(NOW - DAY - 1).toISOString();
    if (mode === "mismatch") input.sceneVersion = "incompatible";
    return Response.json(input);
  });
  const signal = new AbortController().signal;
  assert.equal((await loadPublicProjection("/le-grande-center", signal)).status, "ready");
  assert.equal((await loadPublicProjection("/le-grande-center/", signal)).status, "ready");
  for (const failureMode of ["http", "network", "json", "oversize", "stale", "mismatch"] as const) {
    mode = failureMode;
    const result = await loadPublicProjection("/le-grande-center", signal);
    assert.equal(result.status, failureMode === "stale" || failureMode === "mismatch" ? failureMode : "unavailable");
    assert.equal(result.projection, null);
    assert.doesNotMatch(result.message, /Private|private|Published tenant/);
  }
  const before = requests;
  for (const base of ["https://other.test/", "//other.test/", "https://user:pass@example.test/", "/base?secret=1", "/base#anchor", "javascript:alert(1)"]) {
    assert.equal((await loadPublicProjection(base, signal)).projection, null);
  }
  const aborted = new AbortController();
  aborted.abort();
  assert.equal((await loadPublicProjection("/le-grande-center", aborted.signal)).projection, null);
  assert.equal(requests, before);
});
