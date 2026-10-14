# Backend readiness — phase 2

Cập nhật 14/10/2026. Đây là trạng thái ứng dụng thật, không phải checklist folder-only hoặc demo Pages.

## Đã triển khai

| Boundary | Implementation hiện tại |
| --- | --- |
| Runtime | Next App Router SSR (`output: standalone`), OpenNext Cloudflare; admin/API cùng origin. Không static export/Pages hoặc deploy-dev-pages. |
| Auth | `/admin/` dùng Neon Auth, upstream session mới, emailVerified, issuer/subject binding với staff allowlist/assignment DB active. Signup không tự cấp quyền. `/admin/workspace/` và từng API kiểm tra độc lập; mutation kiểm tra origin. Không demo login/IndexedDB fallback. Hiện workspace dành cho administrator được allowlist, không tuyên bố portal/multi-role đã hoàn tất. |
| DB | `src/server/database.ts` dùng request-local Neon Pool, transaction `leasing_runtime` và actor context/RLS. `workspace.ts` parse command, property lock, CAS revision, idempotency receipts và audit trong cùng transaction; lưu quan hệ, không opaque snapshot. |
| Schema | Baseline + migrations 001–004 đã áp dụng trên stage2, regression disposable và backend production. Production seed chỉ 6 tầng/81 căn approved brochure, configured owner allowlist và approved Neon logo đã xác minh, không customer/financial transactions giả. Frontend production chưa deploy/cutover. |
| Public | SSR và `/api/public/website` đọc projection DB; không trả tenant/contact nội bộ, hold expiry hoặc hợp đồng. DB lỗi không chuyển fixture. |
| Intake | `@mall/ui/forms` live → `POST /api/contact`, cap JSON 16 KiB, consent/field/origin validation, UUID idempotency, HMAC IP + DB cooldown/rate limit. Commit lead/intake trước HTTP 201; visit request không tạo/xác nhận booking. Không có Turnstile. |
| Media | Bounded multipart, PNG/JPEG/WebP decode/re-encode trên Node; Neon-only logo/ảnh upload, R2 private PDF; DB ownership/quota/reservations, inventory và cleanup/reconcile. |
| Tài liệu | PDF quarantine; ordinary view 403 trước manual external review. Review ghi actor/time/note/hash, không đặt scan-clean hay xác nhận chữ ký. GET/HEAD/Range kiểm tra quyền, retention/link chặn xóa. Không soạn hợp đồng/eSign. |

## Media origin và secrets

`src/server/media/neon-function.ts` là protected trusted server origin. App gọi `NEON_MEDIA_FUNCTION_URL` với `x-secret: MEDIA_ORIGIN_SECRET`; function kiểm tra constant-time secret (ít nhất 64 ký tự) trước body/storage. Chỉ GET/PUT/DELETE key branding UUID đã giới hạn và key logo approved (không PUT), PNG/JPEG/WebP tối đa 10 MiB, có signature/dimension checks. Không phải public arbitrary object proxy. App authorize session/property/quota và durable reservation trước hop này. AWS S3 keys chỉ tại origin; cookie/DB/HMAC/media-origin secrets đều server-only.

`scripts/build-cloudflare.mjs` giấu envfiles chuẩn trong lúc OpenNext bundle rồi khôi phục. Không gọi trực tiếp OpenNext build với file chứa secret. Nếu deploy sau này, cấp secret ở Worker runtime; không commit/bundle hoặc dùng `NEXT_PUBLIC_*` cho secrets.

`mall-assets` là public R2 project catalog; `mall-documents` là private production bucket, `mall-documents-stage2` là private stage2 bucket. Wrangler dev bindings `remote: true` thực sự đọc/ghi cloud. Meter bao gồm inventory public + tracked Neon/private + reservations, không chỉ uploaded list; mismatch/unavailable inventory khóa upload. Xem [quota](storage-quota.md).

## Bằng chứng runtime đã quan sát trong giai đoạn phase 2

Các kết quả sau được ghi nhận ở localhost:3100 chạy Node Next với Neon/R2 thật, không phải kết quả deploy Worker production:

