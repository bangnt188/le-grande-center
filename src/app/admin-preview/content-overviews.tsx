"use client";

import { useState } from "react";
import { AdminPanel, Badge, Button, Input, Table, Textarea, type ToastTone } from "@mall/ui";
import { FLOORS, FLOOR_PUBLIC_DESCRIPTION_MAX_LENGTH, FLOOR_PUBLIC_TITLE_MAX_LENGTH, FLOOR_PURPOSE_MAX_LENGTH, type Floor } from "@/shared/admin/space-model";
import { siteUrl } from "@/config/site";
import { BROCHURE_FLOORS, BROCHURE_PATH } from "@/features/public/brochure-leasing";
import type { AdminData } from "@/features/admin/use-admin-data";
import { AdminEditor } from "@/features/admin/admin-editor";
import { AdminPagination, useAdminPagination } from "@/features/admin/admin-pagination";
import styles from "@/features/admin/admin-records.module.css";
import { tenantRecords } from "@/features/admin/tenant-records";

type Props = { data: AdminData; onSpace: (floor: Floor, slotId?: string) => void; onMessage: (message: string, tone?: ToastTone) => void };
const number = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

export function FloorOverview({ data, onSpace, onMessage }: Props) {
  const [editing, setEditing] = useState<Floor | null>(null);
  const assetBase = new URL(siteUrl).pathname.replace(/\/+$/, "");
  const rows = FLOORS.map(floor => {
    const members = data.slots.filter(slot => slot.floor === floor);
    const floorGroups = data.groups.filter(group => group.floor === floor);
    const scopes = new Set([`Tầng ${floor}`, ...members.map(slot => `slot:${slot.id}`), ...floorGroups.map(group => `group:${group.id}`)]);
    const content = data.floors.find(item => item.number === floor)!;
    return { floor, purpose: content.purpose, publicTitle: content.publicTitle, publicDescription: content.publicDescription, count: members.length, area: members.reduce((sum, slot) => sum + slot.area, 0), media: data.media.filter(item => scopes.has(item.scope)).length };
  });
  return <><AdminPanel className="records-panel" labelledBy="floor-overview-heading">
    <div className="register-heading"><h2 id="floor-overview-heading">Danh sách tầng</h2><Badge tone="warning">Lưu trong trình duyệt</Badge></div>
    <Table viewportLabel="Tổng quan tầng, có thể cuộn ngang" emptyLabel="Chưa có tầng." rows={rows} getRowKey={row => String(row.floor)} columns={[
      { id: "floor", header: "Tầng", cell: row => <strong>Tầng {row.floor}</strong> },
      { id: "purpose", header: "Công năng nội bộ", cell: row => row.purpose || "Chưa cập nhật" },
      { id: "publicCopy", header: "Nội dung website", cell: row => <><strong>{row.publicTitle}</strong><small>{row.publicDescription}</small></> },
      { id: "count", header: "Slot gốc", cell: row => number(row.count) },
      { id: "area", header: "Tổng diện tích slot", cell: row => `${number(row.area)} m²` },
      { id: "media", header: "Media liên kết", cell: row => number(row.media) },
      { id: "action", header: "Thao tác", cell: row => <div className={styles.actions}><Button variant="quiet" onClick={() => onSpace(row.floor)}>Xem slot tầng {row.floor}</Button><Button variant="secondary" disabled={data.pending} onClick={() => setEditing(row.floor)}>Sửa nội dung</Button></div> },
    ]}/>
    <p className="panel-note">Mô tả website dùng chung cho trang chủ, 3D, tổng quan tầng và mặt bằng. Công năng nội bộ vẫn là trường riêng. Nội dung dùng thử chỉ lưu trong trình duyệt này.</p>
  </AdminPanel>{editing !== null && (() => {
    const content = data.floors.find(item => item.number === editing)!;
    const sourcePage = BROCHURE_FLOORS.find(item => item.id === editing)!.sourcePage;
    return <AdminEditor data={data} title={`Nội dung tầng ${editing}`} description="Tên và mô tả website này được dùng chung tại trang chủ, 3D, tổng quan tầng và mặt bằng." onClose={() => setEditing(null)} onSave={async form => {
      const saved = await data.execute({ type: "update-floor", floor: editing, purpose: String(form.get("purpose") ?? "").trim(), publicTitle: String(form.get("publicTitle") ?? "").trim(), publicDescription: String(form.get("publicDescription") ?? "").trim() });
      if (saved) onMessage("Đã lưu nội dung tầng trong trình duyệt.");
      return saved;
    }}>
      <label>Công năng nội bộ<Input name="purpose" required maxLength={FLOOR_PURPOSE_MAX_LENGTH} defaultValue={content.purpose}/></label>
      <label>Tên hiển thị trên website<Input name="publicTitle" required maxLength={FLOOR_PUBLIC_TITLE_MAX_LENGTH} defaultValue={content.publicTitle}/></label>
      <label>Mô tả dùng chung<Textarea name="publicDescription" required maxLength={FLOOR_PUBLIC_DESCRIPTION_MAX_LENGTH} defaultValue={content.publicDescription}/></label>
      <a href={`${assetBase}${BROCHURE_PATH}#page=${sourcePage}`} target="_blank" rel="noopener noreferrer">Đối chiếu tầng {editing} · trang {sourcePage} trong brochure PDF<span className="sr-only"> (tab mới)</span></a>
    </AdminEditor>;
  })()}</>;
}

export function TenantOverview({ data, onSpace }: Props) {
  const [query, setQuery] = useState("");
  const rows = tenantRecords(data).filter(row => `${row.name} ${row.leases} ${row.slots.map(slot => slot.code).join(" ")}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const pages = useAdminPagination(rows, query);
  return <AdminPanel className="records-panel" labelledBy="tenant-overview-heading">
    <div className="register-heading"><h2 id="tenant-overview-heading">Đối tác thuê mặt bằng</h2><label className="search-field"><span className="sr-only">Tìm đối tác, hợp đồng hoặc slot</span><Input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm đối tác, hợp đồng, slot…"/></label></div>
    <Table viewportLabel="Đối tác và mặt bằng thuê, có thể cuộn ngang" rows={pages.rows} getRowKey={row => row.id} emptyLabel="Không có đối tác thuê phù hợp." columns={[
      { id: "name", header: "Bên thuê", cell: row => <><strong>{row.name}</strong><small className={styles.secondary}>{row.label}</small></> },
      { id: "lease", header: "Hồ sơ thuê", cell: row => row.leases },
      { id: "area", header: "Diện tích slot", cell: row => `${number(row.slots.reduce((sum, slot) => sum + slot.area, 0))} m²` },
      { id: "spaces", header: "Mặt bằng", cell: row => <div className={styles.actions}>{row.slots.map(slot => <Button key={slot.id} variant="quiet" onClick={() => onSpace(slot.floor, slot.id)}>Tầng {slot.floor} · {slot.code} · {slot.status}</Button>)}</div> },
    ]}/><AdminPagination state={pages} label="đối tác thuê"/>
    <p className="panel-note">Doanh nghiệp được tổng hợp từ hồ sơ thuê đã ghi nhận. Tên nhập trực tiếp trên slot không tự tạo doanh nghiệp hoặc chứng minh hợp đồng.</p>
  </AdminPanel>;
}
