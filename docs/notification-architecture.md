# Lead notifications: durable website → Render → Zalo groups

[README](../README.md) · [Database guide](../database/README.md) · [Agent invariants](../AGENT.md)

## Data ownership and invariant

```text
Website Neon: lead + intake + notification outbox — one transaction
  → scheduled HTTPS dispatcher, stable contact:<intake-id>:zalo key
Separate Render Neon: website registry + event + recipient snapshot
  → persistent per-recipient queue → Zalo Bot API / optional Gmail API
```

**No shared website/bot DB.** Never install the website connection string in Render. `submitContact` in `src/server/public.ts` commits lead/intake, rate/idempotency/audit and `leasing.contact_notification_outbox` together via `withTransaction('public:intake')`. HTTP201 follows commit, not provider delivery; Render cold start does not hold the public form. Replaying the same accepted form receipt does not enqueue again. No old lead backfill.

Notification text includes Le Grande Centre, lead reference, name, phone and intent. Notes, email and the rest of the private intake are not copied into the notification. Payloads are sensitive plaintext while pending; no payload/key/recipient/provider error-body logging.

## Two durable hand-offs

1. Source outbox migration `012-contact-notification-outbox.sql` generates key **`contact:<intake-id>:zalo`**. RLS allows `public:intake` to enqueue and only `system:notification-dispatch` to read/update. The lead remains business data after notification payload is cleared.
2. `dispatchContactNotifications` claims at most five due rows with `SKIP LOCKED` and a **180-second lease**, closes every DB transaction before network I/O, then sends concurrently with a 120-second timeout and no redirects. Failures schedule exponential source delay **30 seconds–1 hour**; the scheduler controls the actual retry cadence.
3. Render authenticates the finite website key, validates payload and persists event plus **all currently linked recipient groups** atomically before HTTP202. No provider send is required before acceptance. New group links do not retroactively change a snapshot.
4. Source accepts only a valid HTTP200/202 JSON receipt with channel `zalo`, state `queued`/`sending`/`sent`, ID and timestamps. It then sets `forwarded_at`/`remote_id` and clears source payload. This is transfer of durable responsibility, not delivery proof. Lost ACK, timeout, malformed receipt, DB error, unlinked groups or rejected credentials retain the source row for retry with **the same key and payload**.
5. Render retries each unsent recipient with **60-second leases** and exponential **5–300 second** backoff, without retrying already ACKed recipients. Recovery runs at startup, on enqueue, on deadlines, every five seconds while the process is running, and on HTTP/health traffic. Independent bot/notification processor locks use direct PostgreSQL sessions.
6. Render clears event payload only after every recipient has provider ACK; metadata/hash/idempotency and recipient delivery records remain. No retry replaces a stable business key with a random new key.

**At-least-once, not exactly-once:** a provider can accept a message before a crash/timeout prevents storing ACK, so a retry may duplicate that recipient. `sent` means provider ACK, not read or inbox delivery. If a destination stays broken, its payload stays pending; fix credentials/membership/provider access rather than dropping the outbox.

Render Free can sleep. Website durable rows survive its cold start and later wake/retry, but timers do not keep Render awake and no immediate-delivery SLA is claimed. Zalo `/init`/chat webhooks are best-effort **until the webhook actually reaches Render and inbox commits**; provider cold-start timeout before that point depends on Zalo retry and is not rescued by the website outbox.

## Operator: issue credentials and link groups

From the **bot repo** `zalo-bot/render-relay`, using its private `.env.local` pointing to the bot DB:

```sh
node --env-file=.env.local scripts/website.mjs issue --origin https://legrandecentre.vn --name "Le Grande Centre" --max-groups 3 --expires-days 90
node --env-file=.env.local scripts/website.mjs rotate --origin https://legrandecentre.vn --expires-days 90
node --env-file=.env.local scripts/website.mjs limit --origin https://legrandecentre.vn --max-groups 5
node --env-file=.env.local scripts/website.mjs revoke --origin https://legrandecentre.vn
```

These are separate operator actions, not a launch script to run all four. `issue` requires origin/name, accepts optional `--gmail-to owner@example.com`; max groups defaults3/range1–100, expiry defaults90days/range1–3650. Issue fails for an already issued origin. **Issue/rotate print plaintext key once**: capture privately into website secret storage, never public/group/CI logs. Bot DB stores only SHA-256 digest/prefix. Rotation immediately invalidates old key, preserves site/groups/history and re-enables a revoked site; install the replacement in website runtime. Revoke/expiry block new auth and bindings, not already accepted deliveries. No public enrollment or environment JSON recipient list.

