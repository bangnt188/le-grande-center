"use client";

import { useEffect, useRef, useState } from "react";
import { AdminPanel, Alert, Badge, Button, ConfirmDialog, EmptyState, FilePreview, Input, PaginatedContent, Select, Textarea, Video, WorkspaceLayout, type ToastTone } from "@mall/ui";
import { LEAD_STATUSES, type Lead, type MediaItem } from "@/shared/admin/contracts";
import { FLOORS, type Floor } from "@/shared/admin/space-model";
import { formatStorageBytes, storageState } from "@/shared/admin/storage-policy";
import type { AdminData } from "./use-admin-data";
import { AdminEditor } from "./admin-editor";
import { AdminPagination, useAdminPagination } from "./admin-pagination";
import { useRecordDetail } from "./use-record-detail";
import styles from "./admin-records.module.css";
import { StorageUsagePanel } from "./storage-usage-panel";
import Link from "next/link";
import { WebsiteSettingsPanel } from "./website-settings-panel";

type Props = { data: AdminData; onMessage: (message: string, tone?: ToastTone) => void };
const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export function LeadsWorkspace({ data, onFloor, onMessage }: Props & { onFloor: (floor: Floor) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Lead | "new" | null>(null);
  const details = useRecordDetail("leads");
  const rows = data.leads.filter(item => (!filter || item.status === filter) && `${item.name} ${item.interest} ${item.email ?? ""} ${item.phone ?? ""} ${item.source} ${data.companies.find(company => company.id === item.companyId)?.name ?? ""}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const pages = useAdminPagination(rows, `${query}|${filter}`);
  const lead = rows.find(item => item.id === selectedId) ?? rows[0];
  const original = editing && editing !== "new" ? editing : undefined;
  return <div ref={details.scopeRef} className={styles.workspace}>
    <div className={styles.toolbar}><p>Ghi nhận và theo dõi nhu cầu tư vấn. Thông tin được lưu trên trình duyệt này, không gửi đến hệ thống tiếp nhận công khai.</p><Button disabled={data.pending} onClick={() => setEditing("new")}>Thêm khách quan tâm</Button></div>
    <WorkspaceLayout className={`records-layout ${styles.layout}`} mobilePresentation="drilldown" detailOpen={details.open} onDetailOpenChange={details.setOpen} returnFocusRef={details.returnFocusRef} detailLabel="Chi tiết khách quan tâm" backLabel="Quay lại danh sách khách" primary={<AdminPanel className="records-panel">
      <div className="register-heading"><h2>Khách quan tâm</h2><div className={styles.filters}><label><span className="sr-only">Tìm khách quan tâm</span><Input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm tên, liên hệ, nhu cầu…"/></label><label><span className="sr-only">Lọc trạng thái tư vấn</span><Select value={filter} onChange={event => setFilter(event.target.value)}><option value="">Tất cả trạng thái</option>{LEAD_STATUSES.map(status => <option key={status}>{status}</option>)}</Select></label></div></div>
      <PaginatedContent layoutKey={pages.pageSize}><div className={styles.list}>{pages.rows.map(item => <Button key={item.id} variant="quiet" className={styles.row} aria-pressed={lead?.id === item.id} onClick={event => { setSelectedId(item.id); details.openDetail("leads", event.currentTarget); }}><span className="lead-avatar">{item.initials}</span><span className={styles.rowText}><strong>{item.name}</strong><span>{item.interest}</span><small>{item.source} · Tầng {item.floor}</small><Badge tone={item.status === "Đã xử lý" ? "success" : item.status === "Mới" ? "warning" : "action"}>{item.status}</Badge></span></Button>)}</div>{!rows.length && <EmptyState title="Không có khách phù hợp" action={<Button variant="quiet" onClick={() => { setQuery(""); setFilter(""); }}>Xóa bộ lọc</Button>}>Thêm khách quan tâm hoặc điều chỉnh tìm kiếm.</EmptyState>}</PaginatedContent><AdminPagination state={pages} label="khách quan tâm"/>
    </AdminPanel>} detail={<AdminPanel className={`records-panel ${styles.detail}`}>{lead ? <><div className={styles.heading}><h2>{lead.name}</h2><Badge tone={lead.status === "Đã xử lý" ? "success" : "neutral"}>{lead.status}</Badge></div><dl className={styles.facts}><dt>Mã hồ sơ</dt><dd>{lead.id}</dd><dt>Nhu cầu</dt><dd>{lead.interest}</dd><dt>Doanh nghiệp</dt><dd>{data.companies.find(company => company.id === lead.companyId)?.name ?? "Chưa liên kết"}</dd><dt>Email</dt><dd>{lead.email || "Chưa cung cấp"}</dd><dt>Điện thoại</dt><dd>{lead.phone || "Chưa cung cấp"}</dd><dt>Nguồn</dt><dd>{lead.source}</dd><dt>Ghi nhận</dt><dd>{lead.time}</dd><dt>Ghi chú</dt><dd className={styles.note}>{lead.note || "Chưa có ghi chú"}</dd></dl><div className={styles.actions}><Button disabled={data.pending} onClick={() => setEditing(lead)}>Sửa thông tin</Button><Button variant="secondary" onClick={() => onFloor(lead.floor)}>Xem tầng {lead.floor}</Button></div></> : <EmptyState title="Chưa có hồ sơ">Chọn hoặc thêm khách quan tâm để xem chi tiết.</EmptyState>}</AdminPanel>}/>
    {editing && <AdminEditor data={data} title={original ? `Sửa khách ${original.name}` : "Thêm khách quan tâm"} description="Lưu hồ sơ tư vấn nội bộ; không tạo giữ chỗ hoặc hợp đồng." onClose={() => setEditing(null)} onSave={async form => {
      const floor = FLOORS.find(value => value === Number(form.get("floor")));
      const status = LEAD_STATUSES.find(value => value === field(form, "status"));
      if (!floor || !status) return false;
      const saved = await data.execute({ type: "save-lead", leadId: original?.id, values: { name: field(form, "name"), interest: field(form, "interest"), floor, source: field(form, "source"), status, note: field(form, "note"), companyId: field(form, "companyId") || undefined, email: field(form, "email") || undefined, phone: field(form, "phone") || undefined } });
      if (saved) onMessage("Đã lưu khách quan tâm trong trình duyệt.");
      return saved;
    }}><label>Tên khách<Input name="name" required maxLength={80} defaultValue={original?.name}/></label><label>Doanh nghiệp (không bắt buộc)<Select name="companyId" defaultValue={original?.companyId ?? ""}><option value="">Chưa liên kết</option>{data.companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</Select></label><label>Email (không bắt buộc)<Input name="email" type="email" maxLength={254} defaultValue={original?.email}/></label><label>Điện thoại (không bắt buộc)<Input name="phone" type="tel" maxLength={30} defaultValue={original?.phone}/></label><label>Nhu cầu<Input name="interest" required maxLength={160} defaultValue={original?.interest}/></label><label>Tầng quan tâm<Select name="floor" defaultValue={original?.floor ?? 1}>{FLOORS.map(floor => <option key={floor} value={floor}>Tầng {floor}</option>)}</Select></label><label>Nguồn tiếp nhận<Input name="source" required maxLength={80} defaultValue={original?.source}/></label><label>Trạng thái<Select name="status" defaultValue={original?.status ?? "Mới"}>{LEAD_STATUSES.map(status => <option key={status}>{status}</option>)}</Select></label><label>Ghi chú<Textarea name="note" rows={4} maxLength={600} defaultValue={original?.note}/></label></AdminEditor>}
  </div>;
}

export function MediaWorkspace({ data, onMessage, initialMediaId, initialScope }: Props & { initialMediaId?: string; initialScope?: string }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [source, setSource] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialMediaId ?? null);
  const [editor, setEditor] = useState<"upload" | "rename" | "link" | null>(null);
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState<MediaItem | null>(null);
  const dialogHost = useRef<HTMLDivElement>(null);
  const deletingRef = useRef(false);
  const details = useRecordDetail("media");
  const state = storageState(data.storage);
  const [capacity, setCapacity] = useState<{ quota?: number; usage?: number } | null>(null);
  useEffect(() => { let alive = true; if (navigator.storage?.estimate) void navigator.storage.estimate().then(value => { if (alive) setCapacity(value); }).catch(() => { if (alive) setCapacity(null); }); return () => { alive = false; }; }, [data.storage?.usedBytes]);
  useEffect(() => { if (initialMediaId) { setSelectedId(initialMediaId); details.openDetail(); } }, [initialMediaId]);
  const scopes = [{ value: "Toàn dự án", label: "Toàn dự án" }, ...FLOORS.map(floor => ({ value: `Tầng ${floor}`, label: `Tầng ${floor}` })), ...data.slots.map(slot => ({ value: `slot:${slot.id}`, label: `Tầng ${slot.floor} · ${slot.code}` })), ...data.groups.map(group => ({ value: `group:${group.id}`, label: `Tầng ${group.floor} · Nhóm ${group.name}` }))];
  const rows = data.media.filter(item => (!kind || item.kind === kind) && (!scopeFilter || item.scope === scopeFilter) && (!source || (source === "project" ? item.projectAsset : item.hasUploadedFile)) && `${item.name} ${item.sourcePath ?? ""}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const pages = useAdminPagination(rows, `${query}|${kind}|${scopeFilter}|${source}`);
  const media = rows.find(item => item.id === selectedId) ?? rows[0];
  const linkedLeases = media ? data.leases.filter(lease => lease.documentMediaId === media.id) : [];
  const selectedLogo = media?.id === data.settings?.website.logoMediaId;
  const protectedMedia = !!media?.projectAsset || !!media?.reference || selectedLogo || linkedLeases.length > 0;
  const isPdf = media?.mimeType === "application/pdf";
  return <div ref={details.scopeRef} className={styles.workspace}>
    <p className="panel-note">{data.media.filter(item => item.projectAsset).length} asset có sẵn của dự án · {data.media.filter(item => item.hasUploadedFile).length} tệp đã tải lên. Ảnh, PDF và video mở trực tiếp; không nhân bản asset vào IndexedDB.</p>
    <div className={styles.toolbar}><p>PNG, JPG, WebP hoặc PDF · tối đa 10 MiB/tệp. Tải lên chỉ lưu tệp, không ký hoặc xác thực tài liệu.</p><Button disabled={data.pending || state.blocked} onClick={() => { setEditingMedia(null); setEditor("upload"); }}>Tải tệp lên</Button></div>
    <WorkspaceLayout className={`records-layout ${styles.layout}`} mobilePresentation="drilldown" detailOpen={details.open} onDetailOpenChange={details.setOpen} returnFocusRef={details.returnFocusRef} detailLabel="Chi tiết tệp" backLabel="Quay lại thư viện media" primary={<AdminPanel className="records-panel">
      <div className="register-heading"><h2>Thư viện tệp <small>({rows.length})</small></h2><div className={styles.filters}>
        <label><span className="sr-only">Tìm tên hoặc đường dẫn tệp</span><Input type="search" placeholder="Tìm tên, đường dẫn…" value={query} onChange={event => setQuery(event.target.value)}/></label>
        <label><span className="sr-only">Lọc loại tệp</span><Select value={kind} onChange={event => setKind(event.target.value)}><option value="">Tất cả loại tệp</option>{["Ảnh", "Tài liệu", "Video", "Model 3D", "Tài nguyên"].map(value => <option key={value}>{value}</option>)}</Select></label>
        <label><span className="sr-only">Lọc nguồn tệp</span><Select value={source} onChange={event => setSource(event.target.value)}><option value="">Tất cả nguồn</option><option value="project">Asset dự án</option><option value="upload">Đã tải lên</option></Select></label>
        <label><span className="sr-only">Lọc liên kết tệp</span><Select value={scopeFilter} onChange={event => setScopeFilter(event.target.value)}><option value="">Tất cả liên kết</option>{scopes.map(scope => <option key={scope.value} value={scope.value}>{scope.label}</option>)}</Select></label>
      </div></div>
      <PaginatedContent layoutKey={pages.pageSize}><div className={styles.mediaGrid}>{pages.rows.map(item => <Button key={item.id} variant="quiet" className={styles.tile} aria-pressed={media?.id === item.id} onClick={event => { setSelectedId(item.id); details.openDetail("media", event.currentTarget); }}>
        <span className={styles.thumbnail}>{item.kind === "Ảnh" && item.url ? <img src={item.url} alt="" loading="lazy" decoding="async"/> : <span>{item.kind === "Video" ? "VIDEO" : item.kind === "Model 3D" ? "GLB" : item.mimeType === "application/pdf" ? "PDF" : "HDR"}</span>}</span>
        <strong>{item.name}</strong><span>{item.kind} · {item.size}</span><small>{item.projectAsset ? "Asset dự án" : "Đã tải lên"}</small>
      </Button>)}</div>{!rows.length && <EmptyState title="Không có tệp phù hợp" action={<Button variant="quiet" onClick={() => { setQuery(""); setKind(""); setScopeFilter(""); setSource(""); }}>Xóa bộ lọc</Button>}>Thử tên, loại hoặc nguồn tệp khác.</EmptyState>}</PaginatedContent><AdminPagination state={pages} label="tệp"/>
    </AdminPanel>} detail={<AdminPanel className={`records-panel ${styles.detail}`}>{media ? <>
      <div className={styles.heading}><h2>{media.name}</h2><Badge>{media.projectAsset ? "Asset dự án" : "Đã tải lên"}</Badge></div>
      <div className={styles.preview}>{media.url && media.kind === "Ảnh" ? <FilePreview source={media.url} fileName={media.name} mediaType={media.mimeType}/> : media.url && media.kind === "Video" ? <Video key={media.id} src={media.url} title={media.name} controls preload="metadata" fit="contain"/> : media.url && isPdf ? <iframe key={media.id} src={media.url} title={media.name}/> : <p>{media.kind === "Model 3D" ? "Asset GLB của cảnh 3D. Mở công trình để xem trong ngữ cảnh hoặc tải tệp gốc." : "HDR dùng làm ánh sáng môi trường; trình duyệt không có preview native. Có thể tải tệp gốc."}</p>}</div>
      {media.kind === "Model 3D" && <Link href="/kham-pha/" target="_blank" rel="noopener noreferrer" prefetch={false}>Xem công trình 3D</Link>}
      {media.url && <div className={styles.actions}><a href={media.url} target="_blank" rel="noopener noreferrer">Mở tệp gốc</a><a href={media.url} download={media.name}>Tải tệp xuống</a></div>}
      <dl className={styles.facts}><dt>Loại</dt><dd>{media.kind}</dd><dt>Dung lượng</dt><dd>{media.size}</dd><dt>Nguồn / đường dẫn</dt><dd className={styles.note}>{media.sourcePath || "File upload trên trình duyệt này"}</dd><dt>Liên kết</dt><dd>{scopes.find(item => item.value === media.scope)?.label ?? media.scope}</dd><dt>Hồ sơ thuê sử dụng</dt><dd>{linkedLeases.map(lease => lease.id).join(", ") || "Không có"}</dd></dl>
      {protectedMedia && <Alert tone="info">{media.projectAsset ? "Tệp nguồn của dự án: chỉ xem, không sửa/xóa từ bản dùng thử. Không tính vào dung lượng upload IndexedDB." : selectedLogo ? "Tệp đang là logo website. Chọn logo khác trước khi xóa." : "Tệp đang gắn với hồ sơ thuê. Không đổi liên kết hoặc xóa; thay tài liệu trong hồ sơ thuê trước."}</Alert>}
      {!media.projectAsset && <div className={styles.actions}><Button variant="secondary" disabled={data.pending} onClick={() => { setEditingMedia(media); setEditor("rename"); }}>Đổi tên</Button><Button variant="secondary" disabled={data.pending || protectedMedia} onClick={() => { setEditingMedia(media); setEditor("link"); }}>Đổi liên kết</Button><Button variant="secondary" disabled={data.pending || protectedMedia} onClick={() => setDeleting(media)}>Xóa tệp</Button></div>}
    </> : <EmptyState title="Chọn một tệp">Chọn ảnh, video hoặc tài liệu để xem.</EmptyState>}</AdminPanel>}/>
    {editor && <AdminEditor data={data} title={editor === "upload" ? "Tải tệp lên" : editor === "rename" ? "Đổi tên tệp" : "Đổi liên kết tệp"} description="Lưu trên trình duyệt này. Không tải lên đám mây hoặc công bố website." saveLabel={editor === "upload" ? "Lưu tệp" : "Lưu thay đổi"} onClose={() => { setEditor(null); setEditingMedia(null); }} onSave={async form => {
      let saved = false;
      if (editor === "upload") {
        const files = form.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
        if (!files.length) return false;
        saved = await data.uploadFiles(files, field(form, "scope"));
      } else if (editingMedia) saved = await data.execute(editor === "rename" ? { type: "rename-media", mediaId: editingMedia.id, name: field(form, "name") } : { type: "link-media", mediaId: editingMedia.id, scope: field(form, "scope") });
      if (saved) onMessage(editor === "upload" ? "Đã lưu tệp trong trình duyệt." : "Đã cập nhật tệp.");
      return saved;
    }}>{editor === "upload" && <label>Chọn tệp<Input name="files" type="file" multiple required accept="image/png,image/jpeg,image/webp,application/pdf"/></label>}{editor === "rename" ? <label>Tên tệp<Input name="name" required maxLength={160} defaultValue={editingMedia?.name}/></label> : <label>Liên kết với<Select name="scope" defaultValue={scopes.some(scope => scope.value === (editingMedia?.scope ?? initialScope)) ? editingMedia?.scope ?? initialScope : "Toàn dự án"}>{scopes.map(scope => <option key={scope.value} value={scope.value}>{scope.label}</option>)}</Select></label>}</AdminEditor>}
    <div ref={dialogHost} className="admin-dialog-host"/><ConfirmDialog open={!!deleting} title="Xóa tệp đã lưu?" description={deleting ? `${deleting.name}. ${deleting.hasUploadedFile ? "Tệp gốc và liên kết sẽ bị xóa khỏi trình duyệt này." : "Chỉ xóa mục tham chiếu trong thư viện; không xóa asset tĩnh của website."} Thao tác không thể hoàn tác.` : ""} confirmLabel={data.pending ? "Đang xóa…" : "Xóa tệp"} cancelLabel="Giữ tệp" portalContainer={dialogHost} onClose={() => { if (!deletingRef.current) setDeleting(null); }} onConfirm={() => {
      if (!deleting || deletingRef.current || data.pending) return;
      deletingRef.current = true;
      void data.execute({ type: "delete-media", mediaId: deleting.id }).then(saved => { if (saved) { setDeleting(null); onMessage("Đã xóa tệp khỏi trình duyệt."); } else onMessage("Chưa xóa được tệp. Kiểm tra lỗi và thử lại.", "error"); }).finally(() => { deletingRef.current = false; });
    }}/>{deleting && data.error && <Alert tone="error">{data.error}</Alert>}
    <details><summary>Dung lượng file tải lên trên thiết bị</summary><StorageUsagePanel usage={data.storage} pending={data.pending}/><p className="panel-note">Browser quota ước tính: {capacity?.quota !== undefined ? formatStorageBytes(capacity.quota) : "Chưa xác định"}. Asset website và video R2 không tính vào byte upload local.</p></details>
  </div>;
}

export function AdminSettingsWorkspace({ data, onMessage }: Props) {
  const [editing, setEditing] = useState(false);
  const settings = data.settings;
  return <div className={styles.workspace}>
    <AdminPanel className={`records-panel ${styles.detail}`}>
      <div className={styles.heading}><h2>Cài đặt vận hành</h2><Button disabled={!settings || data.pending} onClick={() => setEditing(true)}>Sửa cài đặt</Button></div>
      <p>Cấu hình nội bộ của bản thử nghiệm, chỉ lưu trong trình duyệt. Không đổi nội dung website công khai, đăng nhập hoặc phân quyền.</p>
      {settings && <dl className={styles.facts}>
        <dt>Tên dự án</dt><dd>{settings.propertyName}</dd><dt>Email liên hệ</dt><dd>{settings.contactEmail}</dd>
        <dt>Điện thoại liên hệ</dt><dd>{settings.contactPhone}</dd><dt>Thời gian giữ chỗ mặc định</dt><dd>{settings.defaultHoldHours} giờ</dd>
        <dt>Thời lượng lịch hẹn mặc định</dt><dd>{settings.appointmentMinutes} phút</dd><dt>Địa điểm lịch hẹn mặc định</dt><dd>{settings.appointmentLocation}</dd>
      </dl>}
      {editing && settings && <AdminEditor data={data} title="Cài đặt vận hành" description="Giá trị mặc định áp dụng cho thao tác mới; không sửa giữ chỗ hoặc lịch hẹn đã tạo." onClose={() => setEditing(false)} onSave={async form => {
        if (!data.settings) return false;
        const saved = await data.execute({ type: "update-settings", values: { propertyName: field(form, "propertyName"), contactEmail: field(form, "contactEmail"), contactPhone: field(form, "contactPhone"), defaultHoldHours: Number(form.get("defaultHoldHours")), appointmentMinutes: Number(form.get("appointmentMinutes")), appointmentLocation: field(form, "appointmentLocation"), website: data.settings.website } });
        if (saved) onMessage("Đã lưu cài đặt vận hành trong trình duyệt.");
        return saved;
      }}>
        <label>Tên dự án<Input name="propertyName" required maxLength={120} defaultValue={settings.propertyName}/></label>
        <label>Email liên hệ (không bắt buộc)<Input name="contactEmail" type="email" maxLength={254} defaultValue={settings.contactEmail}/></label>
        <label>Điện thoại liên hệ (không bắt buộc)<Input name="contactPhone" type="tel" maxLength={32} defaultValue={settings.contactPhone}/></label>
        <label>Giữ chỗ mặc định (giờ)<Input name="defaultHoldHours" type="number" min={1} max={720} step={1} required defaultValue={settings.defaultHoldHours}/></label>
        <label>Lịch hẹn mặc định (phút)<Input name="appointmentMinutes" type="number" min={15} max={240} step={1} required defaultValue={settings.appointmentMinutes}/></label>
        <label>Địa điểm lịch hẹn<Input name="appointmentLocation" required maxLength={160} defaultValue={settings.appointmentLocation}/></label>
      </AdminEditor>}
    </AdminPanel>
    <WebsiteSettingsPanel data={data} onMessage={onMessage}/>
  </div>;
}
