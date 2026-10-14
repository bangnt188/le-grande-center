# Neon, PostgreSQL portability và SQLite

## Runtime hiện tại

Mall dùng Neon PostgreSQL thật qua `@neondatabase/serverless` Pool. `src/server/database.ts` tạo pool theo request, pin client trong transaction, `SET LOCAL ROLE leasing_runtime` và actor context; không giữ socket xuyên Worker requests. Workspace ghi quan hệ với property lock, revision CAS, idempotency receipts, audit và RLS. `AdminSnapshot` là DTO đọc, không phải persistence format.

`database/schema.sql` là baseline; `database/migrations/001`–`004` là incremental evolution có hash tracking. Đã áp dụng trên stage2, regression disposable và backend production. Production seed gồm 6 tầng/81 căn brochure được duyệt, configured owner allowlist và verified Neon logo, không giả customer/contract/financials. Frontend production chưa deploy/cutover. Migration operator-only qua `npm run db:migrate`, direct URL, không pooler và không bước build. Xem [database guide](../database/README.md).

## Đổi provider

- **Neon ↔ Supabase:** cùng PostgreSQL protocol/SQL nhưng không chỉ đổi URL. Giữ application schema/invariants; kiểm tra extensions, version, roles/privileges/RLS, direct vs pooler, TLS và transaction driver. Neon Auth và Object Storage không tự port sang Supabase Auth/Storage.
- **REST/SDK khác nhau:** Supabase Data API/PostgREST và Neon HTTP/Data API không thay trực tiếp transaction tương tác pinned trên một connection. Shared `@shared/backend/pg-connection` có transaction contract; app Neon Pool vẫn phải giữ các bước cùng client.
- **SQLite:** cần schema/adapter/dialect riêng. Baseline dùng ranges/GiST/EXCLUDE, deferred constraints, PL/pgSQL và RLS; SQLite không cung cấp nguyên trạng. Không bỏ invariant chống trùng cam kết hoặc quyền để port nhanh.
- File SQLite local hoặc `/tmp` của serverless/Worker không phải shared durable database. Hosted SQLite vẫn cần kiểm chứng transaction/concurrency và thiết kế tương đương.

## Chuyển tài khoản/dữ liệu

1. Chuyển baseline + migrations + lịch sử áp dụng và dữ liệu quan hệ có stable IDs/FKs, actor/audit, CAS/receipts. Kiểm tra restore/row counts/invariants trước mở writes.
2. Chuyển identity issuer/subject/verified staff mapping theo auth provider thực; không copy session cookies/test fixture emailVerified làm chứng nhận onboarding production.
3. Copy object bytes R2/Neon theo stable object keys/catalog. Verify bytes/size/hash; chuyển metadata provider/bucket/key/visibility/review/retention có audit. Không lưu/copy presigned URLs như locator.
4. Cấu hình runtime secrets và public URLs mới; kiểm tra authorized/private/public projection. **Không import/export opaque browser snapshots** và không tạo demo data khi DB lỗi.

Provider credentials và API quản trị không phải browser SQL credential. Tách runtime/migration URL/role theo môi trường; không đưa DB URL vào `NEXT_PUBLIC_*` hoặc bundle. Migrations/restore là operator action, không CI build/deploy tự động.

## Giới hạn đã biết

Native Cloudflare Worker → Neon S3/Functions hiện 403 HTML trước provider, Node requests được; đây không phải lỗi SQL portability đã được giải quyết. Local real-cloud runtime không chứng minh all-Worker media ready. Frontend production chưa deploy/cutover, domain/DNS do người dùng hoãn. [Readiness](backend-readiness.md) ghi bằng chứng và giới hạn riêng; không có live cloud verification mới trong lần chỉnh docs này.

## Nguồn chính thức

- [Neon connection](https://neon.com/docs/connect/connect-from-any-app), [serverless driver](https://neon.com/docs/serverless/serverless-driver), [pooling](https://neon.com/docs/connect/connection-pooling).
- [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Data API](https://supabase.com/docs/guides/api), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [node-postgres transactions](https://node-postgres.com/features/transactions).
- [SQLite types](https://sqlite.org/datatype3.html), [transactions](https://sqlite.org/lang_transaction.html), [triggers](https://sqlite.org/lang_createtrigger.html), [omitted features](https://sqlite.org/omitted.html).
