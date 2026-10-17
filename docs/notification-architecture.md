# Lead notifications: durable website → Render → Zalo groups

[README](../README.md) · [Database guide](../database/README.md) · [Agent invariants](../AGENT.md)
## Hosting correction from owner

The owner explicitly confirmed this project is **not deployed on Vercel**. Do not request Vercel login, deploy there, or infer deployment ownership from an HTTP server header. This rollout targets the existing Cloudflare Worker and Render bot only. Older hosting notes elsewhere are not authoritative over this clarification.


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
2. `dispatchContactNotifications` claims at most five due rows with `SKIP LOCKED` and a **180-second lease**, closes transactions before network, then sends concurrently. Each batch makes **up to3 attempts**, each bounded40seconds, with250/500ms pauses and the same payload/key. A valid receipt stops retrying immediately. All3 failed attempts retain the source row and schedule exponential source delay **30seconds–1hour** for the next cron batch. HTTP redirects are never followed (`manual`, non200/202 rejected); this is compatible with Cloudflare.
3. Render authenticates the finite website key, validates payload and persists event plus **all currently linked recipient groups** atomically before HTTP202. No provider send is required before acceptance. New group links do not retroactively change a snapshot.
4. Source accepts only a valid HTTP200/202 JSON receipt with channel `zalo`, state `queued`/`sending`/`sent`, ID and timestamps. It then sets `forwarded_at`/`remote_id` and clears source payload. This is transfer of durable responsibility, not delivery proof. Lost ACK, timeout, malformed receipt, DB error, unlinked groups or rejected credentials retain the source row for retry with **the same key and payload**.
5. Render retries each unsent recipient with **60-second leases** and exponential **5–300 second** backoff, without retrying already ACKed recipients. Recovery runs at startup, on enqueue, on deadlines, every five seconds while the process is running, and on HTTP/health traffic. Independent bot/notification processor locks use direct PostgreSQL sessions.
6. Render clears event payload only after every recipient has provider ACK; metadata/hash/idempotency and recipient delivery records remain. No retry replaces a stable business key with a random new key.

**At-least-once, not exactly-once:** a provider can accept a message before a crash/timeout prevents storing ACK, so a retry may duplicate that recipient. `sent` means provider ACK, not read or inbox delivery. If a destination stays broken, its payload stays pending; fix credentials/membership/provider access rather than dropping the outbox.

Render Free can sleep. Website source outbox survives cold start and retries. Zalo chat uses the separate Cloudflare durable webhook ingress (`edge/worker.js` in bot repo): authenticate, persist SQLite inbox, ACK Zalo without waiting for Render, then alarm-forward with120second timeout and persistent retries. Payload clears only after Render confirms inbox acceptance; Render then processes the chat. This prevents the first chat being lost merely because Render was waking. Cold-start reply latency remains; no instant/SLA guarantee.

## Operator: issue credentials and link groups

### Owner PRIVATE chat

These are the source contract for the new `/site` tools, **not a claim that those commands are deployed/live-tested**. First configure `BOT_OWNER_USER_ID` and bot token on Render; the configured owner opens a **PRIVATE** conversation with the bot. No aliases; all `/site` commands bypass AI/quota and are denied in GROUP, even when sent by owner.

| Command in owner's PRIVATE chat | Result |
| --- | --- |
| `/site issue https://legrandecentre.vn 3 5` | New key valid for **3 calendar months**, cap **5 groups**; name defaults to canonical origin |
| `/site rotate https://legrandecentre.vn 6` | New key valid for **6 calendar months from now**, not an extension of old expiry; old key invalid immediately |
| `/site limit https://legrandecentre.vn 10` | Set cap to 10; cannot go below linked group count |
| `/site revoke https://legrandecentre.vn` | Block new authentication/group bindings |
| `/site info https://legrandecentre.vn` | Metadata/expiry/group count and cap; no plaintext key |
| `/site list [page]` | Metadata for **3 sites/page**, default1; positive integer only, e.g. `/site list 2` |
| `/site help` | Exact syntax, no credential values |

