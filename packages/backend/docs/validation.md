# Validation evidence — 2026-10-06

Target: `@mall/backend` trên Node.js v22.22.2. Phạm vi xác nhận từ yêu cầu tiếp tục xây lib và tự test: CRUD, HTTPS, webhook, crypto; SQL/handlers/validation/response kiểm tra qua các interface phục vụ các luồng đó.

## TDD và regression

Đã chạy từng lát cắt test trước implementation: create/get → list → update/version → delete → mass assignment; HTTPS request → timeout → response limit → request limit; webhook raw HMAC → timestamp → body limit → upload timeout → namespace; SQL insert → find → list → versioned update → delete → durable inbox; HTTP handlers POST/GET → pagination → PATCH → DELETE; luồng kết hợp auth/CRUD/encryption/DTO.

Các lỗi hành vi đã thấy RED rồi sửa GREEN:

- Body tự gán scope/role/grants chưa bị reject.
- HTTPS transport hoặc upload webhook bị treo chưa có deadline.
- Payload/response quá lớn chưa bị giới hạn.
- Webhook timestamp quá hạn và chữ ký dùng sang namespace khác chưa bị chặn.
- Crypto làm mất leading BOM; Unicode lỗi bị đổi thành replacement character.
- DB update đổi organization không bị generic CRUD rollback.
- Resource thiếu organization facts vượt được narrow deny qua broad allow.

Crypto và access có code từ trước; các test của phần đó được ghi nhận là regression/security tests, không coi là TDD từ đầu. HMAC được ký bằng Node `createHmac` độc lập với verifier Web Crypto. AES-GCM fixed envelope tạo bằng Node `createCipheriv`, không sinh expected ciphertext bằng chính encrypt của lib.

## Kết quả cuối

- `npm run typecheck:backend`: PASS, gồm source/tests/examples.
- `npm run build:backend`: PASS, dist + declarations.
- `npm run test:backend`: **65 passed, 0 failed, 0 skipped**.
- Import package workspace và 11 subpath từ dist: PASS.
- `npm ls @mall/backend --depth=0`: link đúng packages/backend.
- `npx tsc --noEmit` tại app root: PASS.
- `git diff --check`: PASS.

65 test gồm access 11, CRUD 11, crypto 7, handlers 5, HTTP 8, integration 1, PostgreSQL 7, response 2, validation 3, webhook 10. Scripts có thể chạy lại từ root hoặc package.

## Giới hạn bằng chứng

DB/transaction/inbox/HTTP transport dùng fixture tại dependency ngoài; crypto và Web Request/Response thật. PostgreSQL tests kiểm tra SQL/params/contract, chưa chạy câu SQL trên PostgreSQL thật. Concurrent-edit/duplicate tests dùng fixture serialization/atomic inbox, không chứng minh isolation/constraints của DB production.

Không có provider login, HTTPS call đến vendor thật, Vercel build/deployment, RLS integration hay migration đã apply. App còn static export; Next backend runtime cần deployment riêng hoặc chuyển cấu hình đúng guide. Không commit/push trong bước này; giữ các thay đổi UI đang tồn tại.
