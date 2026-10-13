import { makeB2BFixtures } from "./b2b-data";
import type { Lead, AdminSnapshot } from "../../../shared/admin/contracts";
import { projectMedia } from "./project-media";
import { DEFAULT_WEBSITE_SETTINGS } from "../../../shared/admin/website-defaults";
import { DEFAULT_FLOOR_CONTENT, FLOORS } from "../../../shared/admin/space-model";
import type { Floor, Slot, SpaceGroup } from "../../../shared/admin/space-model";
import { neonMediaUrl, r2AssetUrl } from "../../../config/site";

// The customer's plan does not identify its floor. Repeated geometry is fixture
// data for demonstrating workflows, not an assertion about actual inventory.
export function makeSlots(): Slot[] {
  return FLOORS.flatMap((floor) => Array.from({ length: 11 }, (_, i): Slot => ({
    id: `T${floor}-B${i + 1}`, floor, code: `B.${i + 1}`, order: i + 1,
    side: i < 5 ? "west" as const : "east" as const,
    area: i === 0 || i === 10 ? 205 : 164,
    width: i === 0 || i === 10 ? 10 : 8,
    status: "Trống", tenant: "",
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

export const referencePlanUrl = r2AssetUrl("admin-demo/floor-plan.png");
export const adminLogoUrl = neonMediaUrl("admin-demo/logo-without-text.webp");
const mediaFixtures = projectMedia();

export function makeDemoSnapshot(): AdminSnapshot {
  const purposes = ["Thương mại dịch vụ", "Thương mại dịch vụ", "Dịch vụ & văn phòng", "Dịch vụ & văn phòng", "Dịch vụ & văn phòng", "Sự kiện & trải nghiệm"];
  const data: AdminSnapshot = structuredClone({ ...makeB2BFixtures(), revision: 0, storage: { usedBytes: 0, reservedBytes: 0 }, floors: DEFAULT_FLOOR_CONTENT.map((content, index) => ({ ...content, purpose: purposes[index] })), settings: { website: DEFAULT_WEBSITE_SETTINGS, propertyName: "Le Grande Centre", contactEmail: "leasing@legrande.example", contactPhone: "0973879563", defaultHoldHours: 48, appointmentMinutes: 30, appointmentLocation: "Phòng tư vấn · tầng 1" }, slots: makeSlots(), groups: initialGroups, leads: leadFixtures, media: mediaFixtures });
  for (const lease of data.leases) {
    const company = data.companies.find((item) => item.id === lease.companyId)!;
    data.slots = data.slots.map((slot) => lease.slotIds.includes(slot.id) ? { ...slot, status: "Đang thuê", tenant: company.name } : slot);
    if (lease.slotIds.length > 1) data.groups.push({ id: `demo-group-${lease.id}`, floor: lease.floor, name: `Mặt bằng ${lease.slotIds.map((id) => id.split("-")[1].replace("B", "B.")).join(" + ")}`, slotIds: [...lease.slotIds], status: "Đang thuê" });
  }
  return data;
}
