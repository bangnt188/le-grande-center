"use client";

import { useRef, useState } from "react";
import { AdminPanel, Alert, Badge, Button, ConfirmDialog, EmptyState, Input, LoadingIndicator } from "@mall/ui";
import type { ToastTone } from "@mall/ui";
import { dateLabel, requestLabels, timeLabel } from "./b2b-model";
import type { AdminData } from "./use-admin-data";

export type SlotRecordEntry = { view: "customers" | "requests" | "leases"; id: string };
type Props = {
  id: string;
  data: AdminData;
  onBack: () => void;
  onSlot: (id: string) => void;
  onRecord: (entry: SlotRecordEntry) => void;
  onMedia: (id?: string, scope?: string) => void;
  onMessage: (message: string, tone?: ToastTone) => void;
};
const fmt = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const holdLabels = { active: "Đang giữ chỗ", cancelled: "Đã hủy", converted: "Đã chuyển hợp đồng" };

export default function SlotDetail({ id, data, onBack, onSlot, onRecord, onMedia, onMessage }: Props) {
  const dialogContainer = useRef<HTMLDivElement>(null);
  const [confirmSplit, setConfirmSplit] = useState(false);
  const splitting = useRef(false);
  const effectiveHeading = useRef<HTMLHeadingElement>(null);
  const slot = data.slots.find(item => item.id === id);
  const group = data.groups.find(item => item.slotIds.includes(id));
  const ids = group?.slotIds ?? [id];
  const members = data.slots.filter(item => ids.includes(item.id));
  const matches = (item: { slotIds: string[] }) => item.slotIds.some(member => ids.includes(member));
  const requests = data.requests.filter(matches);
  const holds = data.reservations.filter(matches);
  const leases = data.leases.filter(matches);
  // Match repository protection: active holds and all recorded leases, not wall-clock expiry.
  const protectedCommitment = holds.some(item => item.status === "active") || leases.length > 0;
  const companyIds = new Set([...requests, ...holds, ...leases].map(item => item.companyId));
  const companies = data.companies.filter(item => companyIds.has(item.id));
  const companyName = (companyId: string) => data.companies.find(item => item.id === companyId)?.name ?? companyId;
  const scopedMedia = data.media.filter(item => ids.some(member => item.scope === `slot:${member}`) || (group && item.scope === `group:${group.id}`) || (slot && item.scope === `Tầng ${slot.floor}`) || item.scope === "Toàn dự án");
  const blocked = data.pending || data.loading || protectedCommitment;

  async function save(form: HTMLFormElement) {
    if (!slot || blocked) return;
    const fields = new FormData(form);
    const status = String(fields.get("status") ?? "").trim();
    const name = String(fields.get("name") ?? "").trim();
    if (!status || (group && !name)) { onMessage("Nhập đầy đủ trạng thái và tên mặt bằng.", "warning"); return; }
    const command = group
      ? { type: "update-group" as const, groupId: group.id, name, status }
      : { type: "update-slot" as const, slotId: slot.id, status, tenant: String(fields.get("tenant") ?? "").trim() };
    if (await data.execute(command)) onMessage("Đã lưu thay đổi mặt bằng trong phiên hiện tại.");
  }
  async function split() {
    if (!group || blocked || splitting.current) return;
    splitting.current = true;
    try {
      if (await data.execute({ type: "split", groupId: group.id })) {
        setConfirmSplit(false);
        onMessage(`Đã tách ${group.name}. Slot giữ trạng thái ${group.status}; media nhóm chuyển về tầng ${group.floor}.`);
        requestAnimationFrame(() => effectiveHeading.current?.focus());
      }
    } finally { splitting.current = false; }
  }

  return <div className="slot-dossier">
    <div className="slot-dossier-return"><Button variant="secondary" onClick={onBack}>Quay lại mặt bằng</Button><span className="muted">Cùng dữ liệu quản trị · không tải lại phiên</span></div>
    {data.loading ? <LoadingIndicator label="Đang tải hồ sơ slot…"/> : !slot ? <>
      {data.error ? <Alert tone="error">{data.error}</Alert> : <EmptyState title="Không tìm thấy slot">Mã {id || "(trống)"} không có trong dữ liệu quản trị. Không có mặt bằng thay thế tự động.</EmptyState>}
      <Button variant="secondary" disabled={data.pending} onClick={() => void data.reload()}>{data.pending ? "Đang tải lại…" : "Tải lại dữ liệu"}</Button>
    </> : <>
      <Alert tone="warning">Dữ liệu demo, chỉ giữ trong phiên hiện tại. Hình học 6 tầng được lặp từ bản vẽ chưa xác nhận tầng; diện tích và kích thước là fixture, không phải thông số bàn giao. Mã {slot.id} không được ánh xạ sang mã căn brochure công khai.</Alert>
      {data.error && <Alert tone="error">{data.error} <Button variant="quiet" onClick={() => void data.reload()} disabled={data.pending}>Tải lại dữ liệu</Button></Alert>}
      <div className="slot-dossier-columns">
        <div className="slot-dossier-main">
          <AdminPanel className="slot-dossier-section" labelledBy="slot-original-heading">
            <h2 id="slot-original-heading">Slot gốc {slot.code}</h2>
            <dl className="slot-dossier-facts"><div><dt>Mã quản trị</dt><dd>{slot.id}</dd></div><div><dt>Tầng</dt><dd>{slot.floor}</dd></div><div><dt>Diện tích gốc</dt><dd>{fmt(slot.area)} m²</dd></div><div><dt>Chiều rộng fixture</dt><dd>{fmt(slot.width)} m</dd></div><div><dt>Trạng thái slot gốc</dt><dd>{slot.status}</dd></div><div><dt>Tenant / đối tác slot</dt><dd>{slot.tenant || "Chưa có đối tác"}</dd></div></dl>
          </AdminPanel>
          <AdminPanel className="slot-dossier-section" labelledBy="slot-effective-heading">
            <div className="slot-dossier-section-heading"><h2 ref={effectiveHeading} tabIndex={-1} id="slot-effective-heading">{group ? group.name : "Mặt bằng hiện tại"}</h2><Badge className="slot-dossier-status" tone={(group?.status ?? slot.status) === "Trống" ? "success" : "neutral"}>{group?.status ?? slot.status}</Badge></div>
            <p>{group ? `${group.id} · ${members.length} slot gốc · ${fmt(members.reduce((sum, item) => sum + item.area, 0))} m² tổng diện tích fixture` : "Slot độc lập, chưa thuộc nhóm ghép."}</p>
            <ul className="slot-dossier-members">{members.map(member => <li key={member.id}><Button variant="quiet" onClick={() => onSlot(member.id)} aria-label={`Mở hồ sơ slot ${member.id}`} aria-current={member.id === id ? "page" : undefined}>{member.id}</Button><span>{fmt(member.area)} m² · {fmt(member.width)} m · {member.tenant || "Chưa có đối tác"}</span></li>)}</ul>
            {group && <p className="muted">Trạng thái đang khai thác áp dụng cho cả nhóm. Diện tích và mã từng slot gốc được giữ nguyên.</p>}
          </AdminPanel>
          <AdminPanel className="slot-dossier-section" labelledBy="slot-requests-heading">
            <h2 id="slot-requests-heading">Yêu cầu thuê liên quan <span>({requests.length})</span></h2>
            {requests.length ? <ul className="slot-dossier-records">{requests.map(item => <li key={item.id}><div><strong>{item.id} · {companyName(item.companyId)}</strong><span>{requestLabels[item.status]} · {fmt(item.area)} m²</span><small>{dateLabel(item.start)} – {dateLabel(item.end)} · {item.slotIds.join(" + ")}</small>{item.note && <p>{item.note}</p>}</div><Button variant="quiet" onClick={() => onRecord({ view: "requests", id: item.id })}>Xem yêu cầu {item.id}</Button></li>)}</ul> : <p className="muted">Chưa có yêu cầu thuê gắn với {group ? "nhóm slot này" : "slot này"}.</p>}
          </AdminPanel>
          <AdminPanel className="slot-dossier-section" labelledBy="slot-holds-heading">
            <h2 id="slot-holds-heading">Giữ chỗ liên quan <span>({holds.length})</span></h2>
            {holds.length ? <ul className="slot-dossier-records">{holds.map(item => <li key={item.id}><div><strong>{item.id} · {companyName(item.companyId)}</strong><span>{holdLabels[item.status]} · {item.requestId}</span><small>Kỳ thuê {dateLabel(item.start)} – {dateLabel(item.end)} · {item.slotIds.join(" + ")}</small><small>Hạn xác nhận {timeLabel(item.expiresAt)}, {dateLabel(item.expiresAt)} · mốc demo 06/10/2026</small>{item.note && <p>{item.note}</p>}</div><Button variant="quiet" onClick={() => onRecord({ view: "requests", id: item.requestId })}>Quản lý giữ chỗ {item.id}</Button></li>)}</ul> : <p className="muted">Chưa có giữ chỗ liên quan.</p>}
          </AdminPanel>
          <AdminPanel className="slot-dossier-section" labelledBy="slot-leases-heading">
            <h2 id="slot-leases-heading">Hợp đồng liên quan <span>({leases.length})</span></h2>
            {leases.length ? <ul className="slot-dossier-records">{leases.map(item => <li key={item.id}><div><strong>{item.id} · {companyName(item.companyId)}</strong><span>Đã ký · {fmt(item.area)} m² · {item.slotIds.join(" + ")}</span><small>{dateLabel(item.start)} – {dateLabel(item.end)}</small><p>{item.rentNote}</p><small>{item.documentName} · văn bản mẫu, chưa có tệp ký chính thức</small></div><Button variant="quiet" onClick={() => onRecord({ view: "leases", id: item.id })}>Xem hợp đồng {item.id}</Button></li>)}</ul> : <p className="muted">Chưa có hợp đồng liên quan.</p>}
          </AdminPanel>
          <AdminPanel className="slot-dossier-section" labelledBy="slot-companies-heading">
            <h2 id="slot-companies-heading">Doanh nghiệp liên quan <span>({companies.length})</span></h2>
            {companies.length ? <ul className="slot-dossier-records">{companies.map(item => <li key={item.id}><div><strong>{item.name}</strong><span>{item.brand} · {item.industry}</span><small>{item.contact} · {item.email}</small><small>Phụ trách: {item.owner}</small></div><Button variant="quiet" onClick={() => onRecord({ view: "customers", id: item.id })}>Hồ sơ {item.name}</Button></li>)}</ul> : <p className="muted">Chưa có hồ sơ doanh nghiệp liên kết qua yêu cầu, giữ chỗ hoặc hợp đồng. Tên tenant nhập tự do không tự tạo liên kết doanh nghiệp.</p>}
          </AdminPanel>
        </div>
        <aside className="slot-dossier-side" aria-label="Thao tác và tài liệu slot">
          <AdminPanel className="slot-dossier-section" labelledBy="slot-edit-heading">
            <h2 id="slot-edit-heading">{group ? "Cập nhật nhóm ghép" : "Cập nhật slot"}</h2>
            {protectedCommitment && <Alert tone="warning">Mặt bằng đang có cam kết giữ chỗ hoặc hợp đồng. Không thể sửa trực tiếp hoặc tách nhóm; dùng các mục yêu cầu / hợp đồng bên cạnh để xử lý đúng luồng.</Alert>}
            <form key={`${slot.id}:${group?.id ?? "single"}:${group?.status ?? slot.status}:${group?.name ?? slot.tenant}`} className="slot-dossier-form" onSubmit={event => { event.preventDefault(); void save(event.currentTarget); }}>
              <fieldset disabled={blocked}>
                {group && <label>Tên nhóm<Input name="name" required maxLength={80} defaultValue={group.name}/></label>}
                <label>Trạng thái<Input name="status" required maxLength={60} defaultValue={group?.status ?? slot.status} list="slot-dossier-statuses"/><small>Text tự do, tối đa 60 ký tự.</small></label>
                <datalist id="slot-dossier-statuses">{[...new Set(["Trống", "Đang thuê", "Đã đặt cọc", "Đang đàm phán", ...data.slots.map(item => item.status), ...data.groups.map(item => item.status)])].map(status => <option key={status} value={status}/>)}</datalist>
                {!group && <label>Tenant / đối tác<Input name="tenant" maxLength={80} defaultValue={slot.tenant}/></label>}
                <Button variant="primary" type="submit" disabled={blocked} loading={data.pending} loadingLabel="Đang lưu…">Lưu thay đổi</Button>
              </fieldset>
            </form>
            {group && <Button variant="secondary" disabled={blocked} onClick={() => setConfirmSplit(true)}>Tách về {members.length} slot gốc</Button>}
          </AdminPanel>
          <AdminPanel className="slot-dossier-section" labelledBy="slot-media-heading">
            <h2 id="slot-media-heading">Media liên quan <span>({scopedMedia.length})</span></h2>
            <p className="muted">Tệp gắn với slot thành viên, nhóm, tầng và toàn dự án. Bản vẽ chưa xác nhận tầng không được coi là tài liệu của slot.</p>
            {scopedMedia.length ? <ul className="slot-dossier-media">{scopedMedia.map(item => <li key={item.id}>
              {item.kind === "Ảnh" && item.url && <img src={item.url} alt={item.name}/>}
              <strong>{item.name}</strong><small>{item.scope.startsWith("slot:") ? `Slot ${item.scope.slice(5)}` : item.scope.startsWith("group:") ? `Nhóm ${group?.name ?? item.scope.slice(6)}` : item.scope} · {item.size}</small>
              {item.reference && <small>Bản vẽ tham chiếu, chưa xác nhận thông số bàn giao.</small>}
              {item.url ? <a href={item.url} target="_blank" rel="noreferrer">Mở tệp gốc {item.name}</a> : <p className="muted">Chỉ có mục dữ liệu mẫu; chưa có tệp để mở hoặc tải xuống.</p>}
              <Button variant="quiet" onClick={() => onMedia(item.id)}>Quản lý media {item.name}</Button>
            </li>)}</ul> : <p className="muted">Chưa có media liên kết với slot, nhóm hoặc tầng này.</p>}
            <Button variant="secondary" onClick={() => onMedia(undefined, group ? `group:${group.id}` : `slot:${slot.id}`)}>Thêm tệp cho {group ? "nhóm" : "slot"}</Button>
          </AdminPanel>
        </aside>
      </div>
      <div ref={dialogContainer} className="admin-dialog-host"/>
      <ConfirmDialog open={confirmSplit && !!group} title="Tách mặt bằng ghép?" description={group ? `${group.name} sẽ trở về ${members.length} slot gốc. Diện tích và mã gốc giữ nguyên; các slot giữ trạng thái ${group.status}. Media của nhóm sẽ chuyển về tầng ${group.floor}.` : ""} confirmLabel={data.pending ? "Đang tách…" : "Xác nhận tách nhóm"} cancelLabel="Giữ nhóm" onClose={() => { if (!splitting.current) setConfirmSplit(false); }} onConfirm={() => void split()} portalContainer={dialogContainer}/>
    </>}
  </div>;
}
