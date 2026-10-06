import { BackendError } from "./errors.js";
import { readBytes } from "./internal/body.js";
export type HttpsClientOptions = {
  /** Fixed server-configured trusted origin, never caller-supplied URLs. */
  origin: string;
  headers?: () => HeadersInit | Promise<HeadersInit>;
  timeoutMs?: number;
  maxResponseBytes?: number;
  maxRequestBytes?: number;
  fetch?: typeof fetch;
};
export type JsonRequest<T> = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Runtime schema validator/projection; no unchecked generic type assertion. */
  parse: (data: unknown) => T;
};
export function createHttpsClient(options: HttpsClientOptions) {
  let origin: URL;
  try {
    origin = new URL(options.origin);
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash
      || (origin.port && origin.port !== "443") || !origin.hostname.includes(".") || /^\d+\.\d+\.\d+\.\d+$/.test(origin.hostname)
      || /(?:^|\.)(localhost|local|internal)$/.test(origin.hostname) || origin.hostname.endsWith(".")) throw new Error("Invalid origin");
  } catch { throw new BackendError("INVALID_INPUT"); }
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new BackendError("INVALID_INPUT");
  const maxResponseBytes = options.maxResponseBytes ?? 1_048_576;
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1 || maxResponseBytes > 10_485_760) throw new BackendError("INVALID_INPUT");
  const maxRequestBytes = options.maxRequestBytes ?? 65_536;
  if (!Number.isSafeInteger(maxRequestBytes) || maxRequestBytes < 1 || maxRequestBytes > 1_048_576) throw new BackendError("INVALID_INPUT");
  const transport = options.fetch ?? fetch;
  return {
    async request<T>(path: string, input: JsonRequest<T>): Promise<T> {
      let url: URL;
      try {
        if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) throw new Error("Invalid path");
        url = new URL(path, origin);
        if (url.origin !== origin.origin || url.username || url.password || url.hash || typeof input.parse !== "function") throw new Error("Invalid request");
      } catch { throw new BackendError("INVALID_INPUT"); }
      const method = input.method ?? "GET";
      if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method) || (method === "GET" && input.body !== undefined)) throw new BackendError("INVALID_INPUT");
      let body: string | undefined;
      try { body = input.body === undefined ? undefined : JSON.stringify(input.body); }
      catch { throw new BackendError("INVALID_INPUT"); }
      if (input.body !== undefined && (body === undefined || body.length > maxRequestBytes || new TextEncoder().encode(body).length > maxRequestBytes)) throw new BackendError("INVALID_INPUT");
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new BackendError("TIMEOUT")); }, timeoutMs);
      });
      const operation = async () => {
        const headers = new Headers(await options.headers?.());
        headers.set("accept", "application/json");
        if (body !== undefined) headers.set("content-type", "application/json");
        if (controller.signal.aborted) throw new BackendError("TIMEOUT");
        const response = await transport(url, { method, headers, body, redirect: "error", cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new BackendError("UPSTREAM_ERROR");
        if (response.status === 204) return input.parse(null);
        if (!/^(application\/json|application\/[a-z0-9.+-]+\+json)(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")) throw new BackendError("UPSTREAM_ERROR");
        const bytes = await readBytes(response, maxResponseBytes, controller.signal);
        return input.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
      };
      try { return await Promise.race([operation(), deadline]); }
      catch (error) { throw controller.signal.aborted ? new BackendError("TIMEOUT") : new BackendError("UPSTREAM_ERROR"); }
      finally { clearTimeout(timer); controller.abort(); }
    },
  };
}
