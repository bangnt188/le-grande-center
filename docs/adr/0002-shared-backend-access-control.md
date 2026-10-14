# Architecture Decision — Thư viện backend xác thực và phân quyền

Trạng thái 14/10/2026: shared library có primitives và Mall đã có adapter Neon Auth/PostgreSQL thật. Đây không còn đề xuất chọn Vercel/auth provider. Frontend production chưa deploy/cutover; bằng chứng/giới hạn tại [readiness](../backend-readiness.md).

## Shared core

`packages/backend` (`@shared/backend`) độc lập React/app, không Redis/filesystem/global permission state. Web Request interface hỗ trợ managed runtime. Core cung cấp access/policy, CRUD/SQL/transaction contracts, HTTP/validation, crypto và generic storage; app giữ business schema/workflows, session, role mapping, audit và runtime. Orbit là nguồn nghiên cứu, không backend clone: [research](../orbit-auth-research.md).

`createAccessBackend({verifySession, loadPrincipal, recordDecision})` và `requireAccess(request, {permission, resource})` dùng resource từ DB, không tin client tenant/property/org/owner. Permission stable `resource:action`, không UI label. Grant deny ưu tiên; scopes là điều kiện đồng thời, nhiều allows là lựa chọn riêng, không trộn dimensions giữa grants để mở rộng quyền. Không wildcard/superadmin bypass trong engine.

Collection scope phải áp dụng trước count/paging; object guard không tự thêm SQL predicates. Deny giao collection có thể chặn collection; partial result cần projection/query được kiểm chứng. Không gửi toàn workspace rồi ẩn React. Audit policy decision không là bằng chứng command đã commit; outcome audit phải trong transaction.

## Mall adapter hiện tại

- `/admin/` và `/api/auth` dùng managed Neon Auth, fresh upstream session, expiry/emailVerified và issuer/subject binding. `/admin/workspace/` và mỗi API check độc lập; mutation check same origin.
- `src/server/database.ts` resolve verified email qua DB admin allowlist rồi bind identity; signup không tự tạo quyền. Disabled user/revoked assignment/allowlist bị chặn, current identity/assignment được kiểm tra trong transaction.
- Workspace hiện hỗ trợ **allowlisted administrator**. Năm role schema `administrator/leasing/legal/finance/operations` không có nghĩa đã mở đủ năm UI/field-policy workflows. Customer portal representative/viewer/document-grant UX chưa được triển khai; CRM contact không tự là user có quyền.
- Neon request-local Pool, `leasing_runtime`, actor context/RLS; command parser, property lock/CAS, receipt và audit gắn transaction. Public có projection riêng, không tenant/contact/hold/private documents.
- Media resolve ownership/key DB; PDF quarantine/manual external review và GET/HEAD/Range cùng session guard. Không tự viết password hashing, JWT protocol, MFA hay gọi manual review là antivirus-clean/signature.
- Không browser demo login, role switch hoặc IndexedDB fallback. Secrets chỉ server; static Pages không chạy admin/API.

Baseline + migrations 001–004 đã áp dụng vào stage2, regression disposable và backend production. Production chỉ seed 6 tầng/81 approved brochure slots, configured owner allowlist và verified Neon logo; không fake customer/financial records. Production Auth OTP/require verification/signup-signin verification đã cấu hình, localhost:3000 thêm trusted origin; chưa chứng minh delivery/onboarding. Local sign-in/workspace/media/commands/intake đã quan sát; test identity emailVerified vẫn là fixture DB, không proof OTP hay Google/recovery. Frontend production chưa deploy/cutover.

## Security và trade-off

Fail closed khi session/principal/scope/audit lỗi; không cache permission xuyên request chỉ bằng TTL. Sensitive mutation phải kiểm tra lại assignment/state dưới khóa transaction. Threats: IDOR, forged scope/role, revoked session reuse, broad admin bypass, leaked fields và stale writes. Trusted session, DB-owned resources, exact policy, scoped projection, transaction guard/RLS và audit giải quyết từng boundary, không tự suy mọi endpoint dùng generic engine là đã đúng.

Crypto generic dùng AES-256-GCM/Web Crypto với tenant/record/field context và key ID; không copy 3DES/Redis từ nguồn cũ. Backend compromise vẫn lộ plaintext khi có runtime keys; KMS chỉ khi custody thực sự cần. Không tự thêm KMS vào Mall chỉ vì thư viện có thể mở rộng.

Core nhỏ dễ thay provider nhưng app phải giữ invariants và identity mapping. Auth provider migration không chỉ copy cookies/emailVerified. Transfer gồm schema/migrations/relational data + object keys/catalog/verified metadata, không opaque snapshots.

## Runtime và kiểm chứng

Next SSR standalone và OpenNext thay static export. Native Worker→Neon S3/Functions còn 403 HTML trước provider dù Node works; không claim all-Worker media ready. Production frontend chưa deploy/cutover; domain/DNS explicitly deferred. CI chỉ shared integrity/types/pure tests và application build, không fake live provider checks khi không có secrets. Không có verification mới trong lần sửa ADR này.

Tham khảo: [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [shared integration](../../packages/backend/docs/integration.md), [portability](../../packages/backend/docs/portability.md), [app adapters ADR](0003-shared-backend-app-adapters.md).
