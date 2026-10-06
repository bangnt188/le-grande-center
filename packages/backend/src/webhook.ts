import { BackendError } from "./errors.js";
import { readRequestBytes } from "./internal/body.js";
export type WebhookEvent = {
  namespace: string;
  id: string;
  timestamp: number;
  body: Uint8Array<ArrayBuffer>;
  /** Do not prune unprocessed inbox records; this is minimum replay-dedup retention. */
  retainUntil: number;
};
export type WebhookOptions = {
  namespace: string;
  /** Server-configured current/previous non-extractable HMAC SHA-256 keys, at most three. */
  getKeys: () => Promise<readonly CryptoKey[]>;
  /** Atomic unique(namespace,id) + raw inbox insert. true=new durable event, false=already durable. */
  storeEvent: (event: WebhookEvent) => Promise<boolean>;
  now?: () => number;
  toleranceSeconds?: number;
  retentionSeconds?: number;
  maxBodyBytes?: number;
  timeoutMs?: number;
};
/** Internal protocol only: HMAC of UTF-8 v1.namespace.timestamp.id. concatenated with untouched body bytes. */
export function createWebhookVerifier(options: WebhookOptions) {
  if (!/^[a-zA-Z0-9:_-]{1,128}$/.test(options.namespace) || typeof options.getKeys !== "function" || typeof options.storeEvent !== "function") throw new BackendError("INVALID_INPUT");
  const toleranceSeconds = options.toleranceSeconds ?? 300;
  const retentionSeconds = options.retentionSeconds ?? 86_400;
  if (!Number.isSafeInteger(toleranceSeconds) || toleranceSeconds < 1 || toleranceSeconds > 900 || !Number.isSafeInteger(retentionSeconds) || retentionSeconds < toleranceSeconds * 2 || retentionSeconds > 31_536_000) throw new BackendError("INVALID_INPUT");
  const maxBodyBytes = options.maxBodyBytes ?? 1_048_576;
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1 || maxBodyBytes > 10_485_760) throw new BackendError("INVALID_INPUT");
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new BackendError("INVALID_INPUT");
  const clock = () => {
    try {
      const value = (options.now ?? Date.now)();
      if (!Number.isSafeInteger(value) || value < 1) throw new Error("Invalid clock");
      return value;
    } catch { throw new BackendError("UNAVAILABLE"); }
  };
  const checkTimestamp = (timestamp: number) => {
    const now = clock();
    if (!Number.isSafeInteger(timestamp) || timestamp < 1 || Math.abs(Math.floor(now / 1000) - timestamp) > toleranceSeconds) throw new BackendError("INVALID_WEBHOOK");
    return now;
  };
  return {
    async verify(request: Request): Promise<{ status: "accepted" | "duplicate"; id: string }> {
      const id = request.headers.get("x-webhook-id");
      const timestamp = request.headers.get("x-webhook-timestamp");
      const signature = request.headers.get("x-webhook-signature");
      if (request.method !== "POST" || !id || !/^[A-Za-z0-9_-]{1,128}$/.test(id) || !timestamp || !/^\d{1,13}$/.test(timestamp) || !signature || !/^v1=[a-f0-9]{64}$/.test(signature)) throw new BackendError("INVALID_WEBHOOK");
      checkTimestamp(Number(timestamp));
      let body: Uint8Array<ArrayBuffer>;
      try { body = await readRequestBytes(request, maxBodyBytes, timeoutMs); }
      catch { throw new BackendError("INVALID_WEBHOOK"); }
      const prefix = new TextEncoder().encode(`v1.${options.namespace}.${timestamp}.${id}.`);
      const message = new Uint8Array(prefix.length + body.length);
      message.set(prefix); message.set(body, prefix.length);
      const mac = Uint8Array.from(signature.slice(3).match(/../g)!, byte => Number.parseInt(byte, 16));
      let keys: readonly CryptoKey[];
      try {
        keys = await options.getKeys();
        if (!Array.isArray(keys) || keys.length < 1 || keys.length > 3 || keys.some(key => key.type !== "secret" || key.extractable || key.algorithm.name !== "HMAC" || !("hash" in key.algorithm) || (key.algorithm.hash as Algorithm).name !== "SHA-256" || !("length" in key.algorithm) || typeof key.algorithm.length !== "number" || key.algorithm.length < 256 || !key.usages.includes("verify"))) throw new Error("Invalid key configuration");
      } catch { throw new BackendError("UNAVAILABLE"); }
      let valid = false;
      try { for (const key of keys) { valid = (await crypto.subtle.verify("HMAC", key, mac, message)) || valid; } }
      catch { throw new BackendError("UNAVAILABLE"); }
      if (!valid) throw new BackendError("INVALID_WEBHOOK");
      const at = checkTimestamp(Number(timestamp));
      let stored: boolean;
      try { stored = await options.storeEvent({ namespace: options.namespace, id, timestamp: Number(timestamp), body, retainUntil: at + retentionSeconds * 1000 }); }
      catch { throw new BackendError("UNAVAILABLE"); }
      if (typeof stored !== "boolean") throw new BackendError("UNAVAILABLE");
      return { status: stored ? "accepted" : "duplicate", id };
    },
  };
}
