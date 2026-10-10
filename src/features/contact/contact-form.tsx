"use client";

import { Button, CheckboxField, SelectField, TextareaField, TextField } from "@mall/ui";
import { SurveyForm } from "@mall/ui/forms";
import type { LeasingUnit } from "../public/leasing-model";
import { AREA_OPTIONS, BUSINESS_OPTIONS, TIMING_OPTIONS } from "./contact-model";
import { useContactForm } from "./use-contact-form";
import styles from "./contact-form.module.css";

export function ContactForm({ visitPhone, units }: { visitPhone: string; units: readonly LeasingUnit[] }) {
  const { errors, submission, submit, inquiry, visit } = useContactForm(units);
  const { submitting, ready, coolingDown, countdown } = submission;
  const field = { controlClassName: styles.control, labelClassName: styles.label, containerClassName: styles.field };
  return <div className={styles.frame} data-ui-scheme="light">
    <SurveyForm submission={submission} className={styles.form} onSubmit={submit} noValidate aria-label={visit ? "Yêu cầu đặt lịch xem mặt bằng" : "Yêu cầu tư vấn mặt bằng"} aria-describedby="contact-demo-intro">
      <p id="contact-demo-intro" className={styles.demoIntro}><strong>Form demo</strong>Thông tin không được gửi hoặc lưu. Để trao đổi thực tế, <a href={visitPhone}>gọi hotline cho thuê</a> hoặc dùng email ở phần liên hệ.</p>
      {inquiry && <p className={styles.inquiry}>{visit ? "Đặt lịch xem:" : "Mặt bằng đang quan tâm:"} <strong>{inquiry.id} · Tầng {inquiry.floorId} · {inquiry.area.toLocaleString("vi-VN")} m²</strong>. Bạn có thể chỉnh nhu cầu bên dưới.<br/>Hướng mặt ngoài (tham khảo): {inquiry.orientation}.</p>}
      <div className={styles.fields}>
        <TextField {...field} id="contact-name" name="name" label="Họ tên" required autoComplete="name" placeholder="Nguyễn Văn A" maxLength={100} error={errors.name}/>
        <TextField {...field} id="contact-company" name="company" label="Tên doanh nghiệp" autoComplete="organization" placeholder="Tên thương hiệu / công ty" maxLength={150} error={errors.company}/>
        <TextField {...field} id="contact-phone" name="phone" label="Số điện thoại" type="tel" required autoComplete="tel" inputMode="tel" placeholder="0900 000 000" maxLength={32} error={errors.phone}/>
        <TextField {...field} id="contact-email" name="email" label="Email" type="email" required autoComplete="email" placeholder="you@company.com" maxLength={254} error={errors.email}/>
        <SelectField {...field} id="contact-business" name="business" label="Loại hình kinh doanh" required defaultValue="" placeholder="Chọn một lựa chọn" options={BUSINESS_OPTIONS} error={errors.business}/>
        <SelectField {...field} key={"area-" + (inquiry?.id ?? "general")} id="contact-area" name="area" label="Diện tích mong muốn" defaultValue={inquiry ? inquiry.area < 100 ? "under-100" : inquiry.area <= 150 ? "100-150" : "over-150" : ""} options={[{ value: "", label: "Chọn một lựa chọn" }, ...AREA_OPTIONS]} error={errors.area}/>
        <SelectField {...field} id="contact-timing" name="timing" label="Thời gian dự kiến thuê" defaultValue="" options={[{ value: "", label: "Chọn một lựa chọn" }, ...TIMING_OPTIONS]} error={errors.timing}/>
        <TextField {...field} key={"space-" + (inquiry?.id ?? "general")} id="contact-space" name="space" label="Mặt bằng đang quan tâm" defaultValue={inquiry ? inquiry.id + " / Tầng " + inquiry.floorId : ""} placeholder="Ví dụ: A.3 / Tầng 1" maxLength={150} error={errors.space}/>
        <TextareaField {...field} key={`note-${inquiry?.id ?? "general"}-${visit}`} containerClassName={`${styles.field} ${styles.wide}`} id="contact-note" name="note" label="Ghi chú" defaultValue={visit && inquiry ? `Tôi muốn đặt lịch xem mặt bằng ${inquiry.id}, tầng ${inquiry.floorId}. Vui lòng liên hệ để thống nhất thời gian.` : ""} rows={4} placeholder="Mô tả thêm về nhu cầu của bạn" maxLength={2000} error={errors.note}/>
      </div>
      <CheckboxField id="contact-consent" name="consent" required containerClassName={styles.consent} label="Tôi đồng ý để đội ngũ Le Grande Centre liên hệ tư vấn về nhu cầu mặt bằng." error={errors.consent}/>
      <div className={styles.actions}>
        <Button type="submit" className={styles.submit} disabled={!ready || coolingDown} loading={submitting} loadingLabel="Đang gửi">
          {submitting ? "Đang gửi…" : coolingDown ? `Gửi lại sau ${countdown}` : visit ? "Gửi yêu cầu đặt lịch" : "Gửi yêu cầu tư vấn"}
        </Button>
        <a className={styles.visit} href={visitPhone}>Đặt lịch tham quan <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" stroke="currentColor" strokeWidth="1.5"/></svg></a>
      </div>
      {coolingDown && <div className={styles.cooldown}><p role="status">Bạn đã gửi nhiều yêu cầu trong thời gian ngắn. Vui lòng chờ trước khi gửi tiếp.</p><span aria-live="off">Thời gian còn lại: <strong>{countdown}</strong></span></div>}
    </SurveyForm>
  </div>;
}
