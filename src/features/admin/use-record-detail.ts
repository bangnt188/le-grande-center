"use client";

import { useEffect, useRef, useState } from "react";

/** Shared interaction policy for the system WorkspaceLayout's mobile drilldown. */
export function useRecordDetail(view: string, stackedMaxWidth = 850) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [openingRevision, setOpeningRevision] = useState(0);
  const [detailView, setDetailView] = useState<string | null>(null);
  const open = detailView === view;

  useEffect(() => {
    if (!open || !window.matchMedia(`(max-width: ${stackedMaxWidth}px)`).matches) return;
    const workspace = scopeRef.current?.querySelector<HTMLElement>("[data-mobile=drilldown][data-open]");
    const detail = workspace?.querySelector<HTMLElement>(":scope > [aria-label]");
    if (window.matchMedia("(max-width: 850px)").matches) workspace?.scrollIntoView({ block: "start" });
    else {
      detail?.focus({ preventScroll: true });
      detail?.scrollIntoView({ block: "start" });
    }
  }, [open, view, stackedMaxWidth, openingRevision]);

  function openDetail(nextView = view, trigger?: HTMLElement) {
    returnFocusRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setDetailView(nextView);
    setOpeningRevision(revision => revision + 1);
  }

  function setOpen(next: boolean) {
    if (next) { openDetail(); return; }
    setDetailView(null);
    // The originating button may have unmounted during a cross-screen drilldown.
    // Resolve it before WorkspaceLayout's scheduled return-focus callback runs.
    requestAnimationFrame(() => {
      if (returnFocusRef.current?.isConnected && scopeRef.current?.contains(returnFocusRef.current)) return;
      returnFocusRef.current = scopeRef.current?.querySelector<HTMLElement>(
        "[data-mobile=drilldown] button[aria-pressed=true], [data-mobile=drilldown] button"
      ) ?? null;
    });
  }

  return { scopeRef, returnFocusRef, open, openDetail, setOpen };
}
