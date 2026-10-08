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
- `LeasingExplorer`: client component nhận `floors`, `units`, `sourceDocument`, `contactEmail`, `initialSelectedId`; không import inventory hoặc cấu hình liên hệ. Sở hữu CTA tiếp tục nhu cầu thuê với mã ô hiện đang xem, dùng lại `LeasingSuggestion`. Đường dẫn asset dùng quy ước basePath của site.
- `useLeasingExplorer`: sở hữu selection, filter và đồng bộ hash với tầng hợp lệ. Loại hình được lấy trong tầng đang xem; đổi tầng reset filter. `leasing-model.ts`: contract readonly và quy tắc lọc diện tích.
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

`LeasingFloor` cung cấp mô tả/trang nguồn/khu dùng chung; `LeasingUnit` cung cấp mã, diện tích, kích thước có trong tài liệu và hình sơ đồ. Tọa độ tái hiện tương quan để chọn ô, không phải polygon CAD hay số đo khảo sát. F.2 dùng clip-path chữ L để khoảng thông tầng không nhận click. Sơ đồ/danh sách/chi tiết dùng cùng inventory. Trên mobile, filter đứng trước sơ đồ và danh sách dùng cuộn trang thay vì cuộn dọc lồng; tóm tắt ô hiện đang xem bám dưới header. Chọn ô không tự cuộn hay đổi focus; nút Xem chi tiết chủ động cuộn/focus panel và không đổi hash tầng. CTA tư vấn giữ mã ô sang contact. Link brochure mở đúng trang theo basePath.

Không tự di chuyển ID/dữ liệu CMS demo `T<n>-B<n>` sang inventory public: đó là fixture nghiệp vụ khác, có liên kết media và workflow mẫu. Cutover backend cần khách/Kỹ thuật duyệt catalog và ánh xạ ID theo phạm vi production; lượt này không ghi DB, không sửa trạng thái thuê, không thêm form hoặc API.

Kiểm chứng cập nhật 08/10/2026: TypeScript đạt; browser Chromium 1440×960 và 390×844 không tràn ngang/ảnh lỗi trong 5 trang. Tầng 3 chỉ có loại hình phù hợp; chọn C.12 bằng Enter giữ focus trong màn hình, nút chi tiết giữ tầng 3, CTA giữ C.12/tầng 3/83 m² sang form. Tầng 1 lọc dưới 100 m² ra rỗng và xóa lọc phục hồi 11 ô. Link homepage sang tổng quan tầng 4 hiện nhãn bên dưới header (96px desktop, 80px mobile) với token offset chung. Sơ đồ brochure/tài liệu chờ được phân biệt. Không xác minh Safari/thiết bị thật, production CMS hoặc độ chính xác CAD.

## Hướng mặt ngoài tham khảo — 08/10/2026

Nguồn đối chiếu: [Google Maps — Le Grande Centre](https://www.google.com/maps/place/Le+Grande+Centre/@9.6101864,105.9692089,17z/data=!3m1!4b1!4m6!3m5!1s0x31a04d86b7d9a867:0x58da1a5e9f7000e3!8m2!3d9.6101864!4d105.9717892!16s%2Fg%2F11nb37lyjk) và `public/le-grande-brochure.pdf`, trang 5–10. Dùng tọa độ place 9.6101864, 105.9717892; longitude 105.9692089 là camera, không phải địa điểm.

Bản vẽ trang 5 ghi cạnh dưới là Nguyễn Chí Thanh, trái giáp khu hồ, phải giáp nhà máy nước. Đối chiếu bản đồ north-up: dưới/mặt tiền Nam, trên/phía sau Bắc, trái Tây, phải Đông. Đây là suy luận địa lý tham khảo; PDF không có mũi tên Bắc, ảnh vệ tinh còn thể hiện khu đất trước xây dựng nên không phải phép đo footprint hiện trạng. Không xuất bản góc phương vị chính xác hay cam kết tầm nhìn/cửa riêng.

`LeasingUnit.orientation` bắt buộc cho 81 mã public. `BROCHURE_ORIENTATION` cung cấp nguồn và bốn cạnh cho route truyền vào renderer, không đưa inventory vào component trình bày. Hướng xuất hiện ở danh sách, chi tiết, accessible name của ô sơ đồ và ngữ cảnh form; chú giải bản đồ có link đối chiếu nguồn.

| Nhóm ô | Hướng mặt ngoài tham khảo |
| --- | --- |
| A/B, dãy shophouse liên thông | Nam / Bắc; ô .1 thêm Tây, .11 thêm Đông |
| C/D.1–.11; E.1–.4 | Bắc; không tự gán đầu Tây/Đông vì WC/vùng đệm ở cạnh |
| C/D.12–.23 | Nam; .12 thêm Tây, .23 thêm Đông |
| E.6–E.11 | Nam; E.6 thêm Tây, E.11 không nằm đầu Đông của building |
| E.5 | Bắc / Nam / Đông; không gian đa mặt ngoài, không gán một cửa chính |
| F.1 | Nội khu — hướng chưa xác nhận; nằm cạnh lõi sảnh/WC, cần bản vẽ cửa để kết luận |
| F.2 | Ngoài trời đa hướng Nam / Tây / Bắc / Đông; không coi là một mặt bằng có một hướng cửa |

Hướng mặt ngoài không đồng nghĩa hướng tiếp cận từ hành lang: dãy trên C/D/E vào từ hành lang phía dưới và dãy dưới tiếp cận từ phía trên; brochure không vẽ cửa cho từng ô phân chia. Không thay các fixture CMS `T<n>-B<n>` bằng hướng public nếu chưa ánh xạ ID/hồ sơ.

Kiểm chứng: smoke catalog 81 ô, đủ số lượng 11/11/23/23/11/2 ở sáu tầng và 16 trường hợp biên/ngoại lệ; `npx tsc --noEmit` đạt. Browser Chromium desktop 1440×960/mobile 390×844 kiểm tra các ô A.1, B.11, C.1/C.12/C.23, D.23, E.5/E.11, F.1/F.2. C.12 giữ Nam/Tây sang contact cùng mã/tầng/83 m² và group dưới 100 m²; Enter và nút chi tiết giữ hash tầng, focus/nhãn không bị header che. Không tràn ngang trang; không có page error/request failure trong mobile smoke. Không xác minh hướng cửa từng ô bằng hồ sơ khảo sát hoặc thiết bị thật.

