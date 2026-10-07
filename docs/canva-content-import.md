# Architecture Decision — Import nội dung mẫu Canva

Ngày: 08/10/2026. Nguồn khách cung cấp: https://squirrel-rnmskw.my.canva.site/.

## Hiểu

Người dùng yêu cầu lấy layout/nội dung Mặt bằng, Về Le Grande Centre và Liên hệ vào website hiện có. Thanh điều hướng giữ đúng: **Trang chủ – Mặt bằng/Cho thuê – Tổng quan từng tầng – Tổng quan Le Grande – Liên hệ**. Không lấy tên menu Canva.

## Thiết kế

- Dựng lại nội dung dưới menu bằng HTML/CSS responsive, tông xanh–kem, serif và điểm nhấn vàng theo mẫu khách.
- Mặt bằng: hero, chọn 6 tầng, sơ đồ ô theo brochure, filter loại hình/diện tích, danh sách đồng bộ selection và CTA tư vấn.
- Tổng quan: giới thiệu, nội dung tổng quan, thư ngỏ chủ đầu tư và hình phối cảnh lấy từ Canva.
- Liên hệ: hotline cho thuê 0973 879 563 / 0944 634 243; ban quản lý 0931 060 768; email, địa chỉ và link bản đồ.
- Nội dung/ảnh Canva đặt trong `canva-content.ts`; mặt bằng lấy từ `brochure-leasing.ts`; contact/navigation dùng chung `site-content.ts`. Asset self-hosted, nguồn ảnh tại `public/client-reference/canva/SOURCE.md`.

Lý do: filter và điều hướng cần hoạt động trên web/mobile; ảnh chụp UI không đáp ứng việc chọn căn. Brochure đã cung cấp mã/diện tích và bố trí của sáu tầng để thay fixture. Trade-off: sơ đồ vẫn là tái hiện bố trí, chưa phải geometry kỹ thuật hay khả dụng thật; công năng phần cho thuê theo brochure, không lấy nhãn tầng Canva làm căn cứ kỹ thuật.

## Validate security và sự chính xác

Chỉ render public text/dữ liệu từ tài liệu khách, không nhúng script/HTML Canva hay PDF runtime. Explorer không thu PII hoặc thêm portal. Liên hệ dùng `tel`/`mailto`; liên kết ngoài có `noopener noreferrer`. Selection/filter dùng dữ liệu brochure có nguồn; không công bố trạng thái mẫu thành khả dụng thật. Tài sản ảnh giữ nhãn phối cảnh tham khảo.

## Đề xuất và migration

Brochure → catalog public có nguồn → khách/Kỹ thuật xác nhận phương án đang sử dụng, geometry và media → publication CMS được duyệt → kiểm tra quyền/đồng bộ production. Không có thay đổi nghiệp vụ thuê trong lượt này; màn hình public không chứng minh backend đã vận hành.

## Architecture Decision — Component composition

### Hiểu

Yêu cầu bổ sung: giao diện phải được tổ chức thành component theo kiến trúc repo. README quy định thư viện `@mall/ui` độc lập với dữ liệu, route và dịch vụ ứng dụng.

### Thiết kế

- `src/app/{mat-bang,tong-quan,lien-he}/page.tsx`: metadata và composition; không chứa markup section hoặc logic bộ lọc.
- `PublicPageLayout`: sở hữu header, main và footer chung, với biến thể giao diện editorial/project. `SitePage` dùng lại layout này cho trang tổng quan tầng.
- `ProjectHero`, `ProjectOverview`, `InvestorLetter`, `ProjectContact`, `LeasingSuggestion`: component trình bày trong feature public; phần có nội dung thay đổi nhận props.
- `LeasingExplorer`: client component nhận `floors`, `units`, `sourceDocument`, `contactEmail`, `initialSelectedId`; không import inventory hoặc cấu hình liên hệ. Đường dẫn asset dùng quy ước basePath của site.
- `useLeasingExplorer`: sở hữu selection, filter và đồng bộ hash với tầng hợp lệ. `leasing-model.ts`: contract readonly và quy tắc lọc diện tích.
- `canva-content.ts`: nội dung/ảnh editorial; `brochure-leasing.ts`: catalog public theo PDF, mỗi ô có `floorId` và hình sơ đồ. Route cung cấp dữ liệu vào explorer.
- `SiteFooter` tách riêng, cả hai biến thể layout dùng chung. Xóa wrapper `ReferencePage` trùng trách nhiệm và `ContactDetails` không có consumer.

Lý do chọn: thay đổi nội dung, bố cục và logic selection có vị trí rõ ràng; renderer không buộc vào nguồn Canva. Trade-off: thêm các file nhỏ trong feature ứng dụng. Component có công năng/route Le Grande thuộc ứng dụng; không đẩy chúng vào shared UI khi chưa có consumer dùng chung khác. Không sửa submodule UI/backend trong thay đổi này.

