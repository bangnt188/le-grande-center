"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Checkbox, Select, Textarea, TextField } from "@mall/ui";
import { AdminEditor } from "@/features/admin/admin-editor";
import type { AdminData } from "@/features/admin/use-admin-data";
import type { Appointment, B2BCommand, Company, Lease, LeasingRequest, Reservation } from "@/shared/admin/b2b-model";
import { FLOORS, hasCommitment, type Floor } from "@/shared/admin/space-model";
import type { MediaItem } from "@/shared/admin/contracts";
import { CompanyPicker } from "@/features/admin/admin-collections";

export type BusinessEditor =
  | { kind: "company"; record?: Company }
  | { kind: "request"; record?: LeasingRequest; companyId?: string }
  | { kind: "appointment"; record?: Appointment; companyId?: string }
  | { kind: "document"; reservation: Reservation; lease?: never }
  | { kind: "document"; lease: Lease; reservation?: never }
  | { kind: "approve" | "reject"; request: LeasingRequest }
  | { kind: "cancel-hold"; reservation: Reservation };

export const isStoredPdf = (item: MediaItem) => item.hasUploadedFile && !item.reference && !!item.url && item.mimeType === "application/pdf";
const text = (values: FormData, key: string) => String(values.get(key) ?? "").trim();
function vietnamDateTime(value = new Date().toISOString()) {
  return new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 16);
}

