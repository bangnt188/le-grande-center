# Kết nối mini lib với ứng dụng

## 1. Transaction và query

`PgQuery(text, values)` là interface tương thích một wrapper của driver PostgreSQL: dữ liệu đều qua params, không nối chuỗi giá trị người dùng vào SQL. CRUD phải bind query vào **cùng transaction**. Driver decode JSONB thành object và BYTEA thành bytes; wrapper không log params có plaintext/secret. Không tắt xác minh TLS khi kết nối DB.

```ts
const repository = createPostgresRepository({
  schema: 'leasing', table: 'your_table',
  columns: { name: 'name' },
  scopeColumns: { tenantId: 'owner_organization_id', propertyId: 'property_id' },
  query: (text, values) => tx.query(text, [...values]),
  decode: parseDatabaseRow,
});
```

Table/cột lấy từ code phía server. Parser chỉ nhận field cho phép. `decode` map SQL thành `{id,version,tenantId,propertyId,...}` và domain fields. Record phải có ID do server/DB tạo và default version 1. Adapter SQL increment version khi UPDATE; DELETE là hard delete, FK/retention/legal hold phải được domain adapter/DB chặn nếu cần. Không gọi CRUD thẳng từ browser.

Transaction runner chỉ resolve khi COMMIT thành công, rollback mọi error từ callback, giới hạn timeout và không retry callback tùy tiện vì callback có audit/I/O. Resolve active scope từ session đã verify và assignments hiện hành. Guard loadPrincipal phải dùng cùng policy snapshot/locking hoặc validate policy revision khi ghi. RLS và DB runtime role không tự được thiết lập bởi lib. Ghi command outcome audit trong transaction; policy decision audit nên độc lập để không mất deny khi rollback.

## 2. Ví dụ customer encrypted fields

[examples/customers.ts](../examples/customers.ts) có factory nhận verifySession, runInTransaction, resolveScope, loadPrincipal, recordDecision và field cipher. Nó tạo SQL repository, CRUD và handlers, mã hóa tax ID trước SQL, trả tax ID chỉ khi có `customers:view-tax-id`. Ví dụ có test tích hợp bằng DB fixture, không phải provider/DB thật.

DDL **tham khảo, chưa apply** cho ví dụ riêng:

```sql
CREATE SCHEMA example_app;
CREATE TABLE example_app.customers (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  property_id text NOT NULL,
  name text NOT NULL,
  tax_id_cipher jsonb,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK (version <= 9007199254740991)
);
CREATE INDEX ON example_app.customers (tenant_id, property_id, id);
ALTER TABLE example_app.customers ENABLE ROW LEVEL SECURITY;
```

Ứng dụng phải thêm FK thật, RLS policies và runtime grants theo DB Mall đã chốt. Không sử dụng owner/superuser để bypass RLS, không đưa DDL mẫu này lên production như baseline Mall. Factory dùng schema cố định `example_app`; chuyển mapping sang bảng của app khi tích hợp. Client PATCH gửi If-Match từ response ETag; không gửi version trong body.

Trong Next.js: module tích hợp `import 'server-only'`, route dùng `runtime='nodejs'`, bind GET/POST cho collection và GET/PATCH/DELETE cho `[id]`. `params` là Promise. Handler Origin dành cho API browser dùng cookie/session và từ chối write thiếu Origin; API bearer/server riêng cần route bảo vệ theo protocol đó. Không coi Origin là authentication.

## 3. HTTPS API bên thứ ba

Client chỉ gọi origin cố định HTTPS trên port 443. Production dùng DNS/egress đáng tin và TLS mặc định có xác minh certificate. Không dùng origin từ DB field do khách chỉnh hoặc URL request body. Headers factory chứa credentials riêng theo environment, chỉ gửi đến origin đó. Không tắt certificate verification ở transport adapter.

Response parser bắt buộc; dữ liệu nhận có thể dùng objectInput/textInput hoặc schema library. Status 204 được parse thành null. API trả non-2xx/malformed JSON/schema sai/response quá lớn → UPSTREAM_ERROR (502); timeout → TIMEOUT (504). Không trả provider body hoặc token vào response/log. Nếu cần Retry-After, idempotency hay streaming, viết vendor adapter theo spec; core JSON client không giả định semantics đó.

## 4. Webhook

Protocol nội bộ có ba header:

- `x-webhook-timestamp`: epoch seconds.
- `x-webhook-id`: ASCII chữ/số/underscore/hyphen, tối đa 128 ký tự.
- `x-webhook-signature`: `v1=` + 64 lowercase hex ký HMAC SHA-256.

Signed bytes là UTF-8 **`v1.namespace.timestamp.deliveryId.`** nối với raw body. Namespace thuộc cấu hình endpoint, không lấy từ payload. Secret/key HMAC riêng cho webhook, ngẫu nhiên >=32 byte, non-extractable HMAC SHA-256 CryptoKey có usage verify; tối đa ba key current/previous. Không dùng encryption key làm signing key.

Đọc và verify **trước** JSON parse. Tolerance mặc định ±300s, body limit 1 MiB, upload timeout 10s. Timestamp được kiểm tra lại sau key lookup. HMAC bảo vệ integrity/authenticity, HTTPS bảo vệ transport; không tự mã hóa webhook payload. Với dữ liệu nhạy cảm trong inbox cần phân quyền, retention, encrypted storage phù hợp và không log body. Envelope field cipher giới hạn 64 KiB nên không dùng nó cho body tùy ý lớn/binary.

```ts
const inbox = createPostgresWebhookInbox({ schema: 'example_app', table: 'webhook_inbox', query: committedQuery });
const verifier = createWebhookVerifier({ namespace: 'vendor:customers', getKeys, storeEvent: inbox.storeEvent });
// Route POST: await verifier.verify(request); rồi trả 202 accepted/200 duplicate.
```

`committedQuery` phải là autocommit hoặc wrapper resolve sau commit. Không bind nó vào transaction ngoài còn chưa commit rồi ACK. Query lỗi → UNAVAILABLE để provider retry. Thêm unique constraint bắt buộc như dưới đây:

```sql
CREATE TABLE example_app.webhook_inbox (
  namespace text NOT NULL,
  delivery_id text NOT NULL,
  signed_at bigint NOT NULL,
  raw_body bytea NOT NULL,
  retain_until bigint NOT NULL,
  processed_at timestamptz,
  PRIMARY KEY (namespace, delivery_id)
);
ALTER TABLE example_app.webhook_inbox ENABLE ROW LEVEL SECURITY;
```

Schema chỉ là mẫu. Add runtime grants/RLS/worker claims và outcome audit thật. Retention dedup mặc định 24h, cấu hình theo retry lifetime vendor; không dọn event chưa xử lý. Inbox worker cần retry/checkpoint; mutation downstream cần idempotency/outbox. Delivery ID chống xử lý duplicate intake, không tự bảo đảm exactly-once nghiệp vụ. Map endpoint/provider sang tenant đáng tin; tenant trong payload không phải authority.

Stripe/GitHub/Shopify có protocol khác: dùng SDK hoặc verifier chính thức của họ, rồi adapter durable inbox. Không gửi format nội bộ này rồi gọi là tương thích mọi nhà cung cấp.
