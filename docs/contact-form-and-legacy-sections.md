# Architecture Decision — Form liên hệ và section từ website cũ

Ngày: 08/10/2026.

## Hiểu

- Khách yêu cầu form theo bố cục Canva, cơ chế hạn chế gửi giống Solar.
- Người dùng xác nhận chưa có API/Turnstile: làm giao diện và cơ chế chặn trước.
- Bổ sung nguồn ưu tiên cho Thư ngỏ và Tài liệu dự án: https://legrandecentre.vn/.
- Giữ menu đã chốt và kiến trúc component hiện có.

## Thiết kế

`ProjectContact` là component trình bày thông tin liên hệ, ghép `ContactForm` tại feature contact. Form dùng `TextField`, `SelectField`, `TextareaField`, `CheckboxField`, `Button` qua export công khai của `@mall/ui`. Không sửa submodule để nhúng nội dung hay route ứng dụng.

Form gồm họ tên, doanh nghiệp, điện thoại, email, loại hình kinh doanh, diện tích mong muốn, thời gian thuê, căn quan tâm và ghi chú. Consent không được tick sẵn. Các option loại hình/diện tích/thời gian là bộ lựa chọn ban đầu, cần khách duyệt trước production.

- `contact-model.ts`: kiểu dữ liệu, đọc trường và kiểm tra input nghiệp vụ; không chứa gateway hay thuật toán gửi.
- `@mall/ui/forms`: `useSurveySubmission` sở hữu khóa gửi, storage, trạng thái và policy mặc định: 3 lần thành công trong rolling window 300 giây → cooldown 300 giây tính từ lần thứ 3, hết cooldown reset cửa sổ. `SurveyForm` sở hữu Toast hệ thống và disclosure demo.
- `use-contact-form.ts`: adapter nhỏ chọn `mode: "demo"`, local storage với key `legrande:contact-preview-rate-limit:v1`, validation/focus lỗi đầu tiên và reset chỉ sau kết quả thành công. Lỗi giữ nguyên nội dung; validation lỗi không gọi shared submit và không tính quota.
- `ContactForm`: markup, labels, style nghiệp vụ và countdown; dùng wrapper `SurveyForm` thay vì tự render Toast. Giới thiệu demo đặt trước các trường và liên kết hotline thực tế; disclosure cuối và feedback vẫn thuộc shared wrapper. Demo dùng delay 700ms và kết quả ngẫu nhiên 50/50 của shared hook, không gửi mạng/lưu lead. Chỉ timestamps/cooldown được lưu ở localStorage; storage bị chặn thì shared hook giữ fallback trong cùng tab.
- `InvestorLetter`: component riêng nhận nội dung và ảnh nền; căn giữa, title/emphasis vàng, divider SVG, ba trích dẫn và chữ ký theo website cũ.
- `project-document-model.ts`: contract group/download độc lập; `ProjectDocuments` nhận dữ liệu qua props. File có filename → anchor download; nguồn PDF để đọc → anchor mở tab riêng. Tệp chưa có → nhãn và trạng thái chờ, không tạo nút tải disabled hay URL giả. Sơ đồ brochure dẫn tới trang 5; sơ đồ kỹ thuật riêng và giấy phép vẫn được ghi rõ chưa có.
- Route Tổng quan chỉ ghép các section với `legacy-content.ts`; nguồn/tệp/checksum tại `public/client-reference/legacy/SOURCE.md`.

Lý do: giao diện nghiệp vụ và validation ở ứng dụng; thuật toán gửi, policy và feedback dùng chung giữa Solar và Le Grande trong component-ui. Trade-off: browser limit có thể bị vượt qua bằng sửa storage/clock hoặc gửi đồng thời từ nhiều tab; đây chỉ là hạn chế thao tác cho UI. Không dùng nó làm kiểm soát abuse production.

## Validate security và file nguồn

Form dùng nút “Gửi yêu cầu tư vấn”, consent và trạng thái bằng ngôn ngữ dành cho khách hàng. Adapter chọn demo rõ ràng; disclosure và Toast dùng chung xác định kết quả mô phỏng, không xác nhận lưu hoặc tiếp nhận lead. Không log/ghi personal data, không thêm admin permission hay bí mật client, không nhúng script/raw HTML website cũ. Chỉ đưa public copy vào React và self-host ảnh/tệp đã lấy.

Kiểm tra URL nguồn:

