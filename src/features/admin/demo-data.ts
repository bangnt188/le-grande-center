import { makeB2BFixtures } from "./b2b-model";
import type { Lead, MediaItem, AdminSnapshot } from "./contracts";
import { FLOORS } from "./space-model";
import type { Floor, Slot, SpaceGroup } from "./space-model";

// The customer's plan does not identify its floor. Repeated geometry is fixture
// data for demonstrating workflows, not an assertion about actual inventory.
export function makeSlots(): Slot[] {
  return FLOORS.flatMap((floor) => Array.from({ length: 11 }, (_, i) => ({
    id: `T${floor}-B${i + 1}`, floor, code: `B.${i + 1}`, order: i + 1,
    side: i < 5 ? "west" as const : "east" as const,
    area: i === 0 || i === 10 ? 205 : 164,
    width: i === 0 || i === 10 ? 10 : 8,
    status: i === 0 ? "Đang thuê" : i === 3 ? "Đang đàm phán" : i === 5 ? "Đã đặt cọc" : "Trống",
    tenant: i === 0 ? "Đối tác mẫu A" : i === 3 ? "Đối tác mẫu B" : i === 5 ? "Đối tác mẫu C" : "",
  })));
}
export const initialGroups: SpaceGroup[] = [{
  id: "demo-group-2-8-9", floor: 2, name: "Mặt bằng thương mại 08–09",
  slotIds: ["T2-B8", "T2-B9"], status: "Trống",
}];

const leadFixtures: Lead[] = [
  { id: "DEMO-1048", name: "Khách hàng mẫu A", initials: "KA", interest: "Thương mại · 300–400 m²", floor: 2 as Floor, source: "Form website", time: "Hôm nay, 09:42", status: "Mới", note: "Quan tâm hai slot liền kề, có mặt tiền rộng." },
  { id: "DEMO-1047", name: "Khách hàng mẫu B", initials: "KB", interest: "Văn phòng · 164 m²", floor: 3 as Floor, source: "Zalo", time: "Hôm nay, 08:15", status: "Đang tư vấn", note: "Cần xem sơ đồ tầng và tài liệu mặt bằng." },
  { id: "DEMO-1046", name: "Khách hàng mẫu C", initials: "KC", interest: "Sự kiện · 400 m²", floor: 6 as Floor, source: "Hotline", time: "Hôm qua, 16:30", status: "Đã xử lý", note: "Đã trao đổi nhu cầu tổ chức sự kiện." },
  { id: "DEMO-1045", name: "Khách hàng mẫu D", initials: "KD", interest: "Shophouse · 205 m²", floor: 1 as Floor, source: "Form website", time: "Hôm qua, 14:10", status: "Mới", note: "Quan tâm slot ở vị trí biên." },
];

const basePath = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://bangnt188.github.io/le-grande-center/").pathname.replace(/\/$/, "");
export const referencePlanUrl = `${basePath}/admin-demo/floor-plan.png`;
export const adminLogoUrl = `${basePath}/admin-demo/logo-without-text.webp`;
const mediaFixtures: MediaItem[] = [
  { id: "plan-reference", name: "Sơ đồ slot B · Khách hàng", kind: "Ảnh", scope: "Chưa xác nhận tầng", size: "Bản vẽ tham chiếu", url: referencePlanUrl, reference: true },
  { id: "sample-plan", name: "Sơ đồ mặt bằng · Tầng 2", kind: "Tài liệu", scope: "Tầng 2", size: "Fixture minh họa" },
  { id: "sample-brochure", name: "Brochure dự án", kind: "Tài liệu", scope: "Toàn dự án", size: "Chưa có tệp bàn giao" },
];

export function makeDemoSnapshot(): AdminSnapshot {
  const data = structuredClone({ ...makeB2BFixtures(), revision: 0, slots: makeSlots(), groups: initialGroups, leads: leadFixtures, media: mediaFixtures });
  const hold = data.reservations[0];
  data.slots = data.slots.map((slot) => hold.slotIds.includes(slot.id) ? { ...slot, status: "Đang giữ chỗ", tenant: "An Retail" } : slot);
  data.groups = data.groups.map((group) => group.slotIds.some((id) => hold.slotIds.includes(id)) ? { ...group, status: "Đang giữ chỗ" } : group);
  for (const lease of data.leases) {
    const company = data.companies.find((item) => item.id === lease.companyId)!;
    data.slots = data.slots.map((slot) => lease.slotIds.includes(slot.id) ? { ...slot, status: "Đang thuê", tenant: company.name } : slot);
    if (lease.slotIds.length > 1) data.groups.push({ id: `demo-group-${lease.id}`, floor: lease.floor, name: `Mặt bằng ${lease.slotIds.map((id) => id.split("-")[1].replace("B", "B.")).join(" + ")}`, slotIds: [...lease.slotIds], status: "Đang thuê" });
  }
  return data;
}
