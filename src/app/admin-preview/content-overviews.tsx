"use client";

import { useState } from "react";
import { AdminPanel, Badge, Button, Input, Table } from "@mall/ui";
import { FLOORS, floorPurpose, type Floor, type Slot, type SpaceGroup } from "@/features/admin/space-model";
import type { MediaItem } from "@/features/admin/contracts";

type Props = {
  slots: Slot[];
  groups: SpaceGroup[];
  media: MediaItem[];
  onSpace: (floor: Floor, slotId?: string) => void;
};
const number = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

export function FloorOverview({ slots, groups, media, onSpace }: Props) {
  const rows = FLOORS.map(floor => {
    const members = slots.filter(slot => slot.floor === floor);
    const floorGroups = groups.filter(group => group.floor === floor);
    const memberIds = new Set(members.map(slot => `slot:${slot.id}`));
    const groupIds = new Set(floorGroups.map(group => `group:${group.id}`));
    return {
      floor, count: members.length,
      area: members.reduce((sum, slot) => sum + slot.area, 0),
      media: media.filter(item => item.scope === `Tầng ${floor}` || memberIds.has(item.scope) || groupIds.has(item.scope)).length,
    };
  });
  return <AdminPanel className="records-panel" labelledBy="floor-overview-heading">
    <div className="register-heading"><h2 id="floor-overview-heading">Danh sách tầng</h2><Badge tone="warning">Dữ liệu mẫu</Badge></div>
    <Table viewportLabel="Tổng quan tầng, có thể cuộn ngang" emptyLabel="Chưa có tầng." rows={rows} getRowKey={row => String(row.floor)} columns={[
      { id: "floor", header: "Tầng", cell: row => <strong>Tầng {row.floor}</strong> },
      { id: "purpose", header: "Công năng minh họa", cell: row => floorPurpose[row.floor] },
      { id: "count", header: "Căn gốc", cell: row => number(row.count) },
      { id: "area", header: "Diện tích mẫu", cell: row => `${number(row.area)} m²` },
      { id: "media", header: "Media liên kết", cell: row => number(row.media) },
      { id: "action", header: "Thao tác", cell: row => <Button variant="quiet" className="text-button" onClick={() => onSpace(row.floor)}>Xem căn tầng {row.floor}</Button> },
    ]}/>
    <p className="panel-note">Sáu tầng cố định. Công năng, diện tích và sơ đồ cần đối soát với hồ sơ Kỹ thuật trước khi công bố.</p>
  </AdminPanel>;
}

export function TenantOverview({ slots, onSpace }: Pick<Props, "slots" | "onSpace">) {
  const [query, setQuery] = useState("");
  const names = [...new Set(slots.map(slot => slot.tenant.trim()).filter(Boolean))];
  const rows = names.filter(name => name.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi"))).map(name => ({
    name, slots: slots.filter(slot => slot.tenant.trim() === name),
  }));
  return <AdminPanel className="records-panel" labelledBy="tenant-overview-heading">
    <div className="register-heading"><h2 id="tenant-overview-heading">Đối tác gắn với mặt bằng</h2><label className="search-field"><span className="sr-only">Tìm tên đối tác</span><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm tên đối tác…"/></label></div>
    <Table viewportLabel="Đối tác và căn liên quan, có thể cuộn ngang" rows={rows} getRowKey={row => row.name} emptyLabel="Không có đối tác phù hợp." columns={[
      { id: "name", header: "Tên đối tác", cell: row => <strong>{row.name}</strong> },
      { id: "count", header: "Căn liên quan", cell: row => row.slots.length },
      { id: "spaces", header: "Mặt bằng / trạng thái", cell: row => <div className="selection-chips">{row.slots.map(slot => <Button key={slot.id} variant="quiet" className="text-button" onClick={() => onSpace(slot.floor, slot.id)}>Tầng {slot.floor} · {slot.code} · {slot.status}</Button>)}</div> },
    ]}/>
    <p className="panel-note">Tổng hợp từ tên đối tác đang gắn trên căn trong phiên demo; không xác nhận quyền thuê hay hợp đồng. Hồ sơ Tenant riêng và trường thông tin cần chốt trong scope production.</p>
  </AdminPanel>;
}
