"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import { Badge, Button, PasswordField, TextField, LoadingIndicator } from "@mall/ui";
import { adminLogoUrl } from "./demo/data";

// Presentation-only demo entry. Never use this marker as production authorization.
export const ADMIN_DEMO_ENTRY_KEY = "legrande-admin-demo-entry";

export default function AdminDemoEntry({ children }: { children?: ReactNode }) {
  const router = useRouter();
  const [entered, setEntered] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!children) return;
    if (sessionStorage.getItem(ADMIN_DEMO_ENTRY_KEY) === "1") setEntered(true);
    else router.replace("/admin-preview/");
  }, [children, router]);
  function enter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const username = event.currentTarget.elements.namedItem("username");
    if (!(username instanceof HTMLInputElement)) return;
    if (!username.value.trim()) { setError("Nhập tên đăng nhập để vào bản demo."); username.focus(); return; }
    try {
      sessionStorage.setItem(ADMIN_DEMO_ENTRY_KEY, "1");
      router.push("/admin-preview/workspace/");
    } catch {
      setError("Trình duyệt đang chặn lưu phiên demo. Cho phép lưu trữ cho trang này rồi thử lại.");
    }
  }
  if (children) return entered ? children : <div className="admin-entry-loading"><LoadingIndicator label="Đang mở quản trị…"/></div>;
  return <main className="legrande-admin admin-demo-login" data-ui-root data-ui-theme="shopping-mall" data-ui-scheme="light">
    <section className="admin-login-brand" aria-label="Le Grande Centre">
      <img src={adminLogoUrl} alt="" width={72} height={72}/>
      <div><h2>Le Grande Centre</h2><p>Không gian quản trị khai thác</p></div>
      <p className="admin-login-intro">Mặt bằng, doanh nghiệp và hồ sơ thuê trong một không gian làm việc.</p>
      <Link href="/">Về website</Link>
    </section>
    <section className="admin-login-panel" aria-labelledby="admin-login-title">
      <Badge tone="warning">Bản demo quản trị</Badge>
      <h1 id="admin-login-title">Đăng nhập quản trị</h1>
      <p>Dành cho đội vận hành Le Grande Centre.</p>
      <form className="admin-login-form" onSubmit={enter} onInput={() => { if (error) setError(""); }}>
        <TextField id="admin-username" name="username" label="Tên đăng nhập" size="lg" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Tên đăng nhập" required aria-describedby="admin-demo-note"/>
        <PasswordField id="admin-password" name="password" label="Mật khẩu" size="lg" showLabel="Hiện mật khẩu" hideLabel="Ẩn mật khẩu" autoComplete="current-password" placeholder="Mật khẩu" required aria-describedby="admin-demo-note"/>
        <Button size="lg" type="submit">Đăng nhập<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg></Button>
      </form>
      {error && <p role="alert" className="admin-login-error">{error}</p>}
      <p id="admin-demo-note" className="admin-login-note">Tên đăng nhập demo: <strong>admin</strong><br/>Mật khẩu demo: <strong>demo123</strong><br/>Không phải tài khoản thật; thông tin đăng nhập không được lưu hoặc gửi. Dữ liệu thử nghiệm đã lưu nằm trên trình duyệt này, chưa có DB/phân quyền. Không nhập thông tin nhạy cảm thật.</p>
    </section>
  </main>;
}
