"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { AdminPanel, Alert, Badge, Button, Input, Select, type ToastTone } from "@mall/ui";
import { adminRequest, ensureSession, useAdminSession } from "./session";
import { makeCacheKey, screenCache } from "./memory-cache";
import styles from "./staff-accounts.module.css";

type StaffAccount = {
  id: string;
  email: string;
  role: "administrator" | "editor";
  status: "revoked" | "invited" | "active";
};
const roleLabels = { administrator: "Admin", editor: "Editor" } as const;
const statusLabels = { revoked: "Đã thu hồi", invited: "Chưa kích hoạt", active: "Đang hoạt động" } as const;
const statusTones: Record<StaffAccount["status"], "neutral" | "warning" | "success"> = { revoked: "neutral", invited: "warning", active: "success" };

export function StaffAccountsPanel({ onMessage }: { onMessage: (message: string, tone?: ToastTone) => void }) {
  const session = useAdminSession();
  const identity = session ? JSON.stringify([session.actorId, session.propertyId, session.role]) : "";
  const key = makeCacheKey(identity, "", "staff");
  const cacheVersion = useSyncExternalStore(screenCache.subscribe, screenCache.getVersion, screenCache.getVersion);
  const [result, setResult] = useState<{ key: string; version: number; items: StaffAccount[] } | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffAccount["role"]>("editor");
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [actionError, setActionError] = useState("");
  useEffect(() => {
    if (!identity) return;
    const controller = new AbortController();
    setFailure(null);
    screenCache.load(key, async signal => {
      const response = await adminRequest("/api/admin/staff/", {}, { signal });
      const items: unknown = await response.json();
      if (!Array.isArray(items) || !items.every(item => item && typeof item.id === "string" && typeof item.email === "string" && (item.role === "administrator" || item.role === "editor") && (item.status === "active" || item.status === "revoked" || item.status === "invited"))) throw new Error("Dữ liệu tài khoản không hợp lệ.");
      return { items: items as StaffAccount[], revision: 0 };
    }, controller.signal).then(value => { if (!controller.signal.aborted) setResult({ key, version: cacheVersion, items: value.items }); }).catch(issue => { if (!controller.signal.aborted) setFailure({ key, message: issue instanceof Error ? issue.message : "Không tải được danh sách tài khoản." }); });
    return () => controller.abort();
  }, [identity, key, cacheVersion]);
  const accounts = result?.key === key && result.version === cacheVersion ? result.items : null;
  const error = actionError || (!identity ? "Phiên quản trị đã hết hạn. Thao tác để tiếp tục." : failure?.key === key ? failure.message : "");
  const loading = !!identity && !accounts && !error;
  async function action(change: () => void) {
    try { await ensureSession({ userAction: true }); setActionError(""); change(); }
    catch (issue) { setActionError(issue instanceof Error ? issue.message : "Không thể thực hiện thao tác."); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setPending(true);
    try {
      const response = await adminRequest("/api/admin/staff/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role }) }, { userAction: true });
      const saved: StaffAccount = await response.json();
      setEmail(""); setActionError(""); screenCache.markAllStale();
      onMessage(saved.status === "invited" ? "Đã cấp quyền. Nhân viên có thể tạo mật khẩu tại trang đăng nhập admin." : "Đã cập nhật vai trò tài khoản.");
    } catch (issue) { setActionError(issue instanceof Error ? issue.message : "Không lưu được tài khoản."); }
    finally { lock.current = false; setPending(false); }
  }
  async function revoke(account: StaffAccount) {
    if (lock.current) return;
    lock.current = true; setPending(true);
    try {
      await adminRequest("/api/admin/staff/", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: account.email }) }, { userAction: true });
      setActionError(""); screenCache.markAllStale(); onMessage(`Đã thu hồi quyền của ${account.email}.`);
    } catch (issue) { setActionError(issue instanceof Error ? issue.message : "Không thu hồi được tài khoản."); }
    finally { lock.current = false; setPending(false); }
  }
  return <AdminPanel className={`records-panel ${styles.panel}`}>
    <div className={styles.heading}><div><h2>Tài khoản nhân viên</h2><p>Thêm email và chọn vai trò. Nhân viên tự tạo mật khẩu tại trang đăng nhập; tài khoản root được bảo vệ và ẩn khỏi danh sách này.</p></div></div>
    <form className={styles.form} onSubmit={save}>
      <label>Email nhân viên<Input type="email" value={email} onChange={event => { const next = event.target.value; void action(() => setEmail(next)); }} placeholder="nhanvien@example.com" maxLength={254} autoComplete="off" required disabled={pending}/></label>
      <label>Vai trò<Select value={role} onChange={event => { const next = event.target.value as StaffAccount["role"]; void action(() => setRole(next)); }} disabled={pending}><option value="editor">Editor (Biên tập)</option><option value="administrator">Admin (Quản trị)</option></Select></label>
      <div className={styles.formAction}><Button type="submit" variant="primary" loading={pending} disabled={pending}>Cấp quyền</Button></div>
    </form>
    {error && <Alert tone="error">{error}</Alert>}
    <div className={styles.listSection}><div className={styles.listHeader}><h3>Danh sách tài khoản {accounts && `(${accounts.length})`}</h3><Button variant="quiet" disabled={pending} onClick={() => void action(() => screenCache.markAllStale())}>Tải lại tài khoản</Button></div>
      {loading ? <p role="status" className={styles.loading}>Đang tải danh sách tài khoản…</p> : accounts?.length === 0 ? <div className={styles.empty}><p>Chưa có tài khoản nhân viên nào được cấp quyền.</p><span>Nhập email và chọn vai trò ở trên để phân quyền nhân viên mới.</span></div> : accounts && <ul className={styles.list}>{accounts.map(account => <li key={account.id} className={styles.item}><div className={styles.accountInfo}><strong className={styles.accountEmail}>{account.email}</strong><div className={styles.badges}><Badge tone={account.role === "administrator" ? "action" : "neutral"}>{roleLabels[account.role]}</Badge><Badge tone={statusTones[account.status]}>{statusLabels[account.status]}</Badge></div></div><div className={styles.actions}>{account.status === "revoked" ? <Button variant="secondary" disabled={pending} onClick={() => void action(() => { setEmail(account.email); setRole(account.role); })}>Cấp lại</Button> : <Button variant="quiet" disabled={pending} onClick={() => void revoke(account)}>Thu hồi</Button>}</div></li>)}</ul>}
    </div>
  </AdminPanel>;
}
