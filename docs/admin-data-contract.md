# Architecture Decision — Dữ liệu admin và deploy demo dev

## Hiểu

Người dùng yêu cầu push nhánh dev và deploy GitHub Pages để thử; giữ TSX có thể
được nối backend về sau với ít thay đổi giao diện. GitHub Pages chỉ phục vụ static
assets, không thực hiện authorization hay transaction ghi database.

## Thiết kế

`AdminWorkspace.tsx → useAdminData → AdminRepository`.

- `src/shared/admin/contracts.ts`: typed snapshot, command và repository interface.
- `src/shared/admin/space-model.ts`: loại tầng/slot/group và hàm thuần hiện có.
- `src/features/admin/demo/data.ts`: fixture riêng, lặp bản vẽ chưa xác định tầng.
- `src/features/admin/demo/repository.ts`: adapter browser, validation, mutation, byte accounting và URL tạm; `indexed-db.ts` lưu snapshot/Blob trong cùng transaction. Memory chỉ dùng cho Node checks.
- `src/features/admin/http-repository.ts`: adapter transport cho backend được triển khai riêng.

Ranh giới BE, DTO và storage: [Cấu trúc backend](backend-structure.md).

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

Snapshot gồm `revision`, `storage`, `floors`, `settings`, `slots`, `groups`, `leads`, `media`, `companies`, `requests`, `reservations`, `leases`, `appointments` theo contracts.ts. Mỗi floor có `purpose` nội bộ và `publicTitle`/`publicDescription` dùng chung trên trang chủ, nội dung 3D, tổng quan tầng và mặt bằng. HTTP consumer từ chối thiếu/sai cấu hình sáu tầng, settings hoặc trạng thái slot. ID ổn định; provider backend cấp URL riêng, không dùng tên nhóm làm khóa.

Media dùng `scope` project/tầng, `slot:<id>`, `group:<id>` hoặc `lease:<id>` do lệnh nghiệp vụ gắn; byte size/MIME lấy từ tệp. `hasUploadedFile` phân biệt tệp upload hoàn tất với asset/mục mẫu; picker hợp đồng chỉ nhận PDF có tệp upload thật. Trong browser cờ này suy ra từ Blob store, không coi URL mẫu là bằng chứng upload; API phải trả cờ hợp lệ và vẫn kiểm tra quyền/tệp ở server. Blob URL chỉ phục vụ runtime, không ghi vào snapshot IndexedDB; URL asset tham chiếu tĩnh có thể có trong fixture.
Media kind thêm Video/Model 3D/Tài nguyên; projectAsset/sourcePath phân biệt catalog từ public/R2 với upload local. Asset dự án chỉ xem: repository từ chối rename/link/delete. Reconcile catalog khi đọc cập nhật asset/loại bỏ mục mẫu thiếu file, không mất upload hoặc liên kết hợp đồng; byte ledger không tính asset. Danh mục được generate trước dev/build.

Command cấu hình: update-floor (công năng nội bộ + nội dung website dùng chung), update-settings (vận hành, giữ settings.website) và update-website-settings. Admin editor tầng dẫn tới đúng trang trong brochure PDF theo `sourcePage`. WebsiteSettings gồm logoMediaId, email, hotline, secondaryPhone, managementPhone, address, zaloUrl; kiểm tra email/phone/https zalo.me và logo phải là ảnh có file. Hồ sơ/mặt bằng/media giữ các command hiện có; không có create/delete floor hoặc luồng ký.

Slot chỉ Trống/Đang thuê, Đang chọn không lưu. Lead chỉ Mới/Đang tư vấn/Đã xử lý. Tên/công năng/liên hệ/thời gian có validation; upload PNG/JPEG/WebP/PDF tối đa 10 MiB, kiểm tra magic header. `record-lease` cần PDF đã upload và giữ chỗ chưa hết hạn; không ghi ngày ký hoặc xác nhận chữ ký.
Website provider SSR dùng defaults, client đọc snapshot/Blob hiện có và lấy `publicTitle`/`publicDescription` từ cùng snapshot. Sau update-floor hoặc lưu website, hook phát window event/BroadcastChannel legrande-website-settings; tab website refresh khi nhận hoặc focus. URL Blob cũ được revoke khi thay/unmount. UI không tạo upload logo local mới; logo hiện có được giữ nguyên cho tới khi có luồng Neon được bảo vệ bằng auth thật. Browser cũ được migrate thêm defaults một lần, không reset dataset. Đây là preview cục bộ, không DB/API production hoặc publish toàn cầu.

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

