# Neon, Supabase và SQLite

## Kết luận

- **Neon ↔ Supabase:** cùng PostgreSQL wire protocol và SQL. Backend có thể dùng cùng `pg` Pool/Client, query/repository và application schema; đổi connection string, TLS/pool mode, roles và auth integration theo provider.
- **REST/SDK không giống nhau:** Supabase `supabase-js` dùng Data API/PostgREST; Neon có HTTP driver và Data API riêng. Chúng không thay trực tiếp `PgQuery` hay transaction nhiều bước pinned trên một connection. Dùng `pg` client cho transaction tương tác.
- **SQLite:** có thể chuyển, nhưng phải viết adapter và schema/dialect khác. Baseline hiện tại cần ranges/GiST/EXCLUDE, deferred constraint triggers, PL/pgSQL và RLS; SQLite không cung cấp các cơ chế tương đương nguyên trạng. Không được bỏ các invariant nghiệp vụ khi port.
- **Vercel:** SQLite file trong function hoặc `/tmp` không phải DB shared/durable giữa instances. SQLite hosted vẫn cần port SQL/transactions theo provider.

## Schema và audit hiện tại

`database/schema.sql` là baseline PostgreSQL duy nhất, chưa áp dụng. Baseline có 40 bảng B2B và đủ sáu audit fields. `@shared/backend/pg-connection` export `createPostgresDatabase({pool})`, pin một client mỗi transaction và truyền query gắn với transaction cho repository.

Cấu hình PostgreSQL runtime và migration nên tách URL/role. Neon pooled URL và Supabase transaction pooler dùng transaction pooling; luôn giữ các bước trong transaction trên cùng client, không phụ thuộc session state. Migrations cần connection mode phù hợp DDL/session tooling. Không dùng credential management API làm SQL credential hoặc expose database URL trong browser.

**Không có database cloud nào được kết nối hoặc migrate.** PostgreSQL 18.6 disposable local đã chạy `database/schema.sql`; 40 bảng có sáu audit fields và bật RLS. Smoke kiểm tra insert/update/soft-delete/restore ghi đúng actor. SQLite cần schema/adapter riêng; chưa kiểm chứng cloud roles/policies/workflows.

## Tài liệu chính thức

- [Neon connection](https://neon.com/docs/connect/connect-from-any-app), [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver), [Neon pooling](https://neon.com/docs/connect/connection-pooling).
- [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase Data API](https://supabase.com/docs/guides/api), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [node-postgres transactions](https://node-postgres.com/features/transactions).
- [SQLite types](https://sqlite.org/datatype3.html), [transactions](https://sqlite.org/lang_transaction.html), [triggers](https://sqlite.org/lang_createtrigger.html), [omitted features](https://sqlite.org/omitted.html).
- [Vercel SQLite local-file note](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel).
