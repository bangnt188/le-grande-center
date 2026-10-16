import "server-only";

const ZALO_API_BASE_URL = "https://bot-api.zaloplatforms.com";
const intentLabel = { consultation: "Tư vấn", visit: "Tham quan", callback: "Gọi lại" } as const;

export async function notifySurveyOwner(input: { referenceCode: string; name: string; phone: string; intent: keyof typeof intentLabel }): Promise<void> {
  const token = process.env.LE_GRANDE_ZALO_BOT_TOKEN;
  const ownerId = process.env.LE_GRANDE_ZALO_OWNER_ID;
  if (!token || !ownerId) throw new Error("Le Grande Zalo notification is not configured.");

  const response = await fetch(`${ZALO_API_BASE_URL}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: ownerId,
      text: `📋 Le Grande Centre: Có yêu cầu khảo sát mới.\nMã: ${input.referenceCode}\nKhách: ${input.name}\nĐiện thoại: ${input.phone}\nLoại yêu cầu: ${intentLabel[input.intent]}`,
    }),
    signal: AbortSignal.timeout(10_000),
    redirect: "manual",
  });
  if (!response.ok) throw new Error("Zalo notification request failed.");
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("ok" in payload) || payload.ok !== true) {
    throw new Error("Zalo rejected the notification.");
  }
}
