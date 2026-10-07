"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ChangeEvent, ReactNode } from "react";
import { FLOORS, floorPurpose, mergeIssue, slotLeft } from "./space-model";
import type { Floor, Slot } from "./space-model";
import { useAdminData } from "@/features/admin/use-admin-data";
import { StorageUsagePanel } from "@/features/admin/storage-usage-panel";
import { storageState } from "@/features/admin/storage-policy";
import { referencePlanUrl } from "@/features/admin/demo-data";

import { useRecordDetail } from "@/features/admin/use-record-detail";
import { useCompanyNotes } from "@/features/admin/use-company-notes";

import B2BWorkspace from "./b2b-workspace";
import { LeGrandeAdminShell } from "@/features/admin/le-grande-admin-shell";
import { AdminPageHeader, AdminPanel, PaginatedContent, WorkspaceLayout, ConfirmDialog, Button, Input, Select, Textarea, Checkbox, Badge, Table, Breadcrumbs, LoadingIndicator, Alert, type ToastTone, type AdminNavigationItem } from "@mall/ui";
import { AdminNotificationsProvider, useAdminNotifications } from "@/features/admin/admin-notifications";
import { AdminPagination, useAdminPagination } from "@/features/admin/admin-pagination";
import type { B2BView } from "./b2b-workspace";

type View = "spaces" | "leads" | "media" | B2BView;
type IconName = "plan" | "people" | "media" | "arrow" | "search" | "check" | "merge" | "split" | "upload" | "file" | "close" | "external" | "menu" | "calendar" | "request";
const iconPaths: Record<IconName, ReactNode> = {
  menu: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m4-10 2 2-2 2"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h2m4 0h2"/></>,
  request: <><path d="M14 3H5v18h14V8zm0 0v5h5M8 12h8m-8 4h3"/><path d="m14 17 1 1 3-3"/></>,
  plan: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 10h18M10 10v11M15 3v7"/></>,
  people: <><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/></>,
  media: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 5-5 4 4 4-6 5 7"/></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  merge: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v3m0 8v3m-5-7h10m-3-3 3 3-3 3"/></>,
  split: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14m-4-9-2 2 2 2m8-4 2 2-2 2"/></>,
  upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/></>,
  file: <><path d="M14 3H5v18h14V8zm0 0v5h5M8 12h8m-8 4h6"/></>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  external: <><path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/></>,
};
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}
function Status({ value }: { value: string }) {
  const tone = value === "Trống" || value === "Đã xử lý" ? "available" : value === "Đang thuê" ? "leased" : value === "Mới" ? "new" : "neutral";
  return <Badge tone={tone === "available" ? "success" : tone === "new" ? "warning" : "neutral"}>{value}</Badge>;
}
const fmt = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const labels: Record<View, string> = { customers: "Khách hàng", requests: "Yêu cầu & giữ chỗ", leases: "Hợp đồng", appointments: "Lịch hẹn", preview: "Góc nhìn khách thuê", spaces: "Tầng & mặt bằng", leads: "Leads tư vấn", media: "Thư viện media" };