Workspace có Tầng, Căn / Mặt bằng, Doanh nghiệp, Khách đang thuê, Khách tiềm năng, Yêu cầu & giữ chỗ, Hợp đồng, Lịch hẹn, Media và Cấu hình trong một sidebar chia nhóm.
`/admin-preview/` là form đăng nhập demo username/password; `/admin-preview/workspace/` là workspace, bắt đầu tại Tầng.
`AdminSnapshot` và `AdminRepository.execute` vẫn là contract dữ liệu; header mở website public thật, không còn mô phỏng public/portal.
`src/shared/admin/b2b-model.ts` giữ DTO dùng thử, không phải bản sao đầy đủ SQL v2. Fixtures nằm riêng trong `demo/b2b-data.ts`; giữ chỗ/lịch hẹn và validation dùng thời gian hiện tại, giờ Việt Nam.

- Các phân hệ cấu hình/mặt bằng/hồ sơ/yêu cầu/hợp đồng/lịch/media có form và command; khách đang thuê là projection từ hồ sơ thuê. Công năng tầng đồng bộ table/bộ chọn tầng/mặt bằng; settings đặt mặc định giữ chỗ/lịch hẹn, không publish website.
- Yêu cầu kiểm tra toàn tổ hợp liền kề cùng tầng/cùng phía và đủ nhóm; diện tích lấy từ slot. Chưa quyết định mới được sửa; lỗi không tạo giữ chỗ một phần.
- Giữ chỗ có hạn theo đồng hồ hiện tại, hủy cần lý do. Upload PDF và lưu hồ sơ từ giữ chỗ là thao tác chuyển thuê rõ ràng, không mô phỏng ký/eSign. Hợp đồng đã có cho upload/thay tệp; không tự coi upload là đã ký.
- Lịch hẹn tạo/sửa thời gian, thời lượng và địa điểm; xác nhận/hủy có kiểm tra trạng thái và xung đột, độc lập giữ slot.

### Lưu browser và xử lý lỗi

IndexedDB `le-grande-admin-browser-v1`: store `state` có key `snapshot`, store `files` theo media ID. Snapshot/Blob thêm/xóa commit cùng transaction; chỉ báo thành công sau `oncomplete`. Byte ledger chỉ tính Blob local, không trừ dung lượng asset tĩnh khi xóa metadata. Revision CAS từ chối tab cũ; tải lại ngay trong form giữ nội dung đang nhập, chỉ lưu tiếp khi người dùng chủ động. Storage bị chặn, quota hết hoặc commit lỗi phải báo lỗi và giữ state/draft cũ, không fallback memory hoặc tự reset dataset.

Reload/đăng xuất giữ dữ liệu đã lưu trên cùng origin/browser; đổi máy/origin không chia sẻ. Browser có thể từ chối/evict dữ liệu; hạn mức nghiệp vụ 8,5 GB không bảo đảm quota thiết bị/cloud. URL Blob được tạo lại sau đọc, giải phóng khi dispose. Draft chưa lưu chỉ trong bộ nhớ; hủy có xác nhận, điều hướng/đóng trang có cảnh báo.

**Ranh giới bảo mật:** username/password chỉ trình diễn form, không gửi/lưu; sessionStorage chỉ giữ marker, không phải auth. Chỉ dùng dữ liệu thử nghiệm; bản Pages/IndexedDB không có phân quyền, intake website, private cloud hoặc API production. Production cần DTO theo quyền, verified session/membership, Origin/CSRF/CORS, transactions/revision/idempotency, upload scan/private delivery và chính sách hồ sơ được duyệt. Không dùng UI filter hoặc việc nhận PDF làm authorization/chứng nhận tài liệu.

Chạy tại local: `NEXT_PUBLIC_SITE_URL=http://localhost:3106/ npm run dev -- --port 3106`, mở `/admin-preview/`. URL này đặt base path local thay cho prefix GitHub Pages.
