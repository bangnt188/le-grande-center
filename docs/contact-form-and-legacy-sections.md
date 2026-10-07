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

- `contact-model.ts`: contract, kiểm tra input và preview gateway được chọn rõ ràng.
- `contact-rate-limit.ts`: quy tắc thuần, giống policy UI Solar: 3 lần hoàn tất trong rolling window 300 giây → cooldown 300 giây tính từ lần thứ 3. Hết cooldown reset cửa sổ. Gửi thiếu/sai trường không tính quota.
- `use-contact-form.ts`: state, validation/focus, lock chống nhấn lặp trong lúc gửi, storage đồng bộ tab/focus, đếm ngược và reset sau khi hoàn tất. Lỗi gateway giữ nguyên nội dung.
- `ContactForm`: markup và các trạng thái; preview nhận dữ liệu trong bộ nhớ để chạy validation, không gửi mạng/lưu lead. Chỉ timestamps/cooldown được lưu ở localStorage. Storage bị chặn thì fallback trong cùng tab.
- `InvestorLetter`: component riêng nhận nội dung và ảnh nền; căn giữa, title/emphasis vàng, divider SVG, ba trích dẫn và chữ ký theo website cũ.
- `project-document-model.ts`: contract group/download độc lập; `ProjectDocuments` nhận dữ liệu qua props. File đã có → anchor download; file chưa có → button disabled và trạng thái chờ tệp.
- Route Tổng quan chỉ ghép các section với `legacy-content.ts`; nguồn/tệp/checksum tại `public/client-reference/legacy/SOURCE.md`.

Lý do: giao diện, trạng thái, policy và nguồn dữ liệu có trách nhiệm rõ ràng. Trade-off: browser limit có thể bị vượt qua bằng sửa storage/clock hoặc gửi đồng thời từ nhiều tab; đây chỉ là hạn chế thao tác cho UI. Không dùng nó làm kiểm soát abuse production. Khác Solar demo hiện tại: kết quả preview xác định, không dùng random để giả lỗi/success.

## Validate security và file nguồn

Theo yêu cầu trình bày như sản phẩm hoàn chỉnh, form dùng nút “Gửi yêu cầu tư vấn”, consent và trạng thái bằng ngôn ngữ dành cho khách hàng. Preview gateway vẫn nằm sau contract nội bộ; thông báo cảm ơn không xác nhận lưu hoặc tiếp nhận lead. Không log/ghi personal data, không thêm admin permission hay bí mật client, không nhúng script/raw HTML website cũ. Chỉ đưa public copy vào React và self-host ảnh/tệp đã lấy.

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

## Cập nhật trình bày sản phẩm — 08/10/2026

Theo yêu cầu mới, bỏ ghi chú demo, hướng dẫn triển khai và nguồn nhập nội dung khỏi giao diện public. Menu và kiến trúc component giữ nguyên. Form giữ preview gateway, validation, khóa gửi và cooldown; chưa nối API. Màn hình hoàn tất dùng lời cảm ơn và hotline, không khẳng định có lead đã lưu. Những dữ liệu vị trí 3D chỉ dùng minh họa không được hiển thị thành mặt bằng thật; người dùng được dẫn sang sơ đồ brochure đã nhập. Không thay đổi quyền truy cập, kiểm tra freshness của projection hay dữ liệu cho thuê. Trade-off: giao diện đã sẵn sàng trình bày nhưng vận hành nhận lead vẫn cần HTTP gateway và kiểm soát server trong migration ở trên.
