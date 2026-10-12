import type { B2BData } from "../../../shared/admin/b2b-model";

export const requestLabels = { submitted: "Chờ xét duyệt", reviewing: "Đang xét duyệt", approved: "Đã duyệt", rejected: "Đã từ chối" };
export const appointmentLabels = { requested: "Chờ xác nhận", confirmed: "Đã xác nhận", cancelled: "Đã hủy" };
export function slotCodes(ids: string[]) { return ids.map((id) => id.replace(/^T\d+-B/, "B.")).join(" + "); }
export function dateLabel(value: string) { return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value)); }
export function timeLabel(value: string) { return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
export function remainingLabel(value: string) { const hours = Math.max(0, Math.ceil((Date.parse(value) - Date.now()) / 3600000)); return hours === 0 ? "Đã hết hạn" : hours >= 24 ? `Còn ${Math.floor(hours / 24)} ngày${hours % 24 ? ` ${hours % 24} giờ` : ""}` : `Còn ${hours} giờ`; }
export function makeB2BFixtures(): B2BData {
  return {
    companies: [
      { id: "company-an", name: "An Retail", initials: "AR", industry: "Bán lẻ & thời trang", brand: "An Boutique", contact: "Người liên hệ mẫu A", email: "leasing@an.example", phone: "", owner: "Nhân viên leasing mẫu", note: "Ưu tiên hai slot liền kề, mặt tiền rộng. Khách cần khảo sát trước khi xác nhận." },
      { id: "company-lam", name: "Lam Foods", initials: "LF", industry: "Ẩm thực & đồ uống", brand: "Lam Kitchen", contact: "Người liên hệ mẫu B", email: "leasing@lam.example", phone: "", owner: "Nhân viên leasing mẫu", note: "Đối tác đang thuê. Theo dõi bàn giao và mốc thông báo gia hạn theo hợp đồng." },
      { id: "company-viet", name: "Việt Studio", initials: "VS", industry: "Dịch vụ & văn phòng", brand: "Việt Studio", contact: "Người liên hệ mẫu C", email: "office@viet.example", phone: "", owner: "Chưa phân công", note: "Quan tâm một slot tầng 3. Chưa có cam kết giữ chỗ." },
    ],
    requests: [
      { id: "YC-2026-018", companyId: "company-an", floor: 2, slotIds: ["T2-B2", "T2-B3"], area: 328, start: "2027-01-01", end: "2027-12-31", status: "submitted", note: "Cần 300–400 m², có thể nối hai slot. Khảo sát và xác nhận điều kiện kỹ thuật trước khi ký.", received: "2026-10-06" },
      { id: "YC-2026-017", companyId: "company-an", floor: 2, slotIds: ["T2-B8", "T2-B9"], area: 328, start: "2027-01-01", end: "2027-12-31", status: "approved", note: "Phương án thay thế đã được giữ chỗ trong dữ liệu mẫu.", received: "2026-10-05" },
      { id: "YC-2026-016", companyId: "company-viet", floor: 3, slotIds: ["T3-B7"], area: 164, start: "2027-02-01", end: "2028-01-31", status: "reviewing", note: "Văn phòng đại diện; cần xem bản vẽ được duyệt.", received: "2026-10-05" },
    ],
    reservations: [{ id: "GC-2026-009", requestId: "YC-2026-017", companyId: "company-an", floor: 2, slotIds: ["T2-B8", "T2-B9"], area: 328, start: "2027-01-01", end: "2027-12-31", expiresAt: new Date(Date.now() + 48 * 3600000).toISOString(), status: "active", note: "Thời hạn minh họa, chưa phải chính sách đã chốt." }],
    leases: [{ id: "HD-2026-004", companyId: "company-lam", floor: 1, slotIds: ["T1-B1"], area: 205, start: "2026-04-01", end: "2027-03-31", status: "executed", rentNote: "Theo thỏa thuận riêng · số tiền chưa nhập", documentName: "Hợp đồng thuê · Lam Foods · bản mẫu", documentMediaId: "contract-sample-pdf", signedOn: "2026-03-20" },
      { id: "HD-2026-008", companyId: "company-an", floor: 1, slotIds: ["T1-B8", "T1-B9"], area: 328, start: "2026-08-01", end: "2028-07-31", status: "executed", rentNote: "Đơn giá và phí dịch vụ theo phụ lục riêng · mẫu", documentName: "Hợp đồng thuê · An Boutique · bản mẫu", signedOn: "2026-07-15" },
      { id: "HD-2026-006", companyId: "company-viet", floor: 4, slotIds: ["T4-B2", "T4-B3"], area: 328, start: "2026-06-01", end: "2027-05-31", status: "executed", rentNote: "Kỳ thanh toán và tiền bảo đảm theo thỏa thuận riêng · mẫu", documentName: "Hợp đồng thuê · Việt Studio · bản mẫu", signedOn: "2026-05-20" },
      { id: "HD-2026-003", companyId: "company-lam", floor: 2, slotIds: ["T2-B11"], area: 205, start: "2026-01-01", end: "2026-12-31", status: "executed", rentNote: "Đang rà soát điều khoản gia hạn · mẫu", documentName: "Hợp đồng thuê · Lam Kitchen · bản mẫu", signedOn: "2025-12-18" },
    ],
    appointments: [
      { id: "LH-2026-012", companyId: "company-an", purpose: "Khảo sát mặt bằng", startsAt: new Date(Date.now() + 24 * 3600000).toISOString(), status: "confirmed", location: "Sảnh Le Grande Centre", durationMinutes: 30 },
      { id: "LH-2026-013", companyId: "company-viet", purpose: "Tư vấn nhu cầu thuê", startsAt: new Date(Date.now() + 29 * 3600000).toISOString(), status: "requested", location: "Phòng tư vấn · tầng 1", durationMinutes: 30 },
    ],
  };
}
