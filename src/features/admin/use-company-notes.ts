"use client";

import { useEffect, useState } from "react";
import type { Company } from "../../shared/admin/b2b-model";
import type { AdminData } from "./use-admin-data";

export type CompanyNotes = {
  value: (company: Company) => string;
  dirty: (company: Company) => boolean;
  update: (company: Company, value: string) => void;
  navigate: (action: () => void) => void;
  pendingNavigation: (() => void) | null;
  stay: () => void;
  continue: () => void;
  save: (company: Company) => Promise<boolean>;
};
/** Drafts live above the view switch so a remounted dossier does not lose edits. */
export function useCompanyNotes(execute: AdminData["execute"], hasOtherDrafts = false): CompanyNotes {
  const [drafts, setDrafts] = useState<Record<string, { value: string; original: string }>>({});
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const dirty = (company: Company) => drafts[company.id] !== undefined && drafts[company.id].value !== company.note;
  const hasUnsaved = Object.values(drafts).some(draft => draft.value !== draft.original) || hasOtherDrafts;

  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved]);

  return {
    value: (company: Company) => drafts[company.id]?.value ?? company.note,
    dirty,
    update: (company: Company, value: string) => setDrafts(current => ({ ...current, [company.id]: { value, original: current[company.id]?.original ?? company.note } })),
    navigate: (action: () => void) => {
      if (hasUnsaved) setPendingNavigation(() => action);
      else action();
    },
    pendingNavigation,
    stay: () => setPendingNavigation(null),
    continue: () => { const action = pendingNavigation; setPendingNavigation(null); action?.(); },
    save: async (company: Company) => {
      const note = drafts[company.id]?.value ?? company.note;
      if (!await execute({ type: "save-company", companyId: company.id, note })) return false;
      setDrafts(current => {
        if (current[company.id]?.value !== note) return current;
        const next = { ...current };
        delete next[company.id];
        return next;
      });
      return true;
    },
  };
}
