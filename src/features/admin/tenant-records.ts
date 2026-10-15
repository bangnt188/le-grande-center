import type { AdminSnapshot } from "../../shared/admin/contracts";

export function companyCategory(data: Pick<AdminSnapshot, "leases" | "reservations" | "requests">, companyId: string, now = Date.now()) {
  if (data.leases.some(lease => lease.companyId === companyId)) return "Đang thuê";
  if (data.reservations.some(hold => hold.companyId === companyId && hold.status === "active" && Date.parse(hold.expiresAt) > now)) return "Đang giữ chỗ";
  if (data.requests.some(request => request.companyId === companyId && (request.status === "submitted" || request.status === "reviewing"))) return "Đang tư vấn";
  return "Chưa thuê";
}
/** A registered tenant requires a lease; a manually occupied slot remains a separate record. */
export function tenantRecords(data: Pick<AdminSnapshot, "companies" | "leases" | "slots">) {
  const leasedIds = new Set(data.leases.flatMap(lease => lease.slotIds));
  const registered = data.companies.flatMap(company => {
    const leases = data.leases.filter(lease => lease.companyId === company.id);
    if (!leases.length) return [];
    const ids = new Set(leases.flatMap(lease => lease.slotIds));
    return [{ id: company.id, name: company.name, label: "Doanh nghiệp trong hồ sơ thuê", leases: leases.map(lease => lease.id).join(", "), slots: data.slots.filter(slot => ids.has(slot.id)) }];
  });
  const manual = data.slots.filter(slot => (slot.status === "Đã thuê" || slot.status === "Đang thuê") && !leasedIds.has(slot.id)).map(slot => ({ id: `manual:${slot.id}`, name: slot.tenant.trim() || "Chưa ghi tên bên thuê", label: "Ghi nhận trực tiếp trên slot · chưa có hồ sơ thuê liên kết", leases: "—", slots: [slot] }));
  return [...registered, ...manual];
}