### Validate security

Props đi qua client chỉ chứa dữ liệu công khai serializable; contract readonly không phải cơ chế phân quyền. Quyền đọc/xuất bản CMS cần thực thi tại backend khi tích hợp. React render văn bản, không dùng raw HTML/script Canva. Hash chỉ chọn ID tầng có trong props; không trở thành đường dẫn fetch. Layout vẫn tương thích static export và không thêm dịch vụ runtime.

### Đề xuất và migration

Khi có CMS, route/build adapter ánh xạ publication đã duyệt vào contract public; không nhúng fetch/quyền quản trị vào renderer. Catalog public hiện dựa trên brochure, geometry vẫn cần xác nhận kỹ thuật. Không coi việc truyền props là đã hoàn tất CMS/production.

Kiểm tra sau refactor: `tsc --noEmit` thành công; rà import không còn wrapper cũ hoặc fixture trong explorer; `git diff --check` không báo lỗi. Không chạy test suite.

## Architecture Decision — Slot theo brochure dự án

Nguồn: `public/le-grande-brochure.pdf`, trang 5–10; đã đọc text và render đối chiếu cả sáu bản vẽ. Mặt bằng public thay fixture Canva bằng `brochure-leasing.ts`, không thay model building hay dữ liệu nghiệp vụ CMS.

| Tầng | Mã ô trong brochure | Số ô | Đặc điểm bố trí |
| --- | --- | ---: | --- |
| 1 | A.1–A.11 | 11 | Một dãy, sảnh giữa; liên thông lên tầng 2 |
| 2 | B.1–B.11 | 11 | Một dãy, sảnh/thông tầng giữa; liên thông từ tầng 1 |
| 3 | C.1–C.23 | 23 | Hai dãy; 3 khu có thể phân chia, không phải 23 căn trống |
| 4 | D.1–D.23 | 23 | Hai dãy; 3 khu có thể phân chia, không phải 23 căn trống |
| 5 | E.1–E.11 | 11 | Hai dãy bên trái, E.5 = 1.000 m² là khu rạp dự kiến |
| 6 | F.1–F.2 | 2 | F.1 = 46 m²; F.2 = 1.020 m² ngoài trời dạng chữ L |

Tổng cộng 81 ô có mã trên tài liệu, không phải 81 đơn vị cho thuê độc lập/đang khả dụng đã xác nhận. Sảnh, WC, hành lang và khoảng thông tầng không tạo slot. Hai tầng shophouse không được ngầm coi là hai hợp đồng độc lập cho mỗi căn liên thông.

Giữ nguyên diện tích in trong PDF, không tính lại từ kích thước đã làm tròn: ví dụ C.1 = 54 m² dù kích thước ghi 5,5 × 9,8 m; F.1 = 46 m² dù ghi 7,8 × 6 m. F.2 chỉ có diện tích/đường bao minh họa; không gán kích thước cạnh tài liệu không cung cấp. Công năng linh hoạt và rạp dự kiến được ghi đúng tính chất đề xuất, không gán thương hiệu hay trạng thái thuê.

`LeasingFloor` cung cấp mô tả/trang nguồn/khu dùng chung; `LeasingUnit` cung cấp mã, diện tích, kích thước có trong tài liệu và hình sơ đồ. Tọa độ sơ đồ tái hiện tương quan bố trí để chọn ô, không phải polygon CAD hay số đo khảo sát. F.2 dùng clip-path chữ L để khoảng thông tầng không nhận click chọn F.2. Bộ lọc/danh sách/sơ đồ/chi tiết cùng dùng inventory này; chọn từ danh sách đưa nhãn ô vào vùng cuộn. Link brochure mở đúng trang, theo basePath của site. Xóa fixture A01–A05 và cập nhật ví dụ mã căn trong form liên hệ.

Không tự di chuyển ID/dữ liệu CMS demo `T<n>-B<n>` sang inventory public: đó là fixture nghiệp vụ khác, có liên kết media và workflow mẫu. Cutover backend cần khách/Kỹ thuật duyệt catalog và ánh xạ ID theo phạm vi production; lượt này không ghi DB, không sửa trạng thái thuê, không thêm form hoặc API.

Kiểm chứng: `npx tsc --noEmit` và `npm run build` thành công. Browser local kiểm tra số ô/trang nguồn của cả sáu tầng, lọc rỗng/xóa lọc/reset khi đổi tầng, chọn E.5/F.2, kích thước C.12, khoảng thông tầng không nhận click F.2, mailto đúng ô/tầng. Desktop 1440 × 960 và mobile 390 × 844: không tràn ngang trang, cuộn riêng sơ đồ; chọn C.23 từ danh sách đưa nhãn vào vùng cuộn và Enter chọn được. Không có page error/request failure trong hai tab xác nhận. Chưa xác minh deploy production/CMS hoặc độ chính xác hình học kỹ thuật.
