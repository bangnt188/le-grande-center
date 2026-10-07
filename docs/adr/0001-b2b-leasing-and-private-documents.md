# Slot gốc, cam kết theo thời gian và tài liệu private

Trạng thái: quyết định nghiệp vụ đã chốt; schema và hạ tầng chưa triển khai.

Dùng slot gốc ổn định, phiên bản mặt bằng tham chiếu slot và phân bổ theo thời
gian để hỗ trợ nhiều phương án ghép mà không cho cam kết trùng. Luồng khách là
**gửi yêu cầu → chủ đầu tư duyệt → giữ chỗ có hạn**; lịch hẹn độc lập với giữ chỗ.
Dữ liệu công khai được duyệt riêng, không công bố countdown hợp đồng/hold mặc định.
Tài liệu hợp đồng đặt trong R2 private, xem qua Worker kiểm tra session và quyền
trên mỗi tài liệu. Đây là ranh giới bền vững giúp giữ UI khi thay backend/storage.

## Trade-off

- Nhiều quan hệ hơn draft admin v1; đổi lại kiểm soát chồng slot, lịch sử bản vẽ
  và hợp đồng mà không sửa slot gốc khi khách chọn phương án khác.
- Worker phải xử lý streaming/Range và authorization; đổi lại URL xem không cấp
  quyền cho người nhận link. Presigned URL vẫn dùng được cho download có hạn khi
  chính sách cho phép; người cầm link có quyền đến khi hết hạn.
- Cấu hình nhãn trạng thái bằng dữ liệu. Thêm state có tác động đến cam kết cần
  review workflow; đổi nhãn không thay quyền hay giải phóng slot.

## Migration

Baseline PostgreSQL duy nhất ở `database/schema.sql`, schema `leasing`.
Đây là schema mới, chưa apply/migrate dữ liệu. Xác nhận bản vẽ, map ID,
backfill và triển khai auth/commands/storage trước khi chuyển adapter HTTP.
Kế hoạch và các điểm chưa chốt: [Thiết kế B2B](../b2b-leasing-design.md).
