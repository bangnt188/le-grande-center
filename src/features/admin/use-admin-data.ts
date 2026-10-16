"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminCommand, AdminSnapshot } from "../../shared/admin/contracts";
import { createHttpRepository } from "./http-repository";
import { storageUploadIssue } from "../../shared/admin/storage-policy";
import { useRouter } from "next/navigation";

export type AdminData = Pick<AdminSnapshot, "floors" | "slots" | "groups" | "leads" | "media" | "companies" | "requests" | "reservations" | "leases" | "appointments" | "storage"> & {
  settings: AdminSnapshot["settings"] | null;
  revision: number | null;
  collections: AdminSnapshot["collections"] | null;
  markDraft: (key: string, dirty: boolean) => void;
  hasUnsavedDrafts: boolean;
  pending: boolean; loading: boolean; error: string;
  execute: (command: AdminCommand) => Promise<boolean>;
  uploadFiles: (files: File[], scope: string) => Promise<boolean>;
  reload: () => Promise<boolean>;
  reviewMedia: (id: string, note: string) => Promise<boolean>;
  reconcileStorage: () => Promise<boolean>;
};

export function useAdminData(): AdminData {
  const router = useRouter();
  const [repository] = useState(() => createHttpRepository("/api/admin"));
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
    revision: data?.revision ?? null, collections: data?.collections ?? null,
    floors: data?.floors ?? [], settings: data?.settings ?? null, markDraft, hasUnsavedDrafts: Object.keys(drafts).length > 0,
    slots: data?.slots ?? [], groups: data?.groups ?? [], leads: data?.leads ?? [], media: data?.media ?? [],
    companies: data?.companies ?? [], requests: data?.requests ?? [], reservations: data?.reservations ?? [], leases: data?.leases ?? [], appointments: data?.appointments ?? [],
    storage: data?.storage ?? null, pending, loading, error,
    execute: async (command: AdminCommand) => {
      const saved = await run(() => repository.execute(command));
      if (saved && (command.type === "update-website-settings" || command.type === "update-settings" || command.type === "update-floor")) router.refresh();
      return saved;
    },
    uploadFiles: (files: File[], scope: string) => run(() => {
      const issue = storageUploadIssue(data?.storage ?? null, files);
      if (files.length > 4 || files.reduce((total, file) => total + file.size, 0) >= 20 * 1024 * 1024) throw new Error("Mỗi lần tối đa 4 tệp, tổng dung lượng dưới 20 MiB.");
      if (issue) throw new Error(issue);
      return repository.upload(files, scope);
    }),
    reload: () => run(() => repository.read()),
    reviewMedia: (id, note) => run(() => repository.reviewMedia(id, note)),
    reconcileStorage: () => run(() => repository.reconcileStorage()),
  };
}
