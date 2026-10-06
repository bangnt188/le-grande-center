import type { Floor } from "./space-model";

export type Company = { id: string; name: string; initials: string; industry: string; brand: string; contact: string; email: string; phone: string; owner: string; note: string };
export type LeasingRequest = { id: string; companyId: string; floor: Floor; slotIds: string[]; area: number; start: string; end: string; status: "submitted" | "reviewing" | "approved" | "rejected"; note: string; received: string };
export type Reservation = { id: string; requestId: string; companyId: string; floor: Floor; slotIds: string[]; area: number; start: string; end: string; expiresAt: string; status: "active" | "cancelled" | "converted"; note: string };
export type Lease = { id: string; companyId: string; reservationId?: string; floor: Floor; slotIds: string[]; area: number; start: string; end: string; status: "executed"; rentNote: string; documentName: string; signedOn: string };
export type Appointment = { id: string; companyId: string; purpose: string; startsAt: string; status: "requested" | "confirmed" | "cancelled"; location: string };
export type PublicSpace = { id: string; floor: Floor; slotIds: string[]; area: number; availability: string; title: string; orientation: string };
export type B2BData = { companies: Company[]; requests: LeasingRequest[]; reservations: Reservation[]; leases: Lease[]; appointments: Appointment[] };
export type B2BCommand =
  | { type: "approve-request"; requestId: string; holdHours: number; note: string }
  | { type: "review-request"; requestId: string }
  | { type: "reject-request"; requestId: string; reason: string }
  | { type: "cancel-hold"; reservationId: string; reason: string }
  | { type: "convert-hold"; reservationId: string }
  | { type: "submit-request"; companyId: string; spaceId: string; start: string; end: string; note: string }
  | { type: "save-company"; companyId: string; note: string }
  | { type: "book-appointment"; companyId: string; purpose: string; startsAt: string }
  | { type: "confirm-appointment"; appointmentId: string }
  | { type: "cancel-appointment"; appointmentId: string };

