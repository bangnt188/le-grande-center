"use client";

import NextLink from "next/link";
import { useId, useState } from "react";
import { AdminPanel, Button, Input, Select, Textarea, type ToastTone } from "@mall/ui";
import type { WebsiteSettings } from "@/shared/admin/website-settings";
import { AdminEditor } from "./admin-editor";
import type { AdminData } from "./use-admin-data";
import styles from "./admin-records.module.css";

const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export function WebsiteSettingsPanel({ data, onMessage }: {
  data: AdminData;
  onMessage: (message: string, tone?: ToastTone) => void;
}) {
  const [editing, setEditing] = useState(false);
  const zaloNoteId = useId();
  const website = data.settings?.website;
  const currentLogo = data.media.find(item => item.id === website?.logoMediaId);
  return <AdminPanel className={`records-panel ${styles.detail}`}>
    <div className={styles.heading}>
      <h2>Cấu hình website</h2>
      <Button disabled={!website || data.pending || data.loading} onClick={() => setEditing(true)}>Sửa cấu hình website</Button>
    </div>
    <p>Thông tin liên hệ được công bố từ hệ thống. Logo chỉ lưu trong Neon Object Storage; không lưu trong trình duyệt hoặc R2.</p>
    {website && <dl className={styles.facts}>
      <dt>Logo hiện tại</dt><dd>{currentLogo ? <><img src={currentLogo.url} alt="Logo website hiện tại" width={160} height={96} style={{ objectFit: "contain", maxWidth: "100%" }}/><span className={styles.secondary}>{currentLogo.name}</span></> : "Chưa chọn logo Neon."}</dd>
      <dt>Email</dt><dd>{website.email}</dd>
      <dt>Hotline</dt><dd>{website.hotline}</dd>
      <dt>Điện thoại bổ sung</dt><dd>{website.secondaryPhone || "Không sử dụng"}</dd>
      <dt>Điện thoại ban quản lý</dt><dd>{website.managementPhone || "Không sử dụng"}</dd>
      <dt>Địa chỉ</dt><dd>{website.address}</dd>
      <dt>Đường dẫn Zalo</dt><dd>{website.zaloUrl}</dd>
    </dl>}
    <div className={styles.actions}><NextLink href="/" target="_blank" rel="noopener noreferrer">Mở website<span className="sr-only"> (tab mới)</span></NextLink></div>
    {website && <label>Tải logo lên Neon<Input type="file" accept="image/png,image/jpeg,image/webp" disabled={data.pending || data.loading} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void data.uploadFiles([file], "Toàn dự án").then(saved => { if (saved) onMessage("Đã lưu ảnh vào Neon. Chọn ảnh trong cấu hình để công bố."); }); }}/></label>}
    {editing && website && <AdminEditor data={data} title="Cấu hình website" description="Lưu thông tin liên hệ công khai và chọn logo được lưu trên Neon." onClose={() => setEditing(false)} onSave={async form => {
      const values: WebsiteSettings = {
        logoMediaId: field(form, "logoMediaId"), email: field(form, "email"), hotline: field(form, "hotline"),
        secondaryPhone: field(form, "secondaryPhone"), managementPhone: field(form, "managementPhone"),
        address: field(form, "address"), zaloUrl: field(form, "zaloUrl"),
      };
      const saved = await data.execute({ type: "update-website-settings", values });
      if (saved) onMessage("Đã lưu cấu hình website trên hệ thống.");
      return saved;
    }}>
      <label>Logo website<Select name="logoMediaId" defaultValue={website.logoMediaId} required>{data.media.filter(item => item.kind === "Ảnh" && item.hasUploadedFile).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}{currentLogo && !currentLogo.hasUploadedFile && <option value={currentLogo.id}>{currentLogo.name}</option>}</Select></label>
      <p className={styles.secondary}>Chỉ chọn ảnh đã được máy chủ xử lý và lưu trong Neon. Logo được công bố khi lưu cấu hình.</p>
      <label>Email liên hệ website<Input name="email" type="email" required maxLength={254} defaultValue={website.email}/></label>
      <label>Hotline website<Input name="hotline" type="tel" required maxLength={32} defaultValue={website.hotline}/></label>
      <label>Điện thoại bổ sung (không bắt buộc)<Input name="secondaryPhone" type="tel" maxLength={32} defaultValue={website.secondaryPhone}/></label>
      <label>Điện thoại ban quản lý (không bắt buộc)<Input name="managementPhone" type="tel" maxLength={32} defaultValue={website.managementPhone}/></label>
      <label>Địa chỉ liên hệ<Textarea name="address" required maxLength={400} defaultValue={website.address}/></label>
      <label>Đường dẫn Zalo<Input name="zaloUrl" type="url" required maxLength={240} defaultValue={website.zaloUrl} aria-describedby={zaloNoteId}/></label>
      <p id={zaloNoteId} className={styles.secondary}>Nhập đường dẫn tài khoản cụ thể dạng https://zalo.me/…; không tự tạo từ số hotline. Nút Zalo mở tài khoản này, không tự động gọi điện.</p>
    </AdminEditor>}
  </AdminPanel>;
}
