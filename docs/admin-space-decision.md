# Architecture Decision — Demo quản trị mặt bằng Le Grande Centre

Ngày: 06/10/2026. Phạm vi: prototype Next.js tại `/admin-preview/`, dữ liệu mẫu trong bộ nhớ trình duyệt.

## Hiểu bài toán

Đội vận hành/chủ đầu tư quản lý leads, media và mặt bằng theo 6 tầng cố định. Người dùng xác nhận chỉ ghép slot liền kề cùng tầng, không đi qua sảnh/thông tầng; chọn code-first để duyệt trực tiếp giao diện.

Bản vẽ khách hàng chứa B.1–B.11. B.1/B.11: 205 m², 10 × 20,5 m. B.2–B.10: 164 m², 8 × 20,5 m. Sảnh/thông tầng ở giữa B.5/B.6. Chưa xác nhận tầng của bản vẽ. Fixture lặp geometry trên cả 6 tầng chỉ nhằm mô phỏng, không được dùng làm inventory thực tế. Trạng thái, đối tác và leads là dữ liệu giả lập.

## Thiết kế và quyết định

- Sáu tầng được khai báo cố định. Không có thao tác thêm/xóa tầng.
- Slot là đơn vị gốc có ID chứa tầng, mã, diện tích, thứ tự và phía sảnh. Ghép tạo `SpaceGroup` tham chiếu các slot thành viên, không sửa geometry, mã hoặc diện tích gốc.
- Bộ kiểm tra ghép xác nhận slot tồn tại, không trùng, cùng tầng, cùng phía sảnh, thứ tự liên tiếp, chưa thuộc nhóm khác. Demo chỉ cho ghép slot có text `Trống` và chưa có đối tác.
- Sơ đồ và bảng dùng chung selection. Nhóm hiện thành một footprint liên tục; bảng giữ từng slot gốc và chỉ rõ nhóm chứa nó. Diện tích nhóm là tổng diện tích thành viên.
- Tách nhóm giữ trạng thái text của nhóm trên các slot; media liên kết với nhóm chuyển về tầng, tránh tham chiếu đến nhóm đã tách. Mã và diện tích gốc được bảo toàn.
- Trạng thái dùng `string`, input text kèm gợi ý, filter được sinh từ giá trị hiện tại. Giá trị mới không yêu cầu thay union/enum. Màu có fallback trung tính; text luôn hiển thị.
- Leads hỗ trợ tìm/lọc, trạng thái text, ghi chú và chuyển tới tầng quan tâm. Không chứa PII thật.
- Media hỗ trợ tìm/lọc, chọn tệp xem trước, gắn với tầng/nhóm. Nhóm được tham chiếu bằng ID ổn định, không dùng tên hiển thị làm khóa. Chỉ nhận PNG/JPEG/WebP/PDF tối đa 10 MB. Object URL được giải phóng khi component unmount; không gửi file lên mạng.
- Demo chạy như Client Component nằm trong page Server Component giữ metadata `noindex`. Website công khai vẫn static export. Script postbuild mặc định loại route `admin-preview` và tài sản `admin-demo` khỏi `out`; workflow dev opt-in để publish demo fixture công khai. Hợp đồng dữ liệu mới nằm trong `src/features/admin/`, TSX gọi hook qua repository.

## Lý do và trade-off

Tách slot gốc và nhóm cho phép truy vết, tách lại và định danh media ổn định. Luồng ghép gần sơ đồ làm rõ quan hệ không gian trước khi thao tác. Sáu tầng cố định tránh phát sinh quy trình thay đổi cấu trúc công trình ngoài phạm vi.

Bộ nhớ trình duyệt phù hợp với demo duyệt thiết kế, nhưng mất thay đổi khi reload và không hỗ trợ nhiều người dùng hay audit. Đây không phải thiết kế lưu trữ production. Sơ đồ là mô phỏng, không thay thế bản vẽ kỹ thuật. Bộ trạng thái text linh hoạt nhưng chưa có quy tắc chuyển trạng thái và chưa phải hệ phân loại nghiệp vụ chuẩn.

## Validate security / threat model

- **PII và quyền quản trị:** prototype chỉ có fixture, không có session, auth, API hoặc dữ liệu thật. `noindex` và loại route khỏi export không phải access control; production admin phải chạy trên managed runtime với authorization phía server.
- **XSS từ nội dung:** React render text, không render HTML tùy ý. Trạng thái, tên và ghi chú bị giới hạn độ dài. Tệp HTML/SVG bị loại khỏi demo; object URL không trở thành URL do người dùng tự nhập.
- **Tệp độc hại:** MIME/size ở client chỉ là kiểm tra trải nghiệm. Production cần xác thực upload, kiểm tra signature/size phía server, quét tệp, bucket private, download URL có thời hạn và Content-Disposition phù hợp. Không xem việc demo nhận PDF là chứng nhận tệp an toàn.
- **Ghép trùng do race condition:** kiểm tra trong browser chỉ đủ cho phiên demo. Production phải thực hiện validation và mutation trong transaction, khóa hoặc kiểm soát revision, và ràng buộc mỗi slot chỉ có một membership active.
- **Bịa số liệu dự án:** fixture được ghi rõ trên giao diện; inventory thật chỉ nhập từ bản vẽ đã xác nhận.

## Đề xuất và migration path production

1. Nhận bản vẽ được duyệt của từng tầng; lập inventory với ID ổn định, geometry và cạnh liền kề rõ ràng. Chưa chốt schema diện tích thật từ một ảnh.
2. Chốt status catalog dạng dữ liệu (ID, nhãn text, thứ tự). Quyền ghép phải dựa trên lease/reservation/availability thực tế, không dựa trên nhãn text `Trống`; demo dùng rule đơn giản đã ghi ở trên.
3. Giữ contract `Slot`, `SpaceGroup`, `Lead`, `Media` và thay React state bằng repository/API. Đưa merge/split sang server transaction; ghi actor, revision, before/after và hỗ trợ undo có kiểm tra xung đột.
4. Triển khai admin trên managed serverless runtime, managed relational database và private object storage. Áp dụng session, RBAC, audit, retention PII và upload policy trước khi nhập dữ liệu thật.
5. Chạy preview với dữ liệu đã xác nhận, kiểm tra nghiệp vụ và bàn giao; chỉ xuất nội dung được duyệt sang pipeline build của website công khai.

## Cách mở demo và giới hạn validation

`npm run dev -- --port 3106`, sau đó mở `http://localhost:3106/le-grande-center/admin-preview/` với cấu hình base path mặc định. Nếu `NEXT_PUBLIC_SITE_URL` có path khác, dùng path đó.

Kiểm tra trình duyệt tại 1440, 768, 390 và 320 px; bảng và sơ đồ cuộn trong container ở màn hình nhỏ. Domain checks bao gồm valid merge, duplicate/missing IDs, khác tầng, qua sảnh, không liền kề, nhóm trùng và slot có đối tác. Browser kiểm tra ghép/tách, trạng thái text mới, lead, media, reload, ảnh tham chiếu và reduced motion. Kết quả chi tiết ở `.impeccable/review/checks.json`. Không chứng nhận bảo mật/hiệu năng của hệ thống production chưa triển khai.
