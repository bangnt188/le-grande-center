import { validateContact, type ContactValues } from "@/features/contact/contact-model";
import type { ContactSubmission } from "@/shared/public/contracts";
export function parseContactInput(value: unknown): ContactSubmission {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Yêu cầu không hợp lệ.");
  const input = value as Record<string, unknown>;
  const strings = ["name", "company", "phone", "email", "business", "area", "timing", "space", "note"] as const;
  const limits: Record<(typeof strings)[number], number> = { name: 100, company: 150, phone: 32, email: 254, business: 30, area: 30, timing: 30, space: 150, note: 2000 };
  function text(key: (typeof strings)[number]): string {
    const field = input[key];
    if (typeof field !== "string" || field.length > limits[key] || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(field)) throw new Error("Thông tin không hợp lệ hoặc quá dài.");
    return field.trim();
  }
  if (input.intent !== "consultation" && input.intent !== "visit" && input.intent !== "callback") throw new Error("Loại yêu cầu không hợp lệ.");
  for (const key of ["scope", "visitDate", "visitTime", "unitId"]) if (input[key] !== undefined && (typeof input[key] !== "string" || input[key].length > 50)) throw new Error("Thông tin lựa chọn không hợp lệ.");
  if (input.consent !== true) throw new Error("Vui lòng đồng ý để chúng tôi liên hệ.");
  if (input.scope !== undefined && input.scope !== "single" && input.scope !== "pair") throw new Error("Phạm vi quan tâm không hợp lệ.");
  if (input.intent !== "visit" && (input.visitDate !== undefined || input.visitTime !== undefined)) throw new Error("Ngày tham quan chỉ dùng cho yêu cầu tham quan.");
  const result: ContactValues = { name: text("name"), company: text("company"), phone: text("phone"), email: text("email"), business: text("business"), area: text("area"), timing: text("timing"), space: text("space"), note: text("note"), consent: true };
  if (input.scope) result.scope = input.scope as string;
  if (input.intent === "visit") { result.visitDate = input.visitDate as string; result.visitTime = input.visitTime as string; }
  const dateParts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const today = ["year", "month", "day"].map(type => dateParts.find(part => part.type === type)!.value).join("-");
  const errors = validateContact(result, { visit: input.intent === "visit", callback: input.intent === "callback", today });
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  return { ...result, intent: input.intent, ...(input.unitId ? { unitId: input.unitId as string } : {}) };
}
