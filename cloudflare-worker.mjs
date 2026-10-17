import worker from "./.open-next/worker.js";
import { dispatchScheduledNotifications } from "./src/server/notification-schedule.ts";

// Preserve all installed OpenNext durable-object exports as the adapter evolves.
export * from "./.open-next/worker.js";

export default {
  ...worker,
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(dispatchScheduledNotifications(env));
  },
};
