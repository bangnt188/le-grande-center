export type BackendErrorCode = "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT" | "UNAVAILABLE" | "UPSTREAM_ERROR" | "TIMEOUT" | "INVALID_WEBHOOK";
const statuses: Record<BackendErrorCode, number> = { INVALID_INPUT: 400, NOT_FOUND: 404, CONFLICT: 409, UNAVAILABLE: 503, UPSTREAM_ERROR: 502, TIMEOUT: 504, INVALID_WEBHOOK: 400 };
/** Safe error vocabulary: no SQL, request bodies, keys, provider response or stack in public messages. */
export class BackendError extends Error {
  constructor(public readonly code: BackendErrorCode) { super(code); this.name = "BackendError"; }
  get status(): number { return statuses[this.code]; }
}
