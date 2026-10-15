"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AdminPanel, Alert, Badge, Button, Input, Select, type ToastTone } from "@mall/ui";
import styles from "./staff-accounts.module.css";

type StaffAccount = {
  id: string;
  email: string;
  role: "administrator" | "editor";
  status: "revoked" | "invited" | "active";
};

const roleLabels = {
  administrator: "Admin",
  editor: "Editor",
} as const;

const statusLabels = {
  revoked: "Đã thu hồi",
  invited: "Chưa kích hoạt",
  active: "Đang hoạt động",
} as const;

const statusTones: Record<StaffAccount["status"], "neutral" | "warning" | "success"> = {
  revoked: "neutral",
  invited: "warning",
  active: "success",
};

export function StaffAccountsPanel({ onMessage }: { onMessage: (message: string, tone?: ToastTone) => void }) {
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffAccount["role"]>("editor");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function reload(signal?: AbortSignal) {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/staff", { cache: "no-store", signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không tải được danh sách tài khoản.");
      setAccounts(result);
      setError("");
    } catch (issue) {
      if (issue instanceof DOMException && issue.name === "AbortError") return;
      setError(issue instanceof Error ? issue.message : "Không tải được danh sách tài khoản.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không lưu được tài khoản.");
      setEmail("");
      await reload();
      onMessage(
        result.status === "invited"
          ? "Đã cấp quyền. Nhân viên có thể tạo mật khẩu tại trang đăng nhập admin."
          : "Đã cập nhật vai trò tài khoản."
      );
    } catch (issue) {
      onMessage(issue instanceof Error ? issue.message : "Không lưu được tài khoản.", "error");
    } finally {
      setPending(false);
    }
  }

  async function revoke(account: StaffAccount) {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch("/api/admin/staff", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: account.email }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "Không thu hồi được tài khoản.");
      }
      await reload();
      onMessage(`Đã thu hồi quyền của ${account.email}.`);
    } catch (issue) {
      onMessage(issue instanceof Error ? issue.message : "Không thu hồi được tài khoản.", "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <AdminPanel className={`records-panel ${styles.panel}`}>
      <div className={styles.heading}>
        <div>
          <h2>Tài khoản nhân viên</h2>
          <p>
            Thêm email và chọn vai trò. Nhân viên tự tạo mật khẩu tại trang đăng nhập; tài khoản root được bảo vệ và ẩn khỏi danh sách này.
          </p>
        </div>
      </div>

      <form className={styles.form} onSubmit={save}>
        <label>
          Email nhân viên
          <Input
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="nhanvien@example.com"
            maxLength={254}
            autoComplete="off"
            required
            disabled={pending}
          />
        </label>
        <label>
          Vai trò
          <Select
            value={role}
            onChange={event => setRole(event.target.value as StaffAccount["role"])}
            disabled={pending}
          >
            <option value="editor">Editor (Biên tập)</option>
            <option value="administrator">Admin (Quản trị)</option>
          </Select>
        </label>
        <div className={styles.formAction}>
          <Button type="submit" variant="primary" loading={pending} disabled={pending}>
            Cấp quyền
          </Button>
        </div>
      </form>

      {error && <Alert tone="error">{error}</Alert>}

      <div className={styles.listSection}>
        <div className={styles.listHeader}>
          <h3>Danh sách tài khoản {!loading && `(${accounts.length})`}</h3>
        </div>

        {loading ? (
          <p role="status" className={styles.loading}>
            Đang tải danh sách tài khoản…
          </p>
        ) : accounts.length === 0 ? (
          <div className={styles.empty}>
            <p>Chưa có tài khoản nhân viên nào được cấp quyền.</p>
            <span>Nhập email và chọn vai trò ở trên để phân quyền nhân viên mới.</span>
          </div>
        ) : (
          <ul className={styles.list}>
            {accounts.map(account => (
              <li key={account.id} className={styles.item}>
                <div className={styles.accountInfo}>
                  <strong className={styles.accountEmail}>{account.email}</strong>
                  <div className={styles.badges}>
                    <Badge tone={account.role === "administrator" ? "action" : "neutral"}>
                      {roleLabels[account.role]}
                    </Badge>
                    <Badge tone={statusTones[account.status]}>
                      {statusLabels[account.status]}
                    </Badge>
                  </div>
                </div>
                <div className={styles.actions}>
                  {account.status === "revoked" ? (
                    <Button
                      variant="secondary"
                      disabled={pending}
                      onClick={() => {
                        setEmail(account.email);
                        setRole(account.role);
                      }}
                    >
                      Cấp lại
                    </Button>
                  ) : (
                    <Button
                      variant="quiet"
                      disabled={pending}
                      onClick={() => void revoke(account)}
                    >
                      Thu hồi
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminPanel>
  );
}
