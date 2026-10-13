# Le Grande Centre

Ứng dụng Le Grande Centre. Repo:
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
Trang chủ dùng homepage v2 theo bản tham chiếu khách hàng. Homepage v1 được giữ
trong mã nguồn nhưng không import/render từ route `/`. Chưa thay thế domain production.

Phim dự án trên trang chủ và viewer dùng URL R2 công khai tại
`PROJECT_FILM_URL` trong `src/features/public/site-content.ts`; file MP4 không nằm
trong Git hay bản export. Ảnh, PDF, GLB và HDR của website cũng được tải từ R2;
`r2AssetBase`/`r2AssetUrl` trong `src/config/site.ts` giữ nguyên key tương đối,
không còn tiền tố `public/`. Logo và favicon chỉ nằm trong Neon Object Storage bucket
`media`; website chỉ dùng URL public, không đưa S3 credentials vào client.
Các base URL là biến public `NEXT_PUBLIC_R2_PUBLIC_BASE_URL` và `NEXT_PUBLIC_NEON_MEDIA_BASE_URL`; mặc định dùng bucket hiện tại. Chỉ asset 3D cần CORS vì trình duyệt fetch GLB/HDR. Projection JSON vẫn đọc cùng origin.

Chuyển sang tài khoản storage khác: sao chép object R2 và logo/icon trong Neon bucket `media`, giữ nguyên object keys; đặt GitHub Actions Variables `R2_PUBLIC_BASE_URL`, `NEON_MEDIA_PUBLIC_BASE_URL`, `GITHUB_PAGES_BASE_URL`, rồi deploy lại. Không cần sửa từng trang; S3 access keys chỉ dùng trong công cụ chuyển dữ liệu, không xuất bản.
Video trang chủ không dùng thumbnail/poster.
Video trang chủ tự phát tắt tiếng, lặp lại, chạy inline và không hiện thanh điều
khiển native. Nút **Bật âm thanh / Tắt âm thanh** trên video đổi trạng thái sau
thao tác người dùng, giữ lựa chọn khi cuộn ra/vào video. Video tự dừng khi ra
khỏi viewport, tab bị ẩn hoặc bật reduced motion. Giữ `preload="none"`; trình
duyệt có thể ưu tiên autoplay hơn preload. Phát video cần kết nối tới R2.
Nút âm thanh nằm trong client boundary riêng `home-video-sound-toggle.tsx`, được
import trực tiếp bằng default export; kiểm tra cả Next dev/Fast Refresh khi đổi
component, không chỉ static export.

```sh
git clone --branch dev --recurse-submodules https://github.com/bangnt188/le-grande-center.git
cd le-grande-center
npm ci
npm run dev
```

### Smoke public UI

Với Next dev đang chạy, dùng Node.js 22+ và Chrome/Chromium có sẵn:

```sh
npm run smoke:public -- http://localhost:3000/
```

Đổi URL nếu server dùng port/base path khác. macOS mặc định dùng Google Chrome;
máy khác dùng `chromium` hoặc đặt `CHROME_BIN` tới executable đã cài. Không tải
browser hay thêm dependency. Script mở profile tạm riêng rồi đóng/xóa khi kết thúc.
Kiểm tra header/3D menu ở 1366, 1201, 1200, 1100, 720, 390 và 320px; Escape/focus
menu; slot mở popup trước khi điều hướng; Map/List loại trừ nhau và giữ 22 mặt bằng
tầng 1–2; zoom, đổi ảnh, đồng bộ selection và trả focus khi đóng preview.
Chạy với Next dev hoặc host export hỗ trợ đúng route/payload Next; SPA fallback
của static server thông thường không phải bằng chứng cho navigation Next export.

### Profile cold-start 3D

Sau `npm run build`, phục vụ `out/` bằng static host rồi chạy (Node.js 22+):

```sh
node scripts/profile-3d-startup.mjs http://127.0.0.1:3199/ /tmp/le-grande-startup --check-loading
```

