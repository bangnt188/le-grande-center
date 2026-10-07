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
  };
}

export function validateContact(values: ContactValues): ContactErrors {
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
  if (!values.consent) errors.consent = "Vui lòng đồng ý để chúng tôi liên hệ tư vấn.";
  return errors;
}

// A gateway may acknowledge receipt only after durable persistence on the API.
export type ContactReceipt = { kind: "preview" } | { kind: "received"; id: string };
export interface ContactGateway {
  submit(values: Readonly<ContactValues>): Promise<ContactReceipt>;
}

// Explicitly selected by the preview UI. No network, persistence or simulated
// production receipt; a future HTTP adapter must implement the same interface.
export const previewContactGateway: ContactGateway = {
  async submit() { return { kind: "preview" }; },
};
