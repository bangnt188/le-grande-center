# Neon setup — phase 2

Cập nhật 14/10/2026. Project `wispy-sunset-10596642` (tên hiển thị `mall-staging`, Singapore) phục vụ kết nối Neon Auth/PostgreSQL/Object Storage thật cho phase2.

## Thành phần hiện tại

- Neon PostgreSQL: dữ liệu quan hệ, staff allowlist, workspace CAS/idempotency/audit, public projection và form intake. Baseline + migrations 001–004 đã áp dụng vào stage2, regression disposable và backend production. Production chỉ khởi tạo 6 tầng/81 căn approved brochure, configured owner allowlist và logo Neon approved đã xác minh (25.230 bytes), không fake customer/financial transactions.
- Neon Auth: `/api/auth` managed proxy, verified email và issuer/subject binding với staff allowlist/assignment active. Signup không tự cấp quyền; không có demo login.
- `neon.ts`: bucket `media` `public_read`; function `media` source `src/server/media/neon-function.ts`. Không lưu tài liệu nội bộ vào bucket public-read.
- Function media là **trusted server origin**: `x-secret: MEDIA_ORIGIN_SECRET` (ít nhất 64 ký tự), constant-time auth trước body/storage, chỉ known branding UUID keys và key logo approved, PUT ảnh PNG/JPEG/WebP bounded 10 MiB với signature/dimension checks. Không có anonymous write/arbitrary key endpoint. Node app phải kiểm tra session/quota/ownership và reserve trước gọi origin.
- AWS S3 credentials chỉ ở Neon origin; ứng dụng gọi `NEON_MEDIA_FUNCTION_URL`, không chuyển AWS write keys vào Worker/browser. Public URL ảnh không phải quyền ghi.

## Local runtime

Cần Node **22.22+**. Sau `npm ci`, build hai submodule và generate media catalog như README. Envfiles sau là file operator bị ignore, không commit:

```sh
NEXT_DEV_WRANGLER_ENV=stage2 node scripts/dev-live.mjs --env .env.stage2.local --env .env.stage2.app.local --port 3100
```

`--env` nạp qua `node:util.parseEnv`; file sau override file trước. Không dùng `node --env-file ... next dev`: Next forward `execArgv` qua `NODE_OPTIONS` của child và Node từ chối cờ đó. Không đưa credentials vào CLI output hoặc `NEXT_PUBLIC_*`.

Cấu hình server cần đúng môi trường:

| Nơi | Biến/cấu hình |
| --- | --- |
| Next app | `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` (≥32 ký tự), `CONTACT_RATE_LIMIT_SECRET` (≥32), `NEON_MEDIA_FUNCTION_URL`, `MEDIA_ORIGIN_SECRET`, endpoint Neon để dựng public locator |
| Trusted Neon media origin | `MEDIA_ORIGIN_SECRET` cùng giá trị với app; `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` do môi trường origin cung cấp |
| R2 | `PRIVATE_DOCUMENTS`/`PUBLIC_ASSETS` bindings; `R2_PRIVATE_BUCKET` đúng môi trường và `R2_ACCOUNT_ID`; Node ngoài binding cần scoped R2 access keys nếu dùng S3 adapter |
| Public build config | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_R2_PUBLIC_BASE_URL`, `NEXT_PUBLIC_NEON_MEDIA_BASE_URL`, `SEO_INDEXABLE` — không có secret |

Wrangler stage2 dùng `mall-documents-stage2` private và `mall-assets` public, cả hai `remote: true`: dev thực sự thao tác object cloud. Default private bucket là `mall-documents`; không fallback private files sang public assets. Stage2 giữ noindex.

## Migration và regression

`npm run db:migrate` chỉ đọc **DATABASE_URL_UNPOOLED**, direct URL; không override pooled DATABASE_URL và không chạy trong build. Migration hash/approved seed không fake tenant/financials. `test:database` cần Neon CLI, mặc định `NEON_TEST_PARENT=test-template`: verified empty nonprimary/nondefault/unprotected parent, kiểm tra parent/child non-system regular/partitioned/foreign/materialized tables; chỉ miễn relation installed-extension-owned qua pg_depend. Child identity/compute khác, baseline+migrations/approved seed/logo init, tests và finally delete owned child. Không production/customer-data clone; override production bị từ chối trước connection retrieval. Schema-only bị provider từ chối bởi legacy role leasing_runtime, không xóa role để lách. Isolated runner đã2/2pass; chi tiết [database guide](../database/README.md).

## Bằng chứng và giới hạn

Local Node Next đã quan sát real sign-in/workspace, PNG upload/read/delete, PDF quarantine/manual-review/Range, hold→lease, appointment transition và contactPOST201 real lead. Fixture emailVerified **không chứng minh OTP delivery**. Isolated `test:database` **2/2 pass không skip**, verified empty-template child được finally xóa. `test:admin` **23 pass/1 deliberate live skip**, category precedence/boundary regression; typecheck/backend integrity, 101 shared backend tests và OpenNext build pass. Browser1440/390/320px không overflow, tenant table scroll nội bộ. Standalone npm start: năm trang public, unit detail và JS asset200, admin chưa đăng nhập401. [Readiness](backend-readiness.md) tách bằng chứng và giới hạn.

Native Cloudflare Worker fetch tới Neon S3/Functions trả 403 HTML trước provider (anonymous GET cũng vậy); Node native request được, Worker tới Neon Auth được. Protected function có code nhưng **chưa chứng minh khắc phục cross-zone denial**. Không claim Worker media ready, không tự đổi domain/DNS để giải quyết.

Production backend đã khởi tạo như trên. Production Neon Auth đã bật email OTP, require verification, gửi verification khi signup/signin và thêm localhost:3000 trusted origin; chưa chứng minh OTP delivery/owner onboarding. Production frontend **chưa deploy/cutover**. Người dùng hoãn kết nối `legrandecentre.vn`/DNS; không có yêu cầu custom-domain ở scope hiện tại. Không deploy/provision/đổi credentials khi chỉ chạy build/CI.

`scripts/build-cloudflare.mjs` tạm giấu standard envfiles để OpenNext không nhúng secrets, rồi khôi phục. Nếu deployment được duyệt sau này, cấp API/DB/auth/media secrets bằng Worker runtime secrets, không artifact. `.neon`, envfiles và auth CLI state phải bị ignore. Không commit OAuth/API keys vào project config.
