# Architecture Decision — Dữ liệu admin và deploy demo dev

## Hiểu

Người dùng yêu cầu push nhánh dev và deploy GitHub Pages để thử; giữ TSX có thể
được nối backend về sau với ít thay đổi giao diện. GitHub Pages chỉ phục vụ static
assets, không thực hiện authorization hay transaction ghi database.

## Thiết kế

`AdminWorkspace.tsx → useAdminData → AdminRepository`.

- `contracts.ts`: typed snapshot và sáu command nghiệp vụ.
- `space-model.ts`: loại tầng/slot/group, kiểm tra geometry và membership.
- `demo-data.ts`: fixture riêng, lặp bản vẽ chưa xác định tầng.
- `demo-repository.ts`: adapter bộ nhớ, validation, ghép/tách và object URL.
- `http-repository.ts`: adapter transport cho backend được triển khai riêng.

TSX giữ selection, tìm/lọc và trình bày. Module dữ liệu sở hữu mutation và trả
snapshot có revision; hook hiển thị pending/error, chặn submit đồng thời, chỉ cập
nhật giao diện bằng state được adapter trả về. HTTP adapter chưa có server nhận
request; kết nối DB/auth là công việc tiếp theo, không phải khả năng đã deploy.

### Interface HTTP version 1

Base URL: cấu hình build `NEXT_PUBLIC_ADMIN_API_URL`, HTTPS tuyệt đối (HTTP chỉ
cho localhost). Không chứa secret. Adapter dùng `credentials: include`.

| Request | Input | Success |
| --- | --- | --- |
| GET `/workspace` | authenticated session | `AdminSnapshot` |
| POST `/commands` | `{command, expectedRevision}` và `Idempotency-Key` | snapshot mới |
| POST `/media` | multipart `files`, `scope`, `expectedRevision`; idempotency header | snapshot mới |

Snapshot: `{revision, slots, groups, leads, media}` theo contracts.ts. Các DTO
phải có ID ổn định; media URL do server cấp, không dùng tên nhóm làm foreign key.
Media `scope=group:<id>` hoặc tên tầng được backend map thành FK trong DB; `size`
và `time` là giá trị hiển thị, storage lưu byte_size/received_at chuẩn.

Command: merge, split, update-slot, update-group, update-lead, link-media. Không
có create/delete floor. Trạng thái là text giới hạn 60 ký tự; catalog trạng thái
hoặc quy tắc lease bổ sung sau không thay cấu trúc bảng UI.

HTTP lỗi: 401 hết phiên, 403 thiếu quyền, 409 conflict revision, 413 tệp quá lớn;
các lỗi khác báo tải/lưu thất bại. UI không tự retry mutation. Server phải lưu
idempotency key theo actor và trả lại cùng kết quả khi nhận request trùng.

## Validate security

GitHub Pages demo chỉ dùng fixture công khai, không gọi backend. Build demo
fail nếu có API URL. `noindex` không phải authorization. Template workflow chỉ chạy `dev`,
checkout không lưu git credential, action pin SHA, deploy job chỉ có Pages và
OIDC permissions. Repo UI private dùng deploy key chỉ đọc qua GitHub Secret;
known_hosts lấy từ GitHub meta API, không chấp nhận SSH host chưa xác nhận.

Production backend phải xác thực session, RBAC cho từng command, chống CSRF
(Origin kiểm tra, cookie secure/same-site phù hợp topology), giới hạn CORS chính
xác origin, retention PII và audit. Merge/split phải thực hiện transaction: khóa
slot, so expectedRevision, kiểm tra adjacency và availability thực tế, ghi
membership/group/media/audit và tăng revision. Nhãn `Trống` của demo không thay
thế kiểm tra lease/reservation khi chạy thật.

Upload production kiểm tra nội dung tệp phía server, quét tệp, lưu private object
storage, cấp URL có thời hạn. HTTP adapter kiểm tra envelope snapshot; schema
runtime chi tiết, quyền trên DTO và transport bảo mật vẫn phải xác nhận cùng
backend, không suy ra an toàn từ TypeScript.

## Trade-off và migration

Snapshot thống nhất giúp UI có một interface nhỏ và dễ thay adapter. Với dữ liệu
lớn, backend cần phân trang/filter server thay snapshot toàn bộ; thay hook/list
query theo interface version tiếp theo, phần sơ đồ và form được giữ lại.

