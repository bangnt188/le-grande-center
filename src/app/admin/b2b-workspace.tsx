"use client";

import { useEffect, useRef, useState } from "react";
import { AdminPanel, PaginatedContent, WorkspaceLayout, Tabs, Button, Input, Select, Textarea, Table, Badge as SystemBadge, EmptyState, ConfirmDialog, Modal } from "@mall/ui";
import { AdminPagination, useAdminPagination } from "@/features/admin/admin-pagination";
import type { ToastTone } from "@mall/ui";
import { BusinessRecordEditor, isStoredPdf, type BusinessEditor } from "./b2b-editors";
import type { B2BCommand } from "@/shared/admin/b2b-model";
import { appointmentLabels, dateLabel, remainingLabel, requestLabels, slotCodes as formatSlotCodes, timeLabel } from "@/features/admin/record-labels";
import type { AdminData } from "@/features/admin/use-admin-data";
import type { SlotRecordEntry } from "@/features/admin/slot-detail";
import type { Floor } from "../../shared/admin/space-model";
import { BROCHURE_FLOORS, BROCHURE_UNITS } from "@/features/public/brochure-leasing";

import { useRecordDetail } from "@/features/admin/use-record-detail";
import type { CompanyNotes } from "@/features/admin/use-company-notes";
import { companyCategory } from "@/features/admin/tenant-records";
import { CollectionFeedback, CompanyPicker, useAdminCollection, useAdminRecord, useRelatedCompanies } from "@/features/admin/admin-collections";


