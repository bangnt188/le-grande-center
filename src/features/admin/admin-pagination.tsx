"use client";

import { useEffect, useState } from "react";
import { Pagination, Select } from "@mall/ui";

export function useAdminPagination<T>(items: readonly T[], resetKey: string, initialSize = 5) {
  const [requestedPage, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  useEffect(() => { setPage(1); }, [resetKey]);
  const pageCount = Math.ceil(items.length / pageSize);
  const page = Math.min(Math.max(requestedPage, 1), Math.max(pageCount, 1));
  const start = (page - 1) * pageSize;
  return { rows: items.slice(start, start + pageSize), page, pageCount, pageSize, total: items.length, start, setPage,
    setPageSize: (size: number) => { setPageSize(size); setPage(1); } };
}
export type AdminPaginationState = Omit<ReturnType<typeof useAdminPagination<unknown>>, "rows">;
export function AdminPagination({ state, label }: { state: AdminPaginationState; label: string }) {
  return <div className="admin-pagination">
    <span className="admin-pagination-summary" aria-live="polite">{state.total ? `${state.start + 1}–${Math.min(state.start + state.pageSize, state.total)}` : "0"} / {state.total} bản ghi</span>
    <label className="admin-page-size"><span>Số dòng</span><Select size="sm" aria-label={`Số dòng ${label}`} value={state.pageSize} onChange={event => state.setPageSize(Number(event.target.value))}>{[2, 5, 10, 20].map(size => <option key={size} value={size}>{size}</option>)}</Select></label>
    <Pagination label={`Phân trang ${label}`} page={state.page} pageCount={state.pageCount} onPageChange={state.setPage} previousLabel="Trước" nextLabel="Sau"/>
  </div>;
}
