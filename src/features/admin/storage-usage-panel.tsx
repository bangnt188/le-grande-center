"use client";

import { AdminPanel, Badge, ProgressBar, Button } from "@mall/ui";
import type { CSSProperties } from "react";
import { formatStorageBytes, storageState, type StorageUsage } from "../../shared/admin/storage-policy";

export function StorageUsagePanel({ usage, pending, onReconcile }: {
  usage: StorageUsage | null;
  pending: boolean;
  onReconcile: () => Promise<boolean>;
}) {
  const state = storageState(usage);

  const percent = state.percent ?? 0;
  const isRed = percent >= 85 || state.blocked;
  const isYellow = !isRed && percent >= 65;
  const barColor = isRed ? "#dc2626" : isYellow ? "#eab308" : "#16a34a";
  const badgeTone = !usage ? "neutral" as const : isRed ? "error" as const : isYellow ? "warning" as const : "success" as const;

  const status = !usage
    ? "Đang cập nhật"
    : state.blocked
    ? "Đã đạt giới hạn 8,5 GB"
    : isRed
    ? "Sắp đầy (≥ 85%)"
    : isYellow
    ? "Cần theo dõi (≥ 65%)"
    : "Còn dung lượng (< 65%)";

  const usedFormatted = usage ? formatStorageBytes(usage.usedBytes) : "Chưa xác định";
  const remainingFormatted = usage ? formatStorageBytes(state.remainingBytes) : "Chưa xác định";
  const percentText = `${percent.toFixed(2).replace(".", ",")}%`;

  return <AdminPanel className="storage-panel" aria-busy={pending}>
    <div className="storage-heading">
      <h2>Dung lượng lưu trữ</h2>
      <Badge tone={badgeTone}>{status}</Badge>
    </div>
    {usage && <div className="storage-meter" style={{ "--ui-color-action": barColor, "--ui-color-surface": "var(--ui-color-border, #e5e7eb)" } as CSSProperties}>
      <ProgressBar
        label={`Thực tế đã dùng: ${usedFormatted} / 8,5 GB`}
        value={Math.min(100, Math.max(0, percent))}
        min={0}
        max={100}
        locale="vi-VN"
        format={{ style: "unit", unit: "percent", maximumFractionDigits: 2, roundingMode: "trunc" }}
        pendingLabel="Đang kiểm tra dung lượng"
      />
    </div>}
    <p className="storage-summary" aria-live="polite">
      {!usage
        ? "Đang tải dữ liệu dung lượng thực tế..."
        : state.blocked
        ? "Tải lên đã khóa · Đã đạt giới hạn tối đa 8,5 GB"
        : `Đã sử dụng ${usedFormatted} / 8,5 GB (${percentText}) · Còn trống ${remainingFormatted}`}
    </p>
    <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "16px", marginBottom: "8px" }}>
      <Button variant="secondary" disabled={pending || !usage} loading={pending} loadingLabel="Đang đối soát dung lượng" onClick={() => void onReconcile()}>Đối soát dung lượng thực tế</Button>
    </div>
    <dl className="storage-facts">
      <div><dt>Đã lưu thực tế</dt><dd>{usedFormatted}</dd></div>
      <div><dt>Còn có thể tải lên</dt><dd>{remainingFormatted}</dd></div>
      <div><dt>Giới hạn hệ thống</dt><dd>8,5 GB</dd></div>
    </dl>
  </AdminPanel>;
}
