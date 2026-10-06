# Hợp đồng tích hợp BE

## CRUD

`createCrud<Row, Create, Update, DTO>` nhận transaction, parser create/update và projection DTO. `Row` có id, version, tenantId; scope bổ sung property/organization/owner theo domain. Public methods nhận Web Request để session được verify mỗi lần:

- list(request, {page, pageSize}) → {items, page, pageSize, totalItems, totalPages}; pageSize tối đa 100. Repository nhận offset/limit.
- get(request, id) → DTO.
- create(request, unknownBody) → DTO.
- update(request, id, expectedVersion, unknownBody) → DTO.
- delete(request, id, expectedVersion) → void.

Không đưa SQL/tên table/filter tự do từ browser. DB adapter nhận scope cho mọi query, find/update/delete lọc cả scope và id. Update/delete so version ở DB và trong guard transaction. FK/domain invariant (ghép slot, hợp đồng đang ký, allocation overlap) vẫn nằm trong app/DB, không generic CRUD. Các entity cố định như 6 tầng không expose create/delete route dù core có method.

## HTTPS API

Client cấu hình origin HTTPS ở server. request có method, path, JSON body, parser response; credentials nằm ở server header factory. Không follow redirect, không retry tự động; caller cung cấp idempotency key theo protocol vendor khi cần. Đây là outbound HTTPS, không tạo TLS certificate/inbound server trong lib: Vercel terminate TLS cho domain.

## Webhook

Protocol nội bộ dự kiến headers `x-webhook-timestamp` (epoch seconds), `x-webhook-id`, `x-webhook-signature` (`v1=` + 64 lowercase hex ký HMAC SHA-256). Signed bytes là UTF-8 `v1.namespace.timestamp.deliveryId.` nối với raw body. Secret ngẫu nhiên ít nhất 32 byte; endpoint không dùng chung secret với encryption/provider khác.

Verifier phải đọc body trước JSON parse, xác minh timestamp hai phía, chữ ký constant-time qua native crypto, rồi claim raw event trong inbox bền vững. Claim trả false khi duplicate; không xử lý nghiệp vụ lần hai. Nếu persist lỗi trả failure, không ACK; worker xử lý inbox retry sau đó. Signature không đồng nghĩa authorization cho tenant: app map cấu hình endpoint/provider sang scope trusted, không tin tenant trong payload.

Protocol này không mặc định tương thích Stripe/GitHub/Shopify. Khi có provider cụ thể dùng SDK/signature spec vendor; core inbox có thể được dùng lại qua adapter.

Triển khai hiện hành và DDL mẫu: [Integration](./integration.md).
