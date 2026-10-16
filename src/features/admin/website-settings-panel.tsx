"use client";

import NextLink from "next/link";
import { useEffect, useId, useState } from "react";
import { AdminPanel, Alert, Button, Input, LoadingIndicator, Select, Textarea, type ToastTone } from "@mall/ui";
import type { WebsiteSettings } from "@/shared/admin/website-settings";
import type { AdminMediaDetail, AdminMediaPage } from "@/shared/admin/contracts";
import { AdminEditor } from "./admin-editor";
import { AdminPagination } from "./admin-pagination";
import type { AdminData } from "./use-admin-data";
import { adminRequest, ensureSession } from "./session";
import { makeCacheKey, screenCache } from "./memory-cache";
import { parseMediaDetail, parseMediaPage } from "./http-repository";
import styles from "./admin-records.module.css";

const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export function WebsiteSettingsPanel({ data, onMessage }: { data: AdminData; onMessage: (message: string, tone?: ToastTone) => void }) {
  const [editing, setEditing] = useState<{ website: WebsiteSettings; revision: number } | null>(null);
  const [selectedLogo, setSelectedLogo] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState(false);
  const [actionError, setActionError] = useState("");
  const [logoFailure, setLogoFailure] = useState<{ key: string; message: string } | null>(null);
  const [pageFailure, setPageFailure] = useState<{ key: string; message: string } | null>(null);
  const [logoResult, setLogoResult] = useState<{ key: string; version: number; value: AdminMediaDetail } | null>(null);
  const [pageResult, setPageResult] = useState<{ key: string; version: number; value: AdminMediaPage } | null>(null);
  const [uploading, setUploading] = useState(false);
  const zaloNoteId = useId();
  const website = editing?.website ?? data.settings?.website;
  const logoId = website?.logoMediaId;
  const logoKey = makeCacheKey(data.sessionKey, "", "media-detail", { id: logoId });
  const mediaKey = makeCacheKey(data.sessionKey, "", "media", { source: "uploaded", kind: "Ảnh", query, page, pageSize: 20 });
  useEffect(() => {
    if (!logoId) return;
    const controller = new AbortController();
    setLogoFailure(null);
    screenCache.load(logoKey, async signal => parseMediaDetail(await (await adminRequest(`/api/admin/media/${encodeURIComponent(logoId)}/`, {}, { signal })).json()), controller.signal).then(value => { if (!controller.signal.aborted) setLogoResult({ key: logoKey, version: data.cacheVersion, value }); }).catch(issue => { if (!controller.signal.aborted) setLogoFailure({ key: logoKey, message: issue instanceof Error ? issue.message : "Không tải được thông tin logo." }); });
    return () => controller.abort();
  }, [logoId, logoKey, data.cacheVersion]);
  useEffect(() => {
    if (!editing) return;
    const controller = new AbortController();
    setPageFailure(null);
    const params = new URLSearchParams({ source: "uploaded", kind: "Ảnh", page: String(page), pageSize: "20", ...(query ? { query } : {}) });
    screenCache.load(mediaKey, async signal => parseMediaPage(await (await adminRequest(`/api/admin/media/?${params}`, {}, { signal })).json()), controller.signal).then(value => { if (!controller.signal.aborted) setPageResult({ key: mediaKey, version: data.cacheVersion, value }); }).catch(issue => { if (!controller.signal.aborted) setPageFailure({ key: mediaKey, message: issue instanceof Error ? issue.message : "Không tải được danh sách logo." }); });
    return () => controller.abort();
  }, [!!editing, mediaKey, page, query, data.cacheVersion]);
  const currentLogo = logoResult?.key === logoKey && logoResult.version === data.cacheVersion ? logoResult.value.item : null;
  const mediaPage = pageResult?.key === mediaKey && pageResult.version === data.cacheVersion ? pageResult.value : null;
  const logoError = logoFailure?.key === logoKey ? logoFailure.message : "";
  const pageError = pageFailure?.key === mediaKey ? pageFailure.message : "";
  async function action(change: () => void) {
    try { await ensureSession({ userAction: true }); setActionError(""); change(); }
    catch (issue) { setActionError(issue instanceof Error ? issue.message : "Không thể thực hiện thao tác."); }
  }
  async function upload(file: File) {
    if (uploading) return;
    setUploading(true);
    try {
      const response = await adminRequest("/api/admin/media/?source=uploaded&kind=%E1%BA%A2nh&page=1&pageSize=1", {}, { userAction: true });
      const source = parseMediaPage(await response.json());
      if (await data.uploadFiles([file], "Toàn dự án", source.revision)) onMessage("Đã lưu ảnh vào Neon. Mở cấu hình và chọn ảnh để công bố.");
    } catch (issue) { setActionError(issue instanceof Error ? issue.message : "Không tải được logo."); }
    finally { setUploading(false); }
  }
  const options = mediaPage?.items.filter(item => item.kind === "Ảnh" && item.hasUploadedFile) ?? [];
  return <AdminPanel className={`records-panel ${styles.detail}`}>
    <div className={styles.heading}><h2>Cấu hình website</h2><Button disabled={!website || data.pending || data.loading || uploading} onClick={() => { const revision = data.screenData?.revision; if (website && revision != null) void action(() => { setEditing({ website, revision }); setSelectedLogo(website.logoMediaId); setQuery(""); setPage(1); }); }}>Sửa cấu hình website</Button></div>
    <p>Thông tin liên hệ được công bố từ hệ thống. Logo được lưu trong Neon Object Storage, không lưu dữ liệu riêng tư trong trình duyệt.</p>
    {actionError && <Alert tone="error">{actionError}</Alert>}
    {website && <dl className={styles.facts}>
      <dt>Logo hiện tại</dt><dd>{currentLogo ? <><span>{currentLogo.name}</span>{currentLogo.url && <Button variant="quiet" onClick={() => void action(() => setPreview(value => !value))}>{preview ? "Ẩn logo" : "Xem logo"}</Button>}{preview && currentLogo.url && <img src={currentLogo.url} alt="Logo website hiện tại" width={160} height={96} style={{ objectFit: "contain", maxWidth: "100%" }}/>}</> : logoError ? <Alert tone="error">{logoError} <Button variant="quiet" onClick={() => void action(() => screenCache.markAllStale())}>Thử lại</Button></Alert> : <span role="status">Đang tải thông tin logo…</span>}</dd>
      <dt>Email</dt><dd>{website.email}</dd><dt>Hotline</dt><dd>{website.hotline}</dd><dt>Điện thoại bổ sung</dt><dd>{website.secondaryPhone || "Không sử dụng"}</dd><dt>Điện thoại ban quản lý</dt><dd>{website.managementPhone || "Không sử dụng"}</dd><dt>Địa chỉ</dt><dd>{website.address}</dd><dt>Đường dẫn Zalo</dt><dd>{website.zaloUrl}</dd>
    </dl>}
    <div className={styles.actions}><NextLink href="/" target="_blank" rel="noopener noreferrer">Mở website<span className="sr-only"> (tab mới)</span></NextLink></div>
    {website && <label>Tải logo lên Neon<Input type="file" accept="image/png,image/jpeg,image/webp" disabled={!!editing || data.pending || data.loading || uploading} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void upload(file); }}/>{uploading && <LoadingIndicator label="Đang tải logo…"/>}</label>}
    {editing && <AdminEditor data={data} title="Cấu hình website" description="Lưu thông tin liên hệ công khai và chọn logo đã lưu trên Neon." onClose={() => setEditing(null)} onSave={async form => {
      const values: WebsiteSettings = { logoMediaId: field(form, "logoMediaId"), email: field(form, "email"), hotline: field(form, "hotline"), secondaryPhone: field(form, "secondaryPhone"), managementPhone: field(form, "managementPhone"), address: field(form, "address"), zaloUrl: field(form, "zaloUrl") };
      const saved = await data.execute({ type: "update-website-settings", values }, editing.revision);
      if (saved) onMessage("Đã lưu cấu hình website trên hệ thống.");
      return saved;
    }}>
      <label>Tìm logo<Input type="search" maxLength={200} value={query} placeholder="Tìm ảnh đã tải lên…" onChange={event => { const next = event.target.value; void action(() => { setQuery(next); setPage(1); }); }}/></label>
      {!mediaPage && !pageError && <LoadingIndicator label="Đang tải danh sách logo…"/>}
      {pageError && <Alert tone="error">{pageError} <Button variant="quiet" type="button" onClick={() => void action(() => screenCache.markAllStale())}>Thử lại</Button></Alert>}
      <label>Logo website<Select name="logoMediaId" value={selectedLogo} required onChange={event => { const next = event.target.value; void action(() => setSelectedLogo(next)); }}>{!options.some(item => item.id === selectedLogo) && <option value={selectedLogo}>{selectedLogo === currentLogo?.id ? currentLogo.name : selectedLogo === editing.website.logoMediaId ? "Logo đang công bố" : selectedLogo}</option>}{options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>
      <AdminPagination state={{ page: mediaPage?.page ?? page, pageSize: 20, pageCount: mediaPage?.totalPages ?? 0, total: mediaPage?.totalItems ?? 0, start: (page - 1) * 20, setPage: next => void action(() => setPage(next)) }} label="ảnh logo"/>
      <p className={styles.secondary}>Chỉ chọn ảnh đã được máy chủ xử lý và lưu trong Neon. Logo được công bố khi lưu cấu hình.</p>
      <label>Email liên hệ website<Input name="email" type="email" required maxLength={254} defaultValue={editing.website.email}/></label><label>Hotline website<Input name="hotline" type="tel" required maxLength={32} defaultValue={editing.website.hotline}/></label><label>Điện thoại bổ sung (không bắt buộc)<Input name="secondaryPhone" type="tel" maxLength={32} defaultValue={editing.website.secondaryPhone}/></label><label>Điện thoại ban quản lý (không bắt buộc)<Input name="managementPhone" type="tel" maxLength={32} defaultValue={editing.website.managementPhone}/></label><label>Địa chỉ liên hệ<Textarea name="address" required maxLength={400} defaultValue={editing.website.address}/></label><label>Đường dẫn Zalo<Input name="zaloUrl" type="url" required maxLength={240} defaultValue={editing.website.zaloUrl} aria-describedby={zaloNoteId}/></label><p id={zaloNoteId} className={styles.secondary}>Nhập đường dẫn tài khoản cụ thể dạng https://zalo.me/…; không tự tạo từ số hotline.</p>
    </AdminEditor>}
  </AdminPanel>;
}
