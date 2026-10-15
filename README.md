# Le Grande Centre

Ứng dụng Next.js 16 App Router / React 19 cho website và quản trị Le Grande Centre.
Source: https://github.com/bangnt188/le-grande-center.git, nhánh làm việc `dev`.

## Runtime phase 2

- Next SSR với `output: "standalone"`; OpenNext tạo Cloudflare Worker. Không còn static export, GitHub Pages hoặc `deploy:dev`/publish-dev-pages.
- `/admin/` đăng nhập **Neon Auth thật**, email phải verified và có staff allowlist/assignment active trong DB. Signup không tự cấp quyền. `/admin/workspace/` và từng `/api/admin/*` kiểm tra session phía server; không có demo auth, role switch hoặc IndexedDB fallback.
- Neon PostgreSQL là nguồn dữ liệu nghiệp vụ. Command chạy transaction với runtime role/RLS, property lock, revision CAS, idempotency receipt và audit; không persist opaque snapshots. `AdminSnapshot` chỉ là DTO trả cho UI.
- Public SSR và `/api/public/website` dùng projection DB đã lọc. Không trả tenant/customer/contact nội bộ, hold expiry, điều khoản hợp đồng hoặc tài liệu private. DB lỗi không seed/chuyển sang fixture.
- Form dùng `@mall/ui/forms` live → `POST /api/contact`; chỉ báo nhận sau commit lead/intake. Đề nghị tham quan **không phải booking** và không tự tạo lịch hẹn đã xác nhận.

**Chưa deploy/cutover frontend production. Người dùng đã hoãn kết nối `legrandecentre.vn`/DNS; không thực hiện thay đổi domain trong giai đoạn này.** Domain mặc định trong SEO/config không phải bằng chứng domain đã kết nối.

## Chạy local với cloud thật

Yêu cầu Node **22.22+** (`node:util.parseEnv`) và quyền đọc cả hai submodule private.

```sh
git clone --branch dev https://github.com/bangnt188/le-grande-center.git
cd le-grande-center
git submodule update --init --recursive -- packages/ui packages/backend
npm ci
npm run media:catalog
npm run build:backend
npm run build:ui
NEXT_DEV_WRANGLER_ENV=stage2 node scripts/dev-live.mjs --env .env.stage2.local --env .env.stage2.app.local --port 3100
```

Envfiles là cấu hình local bị ignore, không được commit. `dev-live.mjs --env` nạp tường minh; file sau ghi đè file trước. Không dùng `node --env-file ... next dev`: Next chuyển cờ sang child qua `NODE_OPTIONS`, nơi Node từ chối cờ đó. `npm run dev` vẫn dùng được nếu môi trường server đã được nạp đúng.
Trên máy đã cấu hình `.env.local` thật: `npm run dev:live -- --env .env.local --port 3000` rồi mở `http://localhost:3000/admin/`. 

Mở `http://localhost:3100/admin/`. `NEXT_DEV_WRANGLER_ENV=stage2` chọn private bucket `mall-documents-stage2`; `PRIVATE_DOCUMENTS` và `PUBLIC_ASSETS` trong Wrangler dùng `remote: true`, tức thao tác R2 là thật, không phải emulator. Public assets dùng `mall-assets`. Xem [cấu hình Neon và secrets](docs/neon-setup.md), [readiness và bằng chứng runtime](docs/backend-readiness.md).

## Build, checks và CI

```sh
npm run check:backend
npm run typecheck
npm run test:backend
npm run test:admin
npm run build
npm run build:cloudflare
```

`build` tạo Next standalone; postbuild sao chép public/browser static assets vào artifact. `PORT=3000 HOSTNAME=127.0.0.1 npm start` chạy server.js thực, nạp .env.local nếu có; không dùng next start với standalone. `build:cloudflare` chạy OpenNext (bao gồm Next build). Public/admin/API dynamic không truy vấn DB lúc build. Build thành công không chứng minh kết nối cloud hay quyền production.

