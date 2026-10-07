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
Trang chủ là không gian 3D tương tác của Le Grande Centre; không còn trang chờ
bàn giao nội dung. Repo chưa được xuất bản thay thế domain production.

```sh
git clone --branch dev --recurse-submodules https://github.com/bangnt188/le-grande-center.git
cd le-grande-center
npm ci
npm run dev
```

Mặc định local dùng base path `/le-grande-center/` giống GitHub Pages. Mở
`http://localhost:3000/le-grande-center/admin-preview/` để thử giao diện quản trị.

## Trang chủ B2B và kiến trúc 3D

Mở `http://localhost:3000/le-grande-center/`: ảnh hoàng hôn khách cung cấp lấp viewport,
bấm **Khám phá** để vào `/le-grande-center/kham-pha/` 3D toàn màn hình; **Thoát** về
trang chủ. Không tải WebGL/GLB trước khi vào. Viewer tải asset tự host; site/hồ/ánh
sáng/tương tác dùng Three.js, không cần R3F.
Building GLB được xuất từ `src/app/model-3d/model.ts`, giữ hình khối và nhịp kiến trúc
đối chiếu video dự án. Ảnh tham khảo chỉ quyết định màu/cột/vòng xoay/cảnh quan,
không quyết định building. Sân trước → đường/vòng xoay; hồ sau. Kích thước vẫn minh họa.

Sáu chấm trắng đan xen trái/phải, bám theo xoay/zoom. Bấm/chạm hoặc Tab + Enter
để chọn riêng một tầng; cũng có nút tầng trong bảng công năng. Bấm lại hoặc
**Bỏ chọn tầng** để bỏ chọn. Vòng tỏa 2,8 giây lệch nhịp, tắt chuyển động theo
`prefers-reduced-motion`. Công năng tham chiếu brochure 17 trang: shophouse tầng
1–2, dịch vụ/văn phòng tầng 3–4, giải trí tầng 5 và dịch vụ ngoài trời tầng 6.
Rạp chiếu phim/công năng dự kiến không phải xác nhận đơn vị đang hoạt động.
Không công bố giá, diện tích hay trạng thái khả dụng chưa được xác nhận.

Phim dự án được nén xuống 960×540, giữ toàn bộ thời lượng và âm thanh; có poster,
điều khiển gốc, tự phát im tiếng khi vào vùng nhìn thấy và dừng khi cuộn khỏi vùng.
Tôn trọng `prefers-reduced-motion`; video chỉ tải khi phát nhờ `preload="none"`.
Tài nguyên `project-film.mp4`, `project-film-poster.webp`, `le-grande-brochure.pdf` ở
`public/`; đường dẫn theo pathname của `siteUrl`, hỗ trợ base path và domain root.
Khi WebGL không mở được, phim, công năng và liên hệ vẫn dùng được; không giả lập cảnh 3D.

Số điện thoại, email và địa chỉ được đối chiếu trên https://legrandecentre.vn/.
Liên hệ dùng `tel:` và `mailto:` thật; email điền tầng đang chọn, chỉ mở ứng dụng
email, không giả báo đã gửi lead. Brochure do khách hàng cung cấp; số liệu đất
trong các trang không thống nhất nên không đưa lên trang chủ. Mô hình dùng Y
hướng lên, mặt tiền +Z, tỷ lệ ước lượng, không thay thế hồ sơ thiết kế chính thức.
Phần quản trị và backend hiện có không thay đổi.

### Asset pipeline và public viewer

`npm run models:export` mở authoring server tại `http://127.0.0.1:4174/__author`;
mở URL bằng Chromium để xuất lại 6 context GLB, giữ nguyên building GLB đã duyệt
và ghi `public/model-3d/asset-manifest.json`. Nguồn tải được pin URL/checksum trong
`scripts/scene-asset-sources.json`, cache tại thư mục tạm của hệ thống.
Tên file theo SHA-256, texture nhúng tối đa 1024px, không cần decoder hay Blender.
`npm run check:scene-assets` kiểm tra bytes/hash/GLB/resource limits; tự chạy trước build.
`npm run test:scene` kiểm tra allowlist, scene mismatch, ID/tầng, freshness và lỗi tải.

`scene.ts` sở hữu IDs/anchors/presets; `viewer-projection.json` là publication tĩnh
đọc-only, không lấy admin snapshot. Bản hiện có chỉ gồm brochure và vị trí minh họa;
không có diện tích, tenant hay availability. Mỗi claim sau này phải được publisher
duyệt riêng; parser loại field private. Giới hạn 64 KiB, freshness bảo thủ 24 giờ;
quá hạn hoặc lệch scene thì không chọn slot/hiện claims, 3D/tầng/CTA vẫn hoạt động.
Không tự đổi updatedAt để kéo dài publication. SLA production cần chủ dự án chốt.

Bốn preset `front/aerial/rearLake/side` là điểm khởi đầu/reset; xoay ngang360°, nhìn
gần thẳng từ trên cao, zoom gần tự do và chỉ cap zoom xa. Không ép fit khi orbit.
Hoàng hôn mặc định theo ảnh; building giữ nguyên geometry. Tầng/slot chọn bằng
canvas hoặc panel HTML; email mang ID, không tạo reservation. HIGH/MEDIUM/LOW
giảm context/DPR/shadow/AO trước building. Xe chạy tuyến đường/vòng xoay; người có
rig và animation đi bộ trên vỉa hè. Có nút dừng/chạy, tự dừng khi reduced-motion,
tab hidden hoặc thoát. Cây Poly Haven CC0, xe và người Khronos CC-BY4 được tải về,
tối ưu và tự host; nguồn/license/checksum trong `public/model-3d/ASSET-LICENSE.md`.

Chi tiết triển khai, số đo và cổng production còn cần thiết bị thật:
[scene redesign](docs/architecture-3d-scene-redesign.md).

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