| Tài liệu | Kết quả | Cách dùng |
| --- | --- | --- |
| Brochure | URL website cũ 404 | Dùng PDF 17 trang đã có trong repo, SHA-256 khớp file nguồn tải dưới URL sơ đồ |
| Sơ đồ | URL 200 nhưng bytes/hash trùng brochure | Chờ sơ đồ kỹ thuật riêng; không công bố brochure như một tệp sơ đồ độc lập |
| Quyết định | 200 application/pdf, 2 trang | Copy nguyên tệp vào public và bật download |
| Giấy phép XD | 404 | Chờ tệp, không tạo link tải hỏng |

Tải lại tài liệu công khai không xác nhận tình trạng pháp lý ngoài nội dung file. Stock background của website cũ chỉ là trang trí, không phải ảnh công trình Le Grande Centre.

## Đề xuất và migration

1. Duyệt giao diện/options và cung cấp đúng các tệp còn thiếu.
2. Xây API tiếp nhận serverless ở phạm vi production đã chốt, dùng core backend dùng chung và dữ liệu Lead ứng dụng.
3. Áp dụng lại lớp server Solar: body cap/validation, allowed origin được cấu hình cố định, Turnstile Siteverify kiểm hostname/action, bộ đếm atomic dùng chung (HMAC IP từ proxy tin cậy, không raw IP log), per-client/global budget và idempotency.
4. HTTP gateway chỉ trả `received` sau commit lưu lead; token mới cho retry chưa commit, idempotency giữ theo cùng payload. Chuyển UI preview sang chế độ live sau khi có backend, consent/privacy copy được duyệt, cấu hình Turnstile và quy trình quản lý lead.
5. Không bỏ static export chỉ để giả API trong lần làm UI này. Không bật gửi thật hoặc tự provision dịch vụ bên ngoài.

Nguồn kỹ thuật: code Solar `src/features/survey/survey-form.tsx` và `src/services/survey-submissions.ts`; [Turnstile client rendering](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/) và [server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

## Kiểm tra

- `tsc --noEmit`: đạt.
- `git diff --check`: không có lỗi whitespace.
- Rà hình desktop/mobile ở 1440px/390px cho form, thư ngỏ và tài liệu: không tràn ngang trang. Ảnh lazy-load cần vào vùng nhìn thấy; không suy từ trạng thái chưa tải thành lỗi tệp.
- Lượt kiểm tra tương tác form qua Orca bị gián đoạn khi runtime đóng kết nối; chưa xác minh hoàn chỉnh chuỗi gửi 3 lần/reload trong trình duyệt. Policy được áp dụng trong module riêng theo code Solar.
- Không chạy test suite hoặc deploy. API, Turnstile server và lưu lead thật chưa triển khai theo scope đã xác nhận.

## Cập nhật trải nghiệm khách thuê — 08/10/2026

- CTA từ mặt bằng giữ mã ô qua `/lien-he/?unit=C.12`; contact đối chiếu mã với catalog brochure được truyền vào, không nhận diện tích/tầng từ query tùy ý. Mã hợp lệ điền sẵn ô/tầng và nhóm diện tích, có tóm tắt diện tích thực và cho phép chỉnh sửa. Mã không hợp lệ giữ form yêu cầu chung; không phản chiếu chuỗi query vào dữ liệu dự án.
- Gửi demo lỗi giữ mọi giá trị. Thành công reset dữ liệu người dùng nhập về mặc định, giữ ngữ cảnh ô đang xem nếu có. Reload URL giữ được mã ô và nhóm diện tích; không lưu PII hay draft vào storage.
- Đã smoke trên Chromium 1440×960 và 390×844: C.12/tầng 3/83 m² đi qua cả CTA chi tiết và CTA chung; validation 5 trường bắt buộc focus họ tên; cả hai kết quả demo đã quan sát; lỗi giữ nội dung chỉnh sửa, thành công reset, unknown unit để trống. Sơ đồ trong brochure trả HTTP 200 và có link trang 5. Không thay API, consent, quota hay shared UI package.


Theo yêu cầu mới, nguồn nhập nội dung và hướng dẫn triển khai không nằm trên giao diện public. Menu và kiến trúc component giữ nguyên. Form chọn demo của shared survey submission, giữ validation/focus nghiệp vụ và countdown; chưa nối API. Shared `SurveyForm` vẫn hiển thị disclosure và thông báo mô phỏng trung thực, không khẳng định có lead đã lưu. Những dữ liệu vị trí 3D chỉ dùng minh họa không được hiển thị thành mặt bằng thật; người dùng được dẫn sang sơ đồ brochure đã nhập. Không thay đổi quyền truy cập, kiểm tra freshness của projection hay dữ liệu cho thuê. Vận hành nhận lead vẫn cần shared live mode với HTTP handler thật và kiểm soát server trong migration ở trên.