`scripts/build-cloudflare.mjs` tạm giấu các envfile chuẩn `.env*` mà OpenNext có thể nhúng vào bundle, rồi khôi phục trong `finally`. Dùng script này thay gọi trực tiếp OpenNext build. Chỉ public URL/SEO config được đưa vào build; DB/auth/media/API secrets phải được cấp ở server runtime/Worker secrets nếu deploy sau này. Không đưa secrets vào `NEXT_PUBLIC_*`, Git hoặc artifact.

Workflow `.github/workflows/backend-ci.yml` chỉ typecheck, pure application/shared backend tests, integrity và build Next/OpenNext. Environment có tên lịch sử `github-pages` chỉ giữ quyền truy cập secret submodule; không có Pages/deployment job. CI dùng `COMPONENT_UI_READ_TOKEN` đọc cả `packages/ui` và `packages/backend`; không fetch archive 3D. Không có CF/Neon CI secrets và không giả cloud tests.

`npm run test:database` là regression tích hợp trên **Neon branch cô lập từ empty test-template**, không phải pure CI check; cần Neon CLI operator scope, tuyệt đối không clone production/customer data. `npm run db:migrate` chỉ đọc **`DATABASE_URL_UNPOOLED`** direct URL; không override pooled `DATABASE_URL`. Xem [database guide](database/README.md). Không chạy migration production như một bước build.

Với runtime đang chạy và Chrome/Chromium có sẵn:

```sh
npm run smoke:public -- http://localhost:3100/
```

Đặt `CHROME_BIN` nếu cần. Smoke public không thay các kiểm tra auth/DB/media. Kết quả đã quan sát và giới hạn hiện tại nằm trong [backend readiness](docs/backend-readiness.md); không suy một build pass thành toàn bộ runtime pass.

## Auth, dữ liệu và nghiệp vụ

Trang `/admin/` dùng email + mật khẩu qua Neon Auth; không Google OAuth. Trong mục **Cấu hình → Tài khoản nhân viên**, Admin/root cấp email và vai trò **Admin** hoặc **Editor**. Nhân viên tự tạo mật khẩu ở trang đăng nhập; chỉ email được cấp quyền và xác minh mới vào được workspace. Neon là dịch vụ xác thực phía sau, không yêu cầu nhân viên đăng nhập Neon Console. Editor không được quản lý tài khoản hoặc sửa cấu hình vận hành. Root dùng allowlist riêng, có toàn bộ quyền ứng dụng và không xuất hiện trong danh sách nhân viên. Mutation yêu cầu cùng origin; quyền bị thu hồi được kiểm tra lại phía server.

Migration `007-staff-accounts.sql` thêm role/editor và danh sách tài khoản trong ứng dụng; cần chạy migration trước khi deploy phiên bản này. Migrations `001`–`006` đã áp dụng trên stage2 và production backend, nhưng `007` chưa áp dụng. Migration 006 thay root Google cũ bằng root mật khẩu; Google account cũ không còn quyền root. Local `:3108` dùng production backend đã quan sát root login → workspace `200`, 6 tầng/81 căn, reload giữ session và logout → API `401`; mật khẩu sai bị từ chối trên nhánh test riêng. Frontend production/domain/DNS chưa cutover.

Admin quản lý tầng/mặt bằng, doanh nghiệp, lead, yêu cầu/giữ chỗ, hồ sơ thuê, lịch hẹn và media. Lịch hẹn tách khỏi giữ chỗ. Hợp đồng là **upload/quản lý/liên kết PDF có sẵn**, không soạn thảo, không eSign hay tự xác nhận chữ ký. Chuyển giữ chỗ thành hồ sơ thuê là thao tác nghiệp vụ rõ ràng; không tạo số tài chính giả khi dữ liệu không có.

Sidebar chỉ có **Doanh nghiệp**, không mục Khách đang thuê/Hợp đồng riêng; outer `@mall/ui Tabs` bên trong gồm **Tất cả / Khách đang thuê / Hợp đồng**. Category card suy ra ưu tiên recorded lease → Đang thuê; else active hold chưa hết hạn → Đang giữ chỗ; else submitted/reviewing request → Đang tư vấn; else Chưa thuê. Không persist category riêng. Dossier→contract giữ đúng record ID qua subtab, unsaved-note confirmation giữ nguyên; arrow keys focus/Enter activate tabs. Global `AdminPageHeader` title/description/reload đã bỏ trên mọi màn, giữ local panel headings và error-only Thử lại khi empty workspace cần phục hồi.