- Neon Auth sign-in HTTP 200 và authorized workspace HTTP 200.
- PNG upload 200, public object GET 200; sau xóa, physical object GET 404.
- Private PDF upload 200; ordinary view khi quarantine 403; manual external review 200; authorized Range đọc 206.
- Ghi hồ sơ thuê từ held B.1/B.2 chuyển toàn bộ sang Đang thuê; appointment requested → confirmed.
- Browser public form POST 201 tạo lead/intake thực, không tạo appointment.
- Migrations 001–004 trên stage2 và branch disposable; sau đó backend production cũng đã được khởi tạo baseline+migrations, 6 tầng/81 căn approved brochure, chỉ configured owner allowlist và approved Neon logo (native authorized GET kiểm bytes/hash, 25.230 bytes). Không có production frontend deployment trong bằng chứng này.
- Tắt quyền fixture DB khi Auth session còn hợp lệ: get-session 200 nhưng workspace/private PDF đều 403; đăng xuất qua UI đưa về /admin và cả hai API trả 401.
- PDF R2 không liên kết: upload/rename/delete đều 200, GET sau xóa 404; used bytes trở về đúng mức trước upload và reserved bytes bằng 0.
- Local localhost:3101 dùng backend production đã seed sạch: public API/homepage 200, 6 tầng/81 căn đều Trống, logo Neon đúng branch, không tenant fields; admin chưa đăng nhập 401. Domain/DNS và frontend production không đổi.
- Artifact standalone: npm start chạy server.js không cảnh báo next-start/standalone; năm trang public, /mat-bang/A.1/ và JS asset trả 200, admin chưa đăng nhập 401.

Regression riêng đã chạy: `npm run test:database` **2/2 pass, không skip**, tạo child từ empty `test-template`, apply nguyên baseline + migrations001–004 + approved seed hai lần, verify Neon PNG bytes/SHA và xóa đúng child trong finally. `test:admin` **23 pass/1 deliberate live skip**, gồm category precedence/time-boundary; typecheck/backend integrity, 101 shared backend tests và OpenNext build pass. Browser1440/390/320px không page overflow, tenant table min720 scroll nội bộ. Live suite thực thi riêng, production-parent override bị từ chối trước DB connection. Không phải email-delivery/Worker-media/frontend-deploy proof.

EmailVerified của **test fixture** đã được đặt trong DB phục vụ kiểm tra. Sign-in thành công không chứng minh email OTP delivery, Google OAuth, recovery email hoặc production owner onboarding đã hoạt động. Không suy một path pass thành tất cả workflow/security checks pass.

## Giới hạn còn thật

**Native Cloudflare Worker fetch tới Neon S3 và Neon Functions trả 403 HTML trước provider**, gồm anonymous GET. Node native request thành công và Worker tới Neon Auth được. Protected origin đã có code nhưng chưa chứng minh vượt cross-zone denial; không tuyên bố full Worker media ready hoặc đã sửa lỗi provider network. Local Node với R2 remote không phải full Worker proof.

Production backend đã được chuẩn bị như trên; Neon Auth production đã bật email OTP, require verification và gửi verification khi signup/signin, thêm trusted origin localhost:3000. Cấu hình không chứng minh email delivery hoặc owner onboarding. Production frontend **chưa deploy/cutover**; không dùng stage2 fixture làm owner production. Người dùng đã **hoãn kết nối `legrandecentre.vn`/DNS**; không đòi DNS/custom-domain task để hoàn tất code, không deploy hoặc đổi domain trong scope này.

## Lệnh và CI

Xem [README](../README.md) và [Neon setup](neon-setup.md) cho `scripts/dev-live.mjs --env ...`, Node 22.22+ và remote stage2 bindings. Không dùng Node `--env-file` để spawn Next dev.

- `npm run check:backend`, `typecheck`, `test:backend`, `test:admin`: integrity/type/pure checks.
- `npm run test:database`: isolated real Neon regression, cần quyền operator; không chạy giả trong CI không có secrets.
- `npm run db:migrate`: operator-only **DATABASE_URL_UNPOOLED** direct URL, không override pooled DATABASE_URL, không trong build/deploy job.
- `npm run build` và `build:cloudflare`: standalone/OpenNext artifacts, không cloud proof.

`.github/workflows/backend-ci.yml` dùng environment tên lịch sử `github-pages` để đọc secret `COMPONENT_UI_READ_TOKEN`, fetch đúng packages/ui + packages/backend; archive 3D bị loại. CI không có CF/Neon runtime secrets, không deploy hay tự migrate. Shared backend integrity/type/tests vẫn giữ. Cloudinary generic còn thuộc library nhưng không phải provider được yêu cầu cấp cho Mall hiện tại.

Tài liệu: [structure](backend-structure.md), [private documents](private-documents-r2.md), [portability](database-portability.md), [DB migrations](../database/README.md).
