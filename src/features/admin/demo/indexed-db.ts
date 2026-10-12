import type { AdminSnapshot } from "../../../shared/admin/contracts";
import { makeDemoSnapshot } from "./data";
import { synchronizeProjectMedia } from "./project-media";
import { DEFAULT_FLOOR_CONTENT } from "../../../shared/admin/space-model";
import { DEFAULT_WEBSITE_SETTINGS } from "../../../shared/admin/website-defaults";
export const DEMO_DATABASE_NAME = "le-grande-admin-browser-v1";
export const REVISION_CONFLICT = "Dữ liệu đã thay đổi ở cửa sổ khác. Tải lại dữ liệu trước khi lưu.";
export type StoredDemo = { snapshot: AdminSnapshot; blobs: Map<string, Blob> };

function openDatabase(): Promise<IDBDatabase> {
  const { promise, resolve, reject } = Promise.withResolvers<IDBDatabase>();
  if (typeof indexedDB === "undefined") { reject(new Error("Trình duyệt không hỗ trợ IndexedDB. Không thể lưu dữ liệu.")); return promise; }
  const request = indexedDB.open(DEMO_DATABASE_NAME, 1);
  let blocked = false;
  request.onupgradeneeded = () => {
    try {
      request.result.createObjectStore("state");
      request.result.createObjectStore("files");
    } catch (error) { request.transaction?.abort(); reject(error); }
  };
  request.onsuccess = () => {
    if (blocked) { request.result.close(); return; }
    request.result.onversionchange = () => request.result.close(); resolve(request.result);
  };
  request.onerror = () => reject(request.error ?? new Error("Không mở được dữ liệu IndexedDB."));
  request.onblocked = () => { blocked = true; reject(new Error("IndexedDB đang bị cửa sổ khác chặn. Đóng cửa sổ đó và tải lại.")); };
  return promise;
}
export async function readStoredDemo(): Promise<StoredDemo> {
  const db = await openDatabase();
  const { promise, resolve, reject } = Promise.withResolvers<StoredDemo>();
  const tx = db.transaction(["state", "files"], "readwrite");
  const state = tx.objectStore("state"), files = tx.objectStore("files");
  let snapshot: AdminSnapshot;
  const blobs = new Map<string, Blob>();
  const request = state.get("snapshot");
  request.onsuccess = () => {
    snapshot = request.result ?? makeDemoSnapshot();
    let changed = synchronizeProjectMedia(snapshot);
    snapshot.floors = snapshot.floors.map((floor, index) => {
      const defaults = DEFAULT_FLOOR_CONTENT[index];
      if (floor.publicTitle === undefined || floor.publicDescription === undefined) { changed = true; return { ...floor, publicTitle: floor.publicTitle ?? defaults.publicTitle, publicDescription: floor.publicDescription ?? defaults.publicDescription }; }
      return floor;
    });
    if (snapshot.settings.website === undefined) { snapshot.settings = { ...snapshot.settings, website: { ...DEFAULT_WEBSITE_SETTINGS } }; changed = true; }
    const lease = snapshot.leases.find(item => item.id === "HD-2026-004");
    if (lease && !lease.documentMediaId) {
      lease.documentMediaId = "contract-sample-pdf";
      lease.documentName = snapshot.media.find(item => item.id === "contract-sample-pdf")!.name;
      changed = true;
    }
    if (!request.result || changed) {
      if (request.result) snapshot.revision += 1;
      state.put(snapshot, "snapshot");
    }
  };
  const cursor = files.openCursor();
  cursor.onsuccess = () => { if (cursor.result) { blobs.set(String(cursor.result.key), cursor.result.value); cursor.result.continue(); } };
  tx.oncomplete = () => { db.close(); resolve({ snapshot, blobs }); };
  tx.onabort = () => { db.close(); reject(tx.error ?? new Error("Không đọc được dữ liệu IndexedDB.")); };
  return promise;
}
export async function commitStoredDemo(expectedRevision: number, snapshot: AdminSnapshot, additions: Map<string, Blob>, removals: string[]): Promise<void> {
  const db = await openDatabase();
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const tx = db.transaction(["state", "files"], "readwrite");
  const state = tx.objectStore("state");
  let conflict = false;
  let writeError: unknown;
  const request = state.get("snapshot");
  request.onsuccess = () => {
    if (!request.result || request.result.revision !== expectedRevision) { conflict = true; tx.abort(); return; }
    try {
      // Snapshot metadata and Blob changes share one transaction: neither can commit alone.
      state.put(snapshot, "snapshot");
      const files = tx.objectStore("files");
      for (const [id, blob] of additions) files.put(blob, id);
      for (const id of removals) files.delete(id);
    } catch (error) { writeError = error; tx.abort(); }
  };
  tx.oncomplete = () => { db.close(); resolve(); };
  tx.onabort = () => {
    db.close();
    const issue = writeError ?? tx.error;
    reject(conflict ? new Error(REVISION_CONFLICT) : issue instanceof DOMException && issue.name === "QuotaExceededError" ? new Error("Trình duyệt hết dung lượng IndexedDB. Chưa lưu thay đổi; xóa tệp hoặc giải phóng dung lượng thiết bị.") : issue ?? new Error("Không lưu được dữ liệu IndexedDB. Chưa lưu thay đổi."));
  };
  return promise;
}
