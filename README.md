# Le Grande Center

Ứng dụng Le Grande Center. Repo:
https://github.com/bangnt188/le-grande-center.git.

`main` chỉ chứa README tạm; workspace và cấu hình phát triển nằm trên `dev`.

## Architecture Decision: shared UI

Sử dụng `component-ui` qua Git submodule tại `packages/ui`, theo dõi nhánh
`shopping-mall`; commit khởi tạo là `6c0fbff`. Gitlink khóa phiên bản dùng cho
build, nhánh chỉ xác định nguồn khi chủ động cập nhật. npm workspace liên kết
package với tên hiện có `@mall/ui`, không cần publish lên npm.

Component dùng chung không phụ thuộc dữ liệu, route hay dịch vụ của ứng dụng.
Theme qua CSS semantic token, không cần server để cung cấp cấu hình giao diện.
Đổi lại, clone/CI phải khởi tạo submodule và build UI trước khi build ứng dụng.

Threat model: mã từ dependency là một phần của chuỗi cung ứng. Dùng commit
submodule đã review và lockfile; không tự động cập nhật nhánh trong build/CI.
Theme không tải CSS/script từ website tham chiếu. Font cần được ứng dụng cung
cấp từ tài nguyên tĩnh đã kiểm tra license. Không commit credentials hoặc `.env`.

Migration: build app trong repo root khi chọn framework, giữ dependency
`@mall/ui` và import qua các export công khai. Khi cập nhật thư viện, review diff,
chạy build/typecheck, rồi commit gitlink mới cùng lockfile nếu dependency thay đổi.

## Ứng dụng Next.js

Repo dùng Next.js 16 App Router, React 19 và static export như bản demo Solar.
Website công khai hiện là trang chờ bàn giao; chưa thay thế nội dung đang chạy ở
<https://legrandecentre.vn/>.

```sh
git clone --branch dev --recurse-submodules https://github.com/bangnt188/le-grande-center.git
cd le-grande-center
npm ci
npm run dev
```

Mặc định local dùng base path `/le-grande-center/` giống GitHub Pages. Mở
`http://localhost:3000/le-grande-center/admin-preview/` để thử giao diện quản trị.

## Deploy demo từ dev

Code nguồn được push lên `dev`; artifact Next.js static export nằm trên `gh-pages`.
Xuất bản có thể lặp lại bằng lệnh dưới đây sau khi push code:

```sh
npm run deploy:dev
```

Lệnh kiểm tra branch/source commit, typecheck, repository contract, build demo,
rồi push artifact bằng commit thường (không force). GitHub Pages được cấu hình
nguồn `gh-pages` ở thư mục root. Không thay domain production.

Template Actions ở `docs/deployment/dev-pages.yml` chưa được kích hoạt vì token
hiện tại thiếu quyền `workflow`. Khi có credential phù hợp: chuyển template sang
`.github/workflows/dev-pages.yml`, cấu hình Pages source là Actions và cho phép
branch `dev` trong environment `github-pages`. Secret UI chỉ đọc đã được thiết lập.

Demo: https://bangnt188.github.io/le-grande-center/admin-preview/

Bản Pages là fixture công khai, không có dữ liệu người dùng thật, auth hoặc DB.
Mặc định `npm run build` loại admin khỏi artifact website. Lệnh deploy demo opt-in
qua `NEXT_PUBLIC_ADMIN_DEMO=true` và `INCLUDE_ADMIN_DEMO=true`; cấu hình này không
cho phép gắn backend API. Không dùng demo Pages làm admin production.

## Kết nối dữ liệu sau này

TSX gọi `useAdminData`, không ghi trực tiếp vào dữ liệu nguồn. Interface
`AdminRepository` có adapter demo và adapter HTTP cùng trả `AdminSnapshot`.
Transport dùng revision, request idempotency, cookie session và trạng thái lỗi.
Cấu hình `NEXT_PUBLIC_ADMIN_API_URL` chỉ là URL công khai của backend; không đặt
DB URL, secret hoặc credential trong biến `NEXT_PUBLIC_*`.

[Hợp đồng API và migration](docs/admin-data-contract.md),
[SQL baseline duy nhất](database/schema.sql) và
[thiết kế giao diện](DESIGN.md). Backend/auth/database chưa được triển khai.

## Thiết kế hệ thống B2B đã chốt

