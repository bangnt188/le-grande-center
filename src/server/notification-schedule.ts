type NotificationScheduleEnv = {
  NOTIFICATION_DISPATCH_SECRET?: string;
  WORKER_SELF_REFERENCE: { fetch(request: Request): Promise<Response> };
};

export async function dispatchScheduledNotifications(env: NotificationScheduleEnv): Promise<void> {
  if (!env.NOTIFICATION_DISPATCH_SECRET || env.NOTIFICATION_DISPATCH_SECRET.length < 32) throw new Error("Notification dispatch secret is missing");
  const init = { method: "POST", headers: { Authorization: `Bearer ${env.NOTIFICATION_DISPATCH_SECRET}` }, redirect: "manual" as const };
  // Self-binding runs the normal OpenNext path with request-local env/context.
  const response = await env.WORKER_SELF_REFERENCE.fetch(new Request("https://notification-dispatch.internal/api/internal/notifications/dispatch/", init));
  await response.body?.cancel();
  if (!response.ok) throw new Error(`Notification dispatch failed (${response.status})`);
}
