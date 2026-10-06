export const FLOORS = [1, 2, 3, 4, 5, 6] as const;
export type Floor = (typeof FLOORS)[number];
export type Slot = {
  id: string; floor: Floor; code: string; order: number;
  side: "west" | "east"; area: number; width: number; status: string; tenant: string;
};
export type SpaceGroup = {
  id: string; floor: Floor; name: string; slotIds: string[]; status: string;
};
export const floorPurpose: Record<Floor, string> = {
  1: "Thương mại & shophouse", 2: "Thương mại & shophouse",
  3: "Dịch vụ & văn phòng", 4: "Dịch vụ & văn phòng",
  5: "Giải trí & sự kiện", 6: "Giải trí & sự kiện",
};

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

export function mergeIssue(slots: Slot[], groups: SpaceGroup[], ids: string[], floor: Floor): string | null {
  if (ids.length < 2) return "Chọn ít nhất 2 slot liền kề để ghép.";
  if (new Set(ids).size !== ids.length) return "Mỗi slot chỉ được chọn một lần.";
  const members = ids.map((id) => slots.find((slot) => slot.id === id));
  if (members.some((slot) => !slot)) return "Có slot không tồn tại. Hãy chọn lại.";
  const valid = members.filter((slot): slot is Slot => !!slot).sort((a, b) => a.order - b.order);
  if (valid.some((slot) => slot.floor !== floor)) return "Chỉ ghép các slot trên cùng tầng đang xem.";
  if (valid.some((slot) => slot.side !== valid[0].side)) return "Không thể ghép qua sảnh hoặc khoảng thông tầng.";
  if (valid.some((slot, i) => i > 0 && slot.order !== valid[i - 1].order + 1)) return "Các slot phải liền kề. Chọn thêm slot ở giữa hoặc bỏ slot cách xa.";
  if (groups.some((group) => group.slotIds.some((id) => ids.includes(id)))) return "Slot đã thuộc một mặt bằng ghép. Tách nhóm hiện có trước.";
  if (valid.some((slot) => slot.tenant || slot.status !== "Trống")) return "Demo chỉ ghép slot Trống, chưa có đối tác. Rà soát trạng thái trước.";
  return null;
}

export function slotLeft(slot: Slot): number {
  // Frontage is 100 units in total, including an 8-unit central core.
  return slot.order === 1 ? 0 : 10 + (slot.order - 2) * 8 + (slot.side === "east" ? 8 : 0);
}