export function BusinessRecordEditor({ editor, data, onClose, onSaved }: { editor: BusinessEditor; data: AdminData; onClose: () => void; onSaved: (message: string) => void }) {
  const [floor, setFloor] = useState<Floor>(editor.kind === "request" ? editor.record?.floor ?? FLOORS[0] : FLOORS[0]);
  const [selectedSlots, setSelectedSlots] = useState(editor.kind === "request" ? editor.record?.slotIds ?? [] : []);
  const [file, setFile] = useState<File | null>(null);
  const [mediaId, setMediaId] = useState(editor.kind === "document" && data.media.some(item => item.id === editor.lease?.documentMediaId && isStoredPdf(item)) ? editor.lease?.documentMediaId ?? "" : "");
  const [fileError, setFileError] = useState("");
  const uploadBefore = useRef<Set<string> | null>(null);
  const [now] = useState(() => vietnamDateTime());
  useEffect(() => {
    if (!uploadBefore.current) return;
    const uploaded = data.media.find(item => !uploadBefore.current!.has(item.id) && isStoredPdf(item));
    if (uploaded) { setMediaId(uploaded.id); setFile(null); uploadBefore.current = null; }
  }, [data.media]);
  const record = "record" in editor ? editor.record : undefined;
  const titles = { company: record ? "Sửa doanh nghiệp" : "Thêm doanh nghiệp", request: record ? "Sửa yêu cầu thuê" : "Thêm yêu cầu thuê", appointment: record ? "Sửa lịch hẹn" : "Thêm lịch hẹn", document: "Lưu tệp hợp đồng", approve: "Duyệt yêu cầu & giữ chỗ", reject: "Từ chối yêu cầu", "cancel-hold": "Hủy giữ chỗ" };
  async function save(values: FormData) {
    let command: B2BCommand;
    switch (editor.kind) {
      case "company": command = { type: "upsert-company", companyId: editor.record?.id, values: { name: text(values, "name"), industry: text(values, "industry"), brand: text(values, "brand"), contact: text(values, "contact"), email: text(values, "email"), phone: text(values, "phone"), owner: text(values, "owner"), note: text(values, "note"), taxId: text(values, "taxId"), address: text(values, "address") } }; break;
      case "request": command = { type: "save-request", requestId: editor.record?.id, values: { companyId: text(values, "companyId"), floor, slotIds: values.getAll("slotIds").map(String), start: text(values, "start"), end: text(values, "end"), note: text(values, "note") } }; break;
      case "appointment": {
        const date = new Date(`${text(values, "startsAt")}:00+07:00`);
        if (!Number.isFinite(date.getTime())) return false;
        command = { type: "save-appointment", appointmentId: editor.record?.id, values: { companyId: text(values, "companyId"), purpose: text(values, "purpose"), startsAt: date.toISOString(), location: text(values, "location"), durationMinutes: Number(values.get("durationMinutes")) } }; break;
      }
      case "document":
        if (!data.media.some(item => item.id === mediaId && isStoredPdf(item))) { setFileError("Tải lên hoặc chọn một tệp PDF đã lưu trước khi gắn hợp đồng."); return false; }
        command = editor.lease ? { type: "attach-lease-document", leaseId: editor.lease.id, mediaId } : { type: "record-lease", reservationId: editor.reservation.id, mediaId }; break;
      case "approve": command = { type: "approve-request", requestId: editor.request.id, holdHours: Number(values.get("hours")), note: text(values, "note") }; break;
      case "reject": command = { type: "reject-request", requestId: editor.request.id, reason: text(values, "reason") }; break;
      case "cancel-hold": command = { type: "cancel-hold", reservationId: editor.reservation.id, reason: text(values, "reason") }; break;
    }
    const saved = await data.execute(command);
    if (saved) onSaved(editor.kind === "document" ? "Đã lưu tệp hợp đồng. Thao tác này không xác nhận chữ ký hay nội dung tài liệu." : "Đã lưu thay đổi.");
    return saved;
  }
  return <AdminEditor data={data} title={titles[editor.kind]} description={editor.kind === "document" ? "Chỉ lưu và liên kết tệp PDF có sẵn. Không ký điện tử, không soạn hợp đồng và không xác nhận tài liệu đã ký." : "Hồ sơ nội bộ được lưu trên hệ thống với kiểm tra quyền truy cập."} onClose={onClose} onSave={save} saveLabel={editor.kind === "document" && editor.reservation ? "Lưu hợp đồng & chuyển thuê" : "Lưu thay đổi"}>
    <div className="b2b-editor-fields">
      {editor.kind === "company" && <>
        <TextField id="company-name" name="name" label="Tên doanh nghiệp" defaultValue={editor.record?.name} required maxLength={80}/>
        <TextField id="company-industry" name="industry" label="Ngành hàng" defaultValue={editor.record?.industry} maxLength={120}/>
        <TextField id="company-brand" name="brand" label="Thương hiệu" defaultValue={editor.record?.brand} maxLength={80}/>
        <TextField id="company-contact" name="contact" label="Người liên hệ" defaultValue={editor.record?.contact} maxLength={80}/>
        <TextField id="company-email" name="email" type="email" label="Email" defaultValue={editor.record?.email} maxLength={254}/>
        <TextField id="company-phone" name="phone" type="tel" label="Điện thoại" defaultValue={editor.record?.phone} maxLength={30}/>
        <TextField id="company-owner" name="owner" label="Nhân viên phụ trách" defaultValue={editor.record?.owner} maxLength={80}/>
        <TextField id="company-tax" name="taxId" label="Mã số thuế" defaultValue={editor.record?.taxId} maxLength={30}/>
        <TextField id="company-address" name="address" label="Địa chỉ" defaultValue={editor.record?.address} maxLength={240}/>
        <label>Ghi chú nội bộ<Textarea name="note" rows={3} maxLength={600} defaultValue={editor.record?.note}/></label>
      </>}
      {editor.kind === "request" && <>
        <CompanyPicker data={data} name="companyId" required defaultValue={editor.record?.companyId ?? editor.companyId ?? ""}/>
        <label>Tầng<Select name="floor" value={floor} onChange={event => { setFloor(Number(event.target.value) as Floor); setSelectedSlots([]); }}>{data.floors.map(item => <option key={item.number} value={item.number}>Tầng {item.number} · {item.purpose}</option>)}</Select></label>
        <fieldset className="b2b-slot-options"><legend>Slot · chọn tổ hợp liền kề cùng phía</legend>{data.slots.filter(item => item.floor === floor).map(item => { const unavailable = item.status === "Đang thuê" || hasCommitment(data, [item.id]); return <label key={item.id}><Checkbox name="slotIds" value={item.id} checked={selectedSlots.includes(item.id)} disabled={unavailable} onChange={event => setSelectedSlots(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))}/><span>{item.code} · {item.area} m²{unavailable ? " · Đã có cam kết" : ""}</span></label>; })}</fieldset>
        <p className="panel-note">Chọn ít nhất một slot; mặt bằng ghép phải được chọn đủ các slot thành viên. Diện tích được tính từ dữ liệu mặt bằng.</p>
        <div className="b2b-date-fields"><TextField id="request-start" name="start" label="Ngày bắt đầu" type="date" min={now.slice(0,10)} defaultValue={editor.record?.start ?? now.slice(0,10)} required/><TextField id="request-end" name="end" label="Ngày kết thúc" type="date" min={now.slice(0,10)} defaultValue={editor.record?.end} required/></div>
        <label>Ghi chú nhu cầu<Textarea name="note" maxLength={600} rows={3} defaultValue={editor.record?.note}/></label>
      </>}
      {editor.kind === "appointment" && <>
        <CompanyPicker data={data} name="companyId" required defaultValue={editor.record?.companyId ?? editor.companyId ?? ""}/>
        <TextField id="appointment-purpose" name="purpose" label="Nội dung hẹn" required maxLength={80} defaultValue={editor.record?.purpose ?? "Khảo sát mặt bằng"}/>
        <TextField id="appointment-start" name="startsAt" label="Ngày giờ · giờ Việt Nam (UTC+07)" type="datetime-local" min={now} required defaultValue={editor.record ? vietnamDateTime(editor.record.startsAt) : vietnamDateTime(new Date(Date.now() + 3600000).toISOString())}/>
        <TextField id="appointment-location" name="location" label="Địa điểm" required maxLength={160} defaultValue={editor.record?.location ?? data.settings?.appointmentLocation}/>
        <TextField id="appointment-duration" name="durationMinutes" label="Thời lượng · phút" type="number" required min={15} max={240} step={1} defaultValue={editor.record?.durationMinutes ?? data.settings?.appointmentMinutes}/>
        <p className="panel-note">Lịch hẹn không giữ mặt bằng. Hệ thống kiểm tra thời gian trùng với các lịch chưa hủy.</p>
      </>}
      {editor.kind === "document" && <>
        <label>Tải tệp PDF mới<input type="file" accept="application/pdf,.pdf" name="documentFile" onChange={event => { setFile(event.target.files?.[0] ?? null); setFileError(""); }}/></label>
        <Button variant="secondary" type="button" disabled={!file || data.pending} onClick={async () => {
          if (!file) return;
          if (file.type !== "application/pdf") { setFileError("Tệp hợp đồng phải là PDF."); return; }
          uploadBefore.current = new Set(data.media.map(item => item.id));
          if (!await data.uploadFiles([file], "Toàn dự án")) { uploadBefore.current = null; setFileError("Chưa tải được tệp. Kiểm tra thông báo lỗi và thử lại."); }
        }}>Tải PDF lên khu cách ly</Button>
        <label>Tệp PDF đã tải lên<Select name="mediaId" required value={mediaId} onChange={event => { setMediaId(event.target.value); setFileError(""); }}><option value="">Chọn tệp PDF đã lưu</option>{data.media.filter(item => isStoredPdf(item) && !data.leases.some(lease => lease.documentMediaId === item.id && lease.id !== editor.lease?.id)).map(item => <option key={item.id} value={item.id}>{item.name} · {item.size}</option>)}</Select></label>
        {mediaId && <p role="status">Đã chọn: {data.media.find(item => item.id === mediaId)?.name}</p>}
        {fileError && <Alert tone="error">{fileError}</Alert>}
        <p className="panel-note">PDF được lưu nguyên bản trong R2 riêng tư. Vào Media để tải và kiểm tra tệp bên ngoài, sau đó duyệt thủ công trước khi chọn vào hợp đồng. Không ký điện tử hoặc xác nhận chữ ký.</p>
      </>}
      {editor.kind === "approve" && <>
        <TextField id="hold-hours" name="hours" label="Thời hạn giữ chỗ · giờ" type="number" min={1} max={720} step={1} required defaultValue={data.settings?.defaultHoldHours}/>
        <label>Ghi chú quyết định<Textarea name="note" maxLength={600} rows={3}/></label>
      </>}
      {(editor.kind === "reject" || editor.kind === "cancel-hold") && <label>Lý do<Textarea name="reason" required maxLength={600} rows={3}/></label>}
    </div>
  </AdminEditor>;
}
