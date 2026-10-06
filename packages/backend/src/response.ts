import { AccessError } from "./access.js";
import { BackendError } from "./errors.js";
export type ResponseOptions = { requestId?: string };
function headers(options: ResponseOptions): Headers {
  const result = new Headers({ "cache-control": "private, no-store", "x-content-type-options": "nosniff" });
  if (options.requestId && /^[a-zA-Z0-9_-]{1,128}$/.test(options.requestId)) result.set("x-request-id", options.requestId);
  return result;
}
/** DTOs only. Authentication/authorization and field projection happen before this function. */
export function jsonSuccess<T>(data: T, options: ResponseOptions & { status?: 200 | 201 | 202 } = {}): Response {
  return Response.json({ ok: true, data }, { status: options.status ?? 200, headers: headers(options) });
}
export function jsonError(error: unknown, options: ResponseOptions = {}): Response {
  const known = error instanceof AccessError || error instanceof BackendError;
  return Response.json({ ok: false, error: { code: known ? error.code : "INTERNAL_ERROR" } }, {
    status: known ? error.status : 500, headers: headers(options),
  });
}
