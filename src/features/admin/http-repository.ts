import { isAdminSettings, type AdminRepository, type AdminSnapshot } from "../../shared/admin/contracts";
import { isStorageUsage } from "../../shared/admin/storage-policy";
import { isFloorConfigurations, isSlotStatus } from "../../shared/admin/space-model";

// Transport ready for a separately deployed authenticated backend. No database
// connection or credentials belong here. Endpoint contracts are documented.
export function createHttpRepository(baseUrl: string): AdminRepository {
  const relative = baseUrl === "/api/admin";
  const base = new URL(baseUrl, "https://invalid.local");
  if ((!relative && base.hostname === "invalid.local") || (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))) || base.username || base.password || base.search || base.hash) {
    throw new Error("Admin API URL phải là /api/admin hoặc HTTPS tuyệt đối không chứa credentials/query/hash.");
  }
  let revision: number | null = null;
  async function request(path: string, init?: RequestInit): Promise<AdminSnapshot> {
    const response = await fetch(`${relative ? "/api/admin" : base.href.replace(/\/$/, "")}/${path}/`, {
      ...init, credentials: "include", cache: "no-store",
    });
    if (!response.ok) {
      const messages: Record<number, string> = {
        401: "Phiên đăng nhập hết hạn. Đăng nhập lại.",
        403: "Bạn không có quyền thực hiện thao tác này.",
        409: "Dữ liệu đã thay đổi. Tải lại trước khi thao tác.",
        413: "Tệp vượt quá dung lượng cho phép.",
        507: "Không đủ dung lượng lưu trữ. Tải lại số liệu và chọn ít tệp hơn hoặc liên hệ quản trị viên.",
      };
      let message = messages[response.status] ?? `Không thể tải/lưu dữ liệu (${response.status}). Thử lại.`;
      if (response.status >= 400 && response.status < 500 && response.status !== 401) {
        const problem: unknown = await response.json().catch(() => null);
        if (problem && typeof problem === "object" && "error" in problem) {
          const error = problem.error;
          if (typeof error === "string" && error.length <= 2000) message = error;
          else if (error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message.length <= 2000) message = error.message;
        }
      }
      throw new Error(message);
    }
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || !("revision" in value) || typeof value.revision !== "number" || !("slots" in value) || !Array.isArray(value.slots) || !("groups" in value) || !Array.isArray(value.groups) || !("leads" in value) || !Array.isArray(value.leads) || !("media" in value) || !Array.isArray(value.media)) {
      throw new Error("Dữ liệu API không đúng AdminSnapshot contract.");
    }
    for (const key of ["companies", "requests", "reservations", "leases", "appointments"]) {
      if (!(key in value) || !Array.isArray((value as Record<string, unknown>)[key])) throw new Error("Backend chưa hỗ trợ dữ liệu B2B. Cập nhật workspace contract trước khi kết nối.");
    }
    if (!("collections" in value) || !value.collections || typeof value.collections !== "object" || ["companies", "leads", "appointments"].some(key => {
      const metadata = (value.collections as Record<string, unknown>)[key];
      return !metadata || typeof metadata !== "object" || ["page", "pageSize", "totalItems", "totalPages"].some(field => !(field in metadata) || !Number.isInteger((metadata as Record<string, unknown>)[field]));
    })) throw new Error("Backend chưa cung cấp phân trang hồ sơ hợp lệ.");
    if (!("storage" in value) || (value.storage !== null && !isStorageUsage(value.storage))) throw new Error("Backend chưa cung cấp số liệu dung lượng hợp lệ. Upload đã khóa.");
    if (value.slots.some(item => !item || typeof item !== "object" || !isSlotStatus(item.status)) || value.groups.some(item => !item || typeof item !== "object" || !isSlotStatus(item.status))) throw new Error("Backend phải trả trạng thái slot Còn trống, Liên hệ hoặc Đã thuê.");
    if (!("floors" in value) || !isFloorConfigurations(value.floors) || !("settings" in value) || !isAdminSettings(value.settings)) throw new Error("Backend chưa cung cấp cấu hình tầng và vận hành hợp lệ.");
    if (value.media.some(item => !item || typeof item !== "object" || typeof item.hasUploadedFile !== "boolean")) throw new Error("Backend chưa cung cấp trạng thái tệp đã upload hợp lệ.");
    revision = value.revision;
    return value as AdminSnapshot;
  }
  const currentRevision = () => {
    if (revision === null) throw new Error("Tải dữ liệu trước khi thực hiện thao tác.");
    return revision;
  };
  return {
    initialSnapshot: null,
    read: () => request("workspace"),
    execute: (command) => request("commands", {
      method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ command, expectedRevision: currentRevision() }),
    }),
    upload: (files, scope) => {
      const body = new FormData();
      files.forEach((file) => body.append("files", file));
      body.set("scope", scope); body.set("expectedRevision", String(currentRevision()));
      return request("media", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body });
    },
    reviewMedia: (id, note) => request(`media/${encodeURIComponent(id)}/review`, {
      method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ confirmedExternalReview: true, note, expectedRevision: currentRevision() }),
    }),
    reconcileStorage: () => request("media/reconcile", {
      method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ expectedRevision: currentRevision() }),
    }),
    dispose() {},
  };
}
