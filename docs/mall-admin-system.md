# Architecture Decision — Mall admin dùng UI system

## Hiểu

Yêu cầu: tăng độ sang của admin mall, dùng component hiện có, thay feedback banner bằng toast system và hiển thị pagination thật. Giữ quy trình B2B, dữ liệu mẫu, sáu tầng cố định và điều kiện ghép slot.

## Thiết kế

- App map semantic tokens sang nền kem, xanh sâu, đồng; sidebar tối và nội dung sáng. Tiêu đề serif tạo phân cấp, dữ liệu vẫn dùng sans dễ đọc. Đây là thay đổi admin, không chỉnh landing.
- Controls dùng `Button`, `Input`, `Select`, `Textarea`, `Checkbox`; trạng thái dùng `Badge`; navigation nội dung dùng `Tabs`/`ButtonGroup`; cấu trúc dùng `AdminShell`, `AdminPageHeader`, `AdminPanel`, `WorkspaceLayout` và `Breadcrumbs`.
- Bảng slot/hợp đồng dùng `Table` có props cộng thêm cho row selection/click và vùng cuộn ngang có tên. Semantic table được giữ; nút Chi tiết vẫn là đường truy cập keyboard.
- `AdminNotificationsProvider` chỉ quản lý hàng đợi app tối đa ba thông báo. `AdminToastViewport` render component `Toast` của system ở góc dưới, trong themed root. Success/warning/error có tone tương ứng, đóng được, tự hết hạn; pause khi hover/focus và live announcement do component system cung cấp. Không dùng feedback banner cũ.
- Pagination tái sử dụng `Pagination` + `Select`. Filter/sort xảy ra trước slice. Số dòng 2/5/10/20; chọn số dòng hoặc đổi filter đưa về trang đầu; page được clamp khi dữ liệu giảm. Footer hiển thị khoảng bản ghi và tổng số thật sau filter.
- Doanh nghiệp, yêu cầu, hợp đồng, lịch hẹn, slot, lead và media đều có pagination. Các register nhỏ dùng 2 dòng mặc định để người duyệt thấy nhiều trang mà không phải thêm dữ liệu giả không cần thiết.
- Loading dùng system indicator/Button loading. Thông tin nghiệp vụ lâu dài (giữ chỗ, deadline, cảnh báo hình học) là trạng thái hồ sơ; hướng dẫn ghép dùng `Alert`, không biến toàn bộ thông tin đó thành toast tự biến mất.

## Validate security

Text toast được React escape, không HTML injection. Queue không lưu dữ liệu ra storage/log và không chứa file hợp đồng thật. Pagination phía trình duyệt chỉ áp dụng snapshot demo hoặc dữ liệu API đã được cấp quyền; không phải ranh giới authorization. API production phải lọc quyền ở nguồn, giới hạn page size và trả total/cursor phù hợp trước khi render. Role/mode preview không cấp quyền.

## Lý do, trade-off và migration

Dùng primitives sẵn có giữ focus, disabled/loading, announced status và page semantics nhất quán. App chỉ quản lý domain state, presentation tokens và composition. Trade-off: current demo phân trang client vì repository cung cấp snapshot; với dữ liệu lớn cần server query, không tải toàn bộ snapshot rồi coi pagination là giới hạn dữ liệu.

Migration: thay read toàn bộ register bằng repository query có filter/sort/page hoặc cursor và metadata, giữ `Pagination`/toast/theme adapter. Không sửa component system khi nối DB. Package `Table` mở rộng props theo cách tương thích ngược, consumer cũ không cần thay đổi.

## Phạm vi bằng chứng

Các bản capture `.impeccable/review/mall-system-*` bao gồm desktop/mobile company, toast, lease, slot, lead, desktop request/media/topnav và mobile menu. Browser observation log ghi việc lưu ghi chú → toast, chuyển page doanh nghiệp/hợp đồng → records mới. Typecheck/static build và review cuối được báo riêng; không có production auth/storage/deployment được triển khai. Không thêm hoặc chạy automated tests.

## Architecture Decision — Pagination giữ vị trí ổn định

**Hiểu:** chiều cao danh sách trước đây co theo số item; trang cuối ít item kéo footer phân trang lên. Table auto-layout còn tính lại cột theo dữ liệu mỗi trang, làm chiều cao dòng thay đổi trên mobile.

**Thiết kế:** shared `PaginatedContent` giữ chiều cao lớn nhất đã render tại cùng độ rộng. Footer `Pagination` nằm sau vùng đó. Không tạo bản ghi/trống giả trong table. Đổi page size/density hoặc container width cho phép tính lại; filter, trang cuối và empty state giữ không gian hiện tại. Nội dung dài vẫn được phép nở để không mất dữ liệu. Bảng slot có độ rộng cột ổn định và cuộn ngang trong viewport hiện có.

**Validate security:** observer chỉ đo hình học DOM; không truy cập dữ liệu nghiệp vụ, storage hay network. Không đổi query, giới hạn quyền hoặc nội dung hợp đồng. Observer được ngắt khi unmount; markup bảng và controls system giữ nguyên semantics/focus.

**Trade-off:** khoảng trống ở trang cuối là không gian đã dành cho dữ liệu, giúp nút điều hướng không chạy khỏi vị trí người dùng đang thao tác. Nội dung dài hơn mọi trang đã xem có thể tăng chiều cao để tránh cắt nội dung. Không khoá một chiều cao desktop cho mobile. Quy tắc này là quyết định UX của sản phẩm, không phải một chứng nhận 'global'.

**Migration:** cả bảy register dùng cùng primitive của `@mall/ui`; khi thay snapshot bằng API chỉ giữ `layoutKey` cho page size/density, không thêm page number vào key và không mount lại region mỗi lần tải trang.