Trang đăng nhập và chế độ tạo tài khoản đã được mở trong Chromium local; staff invitations/Admin↔Editor/revoke/editor-deny/root-hidden chạy trên nhánh Neon test riêng. `test:admin` 24 pass/1 deliberate live skip; `test:database` 2/2 pass, nhánh test đã xóa; typecheck và production build pass. Migration 007 chưa áp dụng lên stage2/production; các kết quả này không chứng minh email verification delivery hoặc frontend deploy.

Cấu hình website lưu DB và public đọc projection, không giới hạn cùng browser/origin. Public projection không chứa workspace riêng tư. Form contact kiểm tra consent/server fields, JSON tối đa 16 KiB, origin, UUID idempotency và rate limit DB với HMAC IP; cần proxy đáng tin cho `cf-connecting-ip`. Không có Turnstile hoặc cam kết chống abuse toàn diện.

Chi tiết: [backend structure](docs/backend-structure.md), [portability](docs/database-portability.md), [B2B design](docs/b2b-leasing-design.md), [ADR](docs/adr/0001-b2b-leasing-and-private-documents.md). Các tài liệu thiết kế lịch sử không thay trạng thái runtime hiện tại trong readiness.

## Media và storage

- PNG/JPEG/WebP được kiểm tra size/signature/dimensions, decode và re-encode pixels bằng Photon trên Node trước upload; bỏ metadata/trailing payload. Tối đa 4096 px mỗi chiều, 4 megapixel, 10 MiB/file; tối đa 4 file/20 MiB mỗi batch.
- Logo/favicon/ảnh upload nằm trong **Neon Object Storage `media`**, không dùng R2/static/browser persistence làm fallback logo. Ảnh/video/brochure dự án đã duyệt tiếp tục đọc R2 public `mall-assets`.
- App gọi `NEON_MEDIA_FUNCTION_URL` với server-only `MEDIA_ORIGIN_SECRET` qua `x-secret`. `src/server/media/neon-function.ts` là trusted storage origin, không endpoint upload anonymous: constant-time secret check trước đọc body, key allowlist, bounded PNG/JPEG/WebP. AWS S3 write keys chỉ ở origin. App vẫn phải authorize ownership/quota/reservation trước hop này.
- PDF giữ nguyên bytes trong R2 private `mall-documents` (`mall-documents-stage2` ở stage2), mặc định quarantine. Xem bình thường bị chặn; admin có thể tải riêng để **kiểm tra bên ngoài thủ công**, rồi ghi xác nhận và review note qua API. Không có antivirus, không gọi manual review là scan-clean/chữ ký hợp lệ.
- Private GET/HEAD/Range qua `/api/admin/media/{id}/view` resolve ID/key từ DB và xác minh quyền mỗi request; không public bucket/presigned URL cho browser. Retention/link hợp đồng chặn xóa; xóa vật lý xong mới giảm ledger.
- Quota app 8,500,000,000 bytes gồm inventory thực của public `mall-assets` + tracked Neon/private + reservations; inventory/ledger mismatch hoặc không đọc được inventory sẽ khóa upload. Đây không phải provider-wide spending cap. Xem [quota](docs/storage-quota.md), [private documents](docs/private-documents-r2.md).

**Giới hạn deployment hiện tại:** native fetch từ Cloudflare Worker tới Neon S3/Functions trả 403 HTML trước provider, trong khi Node request thành công và Worker truy cập Neon Auth được. Trusted media origin chưa chứng minh giải quyết cross-zone denial. Không tuyên bố all-Worker media ready; local Node + real remote R2 proof không phải production Worker proof.

