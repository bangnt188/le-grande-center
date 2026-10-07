// Same browser UX policy as Solar survey-form.tsx. This is a convenience limit;
// production abuse protection must also be enforced by the intake API.
export const CONTACT_RATE_LIMIT_KEY = "legrande:contact-preview-rate-limit:v1";
export const CONTACT_SUCCESS_LIMIT = 3;
export const CONTACT_WINDOW_MS = 300_000;
export const CONTACT_COOLDOWN_MS = 300_000;
export type ContactRateLimitState = { successTimestamps: number[]; cooldownUntil: number | null };

export function normalizeRateLimit(value: unknown, now: number): ContactRateLimitState {
  const empty: ContactRateLimitState = { successTimestamps: [], cooldownUntil: null };
  if (!value || typeof value !== "object") return empty;
  if ("cooldownUntil" in value && typeof value.cooldownUntil === "number" && Number.isFinite(value.cooldownUntil)) {
    if (value.cooldownUntil > now) return { successTimestamps: [], cooldownUntil: Math.min(value.cooldownUntil, now + CONTACT_COOLDOWN_MS) };
    // Solar resets the window after its cooldown finishes.
    if (value.cooldownUntil !== 0) return empty;
  }
  if (!("successTimestamps" in value) || !Array.isArray(value.successTimestamps)) return empty;
  return {
    successTimestamps: value.successTimestamps.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry) && entry > now - CONTACT_WINDOW_MS && entry <= now).slice(-CONTACT_SUCCESS_LIMIT),
    cooldownUntil: null,
  };
}

export function recordContactSuccess(state: ContactRateLimitState, now: number): ContactRateLimitState {
  const current = normalizeRateLimit(state, now);
  if (current.cooldownUntil !== null) return current;
  const timestamps = [...current.successTimestamps, now];
  return timestamps.length >= CONTACT_SUCCESS_LIMIT
    ? { successTimestamps: [], cooldownUntil: now + CONTACT_COOLDOWN_MS }
    : { successTimestamps: timestamps, cooldownUntil: null };
}

export function formatCountdown(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