Origin is a canonical HTTPS origin: optional final `/`, no path/query/hash/credentials/non443 port; `www` is not silently removed. No remote URL fetch/domain-ownership check substitutes for explicit operator approval.

With bot in a group and `BOT_OWNER_USER_ID` correctly configured, **owner** sends:

```text
/init https://legrandecentre.vn/
```

Repeat in each intended group. Registry must already exist and be active/unexpired. One website → many groups up to cap; one group → one website globally for that service. Same binding is idempotent even at cap; another website conflicts; cap reductions below membership count fail. SQL triggers/locks enforce cap under concurrency/direct DB writes. No unlink command/UI is implied.

`/init` is GROUP-only, owner-only and free, no AI. Non-owner private text/commands/images always receive exactly `Liên hệ chủ sở hữu để mở khóa tính năng`, no AI/tools/quota/context. Normal owner and group Gen Z flows remain. Bot token stays only on Render; no API key in group commands/replies.

## Website runtime configuration and scheduler

| Server-only variable | Meaning |
| --- | --- |
| `NOTIFICATIONS_URL` | **Full** `https://zalo-render-bot.onrender.com/v1/notifications` endpoint, no query/hash/credentials |
| `NOTIFICATIONS_API_KEY` | Current unexpired website key from private operator issue/rotate |
| `NOTIFICATION_DISPATCH_SECRET` | Dedicated random secret ≥32 characters, distinct from website key, contact rate secret and webhook secret |
| `NOTIFICATION_PRODUCTION_DISPATCH_URL` | Optional **Cloudflare scheduler** HTTPS production `/api/internal/notifications/dispatch/` target; leave empty until production route/DB/secrets are verified |

The generic `@suntech/notifications` SDK takes **service-origin `baseUrl`** (`https://zalo-render-bot.onrender.com`), not this website's full `NOTIFICATIONS_URL`. Le Grande uses native fetch, not the SDK; SDK has no automatic retries and cannot replace a transactional source outbox.

`POST /api/internal/notifications/dispatch/` requires `Authorization: Bearer <NOTIFICATION_DISPATCH_SECRET>`, denies missing/wrong/unconfigured secrets with401 before DB access, and is no-store. Response `{claimed,forwarded}` reports source work, not provider delivery; 503 indicates dispatcher setup/storage failure. Never expose this secret in browser or use the website API key as dispatch authorization.

- **Cloudflare stage2:** `wrangler.jsonc` has cron `* * * * *`, main `cloudflare-worker.mjs`, self-binding `WORKER_SELF_REFERENCE`. Wrapper preserves OpenNext fetch/durable exports and scheduled handler uses `ctx.waitUntil` to POST the protected route through the binding; the binding invokes normal request-local env/context. Install the notification endpoint/key/dispatch secret in stage2 runtime (for example `npx wrangler secret put NOTIFICATIONS_API_KEY` and `npx wrangler secret put NOTIFICATION_DISPATCH_SECRET`; endpoint can also be a runtime secret). `npm run deploy` builds/deploys **stage2 only**, not Vercel. Cron uses the stage2 `lgc-bot-test` DB; no process-local fire-and-forget dispatch.
- **Local Node:** Next dev/start has no automatic cron. After configuring `.env.local`, call the protected route from a real local scheduler/operator, using the secret without printing it. Example with variables privately loaded into the scheduler environment:

  ```sh
  curl --fail --max-time 130 -X POST http://localhost:3000/api/internal/notifications/dispatch/ \
    -H "Authorization: Bearer $NOTIFICATION_DISPATCH_SECRET"
  ```

- **Optional Vercel production dispatch:** after Vercel deploys the route and has the matching dedicated secret/notification env and verified production DB, set `NOTIFICATION_PRODUCTION_DISPATCH_URL=https://legrandecentre.vn/api/internal/notifications/dispatch/` on Cloudflare runtime. Cron still always dispatches stage2 via self-binding and additionally POSTs production with the **same dedicated dispatch secret**, HTTPS validation, no redirects, 130-second timeout. This avoids depending on a Vercel paid one-minute cron. Use the final canonical URL: redirects are rejected. Cloudflare gains permission to dispatch production, not its DB credentials. Do not configure this target before the production route exists; stage2-only success does not prove production forwarding.

