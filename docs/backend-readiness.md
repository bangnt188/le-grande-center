# Backend readiness — phase 2

Cập nhật 14/10/2026. Đây là trạng thái ứng dụng thật, không phải checklist folder-only hoặc demo Pages.

## Đã triển khai

| Boundary | Implementation hiện tại |
| --- | --- |
| Runtime | Next App Router SSR (`output: standalone`), OpenNext Cloudflare; admin/API cùng origin. Không static export/Pages hoặc deploy-dev-pages. |
| Auth | `/admin/` dùng email + mật khẩu qua Neon Auth, không Google OAuth. Admin/root cấp email và role Admin/Editor trong app; nhân viên tự tạo tài khoản email/password và xác minh email. Backend chỉ cho phép email có allowlist/assignment active; Editor không quản lý tài khoản hoặc cấu hình vận hành. Root `root@legrandecentre.vn` được cấp riêng, ẩn khỏi danh sách staff; mỗi request xác minh session mới, emailVerified, issuer/subject và quyền DB. |
| DB | `src/server/database.ts` dùng request-local Neon Pool, transaction `leasing_runtime` và actor context/RLS. `workspace.ts` parse command, property lock, CAS revision, idempotency receipts và audit trong cùng transaction; staff create/revoke/role changes cũng audit và recheck mỗi request. |
| Schema | Production backend has migrations 001–006; stage2 now has 001–009. Migration 007 adds staff role management, 008 normalizes operational statuses, and 009 adds shared-CRUD versions and append-only access decisions. The new staff/CRUD behavior is stage2-only; production backend and frontend have not been cut over. Production contains no customer transactions. |
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

Regression riêng đã chạy: `npm run test:database` **2/2 pass, không skip**, tạo child từ empty `test-template`, apply baseline+migrations+approved seed hai lần, verify logo bytes/hash và xóa đúng child trong `finally`. `test:admin` **30 pass/1 deliberate live skip**; shared backend **101/101 pass**, UI **63/63 pass**. Typecheck và OpenNext Worker build pass. Những kiểm tra này chưa phải bằng chứng Worker media origin hoạt động: native Worker→Neon S3/Functions từng trả 403 HTML trước provider.

Root password account production/stage2 được operator cấp và xác minh theo yêu cầu owner; không phải proof mailbox ownership/delivery. Local `:3108` đã đăng nhập root vào workspace, đọc 6 tầng/81 căn, reload giữ session, logout → API 401. Nhánh test riêng từ empty template cũng chạy password login, từ chối mật khẩu sai và phục hồi session sau reload. Không suy các path này thành OTP/mail recovery/OAuth/Cloudflare deployment đã hoạt động.

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