- [Thiết kế nghiệp vụ, admin, DB và migration](docs/b2b-leasing-design.md).
- [Hợp đồng private trên R2 và Workers Free](docs/private-documents-r2.md).
- [SQL baseline PostgreSQL duy nhất](database/schema.sql) và [hướng dẫn DB](database/README.md).
- [Thuật ngữ](CONTEXT.md) và [quyết định kiến trúc](docs/adr/0001-b2b-leasing-and-private-documents.md).

Luồng: gửi yêu cầu → chủ đầu tư duyệt → giữ chỗ có hạn. Lịch hẹn độc lập.
SQL là thiết kế chưa apply; auth/backend/database vẫn chưa kết nối.

## Architecture Decision: admin

Phân tích luồng quản trị, boundary bảo mật, nội dung và migration trong
[Architecture Decision Admin](docs/admin-architecture-decision.md). Admin thực
tế phải chạy trên Next.js server runtime managed; không đặt trên GitHub Pages.

## Khởi tạo shared UI

```sh
git clone --branch dev --recurse-submodules https://github.com/bangnt188/le-grande-center.git
cd le-grande-center
npm ci
npm run build:ui
npm run typecheck:ui
npm run preview:ui
```

Với clone chưa có submodule:

```sh
git submodule update --init --recursive
```

`npm run pull` updates submodules from their configured branches: backend
`main`, Mall UI `shopping-mall`. It stops if a submodule has uncommitted
changes. Review the updated commits, then commit the new gitlinks in this app
repository to pin the versions used by its build. Both submodule repos are
private; authenticate with `gh auth login` or configure Git credentials that
can read both repositories.

`preview:ui` mở catalog component bằng Vite; đây là preview thư viện, không phải
ứng dụng Le Grande Center.

## Theme shopping mall

```tsx
import "@mall/ui/styles";
import { Button } from "@mall/ui";

<main data-ui-root data-ui-theme="shopping-mall" data-ui-scheme="dark">
  <Button>Liên hệ tư vấn</Button>
</main>
```

Đặt theme, scheme và density trên cùng root. Dùng `data-ui-scheme="light"` cho
nền kem. Popup cần `portalContainer` nằm trong root để kế thừa theme.
Font body: Be Vietnam Pro; font display: Playfair Display.

Nguồn token và contract: [Shopping mall theme](packages/ui/docs/shopping-mall-theme.md).

## Cập nhật UI có chủ đích

```sh
git -C packages/ui fetch origin
git -C packages/ui switch shopping-mall
git -C packages/ui merge --ff-only origin/shopping-mall
npm install
npm run build:ui
npm run typecheck:ui
git diff --submodule=log
```

Sau khi review, commit gitlink `packages/ui` và lockfile ở repo root. Một fresh
clone thường checkout submodule ở detached HEAD của commit đã khóa; đây là hành
vi mặc định của Git submodule.

## Demo hành trình thuê B2B

Mở `/admin-preview/`: giao diện bắt đầu ở **Khách hàng**. Có thể duyệt luồng:

1. Chọn An Retail → **Yêu cầu & giữ chỗ** → mở phương án B.2 + B.3 (328 m²).
2. Nhập số giờ rồi duyệt giữ chỗ; xem cập nhật ở **Tầng & mặt bằng**.
3. Mở yêu cầu đã duyệt → **Mô phỏng ký & chuyển thuê** → xem **Hợp đồng**.
4. Mở **Góc nhìn khách thuê**: trang giới thiệu không hiện thời hạn riêng;
   Portal An Retail có giữ chỗ, tài liệu mẫu và book lịch của doanh nghiệp.

Demo dùng dữ liệu giả lập trong phiên, tài liệu HTML không có chữ ký. Portal là
chế độ xem thử, chưa có xác thực; không nhập hồ sơ/hợp đồng thật. Backend,
authorization và Worker/R2 cần được triển khai theo docs trước khi dùng thật.

## Backend readiness và storage generic

[Checklist trước khi khách hàng tạo tài khoản](docs/backend-readiness.md) tách phần
code còn thiếu khỏi tài khoản/credentials cần cấp. R2/Cloudinary có module generic
trong shared backend và [lệnh smoke upload/read/delete](packages/backend/docs/storage.md).
Đây không phải production integration đã deploy; quota/Worker/session/DB vẫn cần
hoàn thiện trước khi bật dữ liệu thật.