1. Xác nhận inventory/bản vẽ từng tầng; `database/schema.sql` chưa apply và chưa có dữ liệu thật hay kết nối cloud.
2. Triển khai schema cùng lease/reservation, auth, RBAC, audit và upload policy.
3. Implement ba endpoint theo contract, transaction và idempotency; map FK thành
   DTO; kiểm tra từng field và session trước khi trả dữ liệu.
4. Deploy admin trên managed serverless runtime hoặc static frontend + backend
   đã bảo vệ. Cấu hình API URL, session/CORS/CSRF; thử contract và quyền thực tế.
5. Thay fixture bằng adapter HTTP qua cấu hình; kiểm tra tải/lưu, lỗi/xung đột và
   người dùng đồng thời. GitHub Pages tiếp tục là môi trường demo fixture.

## Thiết kế B2B kế nhiệm

Nghiệp vụ đã chốt trong [Thiết kế B2B](b2b-leasing-design.md); baseline duy nhất ở
[`database/schema.sql`](../database/schema.sql), chưa apply hoặc nối backend.

V2 dùng version mặt bằng và allocation theo thời gian; status text không quyết
định khả dụng. Revision theo aggregate thay singleton demo. Tài liệu hợp đồng
xem qua [Worker + R2 private](private-documents-r2.md); signed link chỉ là phương
án download có hạn khi policy cho phép. Trang public trả projection được duyệt.
Endpoint/DTO v2 phải được triển khai riêng trước khi chuyển TSX sang dữ liệu thật.

## Deploy hiện tại

Code nguồn ở `dev`; `npm run deploy:dev` kiểm tra source commit đã push, build
Next.js static export và push artifact vào `gh-pages` bằng commit thường. Pages
phục vụ từ branch artifact với `.nojekyll`, theo
[GitHub Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

Token hiện tại thiếu scope `workflow`, nên template Actions lưu tại
`docs/deployment/dev-pages.yml` và chưa tự chạy khi push dev. Khi có credential
phù hợp, đưa template vào `.github/workflows`, chuyển Pages sang Actions và đổi
branch policy `github-pages` thành dev. Template tách build/deploy theo
[GitHub Pages custom workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
Shared UI luôn lấy commit gitlink đã khóa, không tự nâng branch khi build.

## Demo hành trình B2B (06/10/2026)

Workspace hiện có các view Khách hàng, Yêu cầu & giữ chỗ, Hợp đồng, Lịch hẹn,
Tầng & mặt bằng, Leads, Media và Góc nhìn khách thuê. Dữ liệu B2B dùng chung
`AdminSnapshot`, thao tác đi qua `AdminRepository.execute` như các màn hình cũ.
`b2b-model.ts` là DTO của demo, không phải bản sao đầy đủ schema SQL v2.

- Gửi nhu cầu chưa giữ slot; duyệt yêu cầu cần nhập thời hạn, kiểm tra toàn bộ
  slot liền kề cùng tầng và kỳ thuê. Lỗi không tạo giữ chỗ một phần.
- Giữ chỗ cập nhật slot/hồ sơ; hủy có lý do; chuyển thuê chỉ là **mô phỏng ký**.
  Văn bản HTML minh họa không có chữ ký, không phải file hợp đồng thật.
- Book lịch tạo yêu cầu hẹn 30 phút, độc lập với giữ slot; admin xác nhận/hủy.
- Trang giới thiệu chỉ có thông tin khả dụng được chọn làm mẫu; không có ngày
  hết hợp đồng, countdown nội bộ hoặc tài liệu riêng. Portal mẫu lọc An Retail.
- Mốc tính thời gian cố định 06/10/2026 để demo nhất quán; chưa có expiry worker.

**Ranh giới bảo mật:** góc nhìn public/portal là chế độ trình diễn bên trong admin
static, không phải endpoint công khai hay phân quyền thật. Fixture toàn bộ workspace
vẫn có trong bundle/trình duyệt. Không đưa dữ liệu thật vào bản này. Production phải
cấp DTO riêng theo audience từ server, xác thực membership/object quyền cho mọi
request, thực hiện giao dịch và exclusion constraint trong DB, kiểm tra văn bản ký
trước chuyển thuê, rồi mới nối viewer với Worker/R2 riêng tư. Không dùng lọc React
để bảo vệ dữ liệu. HTTP adapter từ chối snapshot cũ thiếu các collection B2B.

Chạy tại local: `NEXT_PUBLIC_SITE_URL=http://localhost:3106/ npm run dev -- --port 3106`, mở `/admin-preview/`. URL này đặt base path local thay cho prefix GitHub Pages.
