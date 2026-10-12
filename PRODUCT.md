# Le Grande Centre

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Chủ đầu tư và đội vận hành dự án quản lý yêu cầu tư vấn (leads), media và mặt bằng thương mại.

## Product Purpose

Giúp đội vận hành xem mặt bằng theo tầng, theo dõi trạng thái sử dụng, ghép các slot phù hợp và quản lý thông tin tư vấn, hình ảnh, tài liệu.

## Capabilities and Constraints

- Sáu tầng cố định, cho sửa công năng; không thêm/xóa tầng và không tự đổi nội dung brochure/website.
- Slot thuộc một tầng. Chỉ ghép các slot liền kề cùng tầng, không ghép qua sảnh/thông tầng. Người dùng xác nhận ngày 06/10/2026.
- Public shophouse tầng 1–2 gồm 11 cặp A.n/B.n liên thông. Khách xác nhận ngày 12/10/2026 có thể thuê riêng từng căn hoặc kết hợp hai tầng; không mặc định thuê cả cặp. Liên kết public không phải thao tác ghép slot xuyên tầng trong admin.
- Ghép/tách giữ danh tính và diện tích thành viên. Diện tích slot chỉ sửa trực tiếp khi chưa có cam kết và chưa thuộc nhóm; tổng diện tích yêu cầu chưa duyệt được cập nhật từ slot.
- Slot chỉ có hai trạng thái sử dụng: Trống và Đang thuê. Đang chọn là trạng thái tương tác riêng, không lưu trong dữ liệu. Giữ chỗ thuộc hồ sơ thuê và vẫn khóa thao tác xung đột dù slot chưa thuê.
- Toàn bộ admin hiện có hỗ trợ nghiệp vụ dùng thử và lưu snapshot/tệp bằng IndexedDB trên trình duyệt. Chưa có DB/cloud storage, auth, API production hoặc phân quyền thật.
- Chưa có bản vẽ chính thức của cả sáu tầng; không suy diễn fixture thành số liệu thực tế.

## B2B workflow confirmed

- Khách hàng doanh nghiệp có nhu cầu thuê, hợp đồng, lịch hẹn và tài liệu liên kết.
- Gửi yêu cầu → chủ đầu tư duyệt → giữ chỗ có thời hạn; lịch hẹn độc lập.
- Hợp đồng/hold deadline chỉ hiển thị trong quản trị nội bộ có quyền. Public chỉ hiển thị khả dụng dự kiến được duyệt và đăng ký quan tâm. Không có portal đăng nhập dành cho khách thuê trong phạm vi hiện tại.
- Hợp đồng chỉ upload/liên kết/thay PDF, không có ký online/eSign hoặc tự xác nhận nội dung đã ký. Tài liệu production cần storage riêng tư và quyền kiểm tra phía server.
- Giữ chỗ/lịch hẹn dùng thời gian hiện tại. Cấu hình browser đặt mặc định giờ giữ chỗ, thời lượng và địa điểm hẹn; chưa phải chính sách production của khách hàng.
- Admin có một sidebar chia nhóm Mặt bằng/Kinh doanh/Tài nguyên/Hệ thống; mục Cấu hình gồm chính sách dùng thử và logo, Zalo, email, hotline, địa chỉ website. Thay đổi website chỉ áp dụng cùng origin/trình duyệt, chưa công bố toàn cầu hoặc nối DB. Không có portal khách thuê hoặc mô phỏng website bên trong; header mở website thật.
- `/admin-preview/` là form username/password demo, không lưu/gửi thông tin; bấm đăng nhập đi vào Tổng quan tầng tại `/admin-preview/workspace/`. Marker local không cấp quyền production.

## Brand Commitments

Website tham chiếu: https://legrandecentre.vn/. Bộ theme shopping-mall hiện có trong packages/ui là nguồn màu thương hiệu của ứng dụng. Tên hiển thị dùng Le Grande Centre.

## Evidence on Hand

- Bản vẽ do khách hàng cung cấp: B.1 và B.11 có diện tích 205 m², B.2–B.10 có diện tích 164 m²; sảnh/thông tầng nằm giữa B.5 và B.6. Chưa xác nhận bản vẽ ứng với tầng nào.
- Prototype admin hiện có tại src/app/admin-preview/.
- Tài liệu kiến trúc tại docs/admin-architecture-decision.md.

## Product Principles

- Đọc được quan hệ slot, tầng và mặt bằng ghép.
- Mọi trạng thái đều có nhãn text; màu chỉ hỗ trợ nhận biết.
- Không làm mất slot gốc khi ghép hoặc tách mặt bằng.
- Dữ liệu minh họa và thông tin dự án đã xác nhận phải dễ phân biệt.
