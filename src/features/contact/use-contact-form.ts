"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSurveySubmission } from "@mall/ui/forms";
import type { LeasingUnit } from "../public/leasing-model";
import { readContactValues, validateContact, type ContactErrors, type ContactValues } from "./contact-model";

export function useContactForm(units: readonly LeasingUnit[]) {
  const [errors, setErrors] = useState<ContactErrors>({});
  const [inquiry, setInquiry] = useState<LeasingUnit | null>(null);
  const [visit, setVisit] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const selected = units.find(unit => unit.id === params.get("unit")) ?? null;
    setInquiry(selected);
    setVisit(selected !== null && params.get("intent") === "visit");
  }, [units]);
  const submission = useSurveySubmission<ContactValues>({
    mode: "demo",
    storageKey: "legrande:contact-preview-rate-limit:v1",
    storage: "local",
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submission.ready || submission.submitting || submission.coolingDown) return;
    const form = event.currentTarget;
    const values = readContactValues(form);
    const nextErrors = validateContact(values);
    setErrors(nextErrors);
    submission.dismissNotice();
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      const field = form.elements.namedItem(firstError);
      if (field instanceof HTMLElement) field.focus();
      return;
    }
    if (await submission.submit(values) === "success") form.reset();
  }

  return { errors, submission, submit, inquiry, visit };
}
