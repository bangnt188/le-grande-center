# Backend structure — phase 2

Ứng dụng đã chuyển từ browser demo sang Next SSR/OpenNext với Neon Auth/PostgreSQL và Neon/R2 media thật. Không còn folder-only preparation, demo auth hoặc IndexedDB persistence fallback. Trạng thái triển khai/bằng chứng: [readiness](backend-readiness.md).

## Cấu trúc

```text
src/
  app/
    admin/                 # Neon Auth UI + protected workspace
    api/auth/              # managed auth proxy
    api/admin/             # workspace, commands, media/review/view/reconcile
    api/public/website/    # public-only projection
    api/contact/           # live lead/intake, not booking
  features/admin/
    http-repository.ts     # browser -> same-origin authenticated API
    use-admin-data.ts      # UI state, no local persistence fallback
  features/contact/        # business fields + shared live survey submission
  shared/admin/            # DTO/command contracts and pure models/policies
  server/
    auth.ts                # fresh managed session, verified email, origin
    database.ts            # request-local Pool, actor/runtime role/RLS, allowlist
    workspace.ts           # relational reads/commands, CAS/receipts/audit
    public.ts              # approved projection + durable intake/cooldown
    contact-input.ts       # server trust-boundary parser
    public-leasing.ts      # DB catalog -> public display
    media/
      validation.ts        # bounded ingress, types, dimensions, ranges
      prepare.ts           # raster decode/re-encode, PDF unchanged
      repository.ts        # ownership, ledger, quarantine/review, retention
      storage.ts           # trusted Neon origin calls, R2 bindings/inventory
      neon-origin.ts       # S3 signing executed at trusted storage origin
      neon-function.ts     # x-secret protected known-key image storage origin
database/
  schema.sql               # relational baseline
  migrations/              # 001–004 reviewed incremental evolution
scripts/
  migrate-database.ts      # operator migrations + approved project seed
  dev-live.mjs             # explicit --env CLI; avoid Next --env-file spawn bug
  build-cloudflare.mjs     # prevent standard envfiles entering Worker bundle
packages/
  backend/                 # @shared/backend private pinned submodule
  ui/                      # @mall/ui private pinned submodule
archives/3d-model-mall/     # preserved source only, excluded from app build
```

Generated project media catalog contains read-only approved public assets, not demo customers/contracts, quota simulation or persistence. App server may read the generated catalog; it does not import a browser demo repository. Catalog file paths are not authority for cloud bytes/quota.

## Boundaries

- Shared types/pure models do not import features, React, DB driver or secrets. `AdminSnapshot` is an HTTP projection, not a stored JSON database.
- TSX uses the HTTP repository. API identity comes from verified Neon Auth and DB staff allowlist/assignment; client role/property/key claims are not authoritative. Current workspace supports allowlisted administrators, not an implemented multi-role customer portal.
- Every admin API checks auth; writes also check origin. Commands lock property and current assignment, compare revision, validate invariants, persist relational changes + receipt + audit transactionally. DB transaction sets `leasing_runtime` and actor context; RLS remains enabled.
- Public paths use a separate approved projection, never full workspace with React-hidden fields. No tenant/contact/private contract data or hold dates. Public intake only creates lead/intake; appointments are explicit staff workflow.
- Shared backend contains generic access/SQL/HTTP/storage primitives. Application owns B2B workflows, staff mapping, privacy and media lifecycle. Generic CRUD is not a substitute for lease/hold invariants.
- Media metadata/ownership/state/hash are relational; bytes stay in storage. App authorizes and reserves quota before calling protected Neon origin. AWS S3 keys live only there. R2 documents stay private; remote bindings are real even in dev.

## Storage and transfer

Approved public images/video/brochure use R2 `mall-assets`. Uploaded raster images and branding use Neon `media`; logo never falls back to static/R2/browser Blob. PDF uses R2 `mall-documents`, stage2 `mall-documents-stage2`; quarantine requires **manual external review**, not antivirus-clean or online signature. Inventory public + tracked Neon/private + reservations enforces app quota; unknown/mismatch locks upload.

Migrations 001–004 have been applied to stage2, disposable regression branches and the production backend. Production initialization contains only 6 approved brochure floors/81 slots, the configured owner allowlist and verified approved Neon logo; no fabricated customer/financial transactions or frontend cutover. Production Auth OTP/verification settings are configured, not proof of email delivery. Transfer means schema+migrations, relational records, object keys/catalog and verified size/hash metadata, then copied/verified bytes and audited locator changes. Do not transfer opaque snapshots, credentials or presigned URLs. See [portability](database-portability.md), [quota](storage-quota.md) and [private documents](private-documents-r2.md).

## Runtime limits and checks

Next `output: standalone` supports Node SSR; OpenNext packages a Worker. Native Worker → Neon S3/Functions currently returns 403 HTML before provider while Node works; no all-Worker media readiness claim. Production frontend is not deployed/cut over; domain/DNS explicitly deferred by user.

Build CI runs shared integrity/types/tests plus application pure tests/typecheck and Next/OpenNext builds without cloud secrets. Cloud integration uses `test:database` on an isolated Neon branch with operator permissions, never a fake provider in the secretless CI job. New docs/CI edits were not built/tested in this documentation slice; [readiness](backend-readiness.md) distinguishes prior runtime observations from unrun checks.
