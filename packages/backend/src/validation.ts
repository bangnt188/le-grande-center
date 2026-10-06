import { BackendError } from "./errors.js";
import { readRequestBytes } from "./internal/body.js";
/** Flat JSON field allowlist. Nested structures need their own parser (or a schema library). */
export function objectInput(input: unknown, allowedKeys: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))
    || Reflect.ownKeys(input).some(key => typeof key !== "string" || !allowedKeys.includes(key) || ["__proto__", "constructor", "prototype"].includes(key))) throw new BackendError("INVALID_INPUT");
  return input as Record<string, unknown>;
}
export function textInput(input: unknown, options: { minLength?: number; maxLength?: number; trim?: boolean } = {}): string {
  const { minLength = 1, maxLength = 256, trim = true } = options;
  if (!Number.isSafeInteger(minLength) || minLength < 0 || !Number.isSafeInteger(maxLength) || maxLength < minLength || typeof input !== "string") throw new BackendError("INVALID_INPUT");
  const text = trim ? input.trim() : input;
  if (text.length < minLength || text.length > maxLength) throw new BackendError("INVALID_INPUT");
  return text;
}
export function integerInput(input: unknown, options: { min: number; max: number }): number {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || !Number.isSafeInteger(options.min) || !Number.isSafeInteger(options.max) || options.min > options.max || input < options.min || input > options.max) throw new BackendError("INVALID_INPUT");
  return input;
}
/** Bounded UTF-8 JSON reader. Parser may be a Zod/Valibot schema's parse function. */
export async function readJson<T>(request: Request, parse: (input: unknown) => T, options: { maxBytes?: number; timeoutMs?: number } = {}): Promise<T> {
  const maxBytes = options.maxBytes ?? 65_536;
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 1_048_576 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new BackendError("INVALID_INPUT");
  try {
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?\s*$/i.test(request.headers.get("content-type") ?? "") || typeof parse !== "function") throw new Error("Invalid JSON request");
    const body = await readRequestBytes(request, maxBytes, timeoutMs);
    return parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)));
  } catch { throw new BackendError("INVALID_INPUT"); }
}
