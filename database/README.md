# Thiết kế database

Schema chưa được áp dụng production; đã smoke test trên PostgreSQL 18.6 disposable.

## Baseline

`database/schema.sql` là baseline PostgreSQL duy nhất: B2B cùng sáu trường audit và trigger.

Không phải migration production đã chạy. Chạy toàn bộ file trên database mới; không áp vào DB có dữ liệu. Runtime phải đặt `app.actor_id` transaction-local. DB cloud chưa kết nối.
## DB constraints trong v2

- Composite FK ngăn trộn property/floor hoặc contact/brand khác doanh nghiệp.
- Tầng giới hạn 1–6; UI không thêm/xóa, provisioning cần đủ sáu tầng đã xác nhận.
- Deferred assertions đối chiếu đủ member slots/period khi commit hold/lease;
  active hold cần request đã duyệt/ack, executed lease cần file ký clean/sealed.
- Candidate spaces được phép chồng slot. Allocation chưa release không giao nhau
  trên cùng slot gốc theo `daterange`; resource booking không trùng `tstzrange`.
- UUID, numeric cho diện tích/tiền, timezone-aware timestamp và [start,end) ranges.
- Published plan/slot/space, signed lease version, sealed file metadata được đóng
  băng; child membership/measurement/frontage/document link cũng được bảo vệ.
- RLS enabled và PUBLIC grants bị thu hồi; runtime policy/role chưa provision.

Cần review `btree_gist` trên managed provider. `gen_random_uuid()` giả định bản
PostgreSQL hiện đại có built-in này. Không áp nguyên file vào DB đang có dữ liệu;
`CREATE SCHEMA leasing` cố ý không idempotent để không che schema tồn tại khác.

## Các gate trước production

1. Geometry/topology validator; command publish có đủ slot, số liệu, bản vẽ và
   approval, freeze sau khi thêm toàn bộ child records.
2. Runtime validation các deferred assertions trong draft và transaction approve/
   expire/cancel/convert; không suy ra workflow hoàn chỉnh từ overlap constraint.
3. Workflow transition guard, acknowledgement, policy TTL/quota và idempotency.
4. Signed lease phải có clean/sealed PDF đúng doanh nghiệp, đầy đủ party/term
   snapshot và verification chữ ký; DB không tự chứng nhận chữ ký hợp lệ.
5. Appointment/resource period đồng bộ; ownership documents đúng lease/plan.
6. RLS/grants bằng role không owner, không BYPASSRLS; transaction actor context,
   append-only audit/receipt/extension quyền đúng và không log PII tùy tiện.
7. Upload pipeline, quota, cleanup orphan có retention/legal hold, khôi phục.
8. Chạy validation trên disposable DB với provider mục tiêu sau khi được yêu cầu;
   chỉ review SQL trong repo không phải bằng chứng DB chạy thành công.

Các gate này được ghi rõ để baseline không bị hiểu nhầm là backend production
đã hoàn tất. Không có credentials, provisioning hoặc lệnh apply tự động.

[Thiết kế B2B](../docs/b2b-leasing-design.md) ·
[Tài liệu private R2](../docs/private-documents-r2.md) ·
[Portability Neon / Supabase / SQLite](../docs/database-portability.md)