Issue requires `URL MONTHS GROUP_CAP`; rotate requires `URL MONTHS`, without chat defaults. Months are integers **1–120**, added as **UTC calendar months**, preserving UTC time and clamping to the last valid day: Jan31 +1month → Feb28/29. Caps are integers **1–100**; registry/CLI default is **3**, while the chat example explicitly chooses 5. Duplicate issue fails; rotate existing credentials instead.

Only **private owner credential delivery** may contain a new key. No automatic end-user DM: owner installs it in the user's website backend through a private handoff, never terminal/stdout/stderr/log/group/form/browser. Update `NOTIFICATIONS_API_KEY` on **every intended website runtime** immediately after rotate; rotation preserves site/groups/history and re-enables a revoked site. Revoke/expiry do not cancel already accepted deliveries.

Credential change + durable owner-only notification enqueue commit atomically; missing owner PRIVATE chat/storage failure rolls back. `/site` mutation also commits the current inbox row's safe metadata reply and `ready` receipt, with in-transaction status re-check: a crash after commit/replay of the same inbox message does not issue/rotate again. No provider network before queue commit. Registry stores SHA-256/prefix; plaintext stays only in the pending owner-delivery queue until provider ACK, then payload is cleared. Never put a key in normal `messages.reply`, prompt or chat memory. No public enrollment or environment recipient list.

### Compatible operator CLI

From the **bot repo** `zalo-bot/render-relay`, using private `.env.local` for the bot DB:

```sh
node --env-file=.env.local scripts/website.mjs issue --origin https://legrandecentre.vn --name "Le Grande Centre" --max-groups 3 --expires-days 90
node --env-file=.env.local scripts/website.mjs rotate --origin https://legrandecentre.vn --expires-days 90
node --env-file=.env.local scripts/website.mjs limit --origin https://legrandecentre.vn --max-groups 5
node --env-file=.env.local scripts/website.mjs revoke --origin https://legrandecentre.vn
```

These are separate operator actions, not a launch script. CLI issue requires origin/name, accepts optional fixed `--gmail-to`; cap defaults3/range1–100. CLI `--expires-days` remains **days**, default90/range1–3650, unlike `/site` calendar months. Issue/rotate use the same atomic owner PRIVATE delivery, print metadata/receipt only and call `/health` via configured `RENDER_EXTERNAL_URL` to wake the queue.

Origin is a canonical HTTPS origin: optional final `/`, no path/query/hash/credentials/non443 port; `www` is not silently removed. No remote URL fetch/domain-ownership check substitutes for explicit owner approval.

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

The generic `@suntech/notifications` SDK takes **service-origin `baseUrl`** (`https://zalo-render-bot.onrender.com`), not this website's full `NOTIFICATIONS_URL`. Le Grande uses native fetch, not the SDK; SDK has no automatic retries and cannot replace a transactional source outbox.

`POST /api/internal/notifications/dispatch/` requires `Authorization: Bearer <NOTIFICATION_DISPATCH_SECRET>`, denies missing/wrong/unconfigured secrets with401 before DB access, and is no-store. Response `{claimed,forwarded}` reports source work, not provider delivery; 503 indicates dispatcher setup/storage failure. Never expose this secret in browser or use the website API key as dispatch authorization.

- **Cloudflare:** `wrangler.jsonc` cron `* * * * *`, main `cloudflare-worker.mjs`, self-binding `WORKER_SELF_REFERENCE`. The scheduled handler POSTs the protected route in normal OpenNext request-local context. Configure endpoint/key/dispatchsecret in Worker secrets. The deployed Worker uses `lgc-bot-test`; build/deploy does not migrate DB. No unrequested Vercel deployment or external production scheduler target.
- **Local Node:** Next dev/start has no automatic cron. After configuring `.env.local`, call the protected route from a real local scheduler/operator, using the secret without printing it. Example with variables privately loaded into the scheduler environment:

  ```sh
  curl --fail --max-time 130 -X POST http://localhost:3000/api/internal/notifications/dispatch/ \
    -H "Authorization: Bearer $NOTIFICATION_DISPATCH_SECRET"
  ```


If a scheduler stops entirely, source rows remain durable but do not dispatch until an authenticated invocation resumes. A cron configuration in source is not proof its deployed handler runs.

## Gmail boundary

