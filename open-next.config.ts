import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, {
    mode: "short-lived",
    // Always consult D1 tags: workers.dev has no zone-wide cache purge.
    bypassTagCacheOnCacheHit: false,
    shouldLazilyUpdateOnCacheHit: false,
  }),
  queue: doQueue,
  tagCache: d1NextTagCache,
  enableCacheInterception: false,
});
