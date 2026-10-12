import { applyB2BCommand } from "./b2b-commands";
import { isAdminSettings, LEAD_STATUSES, type AdminCommand, type AdminRepository, type AdminSnapshot } from "../../../shared/admin/contracts";
import { makeDemoSnapshot, referencePlanUrl } from "./data";
import { FLOOR_PUBLIC_DESCRIPTION_MAX_LENGTH, FLOOR_PUBLIC_TITLE_MAX_LENGTH, FLOORS, FLOOR_PURPOSE_MAX_LENGTH, hasCommitment, isFloorConfigurations, isSlotStatus, mergeIssue } from "../../../shared/admin/space-model";
import { isStorageUsage, storageUploadIssue } from "../../../shared/admin/storage-policy";
import { commitStoredDemo, readStoredDemo, type StoredDemo } from "./indexed-db";
import { email, floor, initials, phone, record, text } from "./validation";
import { isWebsiteSettings, type WebsiteSettings } from "../../../shared/admin/website-settings";

function validateMediaScope(data: AdminSnapshot, scope: string) {
  const allowed = ["Chưa xác nhận tầng", "Toàn dự án", ...FLOORS.map(number => `Tầng ${number}`), ...data.slots.map(slot => `slot:${slot.id}`), ...data.groups.map(group => `group:${group.id}`)];
  if (!allowed.includes(scope)) throw new Error("Tầng hoặc mặt bằng liên kết không tồn tại. Chọn lại liên kết media.");
}
function validateWebsite(data: AdminSnapshot, values: WebsiteSettings) {
  if (!isWebsiteSettings(values)) throw new Error("Cấu hình website không hợp lệ. Kiểm tra logo, email, hotline, địa chỉ và link https://zalo.me/.");
  const logo = record(data.media, values.logoMediaId);
  if (logo.kind !== "Ảnh" || !logo.mimeType?.startsWith("image/") || (!logo.projectAsset && !logo.hasUploadedFile)) throw new Error("Chọn logo từ ảnh dự án hoặc ảnh đã tải lên.");
}
function apply(data: AdminSnapshot, command: AdminCommand, blobs: Map<string, Blob>) {
  if (command.type === "rename-media" || command.type === "link-media" || command.type === "delete-media") {
    if (record(data.media, command.mediaId).projectAsset) throw new Error("Asset website chỉ được xem; không sửa hoặc xóa tài nguyên dự án từ bản dùng thử.");
  }
  switch (command.type) {
    case "update-floor": {
      const number = floor(command.floor);
      const configuration = data.floors.find(item => item.number === number)!;
      configuration.purpose = text(command.purpose, FLOOR_PURPOSE_MAX_LENGTH);
      configuration.publicTitle = text(command.publicTitle, FLOOR_PUBLIC_TITLE_MAX_LENGTH);
      configuration.publicDescription = text(command.publicDescription, FLOOR_PUBLIC_DESCRIPTION_MAX_LENGTH);
      break;
    }
    case "update-settings": {
      if (!isAdminSettings(command.values)) throw new Error("Cài đặt không hợp lệ. Kiểm tra nội dung liên hệ và giới hạn thời gian.");
      validateWebsite(data, command.values.website);
      data.settings = structuredClone(command.values); break;
    }
    case "update-website-settings": {
      validateWebsite(data, command.values);
      data.settings.website = { ...command.values }; break;
    }
    case "merge": {
      if (hasCommitment(data, command.slotIds)) throw new Error("Slot đang có cam kết. Xử lý giữ chỗ/hợp đồng trước khi ghép.");
      const issue = mergeIssue(data.slots, data.groups, command.slotIds, command.floor);
      if (issue) throw new Error(issue);
      data.groups.push({ id: crypto.randomUUID(), floor: command.floor, slotIds: [...command.slotIds], name: text(command.name, 80), status: "Trống" }); break;
    }
    case "split": {
      const group = record(data.groups, command.groupId);
      if (hasCommitment(data, group.slotIds)) throw new Error("Mặt bằng đang có cam kết. Xử lý giữ chỗ/hợp đồng trước khi tách.");
      data.groups = data.groups.filter(item => item.id !== group.id);
      for (const item of data.media.filter(item => item.scope === `group:${group.id}`)) item.scope = `Tầng ${group.floor}`;
      break;
    }
    case "update-slot": {
      const slot = record(data.slots, command.slotId);
      if (hasCommitment(data, [slot.id])) throw new Error("Slot đang có cam kết. Quản lý trong mục Yêu cầu thuê hoặc Hợp đồng.");
      if (data.groups.some(group => group.slotIds.includes(slot.id))) throw new Error("Slot thuộc nhóm ghép. Cập nhật nhóm thay vì slot thành viên.");
      if (!isSlotStatus(command.status)) throw new Error("Trạng thái slot chỉ gồm Trống hoặc Đang thuê.");
      const tenant = text(command.tenant, 80, true);
      if (command.area !== undefined && (!Number.isFinite(command.area) || command.area < .01 || command.area > 100000)) throw new Error("Diện tích phải từ 0,01 đến 100.000 m².");
      slot.status = command.status; slot.tenant = command.status === "Trống" ? "" : tenant;
      if (command.area !== undefined) {
        slot.area = command.area;
        for (const request of data.requests.filter(item => ["submitted", "reviewing"].includes(item.status) && item.slotIds.includes(slot.id))) request.area = request.slotIds.reduce((sum, id) => sum + record(data.slots, id).area, 0);
      }
      break;
    }
    case "update-group": {
      const group = record(data.groups, command.groupId);
      if (hasCommitment(data, group.slotIds)) throw new Error("Mặt bằng đang có cam kết. Quản lý trong mục Yêu cầu thuê hoặc Hợp đồng.");
      if (!isSlotStatus(command.status)) throw new Error("Trạng thái slot chỉ gồm Trống hoặc Đang thuê.");
      group.name = text(command.name, 80); group.status = command.status;
      for (const slot of data.slots.filter(item => group.slotIds.includes(item.id))) { slot.status = group.status; if (group.status === "Trống") slot.tenant = ""; }
      break;
    }
    case "save-lead": {
      const v = command.values;
      if (!LEAD_STATUSES.includes(v.status)) throw new Error("Trạng thái lead không hợp lệ.");
      if (v.companyId) record(data.companies, v.companyId);
      const values = { name: text(v.name, 80), interest: text(v.interest, 160), floor: floor(v.floor), source: text(v.source, 80), status: v.status, note: text(v.note, 600, true), companyId: v.companyId || undefined, email: email(v.email ?? "", true), phone: phone(v.phone ?? "", true) };
      if (command.leadId) Object.assign(record(data.leads, command.leadId), values, { initials: initials(values.name) });
      else data.leads.unshift({ ...values, id: `lead-${crypto.randomUUID()}`, initials: initials(values.name), time: new Date().toISOString() });
      break;
    }
    case "link-media": {
      const media = record(data.media, command.mediaId);
      if (data.leases.some(lease => lease.documentMediaId === media.id)) throw new Error("Tệp đang liên kết hợp đồng. Thay tệp trong hồ sơ hợp đồng trước khi đổi liên kết.");
      validateMediaScope(data, command.scope); media.scope = command.scope; break;
    }
    case "rename-media": {
      const media = record(data.media, command.mediaId);
      media.name = text(command.name, 160);
      for (const lease of data.leases.filter(item => item.documentMediaId === media.id)) lease.documentName = media.name;
      break;
    }
    case "delete-media": {
      const media = record(data.media, command.mediaId);
      if (data.settings.website.logoMediaId === media.id) throw new Error("Tệp đang là logo website. Chọn logo khác và lưu cấu hình trước khi xóa.");
      if (media.reference) throw new Error("Không xóa bản vẽ tham chiếu của dự án.");
      if (data.leases.some(lease => lease.documentMediaId === media.id)) throw new Error("Tệp đang liên kết hợp đồng. Thay tệp trong hồ sơ hợp đồng trước khi xóa.");
      data.media = data.media.filter(item => item.id !== media.id);
      data.storage!.usedBytes -= blobs.get(media.id)?.size ?? 0; break;
    }
    default: applyB2BCommand(data, command, blobs);
  }
}
async function validateFile(file: File) {
  const accepted = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
  if (!accepted.includes(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024) throw new Error("Chỉ nhận PNG, JPG, WebP hoặc PDF, tối đa 10 MiB/tệp; tệp không được rỗng.");
  text(file.name, 160);
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const header = new TextDecoder().decode(bytes);
  const valid = file.type === "application/pdf" ? header.startsWith("%PDF-") : file.type === "image/png" ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte) : file.type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : header.startsWith("RIFF") && header.slice(8, 12) === "WEBP";
  if (!valid) throw new Error("Nội dung tệp không đúng định dạng PNG, JPG, WebP hoặc PDF đã chọn.");
}

