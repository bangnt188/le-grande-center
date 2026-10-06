// Decimal GB, shared by all media and private documents in this storage scope.
// Client checks are UX only; the backend must reserve bytes atomically.
export const STORAGE_LIMIT_BYTES = 8_500_000_000;
export type StorageUsage = { usedBytes: number; reservedBytes: number };

export function isStorageUsage(value: unknown): value is StorageUsage {
  if (!value || typeof value !== "object") return false;
  const usage = value as Record<string, unknown>;
  return [usage.usedBytes, usage.reservedBytes].every(item => typeof item === "number" && Number.isSafeInteger(item) && item >= 0)
    && Number.isSafeInteger(Number(usage.usedBytes) + Number(usage.reservedBytes));
}

export function storageState(usage: StorageUsage | null) {
  const total = usage ? usage.usedBytes + usage.reservedBytes : null;
  const percent = total === null ? null : total / STORAGE_LIMIT_BYTES * 100;
  return {
    percent,
    remainingBytes: total === null ? 0 : Math.max(0, STORAGE_LIMIT_BYTES - total),
    blocked: total === null || total >= STORAGE_LIMIT_BYTES,
    tone: percent === null ? "neutral" as const : percent > 85 ? "error" as const : percent > 65 ? "warning" as const : "success" as const,
  };
}

export function storageUploadIssue(usage: StorageUsage | null, files: readonly { size: number }[]): string | null {
  if (!usage) return "Chưa xác định dung lượng lưu trữ. Tải lại dữ liệu trước khi thêm tệp.";
  const state = storageState(usage);
  if (state.blocked) return "Đã đạt giới hạn 8,5 GB. Giải phóng dung lượng hoặc liên hệ quản trị viên trước khi tải lên.";
  const bytes = files.reduce((total, file) => total + file.size, 0);
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > state.remainingBytes) return "Các tệp đã chọn sẽ vượt giới hạn 8,5 GB. Chọn ít tệp hơn hoặc giải phóng dung lượng.";
  return null;
}

export function formatStorageBytes(bytes: number): string {
  const unit = bytes >= 1_000_000_000 ? "GB" : "MB";
  const divisor = unit === "GB" ? 1_000_000_000 : 1_000_000;
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(bytes / divisor)} ${unit}`;
}
