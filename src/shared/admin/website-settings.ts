export type WebsiteSettings = { logoMediaId: string; email: string; hotline: string; secondaryPhone: string; managementPhone: string; address: string; zaloUrl: string };
export function isWebsiteSettings(value: unknown): value is WebsiteSettings {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  const text = (key: string, max: number) => typeof data[key] === "string" && String(data[key]).trim() === data[key] && String(data[key]).length > 0 && String(data[key]).length <= max;
  const phone = (key: string, optional = false) => typeof data[key] === "string" && (optional && data[key] === "" || /^[+\d(). -]{7,32}$/.test(String(data[key])) && /^\d{7,15}$/.test(String(data[key]).replace(/\D/g, "")));
  if (!text("logoMediaId", 240) || !text("email", 254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email)) || !text("address", 400) || !text("zaloUrl", 240) || !phone("hotline") || !phone("secondaryPhone", true) || !phone("managementPhone", true)) return false;
  try { const url = new URL(String(data.zaloUrl)); return url.protocol === "https:" && url.hostname === "zalo.me" && !url.username && !url.password && !url.search && !url.hash && /^\/[\w.-]+\/?$/.test(url.pathname); } catch { return false; }
}
