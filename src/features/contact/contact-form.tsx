"use client";

import { Suspense } from "react";
import { Button, CheckboxField, SelectField, TextareaField, TextField } from "@mall/ui";
import { SurveyForm } from "@mall/ui/forms";
import type { LeasingUnit } from "../public/leasing-model";
import { AREA_OPTIONS, BUSINESS_OPTIONS, TIMING_OPTIONS, VISIT_TIME_OPTIONS } from "./contact-model";
import { useContactForm } from "./use-contact-form";
import styles from "./contact-form.module.css";

export function ContactForm(props: { visitPhone: string; units: readonly LeasingUnit[] }) {
  return <Suspense><ContactFormContent {...props}/></Suspense>;
}

function ContactFormContent({ visitPhone, units }: { visitPhone: string; units: readonly LeasingUnit[] }) {
  const { errors, submission, submit, inquiry, visit, pair, scope, setScope, today } = useContactForm(units);
  const selectedArea = scope === "pair" && pair ? pair[0].area + pair[1].area : inquiry?.area;
  const selectedSpace = scope === "pair" && pair ? `${pair[0].id} / Tầng 1 + ${pair[1].id} / Tầng 2` : inquiry ? `${inquiry.id} / Tầng ${inquiry.floorId}` : "";
  const { submitting, ready, coolingDown, countdown } = submission;
  const field = { controlClassName: styles.control, labelClassName: styles.label, containerClassName: styles.field };
  return <div className={styles.frame} data-ui-scheme="light">
    <SurveyForm submission={submission} className={styles.form} onSubmit={submit} noValidate aria-label={visit ? "Đăng ký tham quan thực tế" : "Yêu cầu tư vấn mặt bằng"} aria-describedby={visit ? "contact-demo-intro contact-visit-explanation" : "contact-demo-intro"}>
      {visit && <h2 className={styles.visitHeading}>Đăng ký tham quan thực tế</h2>}
      <p id="contact-demo-intro" className={styles.demoIntro}><strong>Form demo</strong>Thông tin không được gửi hoặc lưu. Để trao đổi thực tế, <a href={visitPhone}>gọi hotline cho thuê</a> hoặc dùng email ở phần liên hệ.</p>
      {visit && <p id="contact-visit-explanation" className={styles.visitExplanation}>Chọn ngày và buổi bạn mong muốn; đây chưa phải lịch hẹn đã xác nhận. Trong quy trình đăng ký thực tế, đội ngũ Le Grande Centre sẽ liên hệ để xác nhận thời gian. Bản demo này không gửi yêu cầu cho đội ngũ.</p>}
      {inquiry && <p className={styles.inquiry}>{visit ? "Mặt bằng muốn tham quan:" : "Mặt bằng đang quan tâm:"} <strong>{inquiry.id} · Tầng {inquiry.floorId} · {inquiry.area.toLocaleString("vi-VN")} m²</strong>. Bạn có thể chỉnh nhu cầu bên dưới.<br/>Hướng mặt ngoài (tham khảo): {inquiry.orientation}.
        {pair && <><br/><strong>Shophouse liên thông {pair[0].id} / {pair[1].id}</strong>: {pair[0].id} (Tầng 1) {pair[0].area.toLocaleString("vi-VN")} m² + {pair[1].id} (Tầng 2) {pair[1].area.toLocaleString("vi-VN")} m²; tổng diện tích theo brochure <strong>{(pair[0].area + pair[1].area).toLocaleString("vi-VN")} m²</strong>.<br/>Có thể thuê riêng từng mặt bằng hoặc thuê kết hợp cả cặp.</>}
      </p>}
      <div className={styles.fields}>
        {pair && inquiry && <SelectField {...field} containerClassName={`${styles.field} ${styles.wide}`} id="contact-scope" name="scope" label="Phạm vi quan tâm" required value={scope} onChange={event => setScope(event.target.value)} options={[{ value: "single", label: `Thuê riêng ${inquiry.id} · ${inquiry.area.toLocaleString("vi-VN")} m²` }, { value: "pair", label: `Thuê cả cặp ${pair[0].id} + ${pair[1].id} · ${(pair[0].area + pair[1].area).toLocaleString("vi-VN")} m²` }]} error={errors.scope}/>}
        {visit && <>
          <TextField {...field} id="contact-visit-date" name="visitDate" label="Ngày tham quan mong muốn" type="date" required min={today || undefined} description="Chọn hôm nay hoặc một ngày trong tương lai." error={errors.visitDate}/>
          <SelectField {...field} id="contact-visit-time" name="visitTime" label="Buổi tham quan mong muốn" required defaultValue="" placeholder="Chọn buổi tham quan" options={VISIT_TIME_OPTIONS} error={errors.visitTime}/>
        </>}
        <TextField {...field} id="contact-name" name="name" label="Họ tên" required autoComplete="name" placeholder="Nguyễn Văn A" maxLength={100} error={errors.name}/>
        <TextField {...field} id="contact-company" name="company" label="Tên doanh nghiệp" autoComplete="organization" placeholder="Tên thương hiệu / công ty" maxLength={150} error={errors.company}/>
        <TextField {...field} id="contact-phone" name="phone" label="Số điện thoại" type="tel" required autoComplete="tel" inputMode="tel" placeholder="0900 000 000" maxLength={32} error={errors.phone}/>
        <TextField {...field} id="contact-email" name="email" label="Email" type="email" required autoComplete="email" placeholder="you@company.com" maxLength={254} error={errors.email}/>
        <SelectField {...field} id="contact-business" name="business" label="Loại hình kinh doanh" required defaultValue="" placeholder="Chọn một lựa chọn" options={BUSINESS_OPTIONS} error={errors.business}/>
        <SelectField {...field} key={`area-${inquiry?.id ?? "general"}-${scope}`} id="contact-area" name="area" label="Diện tích mong muốn" defaultValue={selectedArea !== undefined ? selectedArea < 100 ? "under-100" : selectedArea <= 150 ? "100-150" : "over-150" : ""} options={[{ value: "", label: "Chọn một lựa chọn" }, ...AREA_OPTIONS]} error={errors.area}/>
        <SelectField {...field} id="contact-timing" name="timing" label="Thời gian dự kiến thuê" defaultValue="" options={[{ value: "", label: "Chọn một lựa chọn" }, ...TIMING_OPTIONS]} error={errors.timing}/>
        <TextField {...field} key={`space-${inquiry?.id ?? "general"}-${scope}`} id="contact-space" name="space" label="Mặt bằng đang quan tâm" defaultValue={selectedSpace} placeholder="Ví dụ: A.3 / Tầng 1" maxLength={150} error={errors.space}/>
        <TextareaField {...field} key={`note-${inquiry?.id ?? "general"}-${visit}-${scope}`} containerClassName={`${styles.field} ${styles.wide}`} id="contact-note" name="note" label="Ghi chú" defaultValue={visit ? `Tôi muốn đăng ký tham quan thực tế${selectedSpace ? ` mặt bằng ${selectedSpace}` : ""}. Vui lòng liên hệ để xác nhận thời gian.` : ""} rows={4} placeholder="Mô tả thêm về nhu cầu của bạn" maxLength={2000} error={errors.note}/>
      </div>
      <CheckboxField id="contact-consent" name="consent" required containerClassName={styles.consent} label="Tôi đồng ý để đội ngũ Le Grande Centre liên hệ tư vấn về nhu cầu mặt bằng." error={errors.consent}/>
      <div className={styles.actions}>
        <Button type="submit" className={styles.submit} disabled={!ready || coolingDown} loading={submitting} loadingLabel={visit ? "Đang mô phỏng" : "Đang gửi"}>
          {submitting ? visit ? "Đang mô phỏng…" : "Đang gửi…" : coolingDown ? `Gửi lại sau ${countdown}` : visit ? "Đăng ký tham quan thực tế" : "Gửi yêu cầu tư vấn"}
        </Button>
        <a className={styles.visit} href={visitPhone}>Đặt lịch tham quan <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" stroke="currentColor" strokeWidth="1.5"/></svg></a>
      </div>
      {coolingDown && <div className={styles.cooldown}><p role="status">Bạn đã gửi nhiều yêu cầu trong thời gian ngắn. Vui lòng chờ trước khi gửi tiếp.</p><span aria-live="off">Thời gian còn lại: <strong>{countdown}</strong></span></div>}
    </SurveyForm>
  </div>;
}