The bot service additionally supports `channel:gmail`, a fixed recipient registered with `issue --gmail-to`, and native Gmail REST API OAuth over HTTPS. Render needs **all four** `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_FROM`; App Password/SMTP is not supported on Render Free. Gmail OAuth setup/Testing refresh-token limits are in the bot README. **Actual Gmail credentials/recipient and live sending proof are still required.** This website's current contact outbox emits Zalo only; Gmail support in the service is not a claim that contact emails are queued/configured live.

## Hosting state and required launch steps

- Owner confirms no Vercel deployment for this project. The configured release target is `https://le-grande-centre-stage2.nguyenbang-skyone.workers.dev`. Do not infer current source/runtime DB for a different host from DNS/headers. Deployment of this Worker does not itself change custom-domain routing.
- Canonical local `.env.local` points at Neon `production` (`br-tiny-butterfly-b3uuw92p`); local writes are real. Stage2 runtime uses isolated `lgc-bot-test` (`br-wispy-morning-b33h15x4`), while Auth/media remain production services.
- Both verified website DB targets received **011+012**, with checksum recording and no seed/backfill; both now have migrations001–012. Render uses dedicated `zalo-render-bot` Neon project `lingering-breeze-11185155`, migration0003 applied. A migration does not establish new source is live.

Before declaring launch: confirm live bot/edge commit and webhook probe, owner-bind intended groups, install website endpoint/key/dispatchsecret, verify Worker DB and scheduler, then observe synthetic contact → committed source row → Render durable ACK → every intended group provider ACK and payload cleanup. Group selection still requires owner `/init`; do not bind an arbitrary historical group.

## Acceptance and observed verification

| Failure/input | Required result |
| --- | --- |
| Render sleep/down/timeout | Public lead commit succeeds; source row retained; scheduled retry/wake forwards |
| Duplicate contact receipt | Same lead/intake, one source row, stable request key |
| No group registered | Render409 `website_unlinked`, no idempotency consumed; source retained; init then retry works |
| Repeated init / concurrent groups at cap | No duplicate binding, cap never exceeded, repeat succeeds at cap |
| Cross-website group binding | Conflict, no reassignment |
| Non-owner private text/image/command | Exact locked reply; no model/quota; cannot bind group |
| Owner `/site` in GROUP | Denied, no mutation/key/AI/quota even for owner |
| Month-end issue / early rotate | UTC calendar clamp/time preserved; new expiry from now, old key invalid immediately |
| Crash after `/site` mutation commit before reply | Same inbox receipt resumes without a second issue/rotate; durable owner queue survives |
| Wrong/expired/revoked key | Render401; source payload retained; corrected/rotated credential resumes same key |
| Lost ACK after Render commit | Same event returned on retry; no second fan-out snapshot |
| Changed payload with same business key | Render409, no second event |
| DB outage / crash during claim | No false durable ACK; source/recipient lease expiry recovers |
| One destination fails | Others ACK once; only failed destination retries, except documented ambiguous provider-ACK crash window |
| All provider ACKs | Render payload cleared; source forwarded payload already cleared; metadata kept |
| New group or historical lead | No retroactive event replay/backfill |
| Missing/wrong dispatch secret | 401 before DB; no public dispatch |
| Wrong host/deploy | Verify configured Cloudflare target and its DB; do not deploy Vercel |

Observed website admin **51 passed / 2 skipped**, owned disposable PostgreSQL **5 passed**, typecheck and Next/OpenNext builds passed; all39 bot tests passed, including private owner key issue/rotate and rollback/no-terminal-leak checks. Fixture checks are not real production website-to-group or Gmail delivery proof.

Actual Next dev dispatch was exercised locally against canonical production Neon: wrong secret401, valid200 `{claimed:0,forwarded:0}`; no production lead was created. Actual Cloudflare Worker returned401/200 for the same auth cases. A synthetic stage2 contact returned201 while no groups were linked; source payload remained pending, and deployed one-minute cron increased attempts without dropping it.

The internal dispatch route retains native `maxDuration=180` for compatible Node hosts. Public contact never waits for the three bounded attempts. Owner-chat tools and webhook ingress release proof belong in the bot architecture; source docs alone do not prove deployment.