export function createDemoRepository(): AdminRepository {
  // SSR and browser start at the same loading state; only Node tests get isolated memory.
  const inMemory = typeof window === "undefined" && typeof indexedDB === "undefined";
  let stored: StoredDemo | null = null;
  let queue = Promise.resolve();
  const urls = new Map<string, string>();
  const serialize = <T,>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation); queue = result.then(() => {}, () => {}); return result;
  };
  const load = async () => {
    const next = inMemory ? stored ?? { snapshot: makeDemoSnapshot(), blobs: new Map<string, Blob>() } : await readStoredDemo();
    if (!isFloorConfigurations(next.snapshot.floors) || !isAdminSettings(next.snapshot.settings) || !isStorageUsage(next.snapshot.storage)) throw new Error("Dữ liệu trình duyệt không hợp lệ. Không ghi đè dữ liệu đã lưu.");
    stored = next;
  };
  const hydrate = () => {
    const data = structuredClone(stored!.snapshot);
    for (const [id, url] of urls) if (!stored!.blobs.has(id)) { URL.revokeObjectURL(url); urls.delete(id); }
    for (const media of data.media) {
      if (media.reference) media.url = referencePlanUrl;
      const blob = stored!.blobs.get(media.id);
      media.hasUploadedFile = !!blob;
      if (blob) { if (!urls.has(media.id)) urls.set(media.id, URL.createObjectURL(blob)); media.url = urls.get(media.id); }
    }
    return data;
  };
  const commit = async (data: AdminSnapshot, additions = new Map<string, Blob>()) => {
    const previous = stored!;
    const removals = [...previous.blobs.keys()].filter(id => !data.media.some(item => item.id === id));
    data.revision = previous.snapshot.revision + 1;
    if (!inMemory) await commitStoredDemo(previous.snapshot.revision, data, additions, removals);
    const blobs = new Map(previous.blobs);
    for (const id of removals) blobs.delete(id);
    for (const [id, blob] of additions) blobs.set(id, blob);
    stored = { snapshot: data, blobs }; return hydrate();
  };
  return {
    initialSnapshot: null,
    read: () => serialize(async () => { await load(); return hydrate(); }),
    execute: command => serialize(async () => {
      if (!stored) await load();
      const data = structuredClone(stored!.snapshot);
      apply(data, command, stored!.blobs);
      return commit(data);
    }),
    upload: (files, scope) => serialize(async () => {
      if (!stored) await load();
      const data = structuredClone(stored!.snapshot);
      validateMediaScope(data, scope);
      if (!files.length) throw new Error("Chọn ít nhất một tệp.");
      const issue = storageUploadIssue(data.storage, files); if (issue) throw new Error(issue);
      for (const file of files) await validateFile(file);
      const additions = new Map<string, Blob>();
      for (const file of files) {
        const id = crypto.randomUUID(); additions.set(id, file);
        data.media.unshift({ id, name: file.name.trim(), kind: file.type.startsWith("image/") ? "Ảnh" : "Tài liệu", scope, size: `${(file.size / 1024 / 1024).toFixed(2)} MiB`, sizeBytes: file.size, mimeType: file.type, hasUploadedFile: true });
        data.storage!.usedBytes += file.size;
      }
      return commit(data, additions);
    }),
    dispose() { for (const url of urls.values()) URL.revokeObjectURL(url); urls.clear(); },
  };
}
