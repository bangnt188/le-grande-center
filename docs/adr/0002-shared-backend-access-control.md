# Architecture Decision — Thư viện backend xác thực và phân quyền

Trạng thái: lib và SQL adapter đã có code/typecheck/tests cục bộ; chưa kết nối provider, DB hay deploy Vercel thật.

## Hiểu

Cần backend dùng lại cho Mall và Solar, khởi đầu đơn giản với khoảng 4–5 nhóm quyền. Cùng một màn hình có thể hiển thị thao tác và dữ liệu khác theo quyền. Orbit là nguồn học về cấu trúc, không phải backend sẽ được clone nguyên. Kết quả source review: [Orbit research](../orbit-auth-research.md).

## Thiết kế

Tách `packages/backend` (`@mall/backend`) khỏi thư viện React UI. Core TypeScript không có dependency runtime, không dùng Redis, filesystem hay state toàn cục. Dùng Web `Request` ở interface server để adapter chạy được trên Worker hoặc managed functions. Authentication provider kiểm tra session; principal adapter map issuer/subject thành người dùng active và tải grants hiện hành; policy core kiểm tra permission + tenant + property + organization + owner + object. Audit adapter ghi quyết định trước khi trả kết quả.

Interface nhỏ: `createAccessBackend({verifySession, loadPrincipal, recordDecision})` và `requireAccess(request, {permission, resource})`. `resource` phải do backend resolve từ DB, không lấy các tenant/property/organization/owner từ request body. Kết quả trả actor và policy version để nghiệp vụ tiếp tục kiểm tra lifecycle/revision trong transaction.

Permission là mã ổn định `resource:action`, không phải label UI. Có năm action cơ bản `view/create/update/delete/approve`; thêm action nghiệp vụ như `approve-and-hold`, `download`, `publish` không đổi engine. Grant có allow/deny và scope bắt buộc tenant. Deny có ưu tiên, không wildcard hoặc superadmin bypass. Scope là điều kiện đồng thời; nhiều grant allow là các lựa chọn độc lập. Không trộn scope từ hai grant thành quyền rộng hơn.

DB Mall đã có năm role staff: `administrator`, `leasing`, `legal`, `finance`, `operations`. Đây là profile đề xuất, chưa seed hay cấp quyền thật:

| Vai trò | Phạm vi và nghiệp vụ đề xuất |
|---|---|
| administrator | Quản lý phân công/quyền và cấu hình property; dữ liệu nhạy cảm vẫn cần grant riêng |
| leasing | Khách hàng, lead, lịch hẹn, yêu cầu thuê và giữ chỗ trong property được phân công |
| legal | Hồ sơ pháp lý, phiên bản hợp đồng; duyệt ký và cấp quyền tài liệu theo workflow |
| finance | Điều khoản tiền, hóa đơn/thanh toán; không mặc nhiên chỉnh geometry hay cấp quyền người dùng |
| operations | Tầng/slot, media, lịch vận hành; không mặc nhiên xem tiền hay hợp đồng private |

Portal `representative/viewer` là membership doanh nghiệp, không phải staff role thứ sáu. Cần membership verified, quan hệ property_customer và grant document còn hiệu lực. Không suy ra quyền từ email/domain.

Một screen được render từ `capabilities` và DTO tối thiểu do backend trả. Cùng màn Hợp đồng: leasing thấy tiến độ; legal có action pháp chế; finance có field tiền khi được cấp `contracts:view-finance`. Backend projection mới quyết định field được trả. Không gửi toàn bộ workspace rồi ẩn trong React. Collection query phải dùng đúng filter scope đã authorize; guard object không tự thêm SQL predicates. Deny có thể giao với collection sẽ chặn toàn collection, kể cả deny theo object ID; muốn trả kết quả một phần cần query/projection được kiểm chứng riêng. Audit policy decision không phải bằng chứng command đã thực hiện; command cần audit outcome trong transaction.

## Validate security

Fail closed khi session, principal, grant hoặc scope không hợp lệ; kiểm tra binding issuer/subject; session/grant expiry; disabled user; explicit deny. Lỗi verify/load/audit trả lỗi service, không cho thao tác tiếp. Principal tải mới cho mỗi `requireAccess`; không cache permission xuyên request trong core. Nếu cần cache, adapter phải validate identity/version và có invalidation bảo đảm, không dùng TTL như cam kết revoke tức thời.

