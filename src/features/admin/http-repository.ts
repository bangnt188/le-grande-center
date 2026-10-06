import type { AdminRepository, AdminSnapshot } from "./contracts";

// Transport ready for a separately deployed authenticated backend. No database
// connection or credentials belong here. Endpoint contracts are documented.
export function createHttpRepository(baseUrl: string): AdminRepository {
  const base = new URL(baseUrl, "https://invalid.local");
  if (base.hostname === "invalid.local" || (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))) || base.username || base.password || base.search || base.hash) {
    throw new Error("Admin API URL phải là HTTPS tuyệt đối, không chứa credentials/query/hash.");
  }
  let revision: number | null = null;
  async function request(path: string, init?: RequestInit): Promise<AdminSnapshot> {
    const response = await fetch(`${base.href.replace(/\/$/, "")}/${path}`, {
      ...init, credentials: "include", cache: "no-store",
    });
    if (!response.ok) {
      const messages: Record<number, string> = {
        401: "Phiên đăng nhập hết hạn. Đăng nhập lại.",
        403: "Bạn không có quyền thực hiện thao tác này.",
        409: "Dữ liệu đã thay đổi. Tải lại trước khi thao tác.",
        413: "Tệp vượt quá dung lượng cho phép.",
      };
      throw new Error(messages[response.status] ?? `Không thể tải/lưu dữ liệu (${response.status}). Thử lại.`);
    }
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || !("revision" in value) || typeof value.revision !== "number" || !("slots" in value) || !Array.isArray(value.slots) || !("groups" in value) || !Array.isArray(value.groups) || !("leads" in value) || !Array.isArray(value.leads) || !("media" in value) || !Array.isArray(value.media)) {
      throw new Error("Dữ liệu API không đúng AdminSnapshot contract.");
    }
    for (const key of ["companies", "requests", "reservations", "leases", "appointments"]) {
      if (!(key in value) || !Array.isArray((value as Record<string, unknown>)[key])) throw new Error("Backend chưa hỗ trợ dữ liệu B2B. Cập nhật workspace contract trước khi kết nối.");
    }
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
    dispose() {},
  };
}
