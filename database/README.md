# Database PostgreSQL / Neon

`schema.sql` remains the authoritative relational baseline; reviewed migrations
`001-live-workspace.sql` through `004-recorded-document-financials.sql` evolve it.
There is no opaque stored workspace snapshot or browser persistence fallback.
Runtime composition lives in `src/server/{database,workspace,public}.ts` and `media/`.

## Current state — 14/10/2026

Baseline and migrations 001–004 have been applied to stage2, disposable regression
branches and the production backend. Production initialization contains only six
approved brochure floors/81 slots, the configured owner allowlist and the approved
Neon logo verified by native authorized GET (25,230 bytes, SHA-256 checked).
No customer companies, leads, requests, holds, leases, appointments or financial
transactions were fabricated. The owner organization is not a customer; the disabled
system import actor cannot sign in/administer the property.

Production Neon Auth OTP/verification and signup/signin verification-send settings
are configured; localhost:3000 was added as a trusted origin. Configuration and the
stage2 fixture's verified-email login do not prove email delivery/owner onboarding.
**Production frontend is not deployed/cut over; customer-domain/DNS connection is
explicitly deferred.** This is not a request to deploy or reconnect the domain.

## Bootstrap (operator only)

Use an isolated branch first and supply **`DATABASE_URL_UNPOOLED`** with its direct
connection. The CLI does not read/override pooled `DATABASE_URL` for migration.

```sh
node --env-file=.env.stage2.local --conditions=react-server --import tsx scripts/migrate-database.ts
```

Or, with the environment already loaded:

```sh
npm run db:migrate
```

Node `--env-file` is valid for this direct migration process, **not** for spawning
Next dev; Next runtime must use `scripts/dev-live.mjs --env ...` as in the root README.
Never print/commit connection strings. Migration is not a build/CI/deploy step.
The runner initializes the baseline only when absent, checks applied migration
hashes and seeds approved brochure content idempotently. Do not splice baseline SQL
or delete `leasing_runtime` to bypass provider branch limitations.

Only a verified managed-auth issuer/subject/email may bind the configured owner
allowlist. Identity mismatch, disabled user, revoked assignment or allowlist fails
closed; signup does not create administrator permission.

Import `media/client-reference/legacy/logo-without-text.png` only after independently
verifying the real Neon object: `importApprovedLogo(connectionString,
{publicUrl, bytes, sha256})`, or CLI variables `APPROVED_LOGO_URL`,
`APPROVED_LOGO_BYTES`, `APPROVED_LOGO_SHA256`. Static/R2/browser branding fallback is
not registered. Existing metadata that differs from verified bytes/hash is rejected.

## Invariants

- Request-local Neon Pool, one pinned transaction client, `SET LOCAL ROLE
  leasing_runtime` (non-owner/NOBYPASSRLS), actor context and rollback; application
  authorization additionally resolves/rechecks active staff/property scope.
- Property serialization, revision CAS, actor-scoped idempotency receipt and outcome
  audit commit together. Successful receipt replay returns current projection
  without mutating twice; mismatched key reuse fails.
- Organizations/contacts/inventory versions/members, requests/holds/leases,
  appointments/documents/receipts/audit remain relational. Private fields never enter
  public DTOs. Company category is a **derived UI projection**, not a new DB column:
  recorded lease → Đang thuê; else unexpired active hold → Đang giữ chỗ; else
  submitted/reviewing request → Đang tư vấn; else Chưa thuê.
- Diagram coordinates are labelled brochure references, not surveyed polygons.
  Same-row rectangular boundaries are source-labelled connections, not permission
  to remove walls; gaps/irregular outdoor geometry are not invented connections.
- Rental recording means a recorded PDF file, not eSign/signature certification.
  Financial fields stay unknown/null unless supplied. Replacement appends a version
  and retains previous linked bytes.
- PDF starts quarantine. Authorized **external manual review** records reviewer,
  time/note/seal; `scan_state` stays pending, no antivirus-clean claim. Byte signature
  checks are not antivirus. Retention/lease/plan links and selected logo block delete.
- Public contact commits lead/intake/cooldown/idempotency/audit, not a fabricated
  company, hold, booking or confirmed appointment.

## Isolated real database regression

```sh
npm run test:database
```

Requires authorized Neon CLI/project context. Defaults to `NEON_TEST_PARENT=test-template`;
`NEON_TEST_PROJECT_ID` may select the project. Parent must be a dedicated **empty**
non-primary/non-default/unprotected template, never production/customer data.
The runner checks parent/child non-system regular/partitioned/foreign/materialized
relations; only installed-extension-owned relations identified through `pg_depend`
are exempt. It checks distinct child branch/compute identity, initializes untouched
baseline+migrations+approved brochure seed, fetch-verifies real Neon PNG bytes/hash,
imports metadata, runs live tests and finally deletes **only its owned child**.
Schema-only is unavailable in this project because of the legacy web-access role;
normal cloning from the verified empty template preserves security roles safely.
Do not run `tests/live-workspace.test.ts` manually against a live workspace.

Observed: isolated command **2/2 passed, no skips**, repeated initialization validated
checksums/idempotency and the owned child was deleted; production-parent override
was refused before connection retrieval/DB query. Latest pure `test:admin` **23
passed / 1 deliberate live skip**, including category precedence/time-boundary test.
Main also reported typecheck, shared backend integrity/tests and OpenNext build pass.
These checks do not prove OTP delivery, antivirus or all-Worker media readiness:
native Worker→Neon S3/Functions still returns 403 HTML before provider. See
[readiness](../docs/backend-readiness.md). No checks rerun for this documentation edit.