Chuyển tài khoản/provider: chuyển schema+migrations và dữ liệu quan hệ, object keys/catalog cùng metadata size/hash đã xác minh; copy bytes, đối soát trước đổi locator/public URL. Không export/import opaque snapshots hoặc lưu signed URL dài hạn. Không sửa DNS để lách giới hạn này khi người dùng đã hoãn domain.

## Website public

Tên thương hiệu **Le Grande Centre**; public display dùng Charis SIL, body Be Vietnam Pro; brand/legacy editorial giữ Playfair Display. SEO mặc định `https://legrandecentre.vn/`; `NEXT_PUBLIC_SITE_URL` ghi đè domain/base path. Stage2 giữ `SEO_INDEXABLE=false`; index chỉ bật chủ động khi production đã được duyệt. Metadata/canonical và sitemap lấy public DB catalog, không private admin/3D routes.

Homepage `/` chỉ render `src/features/public/homepage-v2.tsx`. Hero giữ ảnh dự án `images/home-v2/hero.webp`. Phim dùng `PROJECT_FILM_URL` R2, không local MP4/poster/thumbnail; autoplay muted/loop/inline, có nút Bật/Tắt âm thanh. Video dừng ngoài viewport/tab ẩn/reduced motion. Public navigation dùng chung header/footer: Không gian kinh doanh `/tong-quan-tang/`, Le Grande Centre `/tong-quan/`, Đặt lịch tham quan `/lien-he/`, Mặt bằng `/mat-bang/`. Zalo giữ xanh nhận diện `#0068ff`; hotline và Zalo cấu hình độc lập.

`/mat-bang/` giữ Map/List loại trừ nhau, filter, popup trước khi điều hướng chi tiết, Escape/focus return và brochure đúng trang tầng. Tầng 1–2 có hai sơ đồ/22 căn A/B; khách có thể thuê từng căn hoặc kết hợp cặp liên thông, không ép thuê gộp. Chi tiết `/mat-bang/[unitId]/` dùng gallery ảnh dự án tham khảo, không ảnh bàn giao từng căn; map floating icon-only 48px ở trên trái dưới header. CTA tư vấn/tham quan giữ mã căn cho intake live; brochure không phải booking. Không suy dữ liệu kỹ thuật/giá/availability từ hình template.

Homepage giữ cảnh tách lớp **2D** có motion/reduced-motion trong `@mall/ui`; không nhầm với source 3D đã gỡ. Theo yêu cầu 13/10/2026, `/kham-pha/`, viewer links và publication JSON không xuất bản. Source/lịch sử liên quan nằm tại https://github.com/bangnt188/3d-model-mall, submodule `archives/3d-model-mall`; archive không thuộc TS/workspaces/build CI. GLB/HDR/cover còn trên R2 public theo lựa chọn người dùng; tách source không thu hồi direct asset URL.

## Shared UI/backend

`packages/ui` là `component-ui`, nhánh `shopping-mall`, package `@mall/ui`; `packages/backend` là `lib-ts-be`, nhánh `main`, package `@shared/backend`. Gitlink khóa commit build; không tự cập nhật nhánh trong CI. Shared UI không phụ thuộc dữ liệu/route/service của app; shared backend giữ primitives, không thay workflow leasing.

```sh
npm run preview:ui
npm run typecheck:ui
npm run pull
```

`pull` cập nhật hai submodule từ nhánh cấu hình và dừng khi có thay đổi chưa commit; review rồi commit gitlinks/lockfile ở root. Không dùng command này trong build. Clone thông thường checkout submodule detached HEAD là đúng. Cần Git credentials đọc cả hai repo.

```tsx
import "@mall/ui/styles";
import { Button } from "@mall/ui";

<main data-ui-root data-ui-theme="shopping-mall" data-ui-scheme="light">
  <Button>Liên hệ tư vấn</Button>
</main>
```

Dùng semantic tokens; popup kế thừa theme root. Motion/forms/toasts thuộc shared UI, nội dung/validation nghiệp vụ thuộc app. Xem [theme contract](packages/ui/docs/shopping-mall-theme.md) và [design](DESIGN.md).
