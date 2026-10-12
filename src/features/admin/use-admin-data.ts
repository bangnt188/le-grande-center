"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminCommand, AdminSnapshot } from "../../shared/admin/contracts";
import { createDemoRepository } from "./demo/repository";
import { createHttpRepository } from "./http-repository";
import { storageUploadIssue } from "../../shared/admin/storage-policy";

export type AdminData = Pick<AdminSnapshot, "floors" | "slots" | "groups" | "leads" | "media" | "companies" | "requests" | "reservations" | "leases" | "appointments" | "storage"> & {
  settings: AdminSnapshot["settings"] | null;
  markDraft: (key: string, dirty: boolean) => void;
  hasUnsavedDrafts: boolean;
  pending: boolean; loading: boolean; error: string;
  execute: (command: AdminCommand) => Promise<boolean>;
  uploadFiles: (files: File[], scope: string) => Promise<boolean>;
  reload: () => Promise<boolean>;
};

export function useAdminData(): AdminData {
  const [repository] = useState(() => process.env.NEXT_PUBLIC_ADMIN_API_URL
    ? createHttpRepository(process.env.NEXT_PUBLIC_ADMIN_API_URL) : createDemoRepository());
  const [data, setData] = useState<AdminSnapshot | null>(repository.initialSnapshot);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(!repository.initialSnapshot);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, boolean>>({});
  const markDraft = useCallback((key: string, dirty: boolean) => {
    setDrafts(current => {
      if (!!current[key] === dirty) return current;
      const next = { ...current };
      if (dirty) next[key] = true; else delete next[key];
      return next;
    });
  }, []);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    let current = true;
    if (!repository.initialSnapshot) {
      repository.read().then(value => { if (current) setData(value); })
        .catch((issue: unknown) => { if (current) setError(issue instanceof Error ? issue.message : "Không thể tải dữ liệu."); })
        .finally(() => { if (current) setLoading(false); });
    }
    return () => { current = false; alive.current = false; repository.dispose(); };
  }, [repository]);
  async function run(operation: () => Promise<AdminSnapshot>): Promise<boolean> {
    if (lock.current) return false;
    lock.current = true; setPending(true); setError("");
    try {
      const result = await operation();
      if (alive.current) setData(result);
      return true;
    } catch (issue) {
      if (alive.current) setError(issue instanceof Error ? issue.message : "Thao tác thất bại. Thử lại.");
      return false;
    } finally { lock.current = false; if (alive.current) { setPending(false); setLoading(false); } }
  }
  return {
    floors: data?.floors ?? [], settings: data?.settings ?? null, markDraft, hasUnsavedDrafts: Object.keys(drafts).length > 0,
    slots: data?.slots ?? [], groups: data?.groups ?? [], leads: data?.leads ?? [], media: data?.media ?? [],
    companies: data?.companies ?? [], requests: data?.requests ?? [], reservations: data?.reservations ?? [], leases: data?.leases ?? [], appointments: data?.appointments ?? [],
    storage: data?.storage ?? null, pending, loading, error,
    execute: async (command: AdminCommand) => {
      const saved = await run(() => repository.execute(command));
      if (saved && (command.type === "update-website-settings" || command.type === "update-settings" || command.type === "update-floor")) {
        window.dispatchEvent(new Event("legrande-website-settings"));
        if (typeof BroadcastChannel !== "undefined") { const channel = new BroadcastChannel("legrande-website-settings"); channel.postMessage("saved"); channel.close(); }
      }
      return saved;
    },
    uploadFiles: (files: File[], scope: string) => run(() => {
      const issue = storageUploadIssue(data?.storage ?? null, files);
      if (issue) throw new Error(issue);
      return repository.upload(files, scope);
    }),
    reload: () => run(() => repository.read()),
  };
}
