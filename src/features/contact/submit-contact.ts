import type { ContactSubmission } from "@/shared/public/contracts";

export function createContactSubmitter() {
  let attempt: { payload: string; key: string } | null = null;
  return async (values: ContactSubmission): Promise<void> => {
    const payload = JSON.stringify(values);
    if (!attempt || attempt.payload !== payload) attempt = { payload, key: crypto.randomUUID() };
    const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": attempt.key }, body: payload });
    if (!response.ok) throw new Error(response.status === 429 ? "Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau." : "Chưa gửi được yêu cầu. Vui lòng thử lại hoặc gọi hotline.");
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("accepted" in result) || result.accepted !== true) throw new Error("Máy chủ chưa xác nhận tiếp nhận yêu cầu.");
    attempt = null;
  };
}
