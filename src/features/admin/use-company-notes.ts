"use client";

import { useEffect, useState } from "react";
import type { Company } from "./b2b-model";
import type { useAdminData } from "./use-admin-data";

/** Drafts live above the view switch so a remounted dossier does not lose edits. */
export function useCompanyNotes(companies: Company[], execute: ReturnType<typeof useAdminData>["execute"]) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const dirty = (company: Company) => drafts[company.id] !== undefined && drafts[company.id] !== company.note;
  const hasUnsaved = companies.some(dirty);

  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved]);

  return {
    value: (company: Company) => drafts[company.id] ?? company.note,
    dirty,
    update: (id: string, value: string) => setDrafts(current => ({ ...current, [id]: value })),
    navigate: (action: () => void) => {
      if (hasUnsaved) setPendingNavigation(() => action);
      else action();
    },
    pendingNavigation,
    stay: () => setPendingNavigation(null),
    continue: () => { const action = pendingNavigation; setPendingNavigation(null); action?.(); },
    save: async (company: Company) => {
      const note = drafts[company.id] ?? company.note;
      if (!await execute({ type: "save-company", companyId: company.id, note })) return false;
      setDrafts(current => {
        if (current[company.id] !== note) return current;
        const next = { ...current };
        delete next[company.id];
        return next;
      });
      return true;
    },
  };
}