Threat model: đổi ID để đọc chéo tenant/org, sửa role trong browser, reuse session đã revoke, broad administrator bypass, bỏ middleware ở endpoint custom, truyền dữ liệu nhạy cảm vào UI. Chặn bằng trusted session + server-loaded resource + scoped exact grants + guard tại repository/service + projection DTO + audit. Các phép mutation nhạy cảm phải tải/kiểm tra lại assignment/grant và state trong cùng transaction hoặc chống race bằng policy revision. Core không tự điều khiển transaction của DB.

Không tự viết password hashing, JWT signature verification, refresh-token storage hay MFA. Provider adapter phải dùng auth library/provider được chọn và kiểm tra issuer/audience/signature/expiry/session revocation theo protocol. Cookie writes cần kiểm tra CSRF/Origin; mọi endpoint cần giới hạn body/rate và transport policy. Chưa có adapter nghĩa là chưa có login production.

Cách deny mặc định, kiểm tra mỗi request và phân quyền resource phù hợp với [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html). Web interface dựa trên [Workers runtime](https://developers.cloudflare.com/workers/runtime-apis/), không yêu cầu server thường trực. Backend vẫn cần managed runtime và managed persistence; GitHub Pages chỉ phục vụ demo static.

## Trade-off

Core nhỏ dễ kiểm chứng và thay provider, nhưng auth provider, DB/RLS, transaction và DTO projection phải có adapter thực tế. Exact permission/scope ít linh hoạt hơn expression engine, đổi lại không chạy code hoặc SQL điều kiện từ cấu hình. CRUD dùng chung được bổ sung qua transaction/repository/parser/projection rõ ràng; workflow/upload vẫn thuộc ứng dụng vì mỗi miền có invariant riêng.

## Migration path

1. Chốt role matrix và field visibility, dựa trên staff_assignments/memberships/grants hiện có. Core không phụ thuộc danh sách role nên đổi 4/5 role không sửa engine.
2. Chọn managed auth/session provider, map issuer/subject sang leasing.users; load permissions từ assignment active và grant current. Quy tắc role nằm ở app, core chỉ xử lý grant chuẩn.
3. Tạo adapter repository để resolve resource, query theo scope, projection DTO; adapter audit append-only. Next adapter đặt trong file `server-only`, Worker dùng binding tương ứng.
4. Enforce guard tại mọi read/command/document Range/HEAD; kiểm tra lại quyền/state trong transaction ghi. Public projection có đường riêng được duyệt.
5. Nối UI với capabilities endpoint. Role switch ở demo tiếp tục chỉ là fixture cho đến khi endpoint/auth thật hoàn tất.
6. Provision RLS/runtime role và chạy integration tests cross-tenant, revoke, concurrency trên DB/provider được chọn trước production. Không apply baseline SQL tự động trong bước xây core.

## Bổ sung: mini lib và Vercel

Phạm vi ban đầu là access guard và mã hóa field; theo yêu cầu tiếp theo đã bổ sung CRUD, SQL repository, HTTP handlers, validation/response, HTTPS client và webhook verifier/inbox. Không mang framework Go, Redis, 3DES-CBC hoặc generic CRUD từ Orbit qua. Crypto dùng AES-256-GCM Web Crypto với context tenant/record/field và key ID; secrets thuộc BE, không thuộc UI. Target tích hợp Next.js trên Vercel Node runtime, cần chuyển deployment khỏi static export trước khi chạy endpoint thật. Trade-off: secrets runtime đơn giản nhưng BE compromise vẫn lộ plaintext; khi cần custody nghiêm ngặt chuyển sang dịch vụ KMS qua adapter phù hợp. Threat model, rotation và migration được ghi trong [Vercel guide](../../packages/backend/VERCEL.md).

## Kiểm chứng bổ sung

Các interface đã được triển khai theo vòng red → green. Typecheck bao gồm source/tests/examples; tests dùng crypto thật và DB/transport fixture. Chưa kết nối provider, DB, API vendor hoặc deployment Vercel thật. [Hợp đồng tích hợp](../../packages/backend/docs/integration.md) ghi rõ transaction, scope, protocol webhook và giới hạn runtime.


## 2026-10-07 — Reuse across Mall and Solar

Package identity becomes `@shared/backend`; UI identities stay project-specific. Custom scopes use nested `dimensions` with exact policy matching and explicitly required SQL mappings. Existing Mall scope fields remain compatible. Business schemas/workflows and deployment remain application-owned. See [portability decision](../../packages/backend/docs/portability.md) for threat model, trade-offs and migration.