// Stable fixture clock keeps SSR/client rendering and demonstration deadlines equal.
export const DEMO_CLOCK = "2026-10-06T03:00:00.000Z";
export const requestLabels = { submitted: "Chờ xét duyệt", reviewing: "Đang xét duyệt", approved: "Đã duyệt", rejected: "Đã từ chối" };
export const appointmentLabels = { requested: "Chờ xác nhận", confirmed: "Đã xác nhận", cancelled: "Đã hủy" };
export const publicSpaceFixtures: PublicSpace[] = [
  { id: "space-2-2-3", floor: 2, slotIds: ["T2-B2", "T2-B3"], area: 328, title: "Mặt bằng B.2 + B.3", availability: "Đang tiếp nhận yêu cầu", orientation: "Chưa xác nhận" },
  { id: "space-2-8-9", floor: 2, slotIds: ["T2-B8", "T2-B9"], area: 328, title: "Mặt bằng B.8 + B.9", availability: "Đăng ký quan tâm", orientation: "Chưa xác nhận" },
  { id: "space-1-1", floor: 1, slotIds: ["T1-B1"], area: 205, title: "Mặt bằng B.1", availability: "Dự kiến từ quý II/2027", orientation: "Chưa xác nhận" },
];
export function slotCodes(ids: string[]) { return ids.map((id) => id.replace(/^T\d+-B/, "B.")).join(" + "); }
export function dateLabel(value: string) { return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value)); }
export function timeLabel(value: string) { return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
export function remainingLabel(value: string) { const hours = Math.max(0, Math.ceil((Date.parse(value) - Date.parse(DEMO_CLOCK)) / 3600000)); return hours >= 24 ? `Còn ${Math.floor(hours / 24)} ngày${hours % 24 ? ` ${hours % 24} giờ` : ""}` : `Còn ${hours} giờ`; }
export function makeB2BFixtures(): B2BData {
  return {
    companies: [
      { id: "company-an", name: "An Retail", initials: "AR", industry: "Bán lẻ & thời trang", brand: "An Boutique", contact: "Người liên hệ mẫu A", email: "leasing@an.example", phone: "Chưa bổ sung", owner: "Nhân viên leasing mẫu", note: "Ưu tiên hai slot liền kề, mặt tiền rộng. Khách cần khảo sát trước khi xác nhận." },
      { id: "company-lam", name: "Lam Foods", initials: "LF", industry: "Ẩm thực & đồ uống", brand: "Lam Kitchen", contact: "Người liên hệ mẫu B", email: "leasing@lam.example", phone: "Chưa bổ sung", owner: "Nhân viên leasing mẫu", note: "Đối tác đang thuê. Theo dõi bàn giao và mốc thông báo gia hạn theo hợp đồng." },
      { id: "company-viet", name: "Việt Studio", initials: "VS", industry: "Dịch vụ & văn phòng", brand: "Việt Studio", contact: "Người liên hệ mẫu C", email: "office@viet.example", phone: "Chưa bổ sung", owner: "Chưa phân công", note: "Quan tâm một slot tầng 3. Chưa có cam kết giữ chỗ." },
    ],
    requests: [
      { id: "YC-2026-018", companyId: "company-an", floor: 2, slotIds: ["T2-B2", "T2-B3"], area: 328, start: "2027-01-01", end: "2027-12-31", status: "submitted", note: "Cần 300–400 m², có thể nối hai slot. Khảo sát và xác nhận điều kiện kỹ thuật trước khi ký.", received: "2026-10-06" },
      { id: "YC-2026-017", companyId: "company-an", floor: 2, slotIds: ["T2-B8", "T2-B9"], area: 328, start: "2027-01-01", end: "2027-12-31", status: "approved", note: "Phương án thay thế đã được giữ chỗ trong dữ liệu mẫu.", received: "2026-10-05" },
      { id: "YC-2026-016", companyId: "company-viet", floor: 3, slotIds: ["T3-B7"], area: 164, start: "2027-02-01", end: "2028-01-31", status: "reviewing", note: "Văn phòng đại diện; cần xem bản vẽ được duyệt.", received: "2026-10-05" },
    ],
    reservations: [{ id: "GC-2026-009", requestId: "YC-2026-017", companyId: "company-an", floor: 2, slotIds: ["T2-B8", "T2-B9"], area: 328, start: "2027-01-01", end: "2027-12-31", expiresAt: "2026-10-08T10:00:00.000Z", status: "active", note: "Thời hạn minh họa, chưa phải chính sách đã chốt." }],
    leases: [{ id: "HD-2026-004", companyId: "company-lam", floor: 1, slotIds: ["T1-B1"], area: 205, start: "2026-04-01", end: "2027-03-31", status: "executed", rentNote: "Theo thỏa thuận riêng · số tiền chưa nhập", documentName: "Hợp đồng thuê · Lam Foods · bản mẫu", signedOn: "2026-03-20" },
      { id: "HD-2026-008", companyId: "company-an", floor: 1, slotIds: ["T1-B8", "T1-B9"], area: 328, start: "2026-08-01", end: "2028-07-31", status: "executed", rentNote: "Đơn giá và phí dịch vụ theo phụ lục riêng · mẫu", documentName: "Hợp đồng thuê · An Boutique · bản mẫu", signedOn: "2026-07-15" },
      { id: "HD-2026-006", companyId: "company-viet", floor: 4, slotIds: ["T4-B2", "T4-B3"], area: 328, start: "2026-06-01", end: "2027-05-31", status: "executed", rentNote: "Kỳ thanh toán và tiền bảo đảm theo thỏa thuận riêng · mẫu", documentName: "Hợp đồng thuê · Việt Studio · bản mẫu", signedOn: "2026-05-20" },
      { id: "HD-2026-003", companyId: "company-lam", floor: 2, slotIds: ["T2-B11"], area: 205, start: "2026-01-01", end: "2026-12-31", status: "executed", rentNote: "Đang rà soát điều khoản gia hạn · mẫu", documentName: "Hợp đồng thuê · Lam Kitchen · bản mẫu", signedOn: "2025-12-18" },
    ],
    appointments: [
      { id: "LH-2026-012", companyId: "company-an", purpose: "Khảo sát mặt bằng", startsAt: "2026-10-08T02:00:00.000Z", status: "confirmed", location: "Sảnh Le Grande Centre" },
      { id: "LH-2026-013", companyId: "company-viet", purpose: "Tư vấn nhu cầu thuê", startsAt: "2026-10-08T07:00:00.000Z", status: "requested", location: "Phòng tư vấn · tầng 1" },
    ],
  };
}
