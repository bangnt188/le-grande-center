"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { readContactValues, validateContact, type ContactErrors, type ContactGateway } from "./contact-model";
import { CONTACT_RATE_LIMIT_KEY, normalizeRateLimit, recordContactSuccess, formatCountdown, type ContactRateLimitState } from "./contact-rate-limit";

export function useContactForm(gateway: ContactGateway) {
  const [errors, setErrors] = useState<ContactErrors>({});
  const [status, setStatus] = useState<"idle" | "preview" | "received" | "error">("idle");
  const dismissNotice = useCallback(() => setStatus("idle"), []);
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const lock = useRef(false);
  const fallback = useRef<ContactRateLimitState>({ successTimestamps: [], cooldownUntil: null });

  function readState(time: number) {
    try {
      const raw = localStorage.getItem(CONTACT_RATE_LIMIT_KEY);
      return raw ? normalizeRateLimit(JSON.parse(raw), time) : normalizeRateLimit(fallback.current, time);
    } catch { return normalizeRateLimit(fallback.current, time); }
  }
  function writeState(state: ContactRateLimitState) {
    fallback.current = state;
    try { localStorage.setItem(CONTACT_RATE_LIMIT_KEY, JSON.stringify(state)); }
    catch { /* Keep the same-tab limit when storage is restricted. */ }
  }

  useEffect(() => {
    function sync() {
      const time = Date.now();
      let state: ContactRateLimitState;
      try {
        const raw = localStorage.getItem(CONTACT_RATE_LIMIT_KEY);
        state = normalizeRateLimit(raw ? JSON.parse(raw) : fallback.current, time);
      } catch { state = normalizeRateLimit(fallback.current, time); }
      fallback.current = state;
      setCooldownUntil(state.cooldownUntil);
      setNow(time);
      setReady(true);
    }
    function onStorage(event: StorageEvent) {
      if (event.key === CONTACT_RATE_LIMIT_KEY || event.key === null) sync();
    }
    sync();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", sync);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("focus", sync); };
  }, []);

  useEffect(() => {
    if (cooldownUntil === null) return;
    const until = cooldownUntil;
    function tick() {
      const time = Date.now();
      setNow(time);
      if (time >= until) setCooldownUntil(null);
    }
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || lock.current) return;
    const time = Date.now();
    const state = readState(time);
    if (state.cooldownUntil !== null) { setCooldownUntil(state.cooldownUntil); setNow(time); return; }
    const form = event.currentTarget;
    const values = readContactValues(form);
    const nextErrors = validateContact(values);
    setErrors(nextErrors);
    setStatus("idle");
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      const field = form.elements.namedItem(firstError);
      if (field instanceof HTMLElement) field.focus();
      return;
    }
    lock.current = true;
    setSubmitting(true);
    try {
      const receipt = await gateway.submit(values);
      const currentTime = Date.now();
      const updated = recordContactSuccess(readState(currentTime), currentTime);
      writeState(updated);
      setCooldownUntil(updated.cooldownUntil);
      setNow(currentTime);
      setStatus(receipt.kind);
      form.reset();
    } catch {
      // Preserve fields on failure; never log payload or personal data.
      setStatus("error");
    } finally { lock.current = false; setSubmitting(false); }
  }

  const remaining = cooldownUntil === null ? 0 : Math.max(0, cooldownUntil - now);
  return { errors, status, dismissNotice, submit, submitting, ready, coolingDown: remaining > 0, countdown: formatCountdown(remaining) };
}
