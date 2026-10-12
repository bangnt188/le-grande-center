"use client";

import NextLink from "next/link";
import { useId, useState } from "react";
import { AdminPanel, Button, Input, Textarea, type ToastTone } from "@mall/ui";
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
    <p>Thông tin liên hệ dùng thử chỉ áp dụng trong trình duyệt này. Tải/chọn logo mới tạm khóa; logo hiện tại được giữ nguyên đến khi có luồng lưu an toàn vào Neon.</p>
    {website && <dl className={styles.facts}>
      <dt>Logo hiện tại</dt><dd>{currentLogo ? <><img src={currentLogo.url} alt="Logo website hiện tại" width={160} height={96} style={{ objectFit: "contain", maxWidth: "100%" }}/><span className={styles.secondary}>{currentLogo.name}</span></> : "Không tìm thấy logo; website vẫn giữ ảnh dự phòng."}</dd>
      <dt>Email</dt><dd>{website.email}</dd>
      <dt>Hotline</dt><dd>{website.hotline}</dd>
      <dt>Điện thoại bổ sung</dt><dd>{website.secondaryPhone || "Không sử dụng"}</dd>
      <dt>Điện thoại ban quản lý</dt><dd>{website.managementPhone || "Không sử dụng"}</dd>
      <dt>Địa chỉ</dt><dd>{website.address}</dd>
      <dt>Đường dẫn Zalo</dt><dd>{website.zaloUrl}</dd>
    </dl>}
    <div className={styles.actions}><NextLink href="/" target="_blank" rel="noopener noreferrer">Mở website<span className="sr-only"> (tab mới)</span></NextLink></div>
    {editing && website && <AdminEditor data={data} title="Cấu hình website" description="Lưu thông tin liên hệ cho bản xem thử trong trình duyệt này. Logo hiện tại được giữ nguyên cho đến khi có luồng Neon được bảo vệ bằng xác thực thật." onClose={() => setEditing(false)} onSave={async form => {
      const values: WebsiteSettings = {
        logoMediaId: field(form, "logoMediaId"), email: field(form, "email"), hotline: field(form, "hotline"),
        secondaryPhone: field(form, "secondaryPhone"), managementPhone: field(form, "managementPhone"),
        address: field(form, "address"), zaloUrl: field(form, "zaloUrl"),
      };
      const saved = await data.execute({ type: "update-website-settings", values });
      if (saved) onMessage("Đã lưu cấu hình website trên trình duyệt này.");
      return saved;
    }}>
      <input type="hidden" name="logoMediaId" value={website.logoMediaId}/>
      <p className={styles.secondary}>Không thể tải hoặc chọn logo mới lúc này. Việc đổi logo sẽ được mở lại khi upload được lưu an toàn vào Neon; logo hiện tại vẫn được giữ nguyên.</p>
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
