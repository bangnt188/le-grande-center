# Architecture Decision: Admin Le Grande Center

## Bối cảnh

Landing page hiện hành đang chờ đội ngũ phát triển cũ bàn giao source, nội dung
và tài sản. Website công khai hiện có các nhóm nội dung tổng quan dự án, vị trí,
phân khu chức năng, hình ảnh, tiện ích, tài liệu và form tư vấn. Các chi tiết,
trạng thái và số liệu trên website cần được đối chiếu với source bàn giao trước
khi đưa thành dữ liệu quản trị.

Giao diện tại `/admin-preview/` là prototype để duyệt bố cục và luồng quản trị.
Các chỉ số, nhật ký, trạng thái và mã yêu cầu trên đó đều là dữ liệu minh họa.
Không có xác thực, lưu trữ, gửi form, API hay thao tác thay đổi dữ liệu.

## Quyết định

Tách hai bề mặt triển khai:

1. **Website công khai**: Next.js static export, build từ nội dung đã duyệt và
   phục vụ qua static hosting. Không chứa secret hay dữ liệu nội bộ.
2. **Admin vận hành**: Next.js App Router chạy trên managed serverless runtime.
   Xác thực, phân quyền, đọc/ghi dữ liệu và kiểm tra quyền đều thực hiện phía
   server. Không phát hành admin như một trang static trên GitHub Pages.

Admin dự kiến có dashboard, quản lý nội dung landing theo section, thư viện hình
ảnh/tài liệu, hộp thư yêu cầu tư vấn, nhật ký kiểm toán và cấu hình người dùng.
Nội dung xuất bản qua revision: editor tạo draft, người có quyền duyệt xác nhận,
sau đó pipeline build website công khai từ revision đã duyệt. Bản prototype
chưa thực hiện các nghiệp vụ này.

Sau khi nhận bàn giao, cần lập content inventory và xác nhận hợp đồng dữ liệu
trước khi chốt schema. Đề xuất ban đầu là cơ sở dữ liệu quan hệ managed cho nội
dung, trạng thái lead và audit; object storage riêng cho tài liệu. Chưa tạo cloud
resource hay kết nối dữ liệu thật.

## Lý do và trade-off

Static export phù hợp với website công khai ít thay đổi theo request, dễ cache và
không cần vận hành server thường trực. Admin cần session, authorization theo từng
hành động và ghi dữ liệu; do đó phải có runtime xử lý request. Managed serverless
giảm việc tự vận hành máy chủ nhưng thêm chi phí theo mức dùng, giới hạn runtime
và phụ thuộc nhà cung cấp.

Tách website và admin giữ bề mặt công khai nhỏ, cho phép triển khai nội dung tĩnh
độc lập với phiên bản quản trị. Đổi lại, cần version hóa schema/content contract
và pipeline publish giữa hai ứng dụng.

## Threat model ngắn

- **Truy cập trái phép**: kiểm tra session và quyền phía server trên mọi query,
  mutation và Server Action; ẩn nút trên giao diện không phải là kiểm soát quyền.
- **Lộ thông tin liên hệ**: chỉ trả DTO tối thiểu; giới hạn quyền xem lead, ghi
  audit access/export và đặt chính sách lưu trữ/xóa PII.
- **Nội dung hoặc tài liệu độc hại**: upload qua đường dẫn được cấp quyền, kiểm
  tra kích thước/MIME, quét tệp và không render HTML/URL tùy ý.
- **Sai lệch nội dung công khai**: draft và published revision tách biệt; mọi
  lần publish có actor, revision và khả năng rollback.
- **Chuỗi cung ứng CI**: ghim commit submodule và lockfile; CI chỉ có quyền đọc
  source, quyền deploy giới hạn theo môi trường; không đưa secret vào static
  bundle.

## Migration path

1. Nhận source, assets, tài liệu nội dung và cấu hình deploy từ đội ngũ cũ; kiểm
   tra quyền sở hữu, dependency, domain, redirect và dữ liệu form hiện có.
2. Đối chiếu từng section với landing được bàn giao; chốt field/schema, role,
   trạng thái nội dung, chính sách lead và quy trình duyệt.
3. Hoàn tất UI admin trước với dữ liệu fixture; sau đó kết nối auth và repository
   server-side qua interface ổn định.
4. Chạy song song preview website mới với website hiện hành. Chỉ cutover domain
   sau khi nội dung, form, SEO, redirect, bảo mật và quy trình rollback được duyệt.

## Tài liệu tham chiếu

- [Website Le Grande Center hiện tại](https://legrandecentre.vn/)
- [Next.js Static Exports](https://nextjs.org/docs/app/guides/static-exports)
- [Next.js Authentication](https://nextjs.org/docs/app/guides/authentication)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
