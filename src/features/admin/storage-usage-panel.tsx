"use client";

import { AdminPanel, Badge, ProgressBar, Select, Button } from "@mall/ui";
import { useId, useState, type CSSProperties } from "react";
import { formatStorageBytes, STORAGE_LIMIT_BYTES, storageState, type StorageUsage } from "./storage-policy";

export function StorageUsagePanel({ usage, pending, previewUsage }: {
  usage: StorageUsage | null;
  pending: boolean;
  previewUsage?: (bytes: number) => Promise<boolean>;
}) {
  const state = storageState(usage);
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const status = !usage ? "Chưa có số liệu" : state.blocked ? "Đã đạt giới hạn" : state.tone === "error" ? "Sắp đầy" : state.tone === "warning" ? "Cần theo dõi" : "Còn dung lượng";
  const color = state.tone === "warning" ? "var(--mall-storage-warning)" : state.tone === "error" ? "var(--ui-color-error)" : "var(--ui-color-success)";
  return <AdminPanel className="storage-panel">
    <div className="storage-heading"><h2>Dung lượng lưu trữ</h2><Badge tone={state.tone}>{status}</Badge></div>
    <div className="storage-meter" style={{ "--ui-color-action": color, "--ui-color-surface": "var(--ui-color-border)" } as CSSProperties}>
      <ProgressBar label="Hạn mức sử dụng · 8,5 GB" value={state.percent === null ? null : Math.min(100, state.percent)} locale="vi-VN" format={{ style: "unit", unit: "percent", maximumFractionDigits: 2, roundingMode: "trunc" }} pendingLabel="Chưa xác định dung lượng"/>
    </div>
    <p className="storage-summary" aria-live="polite">{!usage ? "Tải lên tạm khóa · Chưa có số liệu dung lượng" : state.blocked ? "Tải lên đã khóa · Đã đạt hạn mức 8,5 GB" : `Còn ${formatStorageBytes(state.remainingBytes)} có thể tải lên`}</p>
    <Button variant="quiet" className="storage-details-toggle" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(!expanded)}>{expanded ? "Thu gọn dung lượng" : "Chi tiết dung lượng"}</Button>
    <div id={detailsId} className="storage-details" data-expanded={expanded || undefined}>
    <dl className="storage-facts">
      <div><dt>Đã lưu</dt><dd>{usage ? formatStorageBytes(usage.usedBytes) : "—"}</dd></div>
      <div><dt>Còn có thể tải lên</dt><dd>{usage ? formatStorageBytes(state.remainingBytes) : "—"}</dd></div>
      <div><dt>Dự phòng ngoài hạn mức</dt><dd>1,5 GB</dd></div>
    </dl>
    <p className="storage-note">{!usage ? "Upload tạm khóa đến khi tải được số liệu dung lượng." : state.blocked ? "Upload đã khóa. Giải phóng dung lượng hoặc liên hệ quản trị viên để tiếp tục." : state.tone === "error" ? "Dung lượng trên 85%. Ưu tiên rà soát tệp không còn sử dụng trước khi tải thêm." : state.tone === "warning" ? "Dung lượng trên 65%. Theo dõi và sắp xếp lại các tệp không còn sử dụng." : "Hình ảnh và tài liệu dùng chung hạn mức. Hệ thống kiểm tra tổng dung lượng trước khi nhận tệp."}</p>
    {!!usage?.reservedBytes && <p className="storage-note">Đang dành chỗ cho upload: {formatStorageBytes(usage.reservedBytes)} · đã tính trong thanh dung lượng.</p>}
    {previewUsage && <div className="storage-demo"><span>Số liệu mẫu · chưa kết nối R2</span><label><span>Xem trạng thái</span><Select aria-label="Trạng thái dung lượng mẫu" disabled={pending} value={String(usage?.usedBytes ?? 0)} onChange={event => { void previewUsage(Number(event.target.value)); }}>
      {usage && ![.45, .72, .9, .9995, 1].some(ratio => Math.round(STORAGE_LIMIT_BYTES * ratio) === usage.usedBytes) && <option value={usage.usedBytes}>Sau khi thêm tệp</option>}
      <option value={Math.round(STORAGE_LIMIT_BYTES * .45)}>45% · Bình thường</option>
      <option value={Math.round(STORAGE_LIMIT_BYTES * .72)}>72% · Cảnh báo vàng</option>
      <option value={Math.round(STORAGE_LIMIT_BYTES * .9)}>90% · Cảnh báo đỏ</option>
      <option value={Math.round(STORAGE_LIMIT_BYTES * .9995)}>Còn 4,25 MB · Thử giới hạn</option>
      <option value={STORAGE_LIMIT_BYTES}>100% · Khóa upload</option>
    </Select></label></div>}
    </div>
  </AdminPanel>;
}
