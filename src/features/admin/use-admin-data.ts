"use client";

import { useEffect, useRef, useState } from "react";
import type { AdminCommand, AdminSnapshot } from "./contracts";
import { createDemoRepository } from "./demo-repository";
import { createHttpRepository } from "./http-repository";
import { storageUploadIssue } from "./storage-policy";

export function useAdminData() {
  const [repository] = useState(() => process.env.NEXT_PUBLIC_ADMIN_API_URL
    ? createHttpRepository(process.env.NEXT_PUBLIC_ADMIN_API_URL) : createDemoRepository());
  const [data, setData] = useState<AdminSnapshot | null>(repository.initialSnapshot);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(!repository.initialSnapshot);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    if (!repository.initialSnapshot) {
      repository.read().then((value) => { if (alive.current) setData(value); })
        .catch((issue: unknown) => { if (alive.current) setError(issue instanceof Error ? issue.message : "Không thể tải dữ liệu."); })
        .finally(() => { if (alive.current) setLoading(false); });
    }
    return () => { alive.current = false; repository.dispose(); };
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
    slots: data?.slots ?? [], groups: data?.groups ?? [], leads: data?.leads ?? [], media: data?.media ?? [],
    companies: data?.companies ?? [], requests: data?.requests ?? [], reservations: data?.reservations ?? [], leases: data?.leases ?? [], appointments: data?.appointments ?? [],
    storage: data?.storage ?? null, pending, loading, error,
    execute: (command: AdminCommand) => run(() => repository.execute(command)),
    uploadFiles: (files: File[], scope: string) => run(() => {
      const issue = storageUploadIssue(data?.storage ?? null, files);
      if (issue) throw new Error(issue);
      return repository.upload(files, scope);
    }),
    previewStorage: repository.previewStorage ? (bytes: number) => run(() => repository.previewStorage!(bytes)) : undefined,
    reload: () => run(() => repository.read()),
  };
}
