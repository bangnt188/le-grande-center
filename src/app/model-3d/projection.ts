import { sceneManifest, type CameraPresetId } from "./scene";

export type PublicSlot = {
  slotId: string;
  floorId: string;
  label: string;
  confidence: "illustrative" | "verified";
  /** Approved public area in square metres; absent for the illustrative publication. */
  area?: number;
  tenant?: string;
  availability?: string;
};
export type PublicProjection = {
  schemaVersion: 1;
  sceneVersion: string;
  publicationRevision: string;
  updatedAt: string;
  allowedPresetIds: CameraPresetId[];
  floors: { floorId: string; label: string }[];
  slots: PublicSlot[];
};
export type ProjectionResult = {
  status: "ready" | "unavailable" | "stale" | "mismatch";
  projection: PublicProjection | null;
  message: string;
};

const FRESHNESS_MS = 24 * 60 * 60 * 1000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const floorIds = new Set(sceneManifest.floors.map(floor => floor.floorId));
const slotsById = new Map(sceneManifest.slots.map(slot => [slot.slotId, slot]));
const presets = new Set<string>(sceneManifest.cameraPresets.map(preset => preset.id));
const failure = (status: Exclude<ProjectionResult["status"], "ready">): ProjectionResult => ({
  status, projection: null,
  message: status === "mismatch" ? "Nội dung công khai chưa khớp phiên bản cảnh. Vẫn có thể xem công trình."
    : status === "stale" ? "Nội dung công khai đã quá thời hạn cập nhật. Vui lòng liên hệ để xác nhận."
      : "Chưa tải được nội dung công khai. Vẫn có thể xem công trình và liên hệ tư vấn.",
});
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text(value: unknown, limit: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= limit
    && !/[\u0000-\u001f\u007f]/.test(value);
}

/** Only fields on this allowlist cross into the viewer; business data cannot control geometry.
 * Claim fields require `approved: { area: true, tenant: true, availability: true }` individually.
 * Approval is a publication contract, not authentication: the publisher must approve before deploy.
 * Every non-ready result discards the entire projection, including previously approved claims.
 */
export function validatePublicProjection(input: unknown, now = Date.now()): ProjectionResult {
  if (!record(input)) return failure("unavailable");
  if (input.schemaVersion !== 1 || input.sceneVersion !== sceneManifest.sceneVersion) return failure("mismatch");
  if (!text(input.publicationRevision, 80) || !text(input.updatedAt, 40)
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(input.updatedAt)
    || !Number.isFinite(now)) return failure("unavailable");
  const updated = Date.parse(input.updatedAt);
  if (!Number.isFinite(updated) || updated - now > FUTURE_TOLERANCE_MS
    || new Date(updated).toISOString().slice(0, 19) !== input.updatedAt.slice(0, 19)) return failure("unavailable");
  if (now - updated > FRESHNESS_MS) return failure("stale");
  if (!Array.isArray(input.allowedPresetIds) || input.allowedPresetIds.length === 0
    || input.allowedPresetIds.length > presets.size
    || !Array.isArray(input.floors) || input.floors.length === 0 || input.floors.length > floorIds.size
    || !Array.isArray(input.slots) || input.slots.length > slotsById.size) return failure("unavailable");

  const allowedPresetIds: CameraPresetId[] = [];
  for (const id of input.allowedPresetIds) {
    if (typeof id !== "string" || !presets.has(id)) return failure("mismatch");
    if (allowedPresetIds.includes(id as CameraPresetId)) return failure("unavailable");
    allowedPresetIds.push(id as CameraPresetId);
  }
  const floors: PublicProjection["floors"] = [];
  const publishedFloors = new Set<string>();
  for (const floor of input.floors) {
    if (!record(floor) || !text(floor.floorId, 8) || !text(floor.label, 160)) return failure("unavailable");
    if (!floorIds.has(floor.floorId)) return failure("mismatch");
    if (publishedFloors.has(floor.floorId)) return failure("unavailable");
    publishedFloors.add(floor.floorId);
    floors.push({ floorId: floor.floorId, label: floor.label.trim() });
  }
  const slots: PublicSlot[] = [];
  const publishedSlots = new Set<string>();
  for (const slot of input.slots) {
    if (!record(slot) || !text(slot.slotId, 16) || !text(slot.floorId, 8) || !text(slot.label, 160)
      || (slot.confidence !== "illustrative" && slot.confidence !== "verified")) return failure("unavailable");
    const anchor = slotsById.get(slot.slotId);
    if (!anchor || anchor.floorId !== slot.floorId || !publishedFloors.has(slot.floorId)) return failure("mismatch");
    if (publishedSlots.has(slot.slotId)) return failure("unavailable");
    publishedSlots.add(slot.slotId);
    const clean: PublicSlot = {
      slotId: slot.slotId, floorId: slot.floorId, label: slot.label.trim(), confidence: slot.confidence,
    };
    const approved = record(slot.approved) ? slot.approved : {};
    if (approved.area === true && slot.area !== undefined) {
      if (typeof slot.area !== "number" || !Number.isFinite(slot.area) || slot.area <= 0 || slot.area > 1_000_000) return failure("unavailable");
      clean.area = slot.area;
    }
    if (approved.tenant === true && slot.tenant !== undefined) {
      if (!text(slot.tenant, 160)) return failure("unavailable");
      clean.tenant = slot.tenant.trim();
    }
    if (approved.availability === true && slot.availability !== undefined) {
      if (!text(slot.availability, 80)) return failure("unavailable");
      clean.availability = slot.availability.trim();
    }
    slots.push(clean);
  }
  return {
    status: "ready", message: "Nội dung công khai đã được tải; mặt bằng và khả dụng cần xác nhận.",
    projection: {
      schemaVersion: 1, sceneVersion: sceneManifest.sceneVersion,
      publicationRevision: input.publicationRevision.trim(), updatedAt: input.updatedAt,
      allowedPresetIds, floors, slots,
    },
  };
}

/** Load only the self-hosted static publication beneath the site's base path, without credentials. */
export async function loadPublicProjection(base: string, signal: AbortSignal): Promise<ProjectionResult> {
  try {
    if (!globalThis.location || signal.aborted) return failure("unavailable");
    const root = new URL(base || "/", globalThis.location.href);
    if (root.origin !== globalThis.location.origin || root.username || root.password || root.search || root.hash
      || !["https:", "http:"].includes(root.protocol)) return failure("unavailable");
    root.pathname = `${root.pathname.replace(/\/$/, "")}/model-3d/viewer-projection.json`;
    const response = await fetch(root.href, {
      signal, credentials: "omit", mode: "same-origin", redirect: "error", cache: "no-cache",
    });
    if (!response.ok || signal.aborted) return failure("unavailable");
    if (!response.body) return failure("unavailable");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 65536) { await reader.cancel(); return failure("unavailable"); }
      chunks.push(value);
    }
    const binary = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { binary.set(chunk, offset); offset += chunk.length; }
    const input: unknown = JSON.parse(new TextDecoder().decode(binary));
    return signal.aborted ? failure("unavailable") : validatePublicProjection(input);
  } catch {
    return failure("unavailable");
  }
}
