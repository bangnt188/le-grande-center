# Mini backend extensions — Architecture Decision

## Hiểu

Bổ sung CRUD, HTTPS API bên thứ ba, webhook và kiểm chứng crypto; dùng được trên Vercel Node 22. Không triển khai DB/provider hay thay static landing trong bước này.

## Thiết kế

- CRUD: `createCrud` cung cấp list/get/create/update/delete. Transaction adapter cung cấp repository, trusted scope và access guard đọc quyền trong cùng transaction. Parser input và DTO projection bắt buộc thuộc app. Version bắt buộc khi sửa/xóa; adapter thực hiện compare-and-swap, không last-write-wins. Không tự sinh SQL hoặc lấy scope từ body.
- HTTPS: `createHttpsClient` cấu hình đúng một origin HTTPS đáng tin; path tương đối, không follow redirect, timeout bao gồm đọc body, giới hạn payload, xác thực response qua parser. Không retry mutation ngầm. Secret headers do app cấp, không gửi qua origin khác.
- Webhook: `createWebhookVerifier` xác minh raw bytes với HMAC SHA-256 cho protocol nội bộ được ghi rõ, timestamp và delivery ID nằm trong signed message. Claim delivery ID atomically qua durable adapter sau khi signature hợp lệ. Adapter xử lý claim + durable inbox trong cùng transaction; app chỉ ACK khi inbox đã bền vững. Nhà cung cấp như Stripe/GitHub phải dùng SDK/protocol riêng, không coi helper này tương thích mặc định.
- Crypto: kiểm chứng AES-GCM với vector độc lập, plaintext tiếng Việt, tamper/context/key mismatch và rotation. Không đưa key vào client.

## Validate security

CRUD transaction/revision tránh lost update; quyền, resource và DTO nằm phía server. Transaction adapter phải có isolation/locking hoặc policy-version check cho revocation, rollback khi guard/projection thất bại; RLS vẫn cần cấu hình thực tế.

HTTPS origin được chọn ở cấu hình BE, tuyệt đối không lấy từ URL khách gửi. Allowlist + không redirect giảm SSRF; hostname allowlist không tự chống DNS rebinding: dùng dịch vụ có DNS đáng tin/egress policy. Giới hạn timeout/body và không trả provider error body/secrets.

Webhook HMAC bảo đảm integrity/authenticity, không bảo mật nội dung; HTTPS bảo vệ transport, field cipher bảo vệ dữ liệu lưu trữ. Durable inbox claim chống duplicate concurrent; replay storage phải phân biệt provider/endpoint/secret domain, giữ ít nhất hết cửa sổ timestamp và provider retry. Không ACK trước durable persist.

## Trade-off / migration

Core không có DB driver/provider dependency. App phải triển khai adapter đúng hợp đồng, không dùng in-memory fixture ở production. Tích hợp từng route trong Next runtime trên Vercel, dùng server-only module; giữ endpoint private no-store và bảo vệ CSRF/rate/body limits. Chọn SDK vendor khi chốt nhà cung cấp.

## TDD interfaces

Đã xác nhận qua yêu cầu tiếp tục xây bộ lib: CRUD public methods, HTTPS request, webhook verification, field encrypt/decrypt; validation/response/SQL/handlers được kiểm tra tại các interface phục vụ luồng đó. Chạy theo từng lát cắt red → green, không mock nội bộ; DB/provider transport/time là dependency ngoài. Fixture transaction chỉ dùng trong test, không là DB adapter production.

Nguồn: [OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [Node Crypto](https://nodejs.org/api/crypto.html), [Stripe signatures](https://docs.stripe.com/webhooks/signatures).
