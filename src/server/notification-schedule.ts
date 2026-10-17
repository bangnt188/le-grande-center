type NotificationScheduleEnv = {
  NOTIFICATION_DISPATCH_SECRET?: string;
  NOTIFICATION_PRODUCTION_DISPATCH_URL?: string;
  WORKER_SELF_REFERENCE: { fetch(request: Request): Promise<Response> };
};

export async function dispatchScheduledNotifications(env: NotificationScheduleEnv): Promise<void> {
  if (!env.NOTIFICATION_DISPATCH_SECRET || env.NOTIFICATION_DISPATCH_SECRET.length < 32) throw new Error("Notification dispatch secret is missing");
  const production = env.NOTIFICATION_PRODUCTION_DISPATCH_URL ? new URL(env.NOTIFICATION_PRODUCTION_DISPATCH_URL) : null;
  if (production && (production.protocol !== "https:" || production.username || production.password || production.search || production.hash)) throw new Error("Invalid production notification dispatch URL");
  const init = { method: "POST", headers: { Authorization: `Bearer ${env.NOTIFICATION_DISPATCH_SECRET}` }, redirect: "error" as const };
  // Self-binding runs the normal OpenNext path with request-local env/context.
  const requests = [env.WORKER_SELF_REFERENCE.fetch(new Request("https://notification-dispatch.internal/api/internal/notifications/dispatch/", init))];
  if (production) requests.push(fetch(production, { ...init, signal: AbortSignal.timeout(130_000) }));
  const responses = await Promise.all(requests);
  for (const response of responses) {
    await response.body?.cancel();
    if (!response.ok) throw new Error(`Notification dispatch failed (${response.status})`);
  }
}
