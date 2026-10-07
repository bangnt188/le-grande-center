import { applyB2BCommand, hasCommitment } from "./b2b-commands";
import type { AdminCommand, AdminRepository, AdminSnapshot } from "./contracts";
import { makeDemoSnapshot } from "./demo-data";
import { FLOORS, mergeIssue } from "./space-model";
import { STORAGE_LIMIT_BYTES, storageUploadIssue } from "./storage-policy";

export function createDemoRepository(): AdminRepository {
  let data = makeDemoSnapshot();
  const urls: string[] = [];
  const snapshot = () => structuredClone(data);
  const text = (value: string, limit: number) => {
    const result = value.trim();
    if (!result || result.length > limit) throw new Error(`Nội dung bắt buộc, tối đa ${limit} ký tự.`);
    return result;
  };
  const exists = (items: { id: string }[], id: string) => {
    if (!items.some((item) => item.id === id)) throw new Error("Bản ghi không còn tồn tại. Tải lại dữ liệu.");
  };
  const validateMediaScope = (scope: string) => {
    const allowed = ["Chưa xác nhận tầng", "Toàn dự án", ...FLOORS.map(floor => `Tầng ${floor}`), ...data.slots.map(slot => `slot:${slot.id}`), ...data.groups.map(group => `group:${group.id}`)];
    if (!allowed.includes(scope)) throw new Error("Tầng hoặc mặt bằng liên kết không tồn tại. Chọn lại liên kết media.");
  };
  function apply(command: AdminCommand) {
    switch (command.type) {
      case "merge": {
        const issue = mergeIssue(data.slots, data.groups, command.slotIds, command.floor);
        if (issue) throw new Error(issue);
        data.groups.push({ id: crypto.randomUUID(), floor: command.floor, slotIds: [...command.slotIds], name: text(command.name, 80), status: "Trống" });
        break;
      }
      case "split": {
        exists(data.groups, command.groupId);
        const group = data.groups.find((item) => item.id === command.groupId)!;
        if (hasCommitment(data, group.slotIds)) throw new Error("Mặt bằng đang có cam kết. Xử lý giữ chỗ/hợp đồng trước khi tách.");
        data.slots = data.slots.map((slot) => group.slotIds.includes(slot.id) ? { ...slot, status: group.status } : slot);
        data.groups = data.groups.filter((item) => item.id !== group.id);
        data.media = data.media.map((item) => item.scope === `group:${group.id}` ? { ...item, scope: `Tầng ${group.floor}` } : item);
        break;
      }
      case "update-slot": {
        exists(data.slots, command.slotId);
        if (hasCommitment(data, [command.slotId])) throw new Error("Slot đang có cam kết. Quản lý trong mục Yêu cầu thuê hoặc Hợp đồng.");
        if (data.groups.some((group) => group.slotIds.includes(command.slotId))) throw new Error("Slot thuộc nhóm ghép. Cập nhật nhóm thay vì slot thành viên.");
        const status = text(command.status, 60);
        if (command.tenant.length > 80) throw new Error("Tên đối tác tối đa 80 ký tự.");
        data.slots = data.slots.map((item) => item.id === command.slotId ? { ...item, status, tenant: command.tenant.trim() } : item);
        break;
      }
      case "update-group": {
        exists(data.groups, command.groupId);
        if (hasCommitment(data, data.groups.find((group) => group.id === command.groupId)!.slotIds)) throw new Error("Mặt bằng đang có cam kết. Quản lý trong mục Yêu cầu thuê hoặc Hợp đồng.");
        const status = text(command.status, 60), name = text(command.name, 80);
        data.groups = data.groups.map((item) => item.id === command.groupId ? { ...item, name, status } : item);
        break;
      }
      case "update-lead": {
        exists(data.leads, command.leadId);
        const status = text(command.status, 60);
        if (command.note.length > 600) throw new Error("Ghi chú tối đa 600 ký tự.");
        data.leads = data.leads.map((item) => item.id === command.leadId ? { ...item, status, note: command.note.trim() } : item);
        break;
      }
      case "link-media": {
        exists(data.media, command.mediaId);
        validateMediaScope(command.scope);
        data.media = data.media.map((item) => item.id === command.mediaId ? { ...item, scope: command.scope } : item);
        break;
      }
      default: applyB2BCommand(data, command);
    }
    data.revision += 1;
  }
  return {
    initialSnapshot: snapshot(),
    async read() { return snapshot(); },
    async execute(command) {
      const previous = data; data = structuredClone(data);
      try { apply(command); return snapshot(); } catch (error) { data = previous; throw error; }
    },
    async upload(files, scope) {
      validateMediaScope(scope);
      const issue = storageUploadIssue(data.storage, files);
      if (issue) throw new Error(issue);
      const accepted = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
      if (files.some((file) => !accepted.has(file.type) || file.size > 10 * 1024 * 1024)) {
        throw new Error("Tệp không hợp lệ. Chỉ nhận PNG, JPG, WebP hoặc PDF, tối đa 10 MB/tệp.");
      }
      const additions: AdminSnapshot["media"] = files.map((file) => {
        const url = URL.createObjectURL(file); urls.push(url);
        return { id: crypto.randomUUID(), name: file.name, kind: file.type.startsWith("image/") ? "Ảnh" : "Tài liệu", scope, size: `${(file.size / 1024 / 1024).toFixed(2)} MB`, url };
      });
      data.media = [...additions, ...data.media]; data.revision += 1;
      data.storage!.usedBytes += files.reduce((total, file) => total + file.size, 0);
      return snapshot();
    },
    async previewStorage(usedBytes) {
      if (!Number.isSafeInteger(usedBytes) || usedBytes < 0 || usedBytes > STORAGE_LIMIT_BYTES) throw new Error("Dung lượng mẫu không hợp lệ.");
      data.storage = { usedBytes, reservedBytes: 0 };
      return snapshot();
    },
    dispose() { urls.forEach((url) => URL.revokeObjectURL(url)); urls.length = 0; },
  };
}
