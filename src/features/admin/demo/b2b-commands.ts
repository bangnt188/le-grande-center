import type { AdminSnapshot, MediaItem } from "../../../shared/admin/contracts";
import type { B2BCommand, RequestInput } from "../../../shared/admin/b2b-model";
import { dates, email, floor, initials, integer, phone, record, text, vietnamToday } from "./validation";
import { hasCommitment } from "../../../shared/admin/space-model";

export function refreshInventory(data: AdminSnapshot, ids: string[]) {
  for (const slot of data.slots.filter(item => ids.includes(item.id))) {
    const lease = data.leases.find(item => item.slotIds.includes(slot.id));
    slot.status = lease ? "Đang thuê" : "Trống";
    slot.tenant = lease ? record(data.companies, lease.companyId).name : "";
  }
  for (const group of data.groups.filter(item => item.slotIds.some(id => ids.includes(id)))) group.status = record(data.slots, group.slotIds[0]).status;
}
function requestMembers(data: AdminSnapshot, values: RequestInput) {
  record(data.companies, values.companyId); floor(values.floor); dates(values.start, values.end);
  if (!values.slotIds.length || new Set(values.slotIds).size !== values.slotIds.length) throw new Error("Chọn slot, không chọn lặp lại.");
  const members = values.slotIds.map(id => record(data.slots, id)).sort((a, b) => a.order - b.order);
  if (members.some((slot, index) => slot.floor !== values.floor || slot.side !== members[0].side || (index > 0 && slot.order !== members[index - 1].order + 1))) throw new Error("Slot phải liền kề, cùng tầng và không qua sảnh.");
  const groups = data.groups.filter(group => group.slotIds.some(id => values.slotIds.includes(id)));
  if (groups.some(group => group.slotIds.length !== values.slotIds.length || !group.slotIds.every(id => values.slotIds.includes(id)))) throw new Error("Chọn toàn bộ mặt bằng ghép, không chọn một phần nhóm.");
  if (hasCommitment(data, values.slotIds) || members.some(slot => slot.status !== "Trống" || slot.tenant)) throw new Error("Có slot chưa khả dụng. Không tạo giữ chỗ một phần; chọn phương án khác.");
  return { members, groups, area: members.reduce((sum, slot) => sum + slot.area, 0) };
}
function activeHold(data: AdminSnapshot, id: string) {
  const hold = record(data.reservations, id);
  if (hold.status !== "active") throw new Error("Giữ chỗ đã kết thúc.");
  if (!Number.isFinite(Date.parse(hold.expiresAt)) || Date.parse(hold.expiresAt) <= Date.now()) throw new Error("Giữ chỗ đã hết hạn. Gửi yêu cầu xét lại.");
  return hold;
}
function document(data: AdminSnapshot, mediaId: string, blobs: Map<string, Blob>, leaseId?: string): MediaItem {
  const media = record(data.media, mediaId), blob = blobs.get(mediaId);
  if (media.reference || media.mimeType !== "application/pdf" || !media.sizeBytes || !blob || blob.type !== "application/pdf" || blob.size !== media.sizeBytes || blob.size > 10 * 1024 * 1024) throw new Error("Tải lên tệp PDF thật trước khi ghi nhận hợp đồng.");
  if (data.leases.some(lease => lease.id !== leaseId && lease.documentMediaId === mediaId)) throw new Error("Tệp PDF đã liên kết với hợp đồng khác.");
  return media;
}
// Browser-only customer testing, not authentication or a signature service.
export function applyB2BCommand(data: AdminSnapshot, command: B2BCommand, blobs: Map<string, Blob>) {
  switch (command.type) {
    case "save-company": {
      record(data.companies, command.companyId).note = text(command.note, 600, true); break;
    }
    case "upsert-company": {
      const v = command.values;
      const values = { name: text(v.name, 80), industry: text(v.industry, 120, true), brand: text(v.brand, 80, true), contact: text(v.contact, 80, true), email: email(v.email, true), phone: phone(v.phone, true), owner: text(v.owner, 80, true), note: text(v.note, 600, true), taxId: text(v.taxId ?? "", 30, true), address: text(v.address ?? "", 240, true) };
      if (command.companyId) {
        Object.assign(record(data.companies, command.companyId), values, { initials: initials(values.name) });
        refreshInventory(data, data.leases.filter(lease => lease.companyId === command.companyId).flatMap(lease => lease.slotIds));
      } else data.companies.push({ ...values, initials: initials(values.name), id: `company-${crypto.randomUUID()}` });
      break;
    }
    case "save-request": {
      const existing = command.requestId ? record(data.requests, command.requestId) : undefined;
      if (existing && !["submitted", "reviewing"].includes(existing.status)) throw new Error("Chỉ sửa yêu cầu đang chờ hoặc đang xét duyệt.");
      const { area } = requestMembers(data, command.values);
      const v = command.values;
      const values = { companyId: v.companyId, floor: v.floor, start: v.start, end: v.end, slotIds: [...v.slotIds], area, note: text(v.note, 600, true) };
      if (existing) Object.assign(existing, values);
      else data.requests.push({ ...values, id: `YC-${crypto.randomUUID()}`, status: "submitted", received: vietnamToday() });
      break;
    }
    case "review-request": {
      const request = record(data.requests, command.requestId);
      if (request.status !== "submitted") throw new Error("Chỉ tiếp nhận yêu cầu chưa xét duyệt.");
      request.status = "reviewing"; break;
    }
    case "reject-request": {
      const request = record(data.requests, command.requestId);
      if (!["submitted", "reviewing"].includes(request.status)) throw new Error("Yêu cầu đã có quyết định.");
      request.note = text(command.reason, 600); request.status = "rejected"; break;
    }
    case "approve-request": {
      const request = record(data.requests, command.requestId);
      if (!["submitted", "reviewing"].includes(request.status)) throw new Error("Yêu cầu đã có quyết định.");
      const hours = integer(command.holdHours, 1, 720), note = text(command.note, 600, true);
      const { members, groups, area } = requestMembers(data, request);
      request.area = area;
      data.reservations.push({ id: `GC-${crypto.randomUUID()}`, requestId: request.id, companyId: request.companyId, floor: request.floor, slotIds: [...request.slotIds], area, start: request.start, end: request.end, expiresAt: new Date(Date.now() + hours * 3600000).toISOString(), status: "active", note });
      request.status = "approved";
      if (members.length > 1 && !groups.length) data.groups.push({ id: `space-${request.id}`, floor: request.floor, slotIds: [...request.slotIds], name: `Mặt bằng ${members.map(slot => slot.code).join(" + ")}`, status: "Trống" });
      refreshInventory(data, request.slotIds); break;
    }
    case "cancel-hold": {
      const hold = record(data.reservations, command.reservationId);
      if (hold.status !== "active") throw new Error("Giữ chỗ đã kết thúc.");
      hold.note = text(command.reason, 600); hold.status = "cancelled";
      refreshInventory(data, hold.slotIds); break;
    }
    case "record-lease": {
      const hold = activeHold(data, command.reservationId), media = document(data, command.mediaId, blobs);
      record(data.companies, hold.companyId);
      if (data.leases.some(lease => lease.slotIds.some(id => hold.slotIds.includes(id))) || data.reservations.some(other => other.id !== hold.id && other.status === "active" && Date.parse(other.expiresAt) > Date.now() && other.slotIds.some(id => hold.slotIds.includes(id)))) throw new Error("Mặt bằng đã có cam kết khác. Tải lại dữ liệu.");
      const id = `HD-${crypto.randomUUID()}`;
      data.leases.push({ id, companyId: hold.companyId, reservationId: hold.id, floor: hold.floor, slotIds: [...hold.slotIds], area: hold.area, start: hold.start, end: hold.end, status: "executed", rentNote: "Theo tài liệu đã tải lên", documentName: media.name, documentMediaId: media.id });
      media.scope = `lease:${id}`; hold.status = "converted"; refreshInventory(data, hold.slotIds); break;
    }
    case "attach-lease-document": {
      const lease = record(data.leases, command.leaseId), media = document(data, command.mediaId, blobs, lease.id);
      const previous = data.media.find(item => item.id === lease.documentMediaId);
      if (previous && previous.id !== media.id) previous.scope = `Tầng ${lease.floor}`;
      lease.documentMediaId = media.id; lease.documentName = media.name; media.scope = `lease:${lease.id}`; break;
    }
    case "save-appointment": {
      const v = command.values, item = command.appointmentId ? record(data.appointments, command.appointmentId) : undefined;
      if (item?.status === "cancelled") throw new Error("Không sửa lịch đã hủy.");
      record(data.companies, v.companyId);
      const start = Date.parse(v.startsAt), duration = integer(v.durationMinutes, 15, 240);
      if (!Number.isFinite(start) || start <= Date.now()) throw new Error("Chọn lịch trong tương lai.");
      if (data.appointments.some(other => other.id !== item?.id && other.status !== "cancelled" && start < Date.parse(other.startsAt) + other.durationMinutes * 60000 && Date.parse(other.startsAt) < start + duration * 60000)) throw new Error("Khung thời gian này đã có lịch. Chọn giờ khác.");
      const values = { companyId: v.companyId, startsAt: new Date(start).toISOString(), durationMinutes: duration, purpose: text(v.purpose, 80), location: text(v.location, 160) };
      if (item) Object.assign(item, values);
      else data.appointments.push({ ...values, id: `LH-${crypto.randomUUID()}`, status: "requested" });
      break;
    }
    case "confirm-appointment": {
      const item = record(data.appointments, command.appointmentId);
      if (item.status !== "requested" || Date.parse(item.startsAt) <= Date.now()) throw new Error("Chỉ xác nhận lịch chờ trong tương lai.");
      item.status = "confirmed"; break;
    }
    case "cancel-appointment": {
      const item = record(data.appointments, command.appointmentId);
      if (item.status === "cancelled") throw new Error("Lịch đã hủy.");
      item.status = "cancelled"; break;
    }
    default: throw new Error("Thao tác không được hỗ trợ.");
  }
}
