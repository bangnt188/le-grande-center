# Neon setup — phase 2

Cập nhật 15/10/2026. Project `wispy-sunset-10596642` (tên hiển thị lịch sử `mall-staging`, Singapore) hiện chỉ còn Neon branch **`production` (`br-tiny-butterfly-b3uuw92p`)**. Local và Worker hiện có cùng dùng DB/Auth production; không có backend database thứ hai.

## Thành phần hiện tại

- Neon PostgreSQL: dữ liệu quan hệ, staff assignment/allowlist, CAS/idempotency/audit, public projection và intake. Sau reset được owner duyệt, baseline+migrations **001–009** đã áp dụng; catalog approved 6 tầng/81 căn, không còn business data cũ. Root allowlist và approved Neon logo được giữ/khôi phục; provider Auth/storage được giữ, Auth chỉ còn root.
- Neon Auth: `/admin/` dùng email + mật khẩu, không Google OAuth. Admin/root cấp email và vai trò Admin/Editor trong app; nhân viên tự tạo mật khẩu tại `/admin/` và xác minh email theo cấu hình provider. Signup không tự cấp quyền. Neon Auth chỉ là dịch vụ backend; nhân viên không cần vào Neon Console. Root `root@legrandecentre.vn` nằm trong allowlist riêng, bị ẩn khỏi danh sách nhân viên. App kiểm tra session mới, issuer/subject và quyền DB trên từng request.
- `neon.ts`: bucket `media` `public_read`; function `media` source `src/server/media/neon-function.ts`. Không lưu tài liệu nội bộ vào bucket public-read.
- Function media là **trusted server origin**: `x-secret: MEDIA_ORIGIN_SECRET` (ít nhất 64 ký tự), constant-time auth trước body/storage, chỉ known branding UUID keys và key logo approved, PUT ảnh PNG/JPEG/WebP bounded 10 MiB với signature/dimension checks. Không có anonymous write/arbitrary key endpoint. Node app phải kiểm tra session/quota/ownership và reserve trước gọi origin.
- AWS S3 credentials chỉ ở Neon origin; ứng dụng gọi `NEON_MEDIA_FUNCTION_URL`, không chuyển AWS write keys vào Worker/browser. Public URL ảnh không phải quyền ghi.

## Local runtime

Cần Node **22.22+**. Sau `npm ci`, `npm run dev` tự generate media catalog và build hai submodule qua `predev`. Operator chỉ cấu hình **`.env.local`** (gitignored), không nhiều profile:

```sh
npm run dev -- --port 3000
# Sau npm run build:
npm start
```

`scripts/load-local-env.mjs` nạp `.env.local` và ghi đè biến cùng tên còn sót trong shell cho dev/start/migration/password command. Không dùng Node `--env-file` để spawn Next dev. Local chạy với production cloud thật: không tạo dữ liệu thử trong app như thể đây là sandbox. Không đưa credentials vào output, Git hoặc `NEXT_PUBLIC_*`.

Cấu hình server phải cùng branch production:

| Nơi | Biến/cấu hình |
| --- | --- |
| Next app | `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` (≥32 ký tự), `CONTACT_RATE_LIMIT_SECRET` (≥32), `NEON_MEDIA_FUNCTION_URL`, `MEDIA_ORIGIN_SECRET`, endpoint Neon để dựng public locator |
| Trusted Neon media origin | `MEDIA_ORIGIN_SECRET` cùng giá trị với app; `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` do môi trường origin cung cấp |
| R2 | `PRIVATE_DOCUMENTS`/`PUBLIC_ASSETS` bindings; `R2_PRIVATE_BUCKET` đúng môi trường và `R2_ACCOUNT_ID`; Node ngoài binding cần scoped R2 access keys nếu dùng S3 adapter |
| Public build config | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_R2_PUBLIC_BASE_URL`, `NEXT_PUBLIC_NEON_MEDIA_BASE_URL`, `SEO_INDEXABLE` — không có secret |

Wrangler chỉ có một root config: private PDF `mall-documents`, public `mall-assets`, bindings `remote: true` nên dev thực sự thao tác cloud. Không fallback private files sang public assets. Worker hiện có `https://le-grande-centre-stage2.nguyenbang-skyone.workers.dev` giữ noindex. Tên Worker và private cache R2 `le-grande-centre-stage2-next-cache` / D1 `le-grande-centre-stage2-next-tags` còn hậu tố lịch sử `stage2`, **không phải Neon branch hoặc profile khác**.

## Operator commands, migration và regression

```sh
npm run db:migrate
# Đặt ROOT_ADMIN_PASSWORD riêng trong .env.local trước thao tác đổi mật khẩu:
npm run auth:set-password -- root@legrandecentre.vn
# Build OpenNext và deploy cùng artifact lên Worker hiện có:
npm run deploy
```

`db:migrate` nạp `.env.local`, chỉ dùng **DATABASE_URL_UNPOOLED** direct URL, không override pooled DATABASE_URL và không chạy trong build/deploy. Runner kiểm migration hash và approved seed, không tạo tenant/financials giả. `auth:set-password` cập nhật provider identity đã tồn tại, không cấp quyền staff; giữ password prefix khớp runtime nếu có. Không có deploy aliases/profile.

`npm run test:database` dùng **PostgreSQL local disposable do runner sở hữu**; cần `postgres`, `initdb`, `pg_ctl` trên `PATH` (macOS có thể cài Homebrew `postgresql@17`). Runner không dùng Neon CLI, không tạo/clone Neon branch và không nạp production secrets. Nó tạo cluster rỗng loopback-only, kiểm ownership, apply baseline+migrations+approved seed hai lần, chạy regression rồi dừng/xóa đúng cluster của lần chạy. Logo metadata là fixture offline, không chứng minh delivery. Kết quả đã quan sát **2/2 pass**; hướng dẫn Homebrew và giới hạn tại [database guide](../database/README.md).

## Bằng chứng và giới hạn

**Bằng chứng lịch sử trước reset:** local Node Next từng quan sát sign-in/workspace, PNG upload/read/delete, PDF quarantine/manual-review/Range, hold→lease, appointment transition và contact POST 201. Fixture emailVerified **không chứng minh OTP delivery**. Các isolated Neon regression cũ, application/shared tests, browser responsive và standalone smoke là kết quả thời điểm trước, không phải setup/test strategy hiện tại. Sau hợp nhất, root login đã trả HTTP 200. [Readiness](backend-readiness.md) tách bằng chứng, performance đang chẩn đoán và giới hạn.

Native Cloudflare Worker fetch tới Neon S3/Functions trả 403 HTML trước provider (anonymous GET cũng vậy); Node native request được, Worker tới Neon Auth được. Protected function có code nhưng **chưa chứng minh khắc phục cross-zone denial**. Không claim Worker media ready, không tự đổi domain/DNS để giải quyết.

Worker hiện có đã deploy dùng production backend duy nhất. Custom-domain `legrandecentre.vn`/DNS vẫn hoãn; Worker giữ noindex. Provider Auth verification/OTP settings không chứng minh email delivery/recovery. Snapshot trước reset `snap-misty-sea-b3tgf6is` (hết hạn 2026-10-22T23:59Z) và private dump được ghi trong [database guide](../database/README.md). Không tự provision/đổi credentials khi chỉ chạy build/CI.

`scripts/build-cloudflare.mjs` tạm giấu standard envfiles để OpenNext không nhúng secrets, rồi khôi phục. Cấp API/DB/auth/media secrets bằng Worker runtime secrets, không artifact. `.neon`, `.env.local` và auth CLI state phải bị ignore. Không commit OAuth/API keys vào project config.