export type B2BView = "customers" | "requests" | "leases" | "appointments";
type Props = {
  notes: CompanyNotes;
  view: B2BView; data: AdminData; entry?: SlotRecordEntry; onView: (view: B2BView, entry?: SlotRecordEntry) => void;
  onFloor: (floor: Floor, ids: string[]) => void; onMessage: (message: string, tone?: ToastTone) => void;
};
const area = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} m²`;
function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "available" | "leased" }) { return <SystemBadge tone={tone === "available" ? "success" : "neutral"}>{children}</SystemBadge>; }
function Period({ start, end }: { start: string; end: string }) { return <>{dateLabel(start)} – {dateLabel(end)}</>; }
function Empty({ children }: { children: React.ReactNode }) { return <EmptyState title="Chưa có bản ghi phù hợp">{children}</EmptyState>; }

export default function B2BWorkspace({ view, data, entry, notes, onView, onFloor, onMessage }: Props) {
  const slotCodes = (ids: string[]) => formatSlotCodes(ids, data.slots);
  function MiniPlan({ ids, floor }: { ids: string[]; floor: Floor }) {
    const codes = data.slots.filter(item => ids.includes(item.id)).map(item => item.code);
    return <svg className="b2b-mini-plan" viewBox="0 0 1000 250" role="img" aria-label={`Vị trí ${slotCodes(ids)} trên tầng ${floor}, theo brochure`}>{BROCHURE_FLOORS.find(item => item.id === floor)?.sharedAreas.map((shape, index) => <rect key={index} x={shape.x} y={shape.y} width={shape.width} height={shape.height} className="mini-core"/>)}{BROCHURE_UNITS.filter(item => item.floorId === floor).map(unit => <rect key={unit.id} x={unit.plan.x} y={unit.plan.y} width={unit.plan.width} height={unit.plan.height} className={codes.includes(unit.id) ? "mini-selected" : "mini-slot"}/>)}</svg>;
  }
  const details = useRecordDetail(view, view === "leases" ? 1200 : 1000);
  const dialogContainer = useRef<HTMLDivElement>(null);
  const documentDialogContainer = useRef<HTMLDivElement>(null);
  const [cancelAppointmentId, setCancelAppointmentId] = useState<string | null>(null);
  const cancellation = useAdminRecord(data, "appointments", cancelAppointmentId, view === "appointments");
  const cancellingAppointment = cancellation.item;
  const cancellationInFlight = useRef(false);
  const [companyId, setCompanyId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [leaseId, setLeaseId] = useState("");
  const [editor, setEditor] = useState<BusinessEditor | null>(null);
  const leaseSelectionInitialized = useRef(false);
  useEffect(() => {
    if (!companyId && data.companies.length && !entry) setCompanyId(data.companies[0].id);
    if (!requestId && data.requests.length) setRequestId(data.requests[0].id);
    if (!leaseSelectionInitialized.current && data.leases.length) { leaseSelectionInitialized.current = true; if (!leaseId) setLeaseId(data.leases[0].id); }
  }, [companyId, requestId, leaseId, data.companies, data.requests, data.leases]);
  const [leaseQuery, setLeaseQuery] = useState("");
  const [leaseCompany, setLeaseCompany] = useState("");
  const [query, setQuery] = useState("");
  const [appointmentQuery, setAppointmentQuery] = useState("");
  const [appointmentStatus, setAppointmentStatus] = useState("");
  const companyPages = useAdminCollection(data, "companies", { query }, view === "customers");
  const appointmentPages = useAdminCollection(data, "appointments", { query: appointmentQuery, status: appointmentStatus }, view === "appointments");
  const companyDetail = useAdminRecord(data, "companies", companyId, view === "customers");
  const [requestFilter, setRequestFilter] = useState("");
  const [companyTab, setCompanyTab] = useState<"overview" | "requests" | "contracts" | "documents">("overview");
  const [documentOpen, setDocumentOpen] = useState(false);
  const consumedEntry = useRef<SlotRecordEntry | undefined>(undefined);
  useEffect(() => {
    if (!entry || entry.view !== view || consumedEntry.current === entry) return;
    consumedEntry.current = entry;
    if (entry.view === "customers") { setCompanyId(entry.id); setCompanyTab("overview"); setQuery(""); }
    if (entry.view === "requests") { setRequestId(entry.id); setRequestFilter(""); }
    if (entry.view === "leases") { setLeaseId(entry.id); setLeaseQuery(""); setLeaseCompany(""); }
    setDocumentOpen(false);
    details.openDetail(entry.view);
  }, [entry, view]);
  const company = companyDetail.item;
  const request = data.requests.find((item) => item.id === requestId);
  const reservation = data.reservations.find((item) => item.requestId === requestId);
  const lease = data.leases.find((item) => item.id === leaseId);
  const leaseDocument = lease ? data.media.find(item => item.id === lease.documentMediaId && isStoredPdf(item)) : undefined;
  const companyRequests = data.requests.filter((item) => item.companyId === companyId);
  const relatedCompanies = useRelatedCompanies(data, view === "requests" ? data.requests.map(item => item.companyId) : view === "leases" ? data.leases.map(item => item.companyId) : view === "appointments" ? [...appointmentPages.rows.map(item => item.companyId), cancellation.item?.companyId] : [], view !== "customers");
  function companyNameForSearch(id: string) { return relatedCompanies.items.find(item => item.id === id)?.name ?? ""; }
  const visibleLeases = data.leases.filter((item) => (!leaseCompany || item.companyId === leaseCompany) && `${item.id} ${companyNameForSearch(item.companyId)} ${slotCodes(item.slotIds)}`.toLowerCase().includes(leaseQuery.toLowerCase()));
  const requestPages = useAdminPagination(data.requests.filter(item => !requestFilter || item.status === requestFilter), requestFilter, 2);
  const leasePages = useAdminPagination(visibleLeases, `${leaseQuery}:${leaseCompany}`, 2);
  const companyLeases = data.leases.filter((item) => item.companyId === companyId);
  const companyName = (id: string) => relatedCompanies.items.find(item => item.id === id)?.name ?? (company?.id === id ? company.name : relatedCompanies.loading ? "Đang tải doanh nghiệp…" : `Thiếu hồ sơ doanh nghiệp (${id})`);
  async function run(command: B2BCommand, message: string) { if (await data.execute(command)) onMessage(message); }
  function goRequest(id: string) { notes.navigate(() => { onView("requests", { view: "requests", id }); }); }
  function goLease(id: string) { notes.navigate(() => { onView("leases", { view: "leases", id }); }); }
  function selectLease(id: string) {
    setLeaseId(id); setDocumentOpen(false); onView("leases", { view: "leases", id }); details.openDetail();
  }
  async function confirmCancellation() {
    if (!cancellingAppointment || cancellationInFlight.current) return;
    cancellationInFlight.current = true;
    try {
      if (await data.execute({ type: "cancel-appointment", appointmentId: cancellingAppointment.id })) {
        setCancelAppointmentId(null);
        onMessage("Đã hủy lịch hẹn. Cam kết trên mặt bằng không thay đổi.");
      }
    } finally { cancellationInFlight.current = false; }
  }
  function filterLeases(nextQuery: string, nextCompany: string) {
    setLeaseQuery(nextQuery); setLeaseCompany(nextCompany); setDocumentOpen(false);
    const matches = data.leases.filter((item) => (!nextCompany || item.companyId === nextCompany) && `${item.id} ${companyNameForSearch(item.companyId)} ${slotCodes(item.slotIds)}`.toLowerCase().includes(nextQuery.toLowerCase()));
    setLeaseId(matches.some((item) => item.id === leaseId) ? leaseId : matches[0]?.id ?? "");
  }

  return <div ref={details.scopeRef} className="b2b-workspace">
    <div ref={dialogContainer} className="admin-dialog-host"/>
    <div ref={documentDialogContainer} className="admin-dialog-host b2b-document-modal-host"/>
    {view === "customers" && <><CollectionFeedback state={companyPages}/><CollectionFeedback state={companyDetail}/></>}
    {view === "appointments" && <><CollectionFeedback state={appointmentPages}/><CollectionFeedback state={cancellation}/></>}
    {view !== "customers" && <CollectionFeedback state={relatedCompanies}/>}
    <ConfirmDialog open={!!cancellingAppointment} title="Hủy lịch hẹn?" description={cancellingAppointment ? `${companyName(cancellingAppointment.companyId)} · ${timeLabel(cancellingAppointment.startsAt)}, ${dateLabel(cancellingAppointment.startsAt)} · ${cancellingAppointment.purpose}. Lịch hẹn sẽ chuyển sang đã hủy; giữ chỗ và hợp đồng không thay đổi.` : ""} confirmLabel={data.pending ? "Đang hủy…" : "Xác nhận hủy lịch"} cancelLabel="Giữ lịch hẹn" onClose={() => { if (!cancellationInFlight.current) setCancelAppointmentId(null); }} onConfirm={() => void confirmCancellation()} portalContainer={dialogContainer}/>
    <Modal open={documentOpen && !!lease} onOpenChange={setDocumentOpen} title="Xem tài liệu hợp đồng" description={lease ? `${lease.id} · ${companyName(lease.companyId)} · Chỉ lưu tệp, không xác nhận chữ ký.` : ""} closeLabel="Đóng tài liệu" portalContainer={documentDialogContainer}>{leaseDocument?.url ? <><p><a href={leaseDocument.url} target="_blank" rel="noopener noreferrer">Mở PDF trong tab mới</a> · <a href={leaseDocument.url} download={leaseDocument.name}>Tải PDF</a></p><iframe className="b2b-document-pdf" src={leaseDocument.url} title={leaseDocument.name}/></> : <><p role="status">Thiếu tệp PDF. Hồ sơ này mới có tên tài liệu, chưa có tệp hợp đồng thật.</p>{lease && <Button onClick={() => { setDocumentOpen(false); setEditor({ kind: "document", lease }); }}>Tải lên / gắn PDF</Button>}</>}</Modal>
    {view === "customers" && <WorkspaceLayout className="b2b-dossier-layout" mobilePresentation="drilldown" detailOpen={details.open} onDetailOpenChange={details.setOpen} returnFocusRef={details.returnFocusRef} detailLabel="Hồ sơ doanh nghiệp" backLabel="Quay lại danh sách doanh nghiệp" primary={
      <section className="b2b-company-list records-panel" aria-label="Danh sách doanh nghiệp">
        <div className="b2b-panel-heading"><h2>Doanh nghiệp <span>{companyPages.total}</span></h2><Button variant="secondary" disabled={data.loading || data.pending} onClick={() => notes.navigate(() => setEditor({ kind: "company" }))}>Thêm doanh nghiệp</Button><label className="b2b-search"><span className="sr-only">Tìm doanh nghiệp</span><Input type="search" maxLength={200} placeholder="Tìm tên, ngành hàng…" value={query} onChange={(event) => setQuery(event.target.value)}/></label></div>
        <PaginatedContent layoutKey={companyPages.pageSize}>{companyPages.rows.map((item) => { const category = companyCategory(data, item.id); return <Button variant="quiet" className={`b2b-company-row ${companyId === item.id ? "is-active" : ""}`} key={item.id} onClick={event => { const trigger = event.currentTarget; notes.navigate(() => { setCompanyId(item.id); setCompanyTab("overview"); setDocumentOpen(false); onView("customers", { view: "customers", id: item.id }); details.openDetail(view, trigger); }); }} aria-pressed={companyId === item.id}><span className="lead-avatar">{item.initials}</span><span><strong>{item.name}</strong><small>{item.industry}</small><SystemBadge className={category === "Đang thuê" ? "company-category slot-state-badge" : "company-category"} data-slot-status={category === "Đang thuê" ? "Đang thuê" : undefined} tone={category === "Đang thuê" ? "action" : category === "Đang giữ chỗ" ? "warning" : "neutral"}>{category}</SystemBadge><span className="b2b-row-meta">{data.requests.filter((entry) => entry.companyId === item.id).length} yêu cầu · {data.leases.filter((entry) => entry.companyId === item.id).length} hợp đồng</span></span></Button>; })}
        {!companyPages.loading && !companyPages.error && !companyPages.rows.length && <Empty>Không tìm thấy doanh nghiệp. <Button variant="quiet" className="text-button" onClick={() => setQuery("")}>Xóa tìm kiếm</Button></Empty>}
        </PaginatedContent><AdminPagination state={companyPages} label="doanh nghiệp"/><p className="panel-note">Hồ sơ nội bộ được lưu trên hệ thống và bảo vệ bằng quyền truy cập.</p>
      </section>} detail={<AdminPanel className="b2b-dossier records-panel">{company ? <>
        <div className="b2b-dossier-header"><span className="b2b-company-mark">{company.initials}</span><div><h2>{company.name}</h2><p>{company.brand} · {company.industry}</p></div><Button variant="secondary" onClick={() => notes.navigate(() => setEditor({ kind: "company", record: company }))}>Sửa doanh nghiệp</Button><span className="b2b-private-label">Hồ sơ nội bộ</span></div>
        <p className="tabs-scroll-hint">Vuốt ngang để xem đủ 4 mục: Tổng quan, Yêu cầu & giữ chỗ, Hợp đồng, Tài liệu.</p>
        <Tabs label="Các phần hồ sơ doanh nghiệp" className="b2b-dossier-tabs" scrollable keepMounted value={companyTab} onValueChange={value => { if (value) setCompanyTab(value as typeof companyTab); setDocumentOpen(false); }} items={[{ value: "overview", label: "Tổng quan", content: <div className="b2b-dossier-body">
            <div className="b2b-profile-columns"><section><h3>Thông tin liên hệ</h3><dl className="b2b-facts"><dt>Người liên hệ</dt><dd>{company.contact}</dd><dt>Email</dt><dd>{company.email}</dd><dt>Điện thoại</dt><dd>{company.phone}</dd><dt>Mã số thuế</dt><dd>{company.taxId || "Chưa bổ sung"}</dd><dt>Địa chỉ</dt><dd>{company.address || "Chưa bổ sung"}</dd></dl></section><section><h3>Quan hệ với trung tâm</h3><dl className="b2b-facts"><dt>Phụ trách</dt><dd>{company.owner}</dd><dt>Nhu cầu</dt><dd>{company.industry}</dd><dt>Hợp đồng</dt><dd>{companyLeases.length ? `${companyLeases.length} hợp đồng` : "Chưa có hợp đồng"}</dd><dt>Giữ chỗ</dt><dd>{data.reservations.filter((item) => item.companyId === companyId && item.status === "active").length} đang hoạt động</dd></dl></section></div>
            <section className="b2b-linked-spaces"><div className="b2b-section-heading"><h3>Mặt bằng đang quan tâm</h3><Button variant="quiet" className="text-button" onClick={() => setCompanyTab("requests")}>Xem yêu cầu thuê</Button></div>{companyRequests.map((item) => <div className="b2b-linked-space" key={item.id}><MiniPlan ids={item.slotIds} floor={item.floor}/><div><strong>Tầng {item.floor} · {slotCodes(item.slotIds)}</strong><small>{area(item.area)} · Hướng chưa xác nhận</small></div><Button variant="quiet" className="text-button" onClick={() => onFloor(item.floor, item.slotIds)}>Xem sơ đồ</Button></div>)}{!companyRequests.length && <Empty>Chưa có yêu cầu thuê. Hồ sơ vẫn có thể được dùng để book lịch tư vấn.</Empty>}</section>
            <form className="b2b-note-form" key={company.id} onSubmit={(event) => { event.preventDefault(); void notes.save(company).then(saved => { if (saved) onMessage("Đã lưu ghi chú doanh nghiệp trên hệ thống."); }); }}><label>Ghi chú nội bộ<Textarea name="note" rows={3} maxLength={600} value={notes.value(company)} onChange={event => notes.update(company, event.target.value)}/></label><p className="draft-status" aria-live="polite">{notes.dirty(company) ? "Chưa lưu · Bản nháp được giữ khi đổi doanh nghiệp hoặc màn hình trong phiên này." : "Ghi chú đã lưu trên hệ thống."}</p><Button variant="secondary" type="submit" className="button secondary" disabled={data.pending} loading={data.pending} loadingLabel="Đang lưu…">Lưu ghi chú</Button></form>
          </div> },{ value: "requests", label: "Yêu cầu & giữ chỗ", content: <div className="b2b-dossier-body">{companyRequests.map((item) => { const hold = data.reservations.find((entry) => entry.requestId === item.id); return <div className="b2b-activity-row" key={item.id}><div><strong>{item.id} · {slotCodes(item.slotIds)}</strong><small>Tầng {item.floor} · {area(item.area)} · <Period start={item.start} end={item.end}/></small>{hold?.status === "active" && <span className="b2b-deadline">{remainingLabel(hold.expiresAt)} giữ chỗ · đến {timeLabel(hold.expiresAt)}, {dateLabel(hold.expiresAt)}</span>}</div><Badge tone={item.status === "approved" ? "available" : "neutral"}>{requestLabels[item.status]}</Badge><Button variant="quiet" className="text-button" onClick={() => goRequest(item.id)}>Chi tiết</Button></div>; })}{!companyRequests.length && <Empty>Chưa có yêu cầu thuê.</Empty>}<p className="panel-note">Thời hạn chỉ dành cho nội bộ và doanh nghiệp có quyền xem. </p></div> },{ value: "contracts", label: "Hợp đồng", content: <div className="b2b-dossier-body">{companyLeases.map((item) => <div className="b2b-activity-row" key={item.id}><div><strong>{item.id}</strong><small>Tầng {item.floor} · {slotCodes(item.slotIds)} · {area(item.area)}</small><small><Period start={item.start} end={item.end}/></small></div><Badge tone="available">Hồ sơ đã lưu</Badge><Button variant="quiet" className="text-button" onClick={() => goLease(item.id)}>Mở hợp đồng</Button></div>)}{!companyLeases.length && <Empty>Chưa có hợp đồng. Yêu cầu được duyệt tạo giữ chỗ; chỉ chuyển thuê khi lưu tệp hợp đồng.</Empty>}</div> },{ value: "documents", label: "Tài liệu", content: <div className="b2b-dossier-body">{companyLeases.map((item) => <div className="b2b-activity-row" key={item.id}><div><strong>{item.documentName}</strong><small>{data.media.some(media => media.id === item.documentMediaId && isStoredPdf(media)) ? "PDF đã lưu trên hệ thống" : "Chưa có PDF được duyệt"}</small></div><Button variant="quiet" className="text-button" onClick={() => { setLeaseId(item.id); setDocumentOpen(true); }}>Xem / gắn PDF</Button></div>)}{!companyLeases.length && <Empty>Chưa có tài liệu hợp đồng.</Empty>}</div> }]}/>
      </> : <Empty>Chọn một doanh nghiệp để xem hồ sơ.</Empty>}</AdminPanel>}/>}

    {view === "requests" && <>
      <ol className="b2b-process" aria-label="Quy trình thuê"><li><span>1</span>Gửi yêu cầu<small>Chưa giữ slot</small></li><li><span>2</span>Xét duyệt<small>Kiểm tra toàn bộ tổ hợp</small></li><li><span>3</span>Giữ chỗ<small>Có thời hạn xác nhận</small></li><li><span>4</span>Hợp đồng<small>Chốt mặt bằng & điều khoản</small></li></ol>
      <WorkspaceLayout className="b2b-request-layout" mobilePresentation="drilldown" detailOpen={details.open} onDetailOpenChange={details.setOpen} returnFocusRef={details.returnFocusRef} detailLabel="Chi tiết yêu cầu thuê" backLabel="Quay lại danh sách yêu cầu" primary={<AdminPanel className="records-panel"><div className="b2b-panel-heading b2b-inline-heading"><h2>Yêu cầu thuê <span>{data.requests.length}</span></h2><Button variant="secondary" disabled={data.loading || data.pending || !data.collections?.companies.totalItems} onClick={() => setEditor({ kind: "request" })}>Thêm yêu cầu thuê</Button><label><span className="sr-only">Lọc yêu cầu thuê</span><Select value={requestFilter} onChange={(event) => setRequestFilter(event.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(requestLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</Select></label></div>
        <PaginatedContent layoutKey={requestPages.pageSize}>{requestPages.rows.map((item) => <Button variant="quiet" className={`b2b-request-row ${item.id === requestId ? "is-active" : ""}`} key={item.id} aria-pressed={item.id === requestId} onClick={() => { setRequestId(item.id); details.openDetail(); }}><span className="b2b-request-company">{companyName(item.companyId)}<Badge tone={item.status === "approved" ? "available" : "neutral"}>{requestLabels[item.status]}</Badge></span><strong>Tầng {item.floor} · {slotCodes(item.slotIds)}</strong><span>{area(item.area)} · <Period start={item.start} end={item.end}/></span><small>{item.id} · Gửi {dateLabel(item.received)}</small></Button>)}
        {!data.requests.some((item) => !requestFilter || item.status === requestFilter) && <Empty>Không có yêu cầu ở trạng thái này. <Button variant="quiet" className="text-button" onClick={() => setRequestFilter("")}>Xem tất cả</Button></Empty>}
        </PaginatedContent><AdminPagination state={requestPages} label="yêu cầu thuê"/>
      </AdminPanel>} detail={<aside className="b2b-request-detail records-panel">{request ? <>
        <div className="b2b-section-heading"><h2>{companyName(request.companyId)}</h2><Badge>{requestLabels[request.status]}</Badge></div><p className="muted">{request.id} · Yêu cầu thuê</p>{["submitted", "reviewing"].includes(request.status) && <Button variant="secondary" onClick={() => setEditor({ kind: "request", record: request })}>Sửa yêu cầu</Button>}<MiniPlan ids={request.slotIds} floor={request.floor}/><h3>Tầng {request.floor} · {slotCodes(request.slotIds)}</h3><dl className="b2b-facts"><dt>Diện tích tham khảo</dt><dd>{area(request.area)}</dd><dt>Kỳ thuê mong muốn</dt><dd><Period start={request.start} end={request.end}/></dd><dt>Hướng</dt><dd>Chưa xác nhận trên bản vẽ</dd><dt>Điều kiện nối</dt><dd>{request.slotIds.length > 1 ? "Liền kề cùng tầng · cần xác nhận kỹ thuật" : "Một slot gốc"}</dd></dl><p className="b2b-customer-note">{request.note || "Khách chưa bổ sung ghi chú."}</p><Button variant="quiet" className="text-button" onClick={() => onFloor(request.floor,request.slotIds)}>Xem mặt bằng trên sơ đồ</Button>
        {["submitted","reviewing"].includes(request.status) && <div className="b2b-decision">
          {request.status === "submitted" && <Button variant="secondary" className="button secondary full" disabled={data.pending} onClick={() => void run({ type: "review-request", requestId: request.id }, "Đã tiếp nhận xét duyệt. Yêu cầu chưa giữ slot.")}>Tiếp nhận xét duyệt</Button>}
          <Button variant="primary" className="button primary full" disabled={data.pending} onClick={() => setEditor({ kind: "approve", request })}>Duyệt & giữ chỗ</Button>
          <Button variant="secondary" className="button secondary full" disabled={data.pending} onClick={() => setEditor({ kind: "reject", request })}>Từ chối yêu cầu</Button>
        </div>}
        {reservation?.status === "active" && <div className="b2b-hold-panel"><div className="b2b-section-heading"><h3>{Date.parse(reservation.expiresAt) <= Date.now() ? "Giữ chỗ đã hết hạn" : "Đang giữ chỗ"}</h3><strong>{remainingLabel(reservation.expiresAt)}</strong></div><p>Hết hạn {timeLabel(reservation.expiresAt)}, {dateLabel(reservation.expiresAt)} · {reservation.id}</p><small>Thời hạn không hiển thị trên trang giới thiệu.</small><Button variant="primary" className="button primary full" disabled={data.pending || Date.parse(reservation.expiresAt) <= Date.now()} onClick={() => setEditor({ kind: "document", reservation })}>Lưu hợp đồng & chuyển thuê</Button><p className="panel-note">Chọn hoặc tải lên PDF thật. Lưu tệp không có nghĩa là ký hay xác nhận nội dung hợp đồng.</p><Button variant="secondary" className="button secondary full" disabled={data.pending} onClick={() => setEditor({ kind: "cancel-hold", reservation })}>Hủy toàn bộ giữ chỗ</Button></div>}
        {reservation?.status === "converted" && <div className="b2b-hold-panel"><h3>Đã chuyển sang hợp đồng</h3><p>Cam kết trên slot được giữ liên tục khi chuyển thuê và lưu tệp.</p><Button variant="secondary" className="button secondary full" onClick={() => { const converted = data.leases.find((item) => item.reservationId === reservation.id); if (converted) goLease(converted.id); }}>Xem hợp đồng</Button></div>}
        {reservation?.status === "cancelled" && <p className="panel-note">Giữ chỗ đã hủy. Muốn giữ lại cần gửi yêu cầu mới để kiểm tra khả dụng.</p>}
      </> : <Empty>Chọn yêu cầu để xem phương án và quyết định.</Empty>}</aside>}/>
    </>}

    {view === "leases" && <WorkspaceLayout className="b2b-lease-layout" mobilePresentation="drilldown" detailOpen={details.open} onDetailOpenChange={details.setOpen} returnFocusRef={details.returnFocusRef} detailLabel="Chi tiết hợp đồng" backLabel="Quay lại danh sách hợp đồng" primary={<AdminPanel className="records-panel"><div className="b2b-panel-heading"><h2>Danh mục hợp đồng <span>{data.leases.length}</span></h2><p className="muted">Theo dõi kỳ thuê và hồ sơ của từng doanh nghiệp.</p><div className="b2b-contract-filters"><label><span className="sr-only">Tìm hợp đồng</span><Input type="search" placeholder="Tìm mã, doanh nghiệp, slot…" value={leaseQuery} onChange={(event) => filterLeases(event.target.value, leaseCompany)}/></label><CompanyPicker data={data} label="Lọc doanh nghiệp" emptyLabel="Tất cả doanh nghiệp" value={leaseCompany} onValueChange={value => filterLeases(leaseQuery, value)}/></div></div><PaginatedContent layoutKey={leasePages.pageSize}><p className="table-scroll-hint">Vuốt ngang để xem đầy đủ thông tin và thao tác.</p><Table viewportLabel="Danh sách hợp đồng, có thể cuộn ngang" rows={leasePages.rows} getRowKey={item => item.id} getRowClassName={item => item.id === leaseId ? "selected-row" : undefined} onRowClick={item => selectLease(item.id)} emptyLabel="Không tìm thấy hợp đồng phù hợp." columns={[
      { id: "company", header: "Hợp đồng / doanh nghiệp", cell: item => <><strong>{item.id}</strong><small>{companyName(item.companyId)}</small></> },
      { id: "space", header: "Mặt bằng", cell: item => <>Tầng {item.floor}<small>{slotCodes(item.slotIds)} · {area(item.area)}</small></> },
      { id: "end", header: "Ngày kết thúc", cell: item => <>{dateLabel(item.end)}<small>Thời hạn nội bộ</small></> },
      { id: "action", header: "Thao tác", cell: item => <Button variant="quiet" className="text-button" aria-label={`Xem hợp đồng ${item.id}`} aria-pressed={item.id === leaseId} onClick={event => { event.stopPropagation(); selectLease(item.id); }}>Chi tiết</Button> },
    ]}/>
{!visibleLeases.length && <Empty>Không tìm thấy hợp đồng. <Button variant="quiet" className="text-button" onClick={() => filterLeases("", "")}>Xóa bộ lọc</Button></Empty>}</PaginatedContent><AdminPagination state={leasePages} label="hợp đồng"/><p className="panel-note">Hết kỳ thuê chưa đồng nghĩa sẵn sàng cho khách mới. Cần xác nhận gia hạn, bàn giao và điều kiện vận hành.</p></AdminPanel>} detail={<aside aria-label="Chi tiết hợp đồng đã chọn" className="b2b-lease-detail records-panel">{lease ? <><div className="b2b-section-heading"><h2>{lease.id}</h2><Badge tone="available">Hồ sơ đã lưu</Badge></div><h3>{companyName(lease.companyId)}</h3><MiniPlan ids={lease.slotIds} floor={lease.floor}/><dl className="b2b-facts"><dt>Mặt bằng</dt><dd>Tầng {lease.floor} · {slotCodes(lease.slotIds)}</dd><dt>Diện tích tham khảo</dt><dd>{area(lease.area)}</dd><dt>Kỳ thuê</dt><dd><Period start={lease.start} end={lease.end}/></dd><dt>Điều khoản thuê</dt><dd>{lease.rentNote}</dd><dt>Tệp hợp đồng</dt><dd>{leaseDocument ? "PDF đã lưu" : "Thiếu tệp PDF"}</dd><dt>Thông báo gia hạn</dt><dd>Chưa nhập điều khoản chính thức</dd></dl><Button variant="secondary" className="button secondary full" onClick={() => onFloor(lease.floor, lease.slotIds)}>Xem các slot liên kết</Button><div className="b2b-file-row"><div><strong>{lease.documentName}</strong><small>{leaseDocument ? "PDF được lưu riêng tư trên hệ thống" : "Chưa có tệp PDF được duyệt"}</small></div><Button variant="secondary" onClick={() => setEditor({ kind: "document", lease })}>{leaseDocument ? "Thay PDF" : "Tải lên / gắn PDF"}</Button>{leaseDocument && !documentOpen && <Button variant="quiet" className="text-button" onClick={() => setDocumentOpen(true)}>Xem tài liệu</Button>}</div></> : <Empty>Chọn hợp đồng để xem chi tiết.</Empty>}</aside>}/>}

    {view === "appointments" && <div className="b2b-appointments-layout"><AdminPanel className="records-panel"><div className="b2b-panel-heading"><h2>Lịch tư vấn & khảo sát</h2><Button variant="secondary" disabled={data.loading || data.pending || !data.collections?.companies.totalItems} onClick={() => setEditor({ kind: "appointment" })}>Thêm lịch hẹn</Button><label>Tìm lịch hẹn<Input type="search" value={appointmentQuery} maxLength={200} placeholder="Tìm nội dung, địa điểm, doanh nghiệp…" onChange={event => setAppointmentQuery(event.target.value)}/></label><label>Trạng thái<Select value={appointmentStatus} onChange={event => setAppointmentStatus(event.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(appointmentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label><p className="muted">Giờ Việt Nam · Lịch hẹn không tạo cam kết giữ mặt bằng.</p></div><PaginatedContent layoutKey={appointmentPages.pageSize}>{appointmentPages.rows.map((item) => <div className="b2b-appointment-row" key={item.id}><div className="b2b-time"><strong>{timeLabel(item.startsAt)}</strong><small>{dateLabel(item.startsAt)}</small></div><div><strong>{companyName(item.companyId)}</strong><span>{item.purpose}</span><small>{item.location} · {item.durationMinutes} phút</small><Badge>{appointmentLabels[item.status]}</Badge></div><div className="b2b-appointment-actions">{item.status !== "cancelled" && <Button variant="quiet" className="text-button" onClick={() => setEditor({ kind: "appointment", record: item })}>Sửa lịch</Button>}{item.status === "requested" && <Button variant="quiet" className="text-button" disabled={data.pending} onClick={() => void run({ type: "confirm-appointment", appointmentId: item.id }, "Đã xác nhận lịch hẹn.")}>Xác nhận lịch</Button>}{item.status !== "cancelled" && <Button variant="quiet" className="text-button" disabled={data.pending} onClick={() => setCancelAppointmentId(item.id)}>Hủy lịch</Button>}</div></div>)}{!appointmentPages.loading && !appointmentPages.error && !appointmentPages.total && <Empty>Không có lịch hẹn phù hợp. Thêm lịch hoặc đổi bộ lọc.</Empty>}</PaginatedContent><AdminPagination state={appointmentPages} label="lịch hẹn"/></AdminPanel></div>}

    {editor && <BusinessRecordEditor editor={editor} data={data} onClose={() => setEditor(null)} onSaved={onMessage}/>}
  </div>;
}