If a scheduler stops entirely, source rows remain durable but do not dispatch until an authenticated invocation resumes. A cron configuration in source is not proof its deployed handler runs.

## Gmail boundary

The bot service additionally supports `channel:gmail`, a fixed recipient registered with `issue --gmail-to`, and native Gmail REST API OAuth over HTTPS. Render needs **all four** `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_FROM`; App Password/SMTP is not supported on Render Free. Gmail OAuth setup/Testing refresh-token limits are in the bot README. **Actual Gmail credentials/recipient and live sending proof are still required.** This website's current contact outbox emits Zalo only; Gmail support in the service is not a claim that contact emails are queued/configured live.

## Hosting state and required launch steps

- `legrandecentre.vn` currently runs **Vercel**; repository `npm run deploy` targets `https://le-grande-centre-stage2.nguyenbang-skyone.workers.dev` only. Vercel authentication/deployment is still pending, and its current runtime DB mapping is unverified. Do not call the domain cut over from a Cloudflare deploy.
- Canonical local `.env.local` points at Neon `production` (`br-tiny-butterfly-b3uuw92p`); local writes are real. Stage2 runtime uses isolated `lgc-bot-test` (`br-wispy-morning-b33h15x4`), while Auth/media remain production services.
- Parent verified both website DB targets and applied **011+012**, with normal advisory lock/checksum recording, no seed/backfill. Both now have migrations001–012. Render uses dedicated `zalo-render-bot` Neon project `lingering-breeze-11185155`, migration0003 applied. A migration does not establish new source is live.

Before declaring launch: (1) confirm deployed bot commit/health/auth and registry; (2) owner-bind intended groups; (3) install website finite key, full endpoint and dedicated dispatch secret on each intended runtime; (4) confirm exact DB schema/branch and deploy website code on that host; (5) verify actual one-minute scheduler; (6) send approved synthetic contact and observe committed source row → valid durable Render ACK → all intended group provider ACKs and payload cleanup. Enable optional production cron only after Vercel route + matching secret exist. Test failures below, not just health. No production delivery claim is made by this document.

## Acceptance and observed verification

| Failure/input | Required result |
| --- | --- |
| Render sleep/down/timeout | Public lead commit succeeds; source row retained; scheduled retry/wake forwards |
| Duplicate contact receipt | Same lead/intake, one source row, stable request key |
| No group registered | Render409 `website_unlinked`, no idempotency consumed; source retained; init then retry works |
| Repeated init / concurrent groups at cap | No duplicate binding, cap never exceeded, repeat succeeds at cap |
| Cross-website group binding | Conflict, no reassignment |
| Non-owner private text/image/command | Exact locked reply; no model/quota; cannot bind group |
| Wrong/expired/revoked key | Render401; source payload retained; corrected/rotated credential resumes same key |
| Lost ACK after Render commit | Same event returned on retry; no second fan-out snapshot |
| Changed payload with same business key | Render409, no second event |
| DB outage / crash during claim | No false durable ACK; source/recipient lease expiry recovers |
| One destination fails | Others ACK once; only failed destination retries, except documented ambiguous provider-ACK crash window |
| All provider ACKs | Render payload cleared; source forwarded payload already cleared; metadata kept |
| New group or historical lead | No retroactive event replay/backfill |
| Missing/wrong dispatch secret | 401 before DB; no public dispatch |
| Wrong host/deploy | Stage2 proof does not count as Vercel/domain proof |

Parent has observed website admin **51 passed / 2 skipped**, owned disposable PostgreSQL **5 passed**, typecheck and Next/OpenNext builds passed; full bot suite passed after an HTTP assertion fix. This documentation worker ran no tests/builds. Fixture/provider checks are not real production delivery; no live-production or Gmail-live claim follows from those results.

Parent also exercised the actual Next dev dispatch route in an isolated local process against the verified canonical production Neon target: wrong dispatch secret returned401; valid secret returned200 `{claimed:0,forwarded:0}`. No production lead was created by this check. This proves route authorization/empty DB dispatch locally, not Vercel deployment or provider delivery.

The internal Next dispatch route sets native `maxDuration=180` so the deployed function can allow the bounded120-second Render cold-start request (subject to the host plan's limits). This does not extend or delay the public contact request; the optional production cron target remains unconfigured until Vercel is ready.
