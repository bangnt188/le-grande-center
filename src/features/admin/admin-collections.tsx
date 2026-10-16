"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Input, LoadingIndicator, Select } from "@mall/ui";
import type { AdminCollectionName, AdminCollectionItems, AdminCollectionPage, AdminCollectionQuery, AdminCollectionDetail } from "../../shared/admin/collection-contracts";
import type { AdminData } from "./use-admin-data";
import { AdminPagination } from "./admin-pagination";

async function collectionRequest<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/admin/collections/${path}`, { credentials: "same-origin", cache: "no-store", signal });
  if (!response.ok) throw new Error(response.status === 401 ? "Phiên đăng nhập hết hạn. Đăng nhập lại." : response.status === 404 ? "Không tìm thấy hồ sơ đã chọn." : `Không thể tải hồ sơ (${response.status}). Thử lại.`);
  return response.json() as Promise<T>;
}
function queryString(query: AdminCollectionQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  return params.toString();
}

/** Collection revisions are informational; only full repository snapshots may advance CAS. */
export function useAdminCollection<C extends AdminCollectionName>(data: AdminData, collection: C, filters: Pick<AdminCollectionQuery, "query" | "status" | "companyId"> = {}, enabled = true, initialPageSize = 20) {
  const [selection, setSelection] = useState({ key: "", page: 1, pageSize: initialPageSize });
  const filterKey = queryString(filters);
  const page = selection.key === filterKey ? selection.page : 1;
  const pageSize = selection.pageSize;
  const requestKey = `${collection}/?${filterKey}&page=${page}&pageSize=${pageSize}`;
  const [result, setResult] = useState<{ key: string; revision: number | null; value: AdminCollectionPage<AdminCollectionItems[C]> } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const ready = enabled && data.revision !== null;
  const loading = ready && (result?.key !== requestKey || result.revision !== data.revision);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setError("");
    const timer = window.setTimeout(() => {
      collectionRequest<AdminCollectionPage<AdminCollectionItems[C]>>(requestKey, controller.signal).then(value => {
        if (controller.signal.aborted) return;
        if (page > Math.max(1, value.totalPages)) { setSelection({ key: filterKey, page: Math.max(1, value.totalPages), pageSize }); return; }
        setResult({ key: requestKey, revision: data.revision, value });
      }).catch((issue: unknown) => { if (!controller.signal.aborted) setError(issue instanceof Error ? issue.message : "Không thể tải danh sách."); });
    }, filters.query ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [ready, requestKey, data.revision, attempt, page, pageSize, filterKey, filters.query]);
  const value = result?.key === requestKey ? result.value : undefined;
  return { rows: value?.items ?? [], page, pageSize, pageCount: value?.totalPages ?? 0, total: value?.totalItems ?? 0, start: (page - 1) * pageSize,
    setPage: (next: number) => setSelection({ key: filterKey, page: next, pageSize }),
    setPageSize: (next: number) => setSelection({ key: filterKey, page: 1, pageSize: next }),
    loading: loading && !error, error, retry: () => { setError(""); setAttempt(value => value + 1); } };
}

export function useAdminRecord<C extends AdminCollectionName>(data: AdminData, collection: C, id: string | null | undefined, enabled = true) {
  const [result, setResult] = useState<{ key: string; revision: number | null; item: AdminCollectionItems[C] } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const key = `${collection}/${encodeURIComponent(id ?? "")}/`;
  const ready = enabled && !!id && data.revision !== null;
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setError("");
    collectionRequest<AdminCollectionDetail<AdminCollectionItems[C]>>(key, controller.signal).then(value => {
      if (!controller.signal.aborted) setResult({ key, revision: data.revision, item: value.item });
    }).catch((issue: unknown) => { if (!controller.signal.aborted) { setResult(null); setError(issue instanceof Error ? issue.message : "Không thể tải hồ sơ."); } });
    return () => controller.abort();
  }, [ready, key, data.revision, attempt]);
  return { item: ready && result?.key === key && result.revision === data.revision ? result.item : undefined, loading: ready && (result?.key !== key || result.revision !== data.revision) && !error, error: ready ? error : "", retry: () => { setError(""); setAttempt(value => value + 1); } };
}

/** Resolve only explicit relationships, in bounded batches; never enumerate a catalog. */
export function useRelatedCompanies(data: AdminData, ids: readonly (string | undefined)[], enabled = true) {
  const key = [...new Set(ids.filter((id): id is string => !!id))].sort().join(",");
  const [result, setResult] = useState<{ key: string; revision: number | null; items: AdminCollectionItems["companies"][] } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const ready = enabled && !!key && data.revision !== null;
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setError("");
    const selected = key.split(",");
    const batches: string[][] = [];
    for (let index = 0; index < selected.length; index += 100) batches.push(selected.slice(index, index + 100));
    Promise.all(batches.map(ids => collectionRequest<AdminCollectionPage<AdminCollectionItems["companies"]>>(`companies/?${queryString({ ids, pageSize: 100 })}`, controller.signal))).then(pages => {
      if (!controller.signal.aborted) setResult({ key, revision: data.revision, items: pages.flatMap(page => page.items) });
    }).catch((issue: unknown) => { if (!controller.signal.aborted) setError(issue instanceof Error ? issue.message : "Không thể tải doanh nghiệp liên quan."); });
    return () => controller.abort();
  }, [ready, key, data.revision, attempt]);
  return { items: ready && result?.key === key ? result.items : [], loading: ready && (result?.key !== key || result.revision !== data.revision) && !error, error: ready ? error : "", retry: () => { setError(""); setAttempt(value => value + 1); } };
}

export function CollectionFeedback({ state }: { state: { loading: boolean; error: string; retry: () => void } }) {
  return <>{state.loading && <LoadingIndicator label="Đang tải hồ sơ…"/>}{state.error && <Alert tone="error">{state.error} <Button variant="quiet" onClick={state.retry}>Thử lại</Button></Alert>}</>;
}

export function CompanyPicker({ data, name, defaultValue = "", required = false, label = "Doanh nghiệp", emptyLabel = "Chọn doanh nghiệp", value, onValueChange }: { data: AdminData; name?: string; defaultValue?: string; required?: boolean; label?: string; emptyLabel?: string; value?: string; onValueChange?: (value: string) => void }) {
  const [localValue, setLocalValue] = useState(defaultValue);
  const selectedId = value ?? localValue;
  const [query, setQuery] = useState("");
  const pages = useAdminCollection(data, "companies", { query });
  const selected = useAdminRecord(data, "companies", selectedId);
  const options = selected.item && !pages.rows.some(item => item.id === selectedId) ? [selected.item, ...pages.rows] : pages.rows;
  return <div className="company-picker">
    {name && <input type="hidden" name={name} value={selectedId}/>}
    <label>Tìm doanh nghiệp<Input type="search" value={query} maxLength={200} placeholder="Tìm tên, ngành hàng…" onChange={event => setQuery(event.target.value)}/></label>
    <CollectionFeedback state={pages}/><CollectionFeedback state={selected}/>
    <label>{label}<Select value={selectedId} required={required} onChange={event => { setLocalValue(event.target.value); onValueChange?.(event.target.value); }}>
      <option value="">{emptyLabel}</option>
      {selectedId && !options.some(item => item.id === selectedId) && <option value={selectedId} disabled>{selected.loading ? "Đang tải doanh nghiệp đã chọn…" : `Không tải được hồ sơ (${selectedId})`}</option>}
      {options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </Select></label>
    <AdminPagination state={pages} label="doanh nghiệp để chọn"/>
  </div>;
}
