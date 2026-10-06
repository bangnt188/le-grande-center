import type { AdminSnapshot } from "./contracts";
import type { B2BCommand, Reservation } from "./b2b-model";
import { DEMO_CLOCK, publicSpaceFixtures } from "./b2b-model";

function required(value: string, limit = 600) {
  const result = value.trim();
  if (!result || result.length > limit) throw new Error(`Nhập nội dung, tối đa ${limit} ký tự.`);
  return result;
}
function record<T extends { id: string }>(items: T[], id: string): T {
  const value = items.find((item) => item.id === id);
  if (!value) throw new Error("Bản ghi không còn tồn tại. Tải lại dữ liệu.");
  return value;
}
function dates(start: string, end: string) {
  for (const value of [start, end]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) throw new Error("Chọn ngày thuê hợp lệ.");
  }
  if (end < start || start < DEMO_CLOCK.slice(0,10)) throw new Error("Ngày kết thúc phải sau ngày bắt đầu; chọn kỳ thuê từ mốc demo trở đi.");
}
export function hasCommitment(data: AdminSnapshot, ids: string[]) {
  return data.reservations.some((hold) => hold.status === "active" && hold.slotIds.some((id) => ids.includes(id))) || data.leases.some((lease) => lease.slotIds.some((id) => ids.includes(id)));
}
function refreshInventory(data: AdminSnapshot, ids: string[]) {
  data.slots = data.slots.map((slot) => {
    if (!ids.includes(slot.id)) return slot;
    const lease = data.leases.find((item) => item.slotIds.includes(slot.id));
    const hold = data.reservations.find((item) => item.status === "active" && item.slotIds.includes(slot.id));
    const companyId = lease?.companyId ?? hold?.companyId;
    return { ...slot, status: lease ? "Đang thuê" : hold ? "Đang giữ chỗ" : "Trống", tenant: data.companies.find((item) => item.id === companyId)?.name ?? "" };
  });
  data.groups = data.groups.map((group) => group.slotIds.some((id) => ids.includes(id)) ? { ...group, status: data.slots.find((slot) => slot.id === group.slotIds[0])?.status ?? "Trống" } : group);
}
function activeHold(data: AdminSnapshot, id: string): Reservation {
  const hold = record(data.reservations, id);
  if (hold.status !== "active") throw new Error("Giữ chỗ đã kết thúc. Chọn một giữ chỗ đang hoạt động.");
  if (Date.parse(hold.expiresAt) <= Date.parse(DEMO_CLOCK)) throw new Error("Giữ chỗ đã hết hạn tại mốc demo. Gửi yêu cầu xét lại.");
  return hold;
}
// Fixture-only simulation. Production must perform equivalent checks atomically
// with SQL locks, revision, idempotency, authorization and document verification.
export function applyB2BCommand(data: AdminSnapshot, command: B2BCommand) {
  switch (command.type) {
    case "save-company": {
      const company = record(data.companies, command.companyId);
      if (command.note.length > 600) throw new Error("Ghi chú tối đa 600 ký tự.");
      company.note = command.note.trim(); break;
    }
    case "review-request": {
      const request = record(data.requests, command.requestId);
      if (request.status !== "submitted") throw new Error("Chỉ tiếp nhận yêu cầu chưa xét duyệt.");
      request.status = "reviewing"; break;
    }
    case "reject-request": {
      const request = record(data.requests, command.requestId);
      if (!["submitted","reviewing"].includes(request.status)) throw new Error("Yêu cầu đã có quyết định.");
      request.note = required(command.reason); request.status = "rejected"; break;
    }
    case "approve-request": {
      const request = record(data.requests, command.requestId);
      if (!["submitted","reviewing"].includes(request.status)) throw new Error("Yêu cầu đã có quyết định.");
      if (!Number.isInteger(command.holdHours) || command.holdHours < 1 || command.holdHours > 720) throw new Error("Nhập thời hạn giữ chỗ từ 1 đến 720 giờ cho lần duyệt demo này.");
      dates(request.start, request.end);
      const members = request.slotIds.map((id) => record(data.slots, id)).sort((a,b) => a.order - b.order);
      if (!members.length || members.some((slot) => slot.floor !== request.floor || slot.side !== members[0].side) || members.some((slot,index) => index > 0 && slot.order !== members[index-1].order + 1)) throw new Error("Slot phải liền kề, cùng tầng và không qua sảnh.");
      const overlaps = [...data.reservations.filter((hold) => hold.status === "active"), ...data.leases].some((item) => item.start <= request.end && request.start <= item.end && item.slotIds.some((id) => request.slotIds.includes(id)));
      if (overlaps || members.some((slot) => slot.status !== "Trống" && !hasCommitment(data,[slot.id]))) throw new Error("Có slot chưa khả dụng trong kỳ thuê này. Không tạo giữ chỗ một phần; chọn phương án khác.");
      const groups = data.groups.filter((group) => group.slotIds.some((id) => request.slotIds.includes(id)));
      if (groups.some((group) => group.slotIds.length !== request.slotIds.length || !group.slotIds.every((id) => request.slotIds.includes(id)))) throw new Error("Phương án đã thay đổi. Xác nhận lại toàn bộ mặt bằng ghép.");
      if (command.note.length > 600) throw new Error("Ghi chú tối đa 600 ký tự.");
      const hold: Reservation = { id: `GC-${crypto.randomUUID().slice(0,8).toUpperCase()}`, requestId: request.id, companyId: request.companyId, floor: request.floor, slotIds: [...request.slotIds], area: request.area, start: request.start, end: request.end, expiresAt: new Date(Date.parse(DEMO_CLOCK) + command.holdHours * 3600000).toISOString(), status: "active", note: command.note.trim() };
      data.reservations.push(hold); request.status = "approved";
      if (members.length > 1 && !groups.length) data.groups.push({ id: `space-${request.id}`, floor: request.floor, slotIds: [...request.slotIds], name: `Mặt bằng ${members.map((slot) => slot.code).join(" + ")}`, status: "Đang giữ chỗ" });
      refreshInventory(data, request.slotIds); break;
    }
    case "cancel-hold": {
      const hold = activeHold(data, command.reservationId);
      hold.note = required(command.reason); hold.status = "cancelled";
      refreshInventory(data, hold.slotIds); break;
    }
    case "convert-hold": {
      const hold = activeHold(data, command.reservationId);
      const company = record(data.companies, hold.companyId);
      data.leases.push({ id: `HD-${crypto.randomUUID().slice(0,8).toUpperCase()}`, companyId: hold.companyId, reservationId: hold.id, floor: hold.floor, slotIds: [...hold.slotIds], area: hold.area, start: hold.start, end: hold.end, status: "executed", rentNote: "Theo thỏa thuận riêng · số tiền chưa nhập", signedOn: DEMO_CLOCK.slice(0,10), documentName: `Hợp đồng thuê · ${company.name} · bản mẫu` });
      hold.status = "converted"; refreshInventory(data, hold.slotIds); break;
    }
    case "submit-request": {
      record(data.companies, command.companyId);
      const space = record(publicSpaceFixtures, command.spaceId);
      dates(command.start, command.end);
      if (command.note.length > 600) throw new Error("Ghi chú tối đa 600 ký tự.");
      data.requests.unshift({ id: `YC-${crypto.randomUUID().slice(0,8).toUpperCase()}`, companyId: command.companyId, floor: space.floor, slotIds: [...space.slotIds], area: space.area, start: command.start, end: command.end, status: "submitted", note: command.note.trim(), received: DEMO_CLOCK.slice(0,10) }); break;
    }
    case "book-appointment": {
      record(data.companies, command.companyId);
      const startsAt = Date.parse(command.startsAt);
      if (!Number.isFinite(startsAt) || startsAt < Date.parse(DEMO_CLOCK)) throw new Error("Chọn lịch sau mốc demo 06/10/2026.");
      if (data.appointments.some((item) => item.status !== "cancelled" && Math.abs(Date.parse(item.startsAt) - startsAt) < 30 * 60000)) throw new Error("Khung 30 phút này đã có lịch. Chọn giờ khác.");
      data.appointments.push({ id: `LH-${crypto.randomUUID().slice(0,8).toUpperCase()}`, companyId: command.companyId, startsAt: new Date(startsAt).toISOString(), purpose: required(command.purpose,80), status: "requested", location: "Phòng tư vấn · tầng 1" }); break;
    }
    case "confirm-appointment": {
      const item = record(data.appointments, command.appointmentId);
      if (item.status !== "requested") throw new Error("Lịch này không còn chờ xác nhận.");
      item.status = "confirmed"; break;
    }
    case "cancel-appointment": {
      const item = record(data.appointments, command.appointmentId);
      if (item.status === "cancelled") throw new Error("Lịch đã hủy.");
      item.status = "cancelled"; break;
    }
  }
}
