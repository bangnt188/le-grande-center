# Le Grande Centre

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Chủ đầu tư và đội vận hành dự án quản lý yêu cầu tư vấn (leads), media và mặt bằng thương mại.

## Product Purpose

Giúp đội vận hành xem mặt bằng theo tầng, theo dõi trạng thái sử dụng, ghép các slot phù hợp và quản lý thông tin tư vấn, hình ảnh, tài liệu.

## Capabilities and Constraints

- Sáu tầng cố định, không có thao tác thêm hoặc xóa tầng.
- Slot thuộc một tầng. Chỉ ghép các slot liền kề cùng tầng, không ghép qua sảnh/thông tầng. Người dùng xác nhận ngày 06/10/2026.
- Giữ danh tính và diện tích slot gốc; mặt bằng ghép tham chiếu các slot thành viên.
- Trạng thái thể hiện bằng text và cho phép bổ sung giá trị về sau.
- Phạm vi hiện tại là demo Next.js với dữ liệu mẫu; auth, lưu trữ, upload production và phân quyền chưa được triển khai.
- Chưa có bản vẽ chính thức của cả sáu tầng; không suy diễn fixture thành số liệu thực tế.

## B2B workflow confirmed

- Khách hàng doanh nghiệp có nhu cầu thuê, hợp đồng, lịch hẹn và tài liệu liên kết.
- Gửi yêu cầu → chủ đầu tư duyệt → giữ chỗ có thời hạn; lịch hẹn độc lập.
- Hợp đồng/hold deadline chỉ hiển thị trong nội bộ hoặc portal có quyền. Public
  chỉ hiển thị khả dụng dự kiến được duyệt và đăng ký quan tâm.
- Tài liệu production dùng R2 private + Worker kiểm tra session/quyền. Demo chỉ
  mô phỏng hồ sơ và tài liệu mẫu, không có authentication/storage thật.
- Chính sách TTL/quota/gia hạn chưa chốt; demo yêu cầu người duyệt chọn thời hạn.

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
