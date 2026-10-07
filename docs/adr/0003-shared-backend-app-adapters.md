# Architecture Decision — Backend core dùng chung Mall và Solar

Ngày: 2026-10-07. Trạng thái: triển khai cục bộ; chưa provision provider hoặc deploy production.

## Hiểu

Hai dự án cần dùng cùng lib nhưng có schema, session, phân quyền và contract HTTP khác nhau. Repo `lib-ts-be` là nguồn duy trì `@shared/backend`; Mall và Solar dùng Git submodule ở `packages/backend`, mỗi app ghim commit đã kiểm thử. Authenticated admin chưa được tạo chỉ bằng dependency.

## Thiết kế

Chọn `@shared/backend@0.2.1`, core không dependency runtime và không cache quyền xuyên request. Core quản lý operation authorization, query selection theo grants, SQL parameterization, validation, transport và crypto; ứng dụng giữ schema, role mapping, workflow, session, audit và deployment.

Mall giữ AdminSnapshot/command interface qua `src/server/workspace-api.ts`. Solar dùng `src/server/catalog.ts` cho DB hiện tại: partial update, gallery cover, publish/hide riêng và tombstone. Solar fixedScope chỉ hợp lệ cho DB riêng một tenant; Mall/shared DB phải mapping tenant/property/organization thật. Keyring/credential tách riêng hai ứng dụng.

## Validate security

Threat model gồm scope giả, đọc chéo tenant/property/record, leak tổng số bản ghi, stale policy/write, rollback làm mất audit, draft media và secret dùng chéo app. Query allow/deny được áp dụng trước COUNT/paging, mỗi row còn guard riêng; session/principal được kiểm tra đầu/cuối operation, expiry được kiểm tra sau audit. Transaction adapter phải khóa assignment/policy revision đến commit; deny audit bền vững độc lập, outcome audit nằm trong transaction.

## Trade-off

Adapter có thêm cấu hình nhưng bảo toàn nghiệp vụ từng app. Fixed tenant tránh đổi schema Solar đang dùng DB riêng, đổi lại không bảo vệ shared multi-tenant tables. Git submodule ghim commit có checksum chống drift; nâng từng app độc lập, imports không đổi. Không dùng generic CRUD thay workflow leasing/publishing/upload.

## Migration path

Build core trước consumer, cập nhật dependency/lockfile đồng bộ. Kiểm tra `npm run check:backend`, chuẩn bị tarball qua lib `npm run prepare:artifact`. Factory không có session giả mặc định; nối provider + policy loader được khóa + durable audit trước khi bind route. Mall Pages giữ static; backend triển khai riêng trên Node serverless. Solar có demo/server target riêng. Trước bật writes cần test auth provider, RLS/runtime role và app workflow trong environment đã provision.

Chi tiết interface, threat model, migration và bằng chứng: [shared application decision](../../packages/backend/docs/shared-applications.md).

Quy trình clone/cập nhật/publish submodule: [backend submodules](../../packages/backend/docs/submodules.md).
