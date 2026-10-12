"use client";

import { AdminPanel, Badge, ProgressBar, Button } from "@mall/ui";
import { useId, useState, type CSSProperties } from "react";
import { formatStorageBytes, storageState, type StorageUsage } from "../../shared/admin/storage-policy";

export function StorageUsagePanel({ usage, pending }: {
  usage: StorageUsage | null;
  pending: boolean;
}) {
  const state = storageState(usage);
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const status = !usage ? "Chưa có số liệu" : state.blocked ? "Đã đạt giới hạn" : state.tone === "error" ? "Sắp đầy" : state.tone === "warning" ? "Cần theo dõi" : "Còn dung lượng";
  const color = state.tone === "warning" ? "var(--mall-storage-warning)" : state.tone === "error" ? "var(--ui-color-error)" : "var(--ui-color-success)";
  return <AdminPanel className="storage-panel" aria-busy={pending}>
    <div className="storage-heading"><h2>Dung lượng lưu trữ</h2><Badge tone={state.tone}>{status}</Badge></div>
    <div className="storage-meter" style={{ "--ui-color-action": color, "--ui-color-surface": "var(--ui-color-border)" } as CSSProperties}>
      <ProgressBar label="Hạn mức sử dụng · 8,5 GB" value={state.percent === null ? null : Math.min(100, state.percent)} locale="vi-VN" format={{ style: "unit", unit: "percent", maximumFractionDigits: 2, roundingMode: "trunc" }} pendingLabel="Chưa xác định dung lượng"/>
    </div>
    <p className="storage-summary" aria-live="polite">{!usage ? "Tải lên tạm khóa · Chưa có số liệu dung lượng" : state.blocked ? "Tải lên đã khóa · Đã đạt hạn mức 8,5 GB" : `Còn ${formatStorageBytes(state.remainingBytes)} theo hạn mức nghiệp vụ`}</p>
    <Button variant="quiet" className="storage-details-toggle" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(!expanded)}>{expanded ? "Thu gọn dung lượng" : "Chi tiết dung lượng"}</Button>
    <div id={detailsId} className="storage-details" data-expanded={expanded || undefined}>
    <dl className="storage-facts">
      <div><dt>Đã lưu</dt><dd>{usage ? formatStorageBytes(usage.usedBytes) : "—"}</dd></div>
      <div><dt>Còn có thể tải lên</dt><dd>{usage ? formatStorageBytes(state.remainingBytes) : "—"}</dd></div>
      <div><dt>Phạm vi số liệu</dt><dd>Dữ liệu tệp trong bản dùng thử</dd></div>
    </dl>
    <p className="storage-note">{!usage ? "Upload tạm khóa đến khi tải được số liệu dung lượng." : state.blocked ? "Upload đã khóa. Giải phóng dung lượng hoặc liên hệ quản trị viên để tiếp tục." : state.tone === "error" ? "Dung lượng trên 85%. Ưu tiên rà soát tệp không còn sử dụng trước khi tải thêm." : state.tone === "warning" ? "Dung lượng trên 65%. Theo dõi và sắp xếp lại các tệp không còn sử dụng." : "Hình ảnh và tài liệu dùng chung hạn mức. Hệ thống kiểm tra tổng dung lượng trước khi nhận tệp."}</p>
    {!!usage?.reservedBytes && <p className="storage-note">Đang dành chỗ cho upload: {formatStorageBytes(usage.reservedBytes)} · đã tính trong thanh dung lượng.</p>}
    <p className="storage-note">Hạn mức nghiệp vụ không bảo đảm dung lượng IndexedDB. Trình duyệt có thể cấp ít hơn hoặc từ chối lưu; hệ thống chỉ báo thành công sau khi lưu được tệp. Chưa có số liệu quota R2/Neon.</p>
    </div>
  </AdminPanel>;
}
