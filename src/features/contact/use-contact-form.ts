"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSurveySubmission } from "@mall/ui/forms";
import { useSearchParams } from "next/navigation";
import { getShophousePair, type LeasingUnit } from "../public/leasing-model";
import { localDateValue, readContactValues, validateContact, type ContactErrors, type ContactValues } from "./contact-model";
import { createContactSubmitter } from "./submit-contact";

export function useContactForm(units: readonly LeasingUnit[]) {
  const [errors, setErrors] = useState<ContactErrors>({});
  const [sendContact] = useState(createContactSubmitter);
  const params = useSearchParams();
  const inquiry = units.find(unit => unit.id === params.get("unit")) ?? null;
  const visit = params.get("intent") === "visit";
  const pair = inquiry ? getShophousePair(inquiry, units) : null;
  const initialScope = pair && params.get("scope") === "pair" ? "pair" : "single";
  const [scope, setScope] = useState(initialScope);
  const [today, setToday] = useState("");
  useEffect(() => {
    setScope(initialScope);
    setErrors({});
  }, [inquiry?.id, visit, initialScope]);
  useEffect(() => {
    if (!visit) return;
    let timer: ReturnType<typeof setTimeout>;
    const refreshToday = () => {
      clearTimeout(timer);
      const now = new Date();
      setToday(localDateValue(now));
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(refreshToday, midnight.getTime() - now.getTime() + 25);
    };
    refreshToday();
    window.addEventListener("focus", refreshToday);
    document.addEventListener("visibilitychange", refreshToday);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refreshToday);
      document.removeEventListener("visibilitychange", refreshToday);
    };
  }, [visit]);
  const submission = useSurveySubmission<ContactValues>({
    mode: "live",
    storageKey: "legrande:contact-live-rate-limit:v1",
    storage: "local",
    rateLimit: { maxSuccesses: 1 },
    onSubmit: values => sendContact({ ...values, intent: visit ? "visit" : "consultation", unitId: inquiry?.id }),
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submission.ready || submission.submitting || submission.coolingDown) return;
    const form = event.currentTarget;
    const values = readContactValues(form);
    if (visit) setToday(localDateValue());
    const nextErrors = validateContact(values, { visit, paired: pair !== null });
    setErrors(nextErrors);
    submission.dismissNotice();
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      const field = form.elements.namedItem(firstError);
      if (field instanceof HTMLElement) field.focus();
      return;
    }
    if (await submission.submit(values) === "success") {
      form.reset();
      setScope(initialScope);
    }
  }

  return { errors, submission, submit, inquiry, visit, pair, scope, setScope, today };
}
