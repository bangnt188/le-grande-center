# Architecture Decision — Backend core dùng chung Mall và Solar

Ngày quyết định 07/10/2026; cập nhật 14/10/2026: Mall đã có adapter Neon Auth/PostgreSQL/media thật và Next SSR/OpenNext. Frontend production chưa deploy/cutover. Không giữ Pages static hoặc backend riêng như phương án cũ.

## Thiết kế

Repo `lib-ts-be` duy trì `@shared/backend`; Mall và Solar dùng submodule `packages/backend`, mỗi app ghim commit đã review. Core không dependency runtime hoặc cache quyền xuyên request; giữ operation authorization, query selection, SQL parameterization, validation, transport và crypto. App giữ schema, session/staff mapping, B2B transitions, audit và deploy.

Mall dùng `src/server/{auth,database,workspace,public}.ts` và `src/server/media/`, bind cùng-origin Next route handlers. `AdminSnapshot`/commands là HTTP contracts; dữ liệu lưu quan hệ, property lock + CAS/idempotency/audit/RLS, không stored snapshot/IndexedDB fallback. Auth verified email + DB active administrator allowlist; không tự cấp role sau signup. Public projection riêng và intake tạo lead, không booking. PDF là upload/manage + manual external review, không eSign/antivirus-clean.

Solar có adapter/schema riêng; fixedScope chỉ phù hợp DB đơn tenant đã kiểm chứng. Không copy Solar tenant mapping/keyring hoặc giả định app khác tự có Mall policy. Mọi key/credential tách ứng dụng và môi trường.

## Security và trade-off

Threats gồm forged scope, cross-tenant/property/record reads, leaked count/fields, stale policy/write, lost audit và shared secrets. Scope phải áp dụng trước count/paging; session và assignment/state được kiểm tra đúng transaction boundary, command outcome audit cùng commit. Generic CRUD không thay lease/hold/media invariants.

Adapter nhiều cấu hình hơn browser demo nhưng giữ business contract và portability. Gitlink/checksum chống drift; không update nhánh tự động trong build. Shared library fixtures/tests không là fallback runtime trong Mall.

## Migration và build

Build core trước consumer, đồng bộ dependency/lockfile. Giữ `npm run check:backend`, `typecheck:backend`, `test:backend` và handoff tarball integrity. App CI thêm full typecheck, pure admin boundaries và `build:cloudflare` (Next standalone + OpenNext), không live DB test/deploy khi không có CF/Neon secrets. Chỉ fetch packages/ui/backend, không archive 3D.

Baseline + migrations 001–004 áp dụng stage2/regression disposable và backend production, seed chỉ approved 6 tầng/81 brochure slots, configured owner allowlist và verified Neon logo, không fake customer/financial records. Production Auth verification/OTP configured không chứng minh delivery/onboarding; frontend production chưa deploy/cutover. Model transfer là schema+migrations, relational data và object keys/catalog với verified size/hash, không opaque snapshots hay presigned URLs.

Local Node real-cloud proof không chứng minh Worker media ready: native Worker fetch tới Neon S3/Functions còn 403 HTML trước provider. Trusted protected Neon origin có code nhưng chưa chứng minh sửa denial. Domain/DNS bị người dùng hoãn; frontend production chưa deploy/cutover. [Readiness](../backend-readiness.md) ghi bằng chứng cụ thể; không có build/test mới trong lần chỉnh ADR này.

Shared contracts: [application decision](../../packages/backend/docs/shared-applications.md), [submodule workflow](../../packages/backend/docs/submodules.md).
