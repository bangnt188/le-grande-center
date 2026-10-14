"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, PasswordField, TextField } from "@mall/ui";
import { useWebsiteSettings } from "@/features/public/website-settings";
import { authClient } from "./auth-client";

type Mode = "login" | "signup" | "verify" | "forgot" | "reset";
const titles: Record<Mode, string> = { login: "Đăng nhập quản trị", signup: "Tạo tài khoản", verify: "Xác minh email", forgot: "Khôi phục mật khẩu", reset: "Đặt mật khẩu mới" };
export default function AdminEntry() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(params.get("denied") ? "Email chưa xác minh hoặc tài khoản chưa được cấp quyền quản trị." : "");
  const [notice, setNotice] = useState("");
  const { logoUrl } = useWebsiteSettings();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    setPending(true); setError(""); setNotice("");
    try {
      if (mode === "login") {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) throw new Error(result.error.message || "Đăng nhập thất bại.");
        router.replace("/admin/workspace/"); router.refresh();
      } else if (mode === "signup") {
        const result = await authClient.signUp.email({ email, password, name: String(form.get("name") ?? "").trim() });
        if (result.error) throw new Error(result.error.message || "Không thể tạo tài khoản.");
        const sent = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
        if (sent.error) throw new Error(sent.error.message || "Không thể gửi mã xác minh.");
        setMode("verify"); setNotice("Kiểm tra email để lấy mã xác minh. Tạo tài khoản không tự cấp quyền quản trị.");
      } else if (mode === "verify") {
        const result = await authClient.emailOtp.verifyEmail({ email, otp: String(form.get("otp") ?? "").trim() });
        if (result.error) throw new Error(result.error.message || "Mã xác minh không hợp lệ.");
        setMode("login"); setNotice("Email đã xác minh. Đăng nhập bằng mật khẩu của bạn.");
      } else if (mode === "forgot") {
        const result = await authClient.emailOtp.requestPasswordReset({ email });
        if (result.error) throw new Error(result.error.message || "Không thể gửi yêu cầu khôi phục.");
        setMode("reset"); setNotice("Nếu tài khoản tồn tại, mã khôi phục đã được gửi đến email.");
      } else {
        const result = await authClient.emailOtp.resetPassword({ email, otp: String(form.get("otp") ?? "").trim(), password });
        if (result.error) throw new Error(result.error.message || "Mã khôi phục không hợp lệ hoặc đã hết hạn.");
        setMode("login"); router.replace("/admin/"); setNotice("Mật khẩu đã cập nhật. Vui lòng đăng nhập.");
      }
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Không thể kết nối dịch vụ đăng nhập."); }
    finally { setPending(false); }
  }
  async function sendCode() {
    if (!email || pending) return;
    setPending(true); setError("");
    try {
      const result = mode === "reset" ? await authClient.emailOtp.requestPasswordReset({ email }) : await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
      if (result.error) throw new Error(result.error.message || "Không thể gửi mã.");
      if (mode !== "reset") setMode("verify"); setNotice("Mã đã được gửi đến email.");
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Không thể gửi mã."); }
    finally { setPending(false); }
  }
  async function googleLogin() {
    if (pending) return;
    setPending(true); setError("");
    try { const result = await authClient.signIn.social({ provider: "google", callbackURL: `${window.location.origin}/admin/workspace/` }); if (result.error) throw new Error(result.error.message || "Không thể đăng nhập Google."); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "Không thể đăng nhập Google."); setPending(false); }
  }
  return <main className="legrande-admin admin-login" data-ui-root data-ui-theme="shopping-mall" data-ui-scheme="light">
    <section className="admin-login-brand" aria-label="Le Grande Centre">{logoUrl && <img src={logoUrl} alt="" width={72} height={72}/>}<div><h2>Le Grande Centre</h2><p>Không gian quản trị khai thác</p></div><p className="admin-login-intro">Mặt bằng, doanh nghiệp và hồ sơ thuê trong một không gian làm việc.</p><Link href="/">Về website</Link></section>
    <section className="admin-login-panel" aria-labelledby="admin-login-title"><h1 id="admin-login-title">{titles[mode]}</h1><p>Dành cho nhân sự được cấp quyền Le Grande Centre.</p>
      <form className="admin-login-form" onSubmit={submit}>
        <TextField id="admin-email" name="email" type="email" label="Email" size="lg" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} value={email} onChange={event => setEmail(event.target.value.trim())}/>
        {mode === "signup" && <TextField id="admin-name" name="name" label="Họ và tên" required maxLength={100} autoComplete="name"/>}
        {(mode === "login" || mode === "signup" || mode === "reset") && <PasswordField id="admin-password" name="password" label={mode === "reset" ? "Mật khẩu mới" : "Mật khẩu"} size="lg" showLabel="Hiện mật khẩu" hideLabel="Ẩn mật khẩu" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? 1 : 8} maxLength={128} required/>}
        {(mode === "verify" || mode === "reset") && <TextField id="admin-otp" name="otp" label={mode === "reset" ? "Mã khôi phục mật khẩu" : "Mã xác minh email"} inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={8}/>}
        <Button size="lg" type="submit" disabled={pending} loading={pending} loadingLabel="Đang xử lý">{titles[mode]}</Button>
      </form>
      {mode === "login" && <Button variant="secondary" disabled={pending} onClick={() => void googleLogin()}>Đăng nhập bằng Google</Button>}
      {error && <p role="alert" className="admin-login-error">{error}</p>}{notice && <p role="status" className="admin-login-note">{notice}</p>}
      <div className="admin-login-links">{mode !== "login" && <Button variant="quiet" disabled={pending} onClick={() => { setMode("login"); setError(""); }}>Trở lại đăng nhập</Button>}{mode === "login" && <><Button variant="quiet" disabled={pending} onClick={() => setMode("forgot")}>Quên mật khẩu</Button><Button variant="quiet" disabled={pending} onClick={() => setMode("signup")}>Chưa có tài khoản</Button></>}<Button variant="quiet" disabled={pending || !email} onClick={() => void sendCode()}>{mode === "reset" ? "Gửi lại mã khôi phục" : mode === "verify" ? "Gửi lại mã xác minh" : "Xác minh email"}</Button></div>
      <p className="admin-login-note">Quyền truy cập được kiểm tra trên máy chủ theo email đã xác minh và hồ sơ nhân sự. Không có mật khẩu dùng thử hoặc quyền tự chọn.</p>
    </section>
  </main>;
}