export default function AdminWorkspace() {
  return <AdminNotificationsProvider><AdminWorkspaceContent/></AdminNotificationsProvider>;
}
function AdminWorkspaceContent() {
  const [view, setView] = useState<View>("customers");
  const [floor, setFloor] = useState<Floor>(2);
  const admin = useAdminData();
  const details = useRecordDetail(view);
  const notes = useCompanyNotes(admin.companies, admin.execute);
  const dialogContainer = useRef<HTMLDivElement>(null);
  const { slots, groups, leads, media, pending, loading, error, execute, uploadFiles, reload } = admin;
  const [selected, setSelected] = useState<string[]>(["T2-B2", "T2-B3"]);
  const [groupName, setGroupName] = useState("Mặt bằng B.2–B.3");
  const { notify } = useAdminNotifications();
  function setMessage(message: string, tone: ToastTone = "success") { if (message) notify(message, tone); }
  useEffect(() => { if (error) notify(error, "error"); }, [error, notify]);
  const [planTab, setPlanTab] = useState<"plan" | "reference">("plan");
  const [slotQuery, setSlotQuery] = useState("");
  const [slotFilter, setSlotFilter] = useState("");
  const [leadQuery, setLeadQuery] = useState("");
  const [leadFilter, setLeadFilter] = useState("");
  const [activeLead, setActiveLead] = useState<string | null>("DEMO-1048");
  const [mediaQuery, setMediaQuery] = useState("");
  const [mediaFilter, setMediaFilter] = useState("");
  const [activeMedia, setActiveMedia] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const storage = storageState(admin.storage);
  const uploadDisabled = pending || loading || storage.blocked;

  const floorSlots = slots.filter((slot) => slot.floor === floor);
  const floorGroups = groups.filter((group) => group.floor === floor);
  const selectedSlots = floorSlots.filter((slot) => selected.includes(slot.id));
  const activeGroup = floorGroups.find((group) => group.slotIds.length === selected.length && group.slotIds.every((id) => selected.includes(id)));
  const problem = mergeIssue(slots, groups, selected, floor);
  const area = selectedSlots.reduce((sum, slot) => sum + slot.area, 0);
  const statusOptions = Array.from(new Set([...floorSlots.map((slot) => slot.status), ...floorGroups.map((group) => group.status)]));
  const planSpaces = floorSlots.filter((slot) => !floorGroups.some((group) => group.slotIds.includes(slot.id))).map((slot) => ({
    id: slot.id, name: slot.code, members: [slot], status: slot.status, group: false,
  })).concat(floorGroups.map((group) => ({
    id: group.id, name: floorSlots.filter((slot) => group.slotIds.includes(slot.id)).map((slot) => slot.code).join(" + "),
    members: floorSlots.filter((slot) => group.slotIds.includes(slot.id)), status: group.status, group: true,
  })));

  function changeFloor(next: Floor) {
    setFloor(next); setSelected([]); setMessage(""); setSlotQuery(""); setSlotFilter(""); setGroupName("");
  }
  function choose(slot: Slot) {
    const group = floorGroups.find((item) => item.slotIds.includes(slot.id));
    setMessage("");
    if (group) { setSelected(group.slotIds); setGroupName(group.name); return; }
    const next = selected.some((id) => floorGroups.some((item) => item.slotIds.includes(id)))
      ? [slot.id] : selected.includes(slot.id) ? selected.filter((id) => id !== slot.id) : [...selected, slot.id];
    setSelected(next);
    setGroupName(`Mặt bằng ${floorSlots.filter((item) => next.includes(item.id)).map((item) => item.code).join("–")}`);
  }
  async function merge() {
    const issue = mergeIssue(slots, groups, selected, floor);
    if (issue || !groupName.trim()) { setMessage(issue ?? "Nhập tên mặt bằng trước khi ghép.", "warning"); return; }
    if (await execute({ type: "merge", floor, slotIds: selected, name: groupName.trim() })) {
      setMessage(`Đã ghép ${selectedSlots.map((slot) => slot.code).join(" + ")} thành ${fmt(area)} m². Slot gốc được giữ nguyên.`);
    }
  }
  async function split() {
    if (!activeGroup) return;
    if (await execute({ type: "split", groupId: activeGroup.id })) {
      setMessage(`Đã tách ${activeGroup.name}. Slot giữ trạng thái ${activeGroup.status}; media của nhóm chuyển về tầng ${activeGroup.floor}.`);
    }
  }
  async function saveSpace(form: HTMLFormElement) {
    const fields = new FormData(form);
    const status = String(fields.get("status") ?? "").trim();
    const tenant = String(fields.get("tenant") ?? "").trim();
    const name = String(fields.get("name") ?? "").trim();
    if (!status || (activeGroup && !name)) { setMessage("Nhập đầy đủ trạng thái và tên mặt bằng.", "warning"); return; }
    const command = activeGroup
      ? { type: "update-group" as const, groupId: activeGroup.id, name, status }
      : { type: "update-slot" as const, slotId: selected[0], status, tenant };
    if (await execute(command)) setMessage("Đã cập nhật dữ liệu.");
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length && await uploadFiles(files, `Tầng ${floor}`)) {
      setMessage(`Đã thêm ${files.length} tệp vào phiên demo. Tệp sẽ mất khi tải lại trang.`);
    }
  }
  const visibleSlots = floorSlots.filter((slot) => {
    const group = floorGroups.find((item) => item.slotIds.includes(slot.id));
    return `${slot.code} ${group?.name ?? ""} ${slot.tenant}`.toLowerCase().includes(slotQuery.toLowerCase()) && (!slotFilter || (group?.status ?? slot.status) === slotFilter);
  });
  const visibleLeads = leads.filter((lead) => `${lead.name} ${lead.id} ${lead.interest}`.toLowerCase().includes(leadQuery.toLowerCase()) && (!leadFilter || lead.status === leadFilter));
  const visibleMedia = media.filter((item) => item.name.toLowerCase().includes(mediaQuery.toLowerCase()) && (!mediaFilter || item.kind === mediaFilter));
  const slotPages = useAdminPagination(visibleSlots, `${floor}:${slotQuery}:${slotFilter}`);
  const leadPages = useAdminPagination(visibleLeads, `${leadQuery}:${leadFilter}`, 2);
  const mediaPages = useAdminPagination(visibleMedia, `${mediaQuery}:${mediaFilter}`);
  const lead = leads.find((item) => item.id === activeLead);
  const mediaItem = media.find((item) => item.id === activeMedia);
  const mediaScopeLabel = (scope: string) => {
    const group = groups.find((item) => `group:${item.id}` === scope);
    return group ? `Tầng ${group.floor} · ${group.name}` : scope;
  };

  const navigation: AdminNavigationItem[] = (["customers", "requests", "leases", "appointments", "spaces", "leads", "media", "preview"] as View[]).map(item => ({ id: item, label: labels[item], icon: <Icon name={item === "spaces" ? "plan" : item === "appointments" ? "calendar" : item === "requests" ? "request" : item === "media" ? "media" : item === "leases" ? "file" : item === "preview" ? "external" : "people"}/>, badge: item === "leads" ? leads.filter(lead => lead.status === "Mới").length : undefined, destination: { kind: "action", onSelect: () => notes.navigate(() => { setView(item); setMessage(""); }) } }));
  return <LeGrandeAdminShell navigation={navigation} activeItemId={view} location={<Breadcrumbs label="Vị trí quản trị" items={[{ label: "Le Grande Centre", href: "https://legrandecentre.vn/" }, { label: labels[view], href: "#admin-workspace", current: true }]}/>}>
        <div ref={dialogContainer} className="admin-dialog-host"/>
        <ConfirmDialog open={!!notes.pendingNavigation} title="Ghi chú chưa lưu" description="Bạn có ghi chú doanh nghiệp chưa lưu. Nếu tiếp tục, bản nháp vẫn được giữ trong phiên này; tải lại hoặc đóng trang sẽ làm mất bản nháp." confirmLabel="Tiếp tục, giữ bản nháp" cancelLabel="Ở lại" onClose={notes.stay} onConfirm={notes.continue} portalContainer={dialogContainer}/>
        <div ref={details.scopeRef}>
        <AdminPageHeader title={labels[view]} description={view === "spaces" ? "Một góc nhìn rõ ràng cho từng mặt bằng, từng cơ hội khai thác." : view === "leads" ? "Theo dõi nhu cầu, kết nối khách hàng với mặt bằng phù hợp." : view === "media" ? "Tập trung bản vẽ, hình ảnh và tài liệu của dự án." : view === "customers" ? "Hồ sơ doanh nghiệp, nhu cầu thuê và mặt bằng trong cùng một nơi." : view === "requests" ? "Từ nhu cầu ban đầu đến giữ chỗ toàn bộ tổ hợp mặt bằng." : view === "leases" ? "Kỳ thuê, mặt bằng và tài liệu riêng của từng doanh nghiệp." : view === "appointments" ? "Kết nối đội leasing với khách hàng qua lịch tư vấn và khảo sát." : "Xem thông tin công khai và trải nghiệm dành riêng cho doanh nghiệp."} actions={view === "spaces" ? <Button variant="secondary" className="button secondary" onClick={() => { setView("media"); setActiveMedia("plan-reference"); }}><Icon name="file" size={17}/>Bản vẽ gốc</Button> : view === "media" ? <Button variant="primary" className="button primary" disabled={uploadDisabled} onClick={() => fileInput.current?.click()}><Icon name="upload" size={17}/>Thêm media</Button> : view === "leads" ? <span className="heading-count">{leads.length} yêu cầu mẫu</span> : <span className="heading-count">B2B · Demo tương tác</span>}/>

        {loading && <LoadingIndicator label="Đang tải dữ liệu…"/>}
        {error && !slots.length && <Button variant="secondary" onClick={reload}>Tải lại dữ liệu</Button>}

        {["customers", "requests", "leases", "appointments", "preview"].includes(view) && <B2BWorkspace view={view as B2BView} data={admin} notes={notes} onView={setView} onMessage={setMessage} onFloor={(nextFloor, ids) => notes.navigate(() => { setFloor(nextFloor); setSelected(ids); setView("spaces"); })}/>}

        {view === "spaces" && <>
          <div className="floor-nav" role="group" aria-label="Chọn tầng">{FLOORS.map((item) => <Button variant="quiet" className={`floor-tab ${floor === item ? "is-active" : ""}`} aria-pressed={floor === item} key={item} onClick={() => changeFloor(item)}><span>Tầng {item}</span><small>{item <= 2 ? "Thương mại" : item <= 4 ? "Văn phòng" : "Giải trí"}</small></Button>)}</div>
          <div className="floor-summary"><div><h2>Tầng {floor} <span>{floorPurpose[floor]}</span></h2><p>{floorSlots.length} slot gốc <span>·</span> {floorSlots.length - floorGroups.reduce((sum, group) => sum + group.slotIds.length - 1, 0)} mặt bằng <span>·</span> {fmt(floorSlots.reduce((sum, slot) => sum + slot.area, 0))} m² theo fixture</p></div><span className="text-note">6 tầng cố định</span></div>
          <div className="space-layout">
            <AdminPanel className="plan-panel" labelledBy="plan-heading">
              <div className="section-toolbar"><div className="segmented"><Button variant="quiet" id="plan-heading" aria-pressed={planTab === "plan"} className={planTab === "plan" ? "is-active" : ""} onClick={() => setPlanTab("plan")}><Icon name="plan" size={16}/>Sơ đồ tương tác</Button><Button variant="quiet" aria-pressed={planTab === "reference"} className={planTab === "reference" ? "is-active" : ""} onClick={() => setPlanTab("reference")}>Bản vẽ tham chiếu</Button></div><span className="plan-scale">Không theo tỷ lệ kỹ thuật</span></div>
              {planTab === "plan" ? <>
                <p className="plan-scroll-hint">Vuốt ngang để xem toàn bộ tầng, từ B.1 đến B.11.</p>
                <div className="plan-scroll" tabIndex={0} aria-label="Sơ đồ tầng, cuộn ngang trên màn hình nhỏ"><div className="plan-canvas"><div className="rear-corridor">HÀNH LANG PHÍA SAU</div><div className="plan-core"><span className="stair-symbol" aria-hidden="true"/><strong>Sảnh giữa</strong><span>Thang bộ<br/>& thang máy</span><div className="void-space">Thông tầng</div></div>{planSpaces.map((space) => {
                  const member = space.members[0];
                  const isSelected = space.members.every((item) => selected.includes(item.id));
                  const left = slotLeft(member);
                  const width = space.members.reduce((sum, item) => sum + item.width, 0);
                  return <Button variant="quiet" key={space.id} type="button" className={`plan-slot ${space.status === "Trống" ? "available" : space.status === "Đang thuê" ? "leased" : "reserved"} ${isSelected ? "is-selected" : ""} ${space.group ? "is-grouped" : ""}`} style={{ "--slot-left": `${left}%`, "--slot-width": `${width}%` } as CSSProperties} aria-pressed={isSelected} aria-label={`${space.name}, ${fmt(space.members.reduce((sum, item) => sum + item.area, 0))} mét vuông, ${space.status}${space.group ? ", đã ghép" : ""}`} onClick={() => choose(member)}><span className="slot-selection">{isSelected && <Icon name="check" size={13}/>}</span><span className="slot-plan-stair" aria-hidden="true"/><strong>{space.name}</strong><span className="slot-area">{fmt(space.members.reduce((sum, item) => sum + item.area, 0))} <small>m²</small></span><span className="slot-status">{space.status}</span>{space.group ? <span className="slot-dimension"><Icon name="merge" size={12}/>Đã ghép {space.members.length} slot</span> : <span className="slot-dimension">{member.width} × 20,5 m</span>}</Button>;
                })}<div className="frontage"><span>MẶT TIỀN CHÍNH</span><span className="entry-arrow">Lối vào sảnh <Icon name="arrow" size={15}/></span></div></div></div>
                <div className="plan-legend"><span><i className="legend-open"/>Trống</span><span><i className="legend-leased"/>Đang thuê</span><span><i className="legend-reserved"/>Trạng thái khác</span><span><i className="legend-selected"/>Đang chọn</span><span><Icon name="merge" size={14}/>Slot đã ghép</span></div>
              </> : <div className="reference-view"><img src={referencePlanUrl} alt="Bản vẽ khách hàng: slot B.1 đến B.11, sảnh giữa B.5 và B.6"/><p>Bản vẽ do khách hàng cung cấp. Chưa xác nhận thuộc tầng nào.</p></div>}
              <p className="plan-caption">Sơ đồ mô phỏng từ bản vẽ khách hàng, dùng chung cho 6 tầng để demo. Diện tích và bố trí từng tầng cần xác nhận khi bàn giao.</p>
            </AdminPanel>
            <aside className="space-inspector" aria-label="Chi tiết lựa chọn">
              <div className="inspector-title"><h3>{activeGroup ? "Mặt bằng đã ghép" : selected.length > 1 ? "Ghép mặt bằng" : "Chi tiết slot"}</h3>{selected.length > 0 && <Button variant="quiet" className="icon-button" aria-label="Bỏ chọn tất cả slot" onClick={() => { setSelected([]); setMessage(""); }}><Icon name="close" size={17}/></Button>}</div>
              {!selected.length ? <div className="selection-empty"><Icon name="plan" size={32}/><h4>Chọn slot trên sơ đồ</h4><p>Chọn một slot để xem chi tiết, hoặc nhiều slot liền kề để ghép mặt bằng.</p><Button variant="secondary" className="button secondary" onClick={() => { setSelected([`T${floor}-B2`, `T${floor}-B3`]); setGroupName("Mặt bằng B.2–B.3"); }}>Thử chọn B.2 + B.3</Button></div> : <>
                <div className="selection-chips">{selectedSlots.map((slot) => <span key={slot.id}>{slot.code}{!activeGroup && <Button variant="quiet" aria-label={`Bỏ chọn ${slot.code}`} onClick={() => choose(slot)}><Icon name="close" size={12}/></Button>}</span>)}</div>
                <div className="selected-area"><span>Tổng diện tích</span><strong>{fmt(area)} <small>m²</small></strong></div>
                <div className="selection-facts"><span>Tầng <strong>{floor}</strong></span><span>Slot gốc <strong>{selectedSlots.length}</strong></span></div>
                {activeGroup || selected.length === 1 ? <form key={`${selected.join("-")}-${activeGroup?.id ?? "slot"}`} onSubmit={(event) => { event.preventDefault(); saveSpace(event.currentTarget); }}>
                  {activeGroup && <label>Tên mặt bằng<Input name="name" maxLength={80} defaultValue={activeGroup.name} required/></label>}
                  <label>Trạng thái<Input aria-label="Trạng thái mặt bằng" name="status" list="space-statuses" maxLength={60} defaultValue={activeGroup?.status ?? selectedSlots[0]?.status} required/><small>Nhập text hoặc chọn gợi ý có sẵn.</small></label>
                  {!activeGroup && <label>Đối tác<Input name="tenant" maxLength={80} defaultValue={selectedSlots[0]?.tenant} placeholder="Chưa có đối tác"/></label>}
                  <datalist id="space-statuses">{[...new Set(["Trống", "Đang thuê", "Đã đặt cọc", "Đang đàm phán", ...statusOptions])].map((status) => <option key={status} value={status}/>)}</datalist>
                  <Button variant="primary" loading={pending} loadingLabel="Đang lưu…" className="button primary full" disabled={pending || loading} type="submit">Lưu thay đổi</Button>
                  {activeGroup && <Button variant="secondary" className="button secondary full split-button" type="button" onClick={split}><Icon name="split" size={17}/>Tách về {selectedSlots.length} slot gốc</Button>}
                </form> : <>
                  <label>Tên mặt bằng ghép<Input value={groupName} maxLength={80} onChange={(event) => setGroupName(event.target.value)} placeholder="Ví dụ: Mặt bằng B.2–B.3"/></label>
                  <Alert tone={problem ? "warning" : "success"}>{problem ?? "Slot liền kề, cùng tầng, không đi qua sảnh. Có thể ghép mặt bằng."}</Alert>
                  <Button variant="primary" className="button primary full" disabled={pending || loading || !!problem || !groupName.trim()} onClick={merge}><Icon name="merge" size={17}/>Ghép {selected.length} slot</Button>
                  <p className="inspector-note">Giữ nguyên mã slot và diện tích gốc. Có thể tách lại sau khi ghép.</p>
                </>}
              </>}
            </aside>
          </div>
          <AdminPanel className="slot-register" labelledBy="register-heading">
            <div className="register-heading"><h2 id="register-heading">Danh sách slot <span>{floorSlots.length}</span></h2><div className="filters"><label className="search-field"><Icon name="search" size={17}/><span className="sr-only">Tìm slot hoặc đối tác</span><Input value={slotQuery} onChange={(event) => setSlotQuery(event.target.value)} placeholder="Tìm slot, đối tác…"/></label><label><span className="sr-only">Lọc trạng thái slot</span><Select value={slotFilter} onChange={(event) => setSlotFilter(event.target.value)}><option value="">Tất cả trạng thái</option>{statusOptions.map((status) => <option key={status}>{status}</option>)}</Select></label></div></div>
            <PaginatedContent layoutKey={slotPages.pageSize}><p className="table-scroll-hint">Vuốt ngang để xem đầy đủ thông tin slot.</p><Table viewportLabel="Danh sách slot, có thể cuộn ngang" rows={slotPages.rows} getRowKey={slot => slot.id} getRowClassName={slot => selected.includes(slot.id) ? "selected-row" : undefined} emptyLabel="Không tìm thấy slot phù hợp." columns={[
              { id: "select", header: "Chọn", cell: slot => <Checkbox checked={selected.includes(slot.id)} onChange={() => choose(slot)} aria-label={`Chọn slot ${slot.code}`}/> },
              { id: "code", header: "Slot gốc", cell: slot => <><strong>{slot.code}</strong><small>Tầng {slot.floor}</small></> },
              { id: "area", header: "Diện tích", cell: slot => `${fmt(slot.area)} m²` },
              { id: "size", header: "Kích thước", cell: slot => `${slot.width} × 20,5 m` },
              { id: "status", header: "Trạng thái", cell: slot => <Status value={floorGroups.find(group => group.slotIds.includes(slot.id))?.status ?? slot.status}/> },
              { id: "tenant", header: "Mặt bằng / đối tác", cell: slot => { const group = floorGroups.find(group => group.slotIds.includes(slot.id)); return group ? <span className="group-reference"><Icon name="merge" size={14}/>{group.name}<small>{group.slotIds.map(id => floorSlots.find(item => item.id === id)?.code).join(" + ")}</small></span> : slot.tenant || <span className="muted">Chưa có đối tác</span>; } },
              { id: "action", header: "Thao tác", cell: slot => <Button variant="quiet" className="text-button" onClick={() => { const group = floorGroups.find(item => item.slotIds.includes(slot.id)); setSelected(group?.slotIds ?? [slot.id]); }}>Chi tiết<Icon name="arrow" size={14}/></Button> },
            ]}/>
            </PaginatedContent><AdminPagination state={slotPages} label="slot"/>
          </AdminPanel>
        </>}

        {view === "leads" && <WorkspaceLayout className="records-layout" mobilePresentation="drilldown" detailOpen={details.open} onDetailOpenChange={details.setOpen} returnFocusRef={details.returnFocusRef} detailLabel="Chi tiết khách tư vấn" backLabel="Quay lại danh sách tư vấn" primary={
          <AdminPanel className="records-panel"><div className="register-heading"><h2>Hộp thư tư vấn</h2><div className="filters"><label className="search-field"><Icon name="search" size={17}/><span className="sr-only">Tìm lead</span><Input placeholder="Tìm khách hàng, nhu cầu…" value={leadQuery} onChange={(event) => setLeadQuery(event.target.value)}/></label><label><span className="sr-only">Lọc trạng thái lead</span><Select value={leadFilter} onChange={(event) => setLeadFilter(event.target.value)}><option value="">Tất cả trạng thái</option>{[...new Set(leads.map((item) => item.status))].map((status) => <option key={status}>{status}</option>)}</Select></label></div></div>
            <PaginatedContent layoutKey={leadPages.pageSize}><div className="lead-list">{leadPages.rows.map((item) => <Button variant="quiet" key={item.id} className={`lead-row ${activeLead === item.id ? "is-active" : ""}`} onClick={() => { setActiveLead(item.id); details.openDetail(); }}><span className="lead-avatar">{item.initials}</span><span className="lead-information"><strong>{item.name}</strong><span>{item.interest}</span><small>{item.id} · {item.source} · {item.time}</small></span><span className="lead-row-end"><Status value={item.status}/><small>Tầng {item.floor}</small></span></Button>)}{!visibleLeads.length && <div className="empty-result">Không có lead phù hợp. <Button variant="quiet" className="text-button" onClick={() => { setLeadQuery(""); setLeadFilter(""); }}>Xóa bộ lọc</Button></div>}</div>
            </PaginatedContent><AdminPagination state={leadPages} label="lead"/><p className="panel-note">Thông tin khách hàng giả lập, không chứa dữ liệu cá nhân thật.</p>
          </AdminPanel>
          } detail={<aside className="record-inspector">{lead ? <>
            <h2>{lead.name}</h2><p className="muted">{lead.id}</p><dl><dt>Nhu cầu</dt><dd>{lead.interest}</dd><dt>Nguồn</dt><dd>{lead.source}</dd><dt>Tầng quan tâm</dt><dd>Tầng {lead.floor}</dd></dl>
            <form key={lead.id} onSubmit={async (event) => { event.preventDefault(); const fields = new FormData(event.currentTarget); const status = String(fields.get("status") ?? "").trim(); if (!status) return; if (await execute({ type: "update-lead", leadId: lead.id, status, note: String(fields.get("note") ?? "").trim() })) setMessage("Đã cập nhật lead."); }}><label>Trạng thái<Input name="status" defaultValue={lead.status} list="lead-statuses" maxLength={60} required/></label><datalist id="lead-statuses"><option value="Mới"/><option value="Đang tư vấn"/><option value="Đã xử lý"/></datalist><label>Ghi chú tư vấn<Textarea name="note" rows={4} maxLength={600} defaultValue={lead.note}/></label><Button variant="primary" type="submit" className="button primary full">Lưu lead</Button></form>
            <Button variant="secondary" className="button secondary full split-button" onClick={() => { changeFloor(lead.floor); setView("spaces"); }}>Xem mặt bằng tầng {lead.floor}<Icon name="arrow" size={17}/></Button>
          </> : <p>Chọn một lead để xem nhu cầu và ghi chú tư vấn.</p>}</aside>}/>}

        {view === "media" && <>
          <Input ref={fileInput} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" multiple disabled={uploadDisabled} onChange={upload} tabIndex={-1}/>
          <StorageUsagePanel usage={admin.storage} pending={pending} previewUsage={admin.previewStorage}/>
          <p className="media-instruction">Ảnh PNG, JPG, WebP hoặc PDF · Tối đa 10 MB/tệp · Xem trước trong phiên demo.</p>
          <WorkspaceLayout className="records-layout" mobilePresentation="drilldown" detailOpen={details.open} onDetailOpenChange={details.setOpen} returnFocusRef={details.returnFocusRef} detailLabel="Chi tiết tệp dự án" backLabel="Quay lại thư viện media" primary={<AdminPanel className="records-panel">
            <div className="register-heading"><h2>Tệp dự án <span>{media.length}</span></h2><div className="filters"><label className="search-field"><Icon name="search" size={17}/><span className="sr-only">Tìm media</span><Input placeholder="Tìm tên tệp…" value={mediaQuery} onChange={(event) => setMediaQuery(event.target.value)}/></label><label><span className="sr-only">Lọc loại media</span><Select value={mediaFilter} onChange={(event) => setMediaFilter(event.target.value)}><option value="">Tất cả loại tệp</option><option>Ảnh</option><option>Tài liệu</option></Select></label></div></div>
            <PaginatedContent layoutKey={mediaPages.pageSize}><div className="media-grid">{mediaPages.rows.map((item) => <Button variant="quiet" className={`media-tile ${activeMedia === item.id ? "is-active" : ""}`} key={item.id} onClick={() => { setActiveMedia(item.id); details.openDetail(); }}><span className={`media-thumbnail ${item.kind === "Tài liệu" ? "document" : ""}`}>{item.kind === "Ảnh" && item.url ? <img src={item.url} alt=""/> : <><Icon name="file" size={40}/><span>{item.url ? "PDF" : "Tệp mẫu"}</span></>}</span><strong>{item.name}</strong><span>{mediaScopeLabel(item.scope)}</span><small>{item.size}</small></Button>)}</div>
            {!visibleMedia.length && <div className="empty-result">Không tìm thấy tệp. <Button variant="quiet" className="text-button" onClick={() => { setMediaQuery(""); setMediaFilter(""); }}>Xóa bộ lọc</Button></div>}
            </PaginatedContent><AdminPagination state={mediaPages} label="media"/>
          </AdminPanel>} detail={<aside className="record-inspector">{mediaItem ? <>
            <h2>Chi tiết media</h2><div className="media-detail-preview">{mediaItem.kind === "Ảnh" && mediaItem.url ? <img src={mediaItem.url} alt={mediaItem.name}/> : <Icon name="file" size={44}/>}</div><h3>{mediaItem.name}</h3><p className="muted">{mediaItem.size}</p>
            {mediaItem.reference && <p className="panel-note">Bản vẽ khách hàng chưa xác định tầng. Sơ đồ tương tác chỉ mô phỏng bố cục để duyệt luồng.</p>}
            <form key={mediaItem.id} onSubmit={async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const scope = String(data.get("scope")); if (await execute({ type: "link-media", mediaId: mediaItem.id, scope })) setMessage("Đã cập nhật liên kết media."); }}><label>Liên kết với tầng / mặt bằng<Select name="scope" defaultValue={mediaItem.scope}><option>Chưa xác nhận tầng</option><option>Toàn dự án</option>{FLOORS.map((item) => <option key={item}>Tầng {item}</option>)}{groups.map((group) => <option key={group.id} value={`group:${group.id}`}>{`Tầng ${group.floor} · ${group.name}`}</option>)}</Select></label><Button variant="primary" type="submit" className="button primary full">Lưu liên kết</Button></form>
            {mediaItem.url ? <a className="button secondary full split-button" href={mediaItem.url} target="_blank" rel="noreferrer">Mở tệp gốc<Icon name="external" size={16}/></a> : <p className="panel-note">Đây là mục mẫu. Thêm tệp thật vào phiên demo để xem trước.</p>}
          </> : <div className="selection-empty"><Icon name="media" size={32}/><h3>Chọn một tệp</h3><p>Xem thông tin và liên kết tệp với tầng hoặc mặt bằng ghép.</p></div>}</aside>}/>
        </>}
        </div>
    </LeGrandeAdminShell>;
}
