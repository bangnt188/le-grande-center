export const BUSINESS_OPTIONS = [
  { value: "retail", label: "Bán lẻ / Showroom" },
  { value: "food", label: "Ẩm thực / Café" },
  { value: "office", label: "Văn phòng" },
  { value: "services", label: "Dịch vụ" },
  { value: "other", label: "Khác" },
] as const;
export const AREA_OPTIONS = [
  { value: "under-100", label: "Dưới 100 m²" },
  { value: "100-150", label: "100–150 m²" },
  { value: "over-150", label: "Trên 150 m²" },
  { value: "consult", label: "Cần tư vấn thêm" },
] as const;
export const TIMING_OPTIONS = [
  { value: "soon", label: "Trong 1 tháng" },
  { value: "1-3-months", label: "Trong 1–3 tháng" },
  { value: "3-6-months", label: "Trong 3–6 tháng" },
  { value: "exploring", label: "Đang tìm hiểu" },
] as const;

export const VISIT_TIME_OPTIONS = [
  { value: "morning", label: "Buổi sáng" },
  { value: "afternoon", label: "Buổi chiều" },
] as const;

export function localDateValue(date = new Date()): string {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export type ContactValues = {
  name: string;
  company: string;
  phone: string;
  email: string;
  business: string;
  area: string;
  timing: string;
  space: string;
  note: string;
  consent: boolean;
  visitDate?: string;
  visitTime?: string;
  scope?: string;
};
export type ContactErrors = Partial<Record<keyof ContactValues, string>>;

export function readContactValues(form: HTMLFormElement): ContactValues {
  const data = new FormData(form);
  const text = (key: string) => String(data.get(key) ?? "").trim();
  return {
    name: text("name"), company: text("company"), phone: text("phone"),
    email: text("email"), business: text("business"), area: text("area"),
    timing: text("timing"), space: text("space"), note: text("note"),
    consent: data.get("consent") === "on",
    ...(data.has("visitDate") ? { visitDate: text("visitDate"), visitTime: text("visitTime") } : {}),
    ...(data.has("scope") ? { scope: text("scope") } : {}),
  };
}

export function validateContact(values: ContactValues, { visit = false, paired = false, now = new Date() } = {}): ContactErrors {
  const errors: ContactErrors = {};
  if (values.name.length < 2 || values.name.length > 100) errors.name = "Nhập họ tên từ 2 đến 100 ký tự.";
  if (values.company.length > 150) errors.company = "Tên doanh nghiệp tối đa 150 ký tự.";
  const digits = values.phone.replace(/\D/g, "");
  if (!/^[+0-9().\s-]+$/.test(values.phone) || digits.length < 9 || digits.length > 15 || values.phone.length > 32) errors.phone = "Nhập số điện thoại hợp lệ, từ 9 đến 15 chữ số.";
  if (values.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = "Nhập địa chỉ email hợp lệ.";
  if (!BUSINESS_OPTIONS.some(option => option.value === values.business)) errors.business = "Chọn loại hình kinh doanh.";
  if (values.area && !AREA_OPTIONS.some(option => option.value === values.area)) errors.area = "Chọn diện tích trong danh sách.";
  if (values.timing && !TIMING_OPTIONS.some(option => option.value === values.timing)) errors.timing = "Chọn thời gian trong danh sách.";
  if (values.space.length > 150) errors.space = "Thông tin mặt bằng tối đa 150 ký tự.";
  if (values.note.length > 2000) errors.note = "Ghi chú tối đa 2.000 ký tự.";
  if (paired && values.scope !== "single" && values.scope !== "pair") errors.scope = "Chọn thuê riêng một mặt bằng hoặc thuê cả cặp.";
  if (visit) {
    const date = values.visitDate ?? "";
    // Local noon avoids UTC shifts and DST transitions at midnight. Compare calendar dates, not instants.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || localDateValue(new Date(`${date}T12:00:00`)) !== date) errors.visitDate = "Chọn ngày tham quan hợp lệ.";
    else if (date < localDateValue(now)) errors.visitDate = "Chọn ngày tham quan từ hôm nay trở đi.";
    if (!VISIT_TIME_OPTIONS.some(option => option.value === values.visitTime)) errors.visitTime = "Chọn buổi sáng hoặc buổi chiều để tham quan.";
  }
  if (!values.consent) errors.consent = "Vui lòng đồng ý để chúng tôi liên hệ tư vấn.";
  return errors;
}
