# Architecture Decision: R2 storage quota

## Decision

Application quota: **8,500,000,000 bytes (8.5 decimal GB)** across media,
private documents, thumbnails and retained versions within one controlled R2
account storage scope. Reserve 1.5 GB below the referenced free storage
allowance. Never grant each project a separate 8.5 GB budget within the same
account. Other buckets/writers must be included or have separately allocated
budgets within this ceiling.

The meter uses `(usedBytes + reservedBytes) / 8,500,000,000`:

- ≤65%: normal, green.
- >65% and ≤85%: warning, yellow.
- >85%: critical, red.
- ≥100%: block new uploads. Existing authorized reads remain available.
- Missing usage: show unavailable state and block uploads until refreshed.
- A batch may reach exactly 8.5 GB, but cannot exceed it. Reject the entire batch
  before creating preview URLs if its total is larger than remaining capacity.

The media demo uses existing `AdminPanel`, `ProgressBar`, `Badge`, `Select`,
`Button` and system Toast. Sample state controls exist only in the demo
repository, never in the HTTP adapter. Upload adds actual `File.size` to sample
usage; selecting another sample scenario resets the aggregate sample usage.
All sample storage data is ephemeral and is not measured from R2.

## API contract and migration

`AdminSnapshot.storage` is either `null` (unknown/unavailable) or:

```ts
{ usedBytes: number; reservedBytes: number }
```

Both values are non-negative safe integers in bytes. Counts include every
physical object in the quota scope, not just the current media list or its
filters. Every read/mutation response supplies fresh counts. Missing or malformed
storage metadata fails the client contract; unknown usage disables upload. The
UI can be reused unchanged when the authenticated API is connected.

An upload quota rejection returns HTTP 507; per-file size rejection returns 413.
Existing type allowlist and 10 MiB per-file restriction remain. The browser's
`accept`, MIME and quota checks serve UX; production checks happen on the server.

## Security and enforcement before production

The current static demo implements client/repository checks only. It does not
configure R2 or implement the following authoritative backend flow:

1. Verify session, upload permission and tenant/property scope. Use private
   Standard storage; never expose R2 keys or a public private-document bucket.
2. In one DB transaction, lock the account quota row; atomically reserve total
   batch bytes only when `used + reserved + incoming <= limit`. Store an
   idempotent upload session with object keys, expected sizes and expiry.
3. Upload through an authenticated Worker that enforces the reserved byte cap
   while reading the body, rejects excess bytes and validates file content.
   Do not rely on a browser-declared size or an unrestricted presigned PUT to
   enforce this hard limit. Include temporary objects and multipart bytes in
   accounting. The Worker keeps upload bodies out of Vercel function limits.
4. Finalize actual sizes atomically, converting reservation to used bytes only
   after successful storage. Repeated finalize is idempotent. Failed/expired
   uploads delete/abort temporary objects before releasing their reservations.
5. Deletion reduces used bytes only after storage deletion is confirmed. Honor
   contract retention requirements and audit authorization. Reconcile ledger
   against R2; block new uploads during unexplained mismatch. Only this service
   can write to controlled buckets.

Threats: concurrent upload races, forged sizes, duplicate retries, abandoned
multipart uploads, external bucket writers and cross-tenant file access.
Transaction reservations, bounded ingress, idempotency, reconciliation and
scoped private access address these threats. The trade-off is a durable ledger
and cleanup/reconciliation jobs in exchange for a limit independent of a
long-lived application server. A quota increase changes backend policy and
client contract together; never trust a limit supplied by the client.

## Provider allowance is not a hard limit

Cloudflare currently includes **10 GB-month/month** for R2 Standard storage,
plus separate Class A/B operation allowances. Storage billing averages daily
peak usage across the billing period. An 8.5 GB storage cap does not guarantee
zero operation charges, undo previous usage charges or impose a provider-wide
spending cap.

Source checked 2026-10-06: [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/).