Script mở Chrome/profile mới, đo khoảng 6 giây và lưu `.json`/`.cpuprofile`.
`--check-loading` kiểm cap 70% khi building còn chờ, không ready trước warm-up,
giữ lựa chọn tầng trong lúc tải, đổi góc nhìn và lỗi tải building. Đóng viewer 3D
khác khi so số đo; không lấy Next dev/HMR làm baseline. Chi tiết trước/sau và
cache: [docs/performance-audit.md](docs/performance-audit.md#6-cập-nhật-sau-triển-khai-cold-start-và-loading-3d).

Tên thương hiệu và title SEO dùng **Le Grande Centre**. Domain mặc định là
`https://legrandecentre.vn/`; local mặc định không có base path. Mở
`http://localhost:3000/admin-preview/` để mở trang đăng nhập demo (tên đăng nhập/mật khẩu bất kỳ, không dùng thông tin thật).
`NEXT_PUBLIC_SITE_URL` vẫn ghi đè domain/path cho local và demo GitHub Pages;
các pipeline deploy demo giữ URL riêng và `SEO_INDEXABLE=false`. Index chỉ bật
khi build production với `SEO_INDEXABLE=true`; đổi domain không tự bật index

## SEO public website

Các trang public dùng title/description, canonical, Open Graph và Twitter metadata riêng.
Homepage xuất `WebSite` JSON-LD; trang chi tiết mặt bằng xuất `BreadcrumbList`.
`/mat-bang/` giữ trải nghiệm sơ đồ/popup và có danh sách liên kết HTML tới từng căn;
sitemap bao gồm các trang chính, trải nghiệm 3D và các trang mặt bằng.
Demo tiếp tục `noindex`; chỉ build production có domain chính thức và
`SEO_INDEXABLE=true` mới xuất sitemap indexable, robots trỏ sitemap. Không deploy
hoặc mở index bằng build này.

## Homepage v2 và kiến trúc 3D

Route `/` chỉ render `src/features/public/homepage-v2.tsx`. Bố cục theo ảnh
`Trang chủ.png`: header nền kem, hero ảnh dự án, phim giới thiệu, tổng quan, vị trí,
một tòa nhà tương tác theo cuộn, dải loại hình kinh doanh, mặt bằng tham khảo, gallery ảnh và liên hệ.
`homepage-v1.tsx` giữ nguyên composition cũ; không có route, import hay chuyển hướng
đến v1 trong trang chủ mới. Viewer `/kham-pha/` giữ chất lượng đã duyệt; dùng
loading 70/30 thay ảnh phủ, shader precompile và warm-up theo batch trước ready.

Mô hình 2D là một cảnh ghép ba layer trong suốt từ ảnh khách cung cấp. Tòa nhà
xếp gọn lúc đầu, tách lớp theo cuộn và khép lại khi cuộn ngược. Điểm bắt đầu
được đẩy sâu hơn trong viewport; khoảng cuộn rút còn 1/1,15 so với trước, giữ
nguyên vị trí mở hoàn toàn. Ba chấm vàng 12px không số (vùng chạm 44px) hiện
ngay trong lúc tách, đi theo từng lớp và có vòng pulse 2,8 giây như viewer 3D.
Pulse dừng khi cảnh ngoài màn hình hoặc tab bị ẩn. Ngay khi bắt đầu tách,
hover/focus/chạm hiện một card và đường nối bám theo chấm đang di chuyển.
Vùng chạm chồng nhau chọn chấm gần pointer nhất; bàn phím giữ thứ tự DOM.
Escape đóng card; cuộn ngược về trạng thái khép hoàn toàn đóng card và line.
Reduced motion hiển thị trạng thái tách sẵn, không pulse.
Ba nhóm 1–2, 3–4, 5–6 giữ tab tầng, công năng và diện tích từ
`BROCHURE_FLOORS`/`BROCHURE_UNITS`; CTA mở `/mat-bang/#tang-N` đúng tầng đang chọn.
Các vùng chọn là minh họa trên phối cảnh, không thay thế bản vẽ kỹ thuật.
Không tải Three.js/WebGL/GLB trên homepage v2.

Dải tiện ích dùng `ExpandingGallery` sẵn có từ `@mall/ui`: hover, bàn phím và
chạm để mở rộng; trên mobile xếp dọc. Giữ đủ sáu loại hình trong ảnh tham chiếu.
Gallery tổng quan đổi ảnh bằng nút thumbnail; mặt bằng tham khảo dẫn tới các URL
chi tiết hiện có. Không công bố giá hay tình trạng còn trống. Rạp chiếu phim và
các loại hình minh họa không phải xác nhận tenant đang hoạt động.

Ảnh tại R2 key prefix `images/home-v2/`: `floor-base.webp`, `floor-middle.webp` và
`floor-roof.webp` tách nền/phân lớp từ `phan-khu.png` khách cung cấp, dùng chung
canvas 1440×960. Giữ phần ảnh gốc nhìn thấy, không dựng thêm mặt khuất.
Sáu ảnh tiện ích cắt vùng ảnh không chữ từ `Trang chủ.png`; ba ảnh chi tiết
lấy từ `/images/gallery/` của legrandecentre.vn.
Hero dùng `hero.webp` tối ưu từ `ảnh hero.png` khách gửi; phần “Nhịp Thở Mới”
dùng `introduction.webp` từ `nhiptho.png`, không gắn caption minh họa. Ảnh khác và
phim tiếp tục tái sử dụng tài nguyên dự án hiện có. Section “Tại Sao Chọn” dùng
`reasons-background.webp` từ `taisao.png`: crop bớt 24,5% phần trời, Gaussian blur
1,15px ở kích thước nguồn và nén WebP. Blur xử lý sẵn, không chạy filter trên chữ.
Nền phủ xanh tối 42%; sáu khối có nền gradient opacity 98% → 38%, chữ trắng 92%.
Desktop ba cột/hai hàng; mobile một cột với nền bám viewport, reduced motion dùng
nền tĩnh. Nội dung sáu lý do giữ nguyên, không thêm cam kết pháp lý/tình trạng thuê.
Section vị trí dùng ảnh thực tế Le Grande; ảnh template chỉ tham khảo bố cục.
Trang chủ bỏ các dòng hướng dẫn cuộn/rê chuột/chạm/bàn phím và chú thích nguồn
lặp dưới section. Giữ nội dung chính, CTA, tên tầng/loại hình và nhãn accessibility.
Ảnh/media dùng R2 base URL độc lập với `siteUrl`, nên hoạt động ở domain production
và GitHub Pages base path; metadata/canonical và projection JSON vẫn theo `siteUrl`.
Section “Vị Trí Chiến Lược” giữ iframe Google Maps Le Grande Centre ở cột trái.
Cột phải: ảnh thực tế lớn → nội dung chữ → ảnh thực tế nhỏ (85% chiều rộng).
Hai ảnh hiện có là `le-grande-aerial-context.webp` và `le-grande-aerial-close.webp`,
giữ tỷ lệ gốc, không crop trong CSS. Mobile chuyển thành một cột, giữ cùng thứ tự.
Map lazy-load, có title accessibility và link mở vị trí `https://maps.app.goo.gl/psjcjBjqCCa2UzwRA`.
Không dùng SDK hoặc API key; bản đồ cần kết nối Google để hiển thị.

Phim có poster, điều khiển native và `preload="none"`; homepage v2 không tự phát.
Số điện thoại, email và địa chỉ tái sử dụng nguồn public dùng chung. CTA tư vấn
mở trang liên hệ hiện có; hotline dùng `tel:` thật. Form liên hệ vẫn là demo,
không thay đổi backend hay giả báo đã gửi lead.
Cụm ContactDock nổi trên các trang SiteFooter dùng hotline và Zalo từ WebsiteSettingsProvider. Defaults là hotline 0973 879 563, tel:0973879563 và https://zalo.me/0973879563; sau lưu cấu hình website cùng browser/origin, hai link nhận giá trị mới. Desktop hiện hai nút; mobile thu gọn mặc định, có disclosure và Escape/focus return.
Link Zalo và số hotline được cấu hình độc lập, không tự đồng nhất. Nút Zalo giữ
xanh nhận diện `#0068ff` theo yêu cầu khách hàng; nút gọi điện dùng token xanh
shopping-mall. Không xác nhận tài khoản Zalo hoặc thực hiện cuộc gọi tự động.

Kiến trúc 3D vẫn ở `/kham-pha/`, dùng `src/app/model-3d/`; GLB và HDR được tải từ R2,
manifest/license/projection JSON ở repo. Sáu tầng giữ công năng brochure, phép xoay/zoom/chọn tầng và reduced motion
hiện có; hình khối/tỷ lệ là minh họa, không thay thế hồ sơ thiết kế chính thức.
Khung tách lớp ở section “Sáu tầng. Nhiều cơ hội kinh doanh.” có CTA
**Khám phá công trình 3D** ở góc dưới phải, dẫn tới `/kham-pha/` với
`prefetch={false}` để không tải trước viewer nặng. Mobile đặt CTA ngay dưới ảnh,
trước thẻ thông tin tầng; thẻ được dời xuống để không chồng lên CTA.
Đã build static và kiểm tra Chromium 1440×1000/390×844: CTA mở viewer có canvas,
không tràn ngang, đúng đích liên hệ/màu Zalo, mở/đóng và focus bằng bàn phím.
Axe trong cụm liên hệ mobile: 0 violation, 0 incomplete; không phải kiểm tra
toàn bộ website hay xác minh tài khoản/liên hệ ngoài hệ thống.
Homepage v2 tái sử dụng `LayeredScrollStory` và `ScrollMotion` của v1 cho sticky
hero, lớp nội dung trượt lên, nền mây và entrance theo cuộn; không import v1.
Reduced motion bỏ sticky, offset và Lenis/reveal, giữ nội dung hiển thị.
Header nền kem dùng chung `SiteHeader` trên các trang public; footer dùng chung
`SiteFooter`. Cả hai lấy nhãn và đường dẫn từ `PUBLIC_NAVIGATION`: “Không gian
kinh doanh” mở `/tong-quan-tang/`, “Le Grande Centre” mở `/tong-quan/`, “Đặt lịch
tham quan” mở `/lien-he/`. Không thêm trang hay chức năng đặt lịch mới.
Menu giữ underline hover/focus/active, không xuống dòng trên desktop; chuyển
sang disclosure mobile ở 1000px, hỗ trợ Escape và đóng khi điều hướng. CTA bo
góc 8px; các trang khác giữ motion hiện có. CTA desktop **KHÁM PHÁ 3D** mở
`/kham-pha/`, giữ `prefetch={false}` để không tải trước viewer; mục **Mặt bằng**
trong menu vẫn mở `/mat-bang/`. Xem [motion notes](docs/public-motion.md).

### Catalogue mặt bằng

`/mat-bang/` dùng ảnh khách cung cấp `hero-matbang.png`, chuyển thành
`leasing-hero.webp` ở nguyên độ phân giải 785×442; lớp màn xanh tách khỏi chữ
trắng nghiêng trên ảnh. Header, footer và entrance motion dùng chung giữ nguyên.
Bộ lọc loại hình/diện tích nằm cùng thanh chọn **Map / List**; chỉ một kiểu xem
được render, đổi kiểu xem giữ bộ lọc. Không có card chọn sẵn khi mở trang thường.

**Tầng 1–2** là một nhóm chọn tầng. Map giữ hai sơ đồ vật lý, List giữ 22 căn
A/B và diện tích gốc; không cộng diện tích hoặc tạo căn ghép giả. Liên kết
`#tang-1`/`#tang-2` vẫn mở nhóm này. Click/chạm ô Map hoặc dòng List mở popup
thông tin; chỉ **Xem chi tiết** chuyển tới `/mat-bang/[unitId]/`. `?unit=B.1#tang-2`
mở đúng căn B.1; đóng popup xóa query `unit`, giữ hash. Escape/backdrop/nút đóng
trả focus về ô đã mở; Tab được giữ trong popup. Brochure mở đúng trang mỗi tầng.

Chromium đã kiểm tra Map/List, lọc loại hình/diện tích và trạng thái rỗng, A.1/B.1,
điều hướng trang con, bàn phím, touch và deep link tại 1366/390/320px; không tràn
ngang trang. Popup 320px cuộn dọc khi nội dung dài.

### Chi tiết slot — public và quản trị

Public có 81 URL `/mat-bang/[unitId]/`, ví dụ `/mat-bang/C.23/`. Trang dùng
diện tích, kích thước có sẵn và bố trí từ brochure; hướng mặt ngoài là tham khảo.
Badge **Đã thuê / Còn trống** dùng phân bố trạng thái mô phỏng, có ghi chú chờ kết
nối dữ liệu; không phải availability đã được xác nhận. Popup tổng quan có ảnh dự án
tham khảo dùng chung theo tầng, không phải ảnh riêng từng căn. Liên kết brochure mở
đúng trang tầng; CTA tư vấn truyền `?unit=C.23` cho form demo hiện có. Trở lại sơ đồ
giữ tầng nhưng không mở lại popup căn; bộ lọc được đặt lại. Sitemap chỉ chứa các URL
này khi bật indexability. Trang chi tiết giữ gallery 5 ảnh dự án, không phải ảnh bàn giao
riêng của từng slot.
Click ảnh lớn hoặc **Xem tất cả ảnh** mở `ImagePreview` dùng chung của `@mall/ui`:
nền sau blur nhẹ 6px, ảnh/chữ giữ sắc nét, zoom +/− 50–300%, **Vừa khung**,
chuyển trước/sau và chọn thumbnail ngay trong modal, không đóng popup khi đổi ảnh.
Đổi ảnh đồng bộ với gallery; đóng bằng Escape, nền ngoài hoặc nút × và trả focus
về đúng nút/ảnh đã mở. Viewer kế thừa theme light cục bộ, cuộn ảnh khi phóng to
và bố cục vừa màn 390/320px. `FilePreview` dùng lại renderer này ở chế độ inline
và có nút **Mở xem ảnh**; các chế độ tài liệu khác giữ nguyên.
Màu của surface, chữ, CTA, trạng thái focus và sơ đồ lấy từ token `shopping-mall`
light của `@mall/ui`; giữ Charis SIL/Be Vietnam Pro của public.
Theme light được đặt ở lớp bọc route, không chỉ ở khối nội dung giới hạn chiều rộng:
nền ngoài/trong cùng `--ui-color-canvas`, panel gallery/thông tin dùng
`--ui-color-surface-raised`, tránh trộn nền legacy hoặc surface vàng nhạt.
Nút floating **icon map** (nhãn accessibility **Vị trí trong tầng**) ở góc trên trái
ngay dưới header mở map trong modal, tô đúng căn
đang xem; mobile cuộn sơ đồ bên trong modal, không kéo tràn trang.
Nút dùng variant `primary` để hover vẫn xanh đậm/icon trắng, tránh hover
`secondary` đổi nền vàng nhạt. Live mark là một vòng mảnh opacity tối đa 22%,
scale tối đa 1.2, chu kỳ 4.8 giây. Dừng khi hover/focus, đang mở map, tab ẩn
hoặc `prefers-reduced-motion`; không làm đổi kích thước vùng bấm.
Ba CTA là **Yêu cầu tư vấn**, **Đặt lịch xem mặt bằng**, **Xem brochure · trang N (PDF)**.
Đặt lịch dùng `?unit=C.23&intent=visit` để điền căn, diện tích và ghi chú đề nghị xem
vào form demo hiện có; không tạo hoặc xác nhận lịch hẹn thật. Brochure lấy
`floor.sourcePage` (tầng 1: trang 5, tầng 6: trang 10), không hard-code trang 5.

Admin mở hồ sơ từ nút **Chi tiết** trong register hoặc liên kết trong inspector;
deep link `/admin-preview/workspace/#slot=T2-B2` sau khi vào demo. Hồ sơ dùng cùng repository trong workspace,
giữ mutation và media upload khi chuyển màn hình hoặc Back/Forward. Xem slot gốc,
nhóm ghép, yêu cầu, giữ chỗ, hợp đồng và media liên quan; cam kết khóa sửa/tách
trực tiếp. Hủy điều hướng khi có ghi chú chưa lưu không ghi đè entry lịch sử.
Fixture admin không ánh xạ sang mã brochure public. Dữ liệu và tệp đã lưu nằm trong IndexedDB của origin/trình duyệt, được giữ sau reload hoặc đăng xuất demo; xóa dữ liệu trình duyệt sẽ mất chúng. sessionStorage chỉ giữ marker vào demo.
Admin vẫn bị loại khỏi public export bởi script bảo vệ hiện có, không được publish
lên GitHub Pages. Plan và bằng chứng: [slot detail](docs/slot-detail-plan.md).

### Asset pipeline và public viewer

`npm run models:export` mở authoring server tại `http://127.0.0.1:4174/__author`;
mở URL bằng Chromium để xuất lại 6 context GLB, giữ nguyên building GLB lấy từ R2
và ghi `public/model-3d/asset-manifest.json`. Nguồn tải được pin URL/checksum trong
`scripts/scene-asset-sources.json`, cache tại thư mục tạm của hệ thống.
Tên file theo SHA-256, texture nhúng tối đa 1024px, không cần decoder hay Blender.
GLB mới sinh vào `public/model-3d/assets/`; upload đúng key lên R2 trước khi build.
`npm run check:scene-assets` tải asset từ R2 và kiểm tra bytes/hash/GLB/resource
limits; tự chạy trước build. `npm run test:scene` kiểm tra allowlist, scene mismatch,
ID/tầng, freshness và lỗi tải.

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

Demo: https://bangnt188.github.io/le-grande-centre/admin-preview/

Bản Pages là fixture công khai, không có dữ liệu người dùng thật, auth hoặc DB.
Mặc định `npm run build` loại admin khỏi artifact website. Lệnh deploy demo opt-in
qua `NEXT_PUBLIC_ADMIN_DEMO=true` và `INCLUDE_ADMIN_DEMO=true`; cấu hình này không
cho phép gắn backend API. Không dùng demo Pages làm admin production.
### Static deploy trên Cloudflare Workers

Cloudflare Workers Build giữ deploy command npx wrangler deploy. wrangler.jsonc
fetch hai submodule private khi chưa có, cài dependencies, build Next.js static
export vào out/ rồi deploy thư mục đó dạng static assets. Đặt SUBMODULE_READ_TOKEN
thành build secret chỉ đọc component-ui và lib-ts-be; không dùng Worker runtime secret.
Build production dùng https://legrandecentre.vn/ và bật indexability.

## Kết nối dữ liệu sau này

Cấu trúc chuẩn bị BE: [shared contracts, demo, server và storage](docs/backend-structure.md).
DTO/hàm thuần ở `src/shared/admin/`; dữ liệu mô phỏng ở `src/features/admin/demo/`;
composition API ở `src/server/`, SQL ở `database/`, primitives ở `packages/backend/`.
Phương án free tier đã đối chiếu: [Neon PostgreSQL/Object Storage](docs/neon-free-tier-research.md)
và [Cloudflare R2/Workers](docs/cloudflare-free-tier-research.md). Đã link Neon và deploy function smoke test;
[xem trạng thái và giới hạn hiện tại](docs/neon-setup.md). Cloud chưa được tích hợp vào Admin.

TSX gọi `useAdminData`, không ghi trực tiếp vào dữ liệu nguồn. Interface
`AdminRepository` có adapter demo và adapter HTTP cùng trả `AdminSnapshot`.
Adapter browser lưu snapshot và Blob trong một transaction IndexedDB, kiểm tra revision giữa các tab; không dùng memory fallback nếu browser từ chối lưu. Chế độ memory chỉ dành cho Node checks.
Transport dùng revision, request idempotency, cookie session và trạng thái lỗi.
Cấu hình `NEXT_PUBLIC_ADMIN_API_URL` chỉ là URL công khai của backend; không đặt
DB URL, secret hoặc credential trong biến `NEXT_PUBLIC_*`.

[Hợp đồng API và migration](docs/admin-data-contract.md),
[SQL baseline duy nhất](database/schema.sql) và
[thiết kế giao diện](DESIGN.md). Backend/auth/database của Admin chưa được triển khai; Neon `api` hiện chỉ trả lời smoke test `Hello from Neon Functions`.

## Thiết kế hệ thống B2B đã chốt

- [Thiết kế nghiệp vụ, admin, DB và migration](docs/b2b-leasing-design.md).
- [Hợp đồng private trên R2 và Workers Free](docs/private-documents-r2.md).
- [SQL baseline PostgreSQL duy nhất](database/schema.sql) và [hướng dẫn DB](database/README.md).
- [Thuật ngữ](CONTEXT.md) và [quyết định kiến trúc](docs/adr/0001-b2b-leasing-and-private-documents.md).

Luồng: gửi yêu cầu → chủ đầu tư duyệt → giữ chỗ có hạn. Lịch hẹn độc lập.
SQL là thiết kế chưa apply; auth/backend/database vẫn chưa kết nối.

### Admin dùng thử đầy đủ nghiệp vụ, chưa nối DB

- Tầng: sửa công năng nội bộ và tên/mô tả website dùng chung cho trang chủ, nội dung 3D, tổng quan tầng, mặt bằng; editor mở đúng trang PDF brochure của tầng.
- Căn/mặt bằng: sửa trạng thái/đối tác, diện tích slot chưa có cam kết; ghép/tách giữ mã và diện tích thành viên.
- Doanh nghiệp và khách tiềm năng: thêm/sửa hồ sơ, liên hệ, ghi chú, liên kết doanh nghiệp; khách đang thuê suy ra từ hồ sơ thuê, không tạo master trùng.
- Yêu cầu: tạo/sửa, tiếp nhận, duyệt/từ chối; giữ chỗ có hạn theo giờ hiện tại, chặn tổ hợp xung đột và không giữ một phần nhóm.
- Hợp đồng chỉ upload/liên kết/thay PDF có sẵn; không soạn thảo, không eSign, không tự xác nhận đã ký. Lưu hồ sơ từ giữ chỗ chuyển toàn bộ tổ hợp sang thuê bằng thao tác rõ ràng.
- Lịch hẹn: tạo/sửa, thời lượng/địa điểm, xác nhận/hủy; kiểm tra xung đột và hiển thị giờ Việt Nam.
- Media hiển thị asset thật của dự án và file upload riêng: ảnh, PDF, video R2, model GLB và HDR. Asset có nguồn/đường dẫn, chỉ xem và không tính vào byte upload local. Tìm theo tên/đường dẫn, lọc loại/nguồn; ảnh dùng FilePreview, video dùng Video, PDF mở bản gốc. GLB có link viewer công trình; HDR tải tệp gốc, không giả preview native. Upload vẫn PNG/JPEG/WebP/PDF tối đa 10 MiB.
- Cấu hình website: chỉnh Zalo, email, hotline, điện thoại bổ sung/ban quản lý và địa chỉ trong bản xem thử cùng browser/origin; không công bố toàn cầu. Logo mặc định/fallback và favicon đọc từ Neon `media`; tải/chọn logo mới vẫn bị khóa đến khi có upload Neon được bảo vệ bằng xác thực thật.

Form dùng component `@mall/ui`, lưu/hủy, lỗi và cảnh báo chưa lưu. Tab cũ phải tải lại snapshot trước khi lưu; nút tải lại trong form giữ nội dung đang nhập. Hạn mức nghiệp vụ 8,5 GB không bảo đảm quota thiết bị hoặc quota cloud. Bản dùng thử không có auth/phân quyền thật, API admin production hoặc kết nối Neon/R2; chỉ dùng dữ liệu thử nghiệm.

- Danh mục asset được sinh từ file local nhưng giữ nguyên metadata của asset đã externalize trong `project-media.json`; URL project media trỏ R2 hoặc Neon theo loại. Không copy asset vào IndexedDB hoặc tự liệt kê bucket cloud. Website chỉ đọc cấu hình đã tồn tại; khách public chưa mở admin không bị tạo database demo.

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

Mở `/admin-preview/` để đăng nhập demo bằng username/password bất kỳ. Thông tin nhập không được lưu/gửi đi; marker vào demo không phải xác thực. Sau đăng nhập vào `/admin-preview/workspace/`, bắt đầu tại **Tầng**.
Thông tin dùng thử hiển thị ngay dưới form: tên đăng nhập **admin**, mật khẩu **demo123**. Đây chỉ là ví dụ cho khách hàng test, không phải credentials production.

Sidebar duy nhất chia **Mặt bằng**, **Kinh doanh**, **Tài nguyên**; không còn selector Nghiệp vụ thuê hoặc selector sidebar/topnav. Doanh nghiệp khác Khách đang thuê: một mục quản lý hồ sơ, một mục tổng hợp quan hệ với mặt bằng.
Slot/nhóm chỉ có **Trống / Đang thuê**; **Đang chọn** là hiệu ứng UI riêng. Select, filter, badge và sơ đồ dùng cùng trạng thái và palette --ui-slot-* từ semantic --ui-color-* tokens. Dữ liệu mẫu suy ra slot đang thuê/đối tác từ hợp đồng mẫu, không gán thuê/đàm phán/đặt cọc giả trên mọi tầng. Giữ chỗ vẫn nằm trong hồ sơ riêng và khóa thao tác xung đột.

1. Mở **Doanh nghiệp** → chọn An Retail → **Yêu cầu & giữ chỗ** → phương án B.2 + B.3 (328 m²).
2. Nhập số giờ rồi duyệt giữ chỗ; xem cập nhật ở **Căn / Mặt bằng**.
3. Mở yêu cầu đã duyệt → **Mô phỏng ký & chuyển thuê** → xem **Hợp đồng**.
4. **Mở website** ở header mở trang public thật trong tab mới. Đã bỏ toàn bộ mô phỏng public/portal khách thuê khỏi admin.

Demo dùng dữ liệu giả lập trong phiên, tài liệu HTML không có chữ ký. Đăng xuất có xác nhận khi còn ghi chú chưa lưu; không nhập hồ sơ/hợp đồng thật. Backend, authorization và Worker/R2 cần được triển khai trước khi dùng thật.

## Backend readiness và storage generic

[Checklist trước khi khách hàng tạo tài khoản](docs/backend-readiness.md) tách phần
code còn thiếu khỏi tài khoản/credentials cần cấp. R2/Cloudinary có module generic
trong shared backend và [lệnh smoke upload/read/delete](packages/backend/docs/storage.md).
Đây không phải production integration đã deploy; quota/Worker/session/DB vẫn cần
hoàn thiện trước khi bật dữ liệu thật.
