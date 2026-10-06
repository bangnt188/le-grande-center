# @mall/backend

Bộ lib BE cơ bản bằng TypeScript cho Vercel Node.js 22+. Không có dependency runtime; sử dụng Web Request/Response và Web Crypto. Cần adapter session và kết nối PostgreSQL thật của ứng dụng.

| Module | Chức năng có code |
|---|---|
| `access` / `policy` | Session binding, quyền `resource:action`, scope tenant/property/organization/owner, explicit deny, expiry, audit, capabilities cho UI |
| `crud` | list/get/create/update/delete, phân trang, parser và DTO projection bắt buộc, version khi sửa/xóa, guard trong transaction |
| `postgres` | SQL CRUD tham số hóa, allowlist cột, filter scope, compare-and-swap version; webhook inbox atomic |
| `handlers` | GET/POST/PATCH/DELETE dùng Web API, params Promise của Next.js, Origin cho browser writes, ETag/If-Match |
| `validation` | Đọc JSON có timeout/body limit; object allowlist, string và integer validator; nhận parser từ Zod/Valibot nếu cần |
| `response` / `errors` | Response JSON thống nhất, status/code an toàn, private no-store |
| `http` | HTTPS client cố định origin, không redirect/retry ngầm, timeout, giới hạn request/response, parser response |
| `webhook` | Xác minh HMAC raw bytes, namespace/timestamp/delivery ID, rotation keys, lưu inbox trước ACK và chống duplicate |
| `crypto` | Field encryption AES-256-GCM, key ID để rotation, ràng buộc tenant/record/field, lỗi không lộ secret |

Import từ `@mall/backend` hoặc từng subpath như `@mall/backend/crud`. Trong Next app đặt module tích hợp trong `src/server/` với `import 'server-only'`; không đưa khóa/principal vào Client Component. `examples/` là application composition tham khảo, không thuộc public package exports.

## CRUD và Next.js

```ts
import 'server-only';
import { createCrudHandlers } from '@mall/backend/handlers';
import { customerService } from '@/server/customer-service';

const routes = createCrudHandlers(customerService, { origin: process.env.APP_ORIGIN! });
export const runtime = 'nodejs';
export const GET = routes.collection.GET;
export const POST = routes.collection.POST;
// Ở app/api/customers/[id]/route.ts: routes.item.GET/PATCH/DELETE.
```

`createCrud` nhận transaction, parseCreate/parseUpdate và project. Transaction cung cấp scope đáng tin, access guard và repository. `createPostgresRepository` cung cấp repository SQL sẵn; app bind `query` vào transaction DB, mapping cột và decoder. Session/provider phải verify ở mỗi operation; `loadPrincipal` đọc quyền hiện hành trong transaction/revision tương ứng.

List trả `{items,page,pageSize,totalItems,totalPages}`, mặc định 20, tối đa 100. Update/delete nhận `expectedVersion`; HTTP handler dùng `If-Match: "1"`, response trả ETag phiên bản mới. Body không được tự gán ID/version/role/grants/scope. Update không được chuyển scope; adapter lỗi hoặc projection thất bại phải rollback. Assign role/move tenant là command riêng có quyền và audit riêng.

Chỉ export verbs phù hợp entity. Sáu tầng cố định không expose POST/DELETE. Hợp đồng, giữ chỗ và ghép slot vẫn cần domain invariant/FK/transaction riêng; generic CRUD không quyết định workflow pháp lý.

Ví dụ nối đủ session + SQL + encrypted tax ID + field visibility: [customers.ts](./examples/customers.ts). [Schema ví dụ và hợp đồng adapter](./docs/integration.md). Đây là schema `example_app`, không phải migration áp dụng lên DB Mall.

## HTTPS và webhook

```ts
const api = createHttpsClient({
  origin: 'https://api.vendor.example',
  headers: () => ({ authorization: `Bearer ${process.env.VENDOR_TOKEN}` }),
});
const result = await api.request('/customers', {
  method: 'POST', body: { name: 'Acme' }, parse: vendorCustomerSchema.parse,
});
```

Origin/credentials thuộc cấu hình BE. Không nhận URL từ khách, không forward browser Cookie/Authorization. Client từ chối HTTP, IP/local hostname, credentials trong URL và path sang origin khác; không follow redirect. Timeout mặc định 10s gồm headers/transport/body; request tối đa 64 KiB, response 1 MiB; có giới hạn cấu hình. Không retry mutation ngầm. Idempotency/retry/outbox theo API vendor; không gọi mutation bên thứ ba giữa transaction CRUD rồi giả định rollback cũng rollback được API đó. Allowlist không tự chống DNS rebinding: cần DNS/egress tin cậy.

`createWebhookVerifier` là protocol HMAC nội bộ, **không mặc định tương thích Stripe/GitHub/Shopify**. Nhà cung cấp cụ thể dùng SDK/spec của họ. [Protocol và inbox](./docs/integration.md#webhook). `storeEvent` chỉ resolve true sau durable commit; unique `(namespace, delivery_id)` chống duplicate đồng thời. Worker xử lý inbox/retry sau đó, không thực hiện toàn bộ nghiệp vụ trong verifier.

## Mã hóa và bảo mật

`createFieldCipher({activeKeyId,getKey})` có encrypt/decrypt text UTF-8 tối đa 64 KiB. AES-256-GCM: IV random 96 bit, tag 128 bit, context tenant/record/field/key-version. Khóa non-extractable, lấy từ server secrets/KMS. Không dùng cho password/file/stream. Context binding chống tráo, không chống replay bản mã cũ. Giữ key cũ đến khi migrate dữ liệu và backup xong; encryption không thay authorization.

`getCapabilities` chỉ là UI hints theo scope; backend vẫn kiểm tra mọi request và project DTO. Không gửi principal/grants lên browser. Thiếu resource facts không được dùng để vượt một deny hẹp. Collection phải dùng đúng scope SQL; deny có thể giao collection sẽ chặn cả collection. Transaction adapter phải bảo vệ row/policy khỏi race bằng isolation/locking/revision; version CAS bảo vệ lost update, không tự bảo đảm revocation consistency. Policy audit không phải command outcome audit; deny audit cần lưu được ngay cả khi domain transaction rollback.

Auth provider, RLS, DB provisioning, rate limiting, domain workflow, inbox worker/outbox, retention và backup là phần triển khai ứng dụng. Thư viện không tạo login/password/JWT riêng hay chạy DB migration tự động. [Vercel và quản lý secrets](./VERCEL.md).

## Kiểm tra

```sh
npm run typecheck:backend
npm run build:backend
npm run test:backend
```

Typecheck gồm src, tests và examples. Tests dùng crypto thật, transaction/DB/HTTPS transport fixture ở các adapter, HMAC tham chiếu từ Node crypto và AES-GCM envelope tạo độc lập. Có test luồng HTTP → access → CRUD → encrypted storage → DTO theo quyền. Chưa kiểm chứng provider/DB/API bên thứ ba/Vercel deployment thật; các kiểm tra đó cần môi trường được kết nối.

[Architecture Decision](../../docs/adr/0002-shared-backend-access-control.md) · [Nguồn học từ Orbit](../../docs/orbit-auth-research.md).
