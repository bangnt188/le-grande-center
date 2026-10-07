# Backend readiness trước khi khách hàng tạo tài khoản

## Kết luận

Core library và hai module R2/Cloudinary đã có implementation generic để cấu hình khi được cấp credentials. **Admin production chưa ready end-to-end; không chỉ thiếu email.** Không thay GitHub Pages demo bằng backend giả, không đưa dữ liệu/secret thật vào fixture.

## Phần đã có code và kiểm tra local

- `@shared/backend`: access/policy, CRUD, SQL adapter, HTTP endpoints/client, validation, safe errors, webhook inbox, field encryption.
- `packages/backend/src/r2.ts`: SigV4 PUT/GET, metadata HEAD, delete; private transfer policy và signed headers. Không cần SDK dependency runtime.
- `packages/backend/src/cloudinary.ts`: signed Blob upload image/video/raw, authenticated mặc định, không ghi đè, destroy theo stable locator, authenticated download API có thời hạn.
- `packages/backend/scripts/storage-smoke.mjs`: lệnh upload/read/delete để kiểm tra ngay khi có credentials; không in secrets và không xóa object không thuộc smoke.
- Provider implementation generic, inject config/fetch/clock; không env global, KYC, booking, phòng homestay, tenant/quota Mall/Solar hardcode. Reuse protocol từ `homeStay/v0-homestay-booking-app/lib/services/server/images.ts`; không copy service nghiệp vụ hay secret fallback. Không tìm thấy R2 implementation trong repo homestay được chỉ định.

[Interface và cấu hình storage](../packages/backend/docs/storage.md).

## Code production còn thiếu, không giải quyết chỉ bằng đăng ký email

| Nhóm | Hiện trạng / việc bắt buộc trước production |
| --- | --- |
| Session và quyền | `src/server/workspace-api.ts` nhận adapter verified session/transaction nhưng chưa có binding provider thật. Cần verified issuer/subject, membership/grants hiện hành, revoke/disabled, audit, Origin/cookie policy; UI role switch không cấp quyền. |
| DB và command nghiệp vụ | Schema ở `database/` là design chưa apply; app chưa có parser đủ command, transaction-bound repository, revision CAS/idempotency receipts và transition/invariants B2B. Core CRUD không thay nghiệp vụ hợp đồng/ghép mặt bằng. |
| Upload/quota | Chưa có `/media` production, Worker bounded ingress, quarantine/scan/finalize, ledger/reservation atomic 8.5 GB và cleanup/reconcile. R2 signed PUT không enforce hard cap. Không đưa hợp đồng signed qua pipeline biến đổi Cloudinary. |
| Private documents | Worker view phải resolve document version/DB-owned key, kiểm tra quyền GET/HEAD/Range, clean/sealed/retention, stream private và audit. Module ký GET không thay authorization mỗi request. |
| Runtime/deployment | `next.config.ts` vẫn `output: 'export'`; giữ public Pages, deploy admin/API runtime riêng hoặc chuyển có chủ đích. `http-repository.ts` hiện POST multipart `/media`, còn Vercel Function payload max 4.5 MB: tệp 10 MiB phải qua ingress phù hợp, không chỉ nối provider vào route này. |

Không tự chọn auth/DB provider hoặc đổi HTTP contract v1 sang direct upload khi application chưa có các adapter trên. Transport UI hiện được giữ nguyên; không có caller production để thay thế bằng adapter storage lúc này.

## Phần cần tài khoản/quyền của khách hàng

1. Owner email để tạo/nhận quyền tài khoản Vercel, Cloudflare và Cloudinary; bật MFA và cấp quyền thành viên qua invitation, không gửi mật khẩu/OTP.
2. R2 private bucket + token scoped đúng bucket: `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. Không bật public access cho private files; browser CORS theo origin được duyệt nếu thực sự dùng direct transfer.
3. Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`; xác nhận policy authenticated delivery, loại file và account restrictions. Preview/Production tách credentials.
4. Verified auth/DB bindings và production origin/domain được cấp quyền; deploy secrets qua dashboard/secret manager, không commit `.env`, không đưa DB/token vào `NEXT_PUBLIC_*`.
5. Chạy live smoke bên dưới, rồi integration quyền/quota/Worker và restore với môi trường thực. Đăng ký email không tự tạo các credentials hoặc hoàn thiện các adapter nghiệp vụ.

```sh
npm run smoke:storage --workspace=@shared/backend -- r2
npm run smoke:storage --workspace=@shared/backend -- cloudinary
```

Hai lệnh tạo/xóa một asset nhỏ unique ở `storage-smoke/`; cần read/write/delete. Nếu cleanup lỗi, command exit 1; kiểm tra dashboard để xóa đúng asset smoke còn sót.

## Bằng chứng kiểm tra trong lần chuẩn bị này

- Build backend, typecheck backend/application và source integrity (`npm run build:backend`, `npm run typecheck:backend`, `npm exec -- tsc --noEmit`, `npm run check:backend`): pass. Integrity receipt được cập nhật cho source mới.
- `npm run test:backend`: 101 tests pass; `npm run test:backend:consumer`: 2 tests pass. Không fail/skip.
- Native module HTTP smoke: R2 upload → HEAD → download đúng bytes → delete → NOT_FOUND; Cloudinary authenticated upload → download đúng bytes → destroy. HTTP server local kiểm tra chữ ký độc lập bằng Node crypto. Throwaway protocol smoke đã xóa; chỉ giữ command live smoke.
- Smoke command từ chối cấu hình thiếu bằng tên biến cần cấp, không gọi provider hoặc in giá trị secret.
- Live R2/Cloudinary, CORS browser, production session/DB/Worker/quota/deploy: chưa kiểm tra, chưa được cấp credentials. GitNexus không có MCP resource và project không cấu hình LSP; evidence dùng source trực tiếp và runtime checks, không graph analysis.

Library là Git submodule canonical `lib-ts-be`; thay đổi hiện nằm trong working tree, chưa commit/push hoặc upgrade Solar. Publish library và update gitlink từng consumer là việc riêng, không tự nâng app khác.

## Tài liệu liên quan

- [Quota và bounded ingress](storage-quota.md).
- [Private Worker view và retention](private-documents-r2.md).
- [Contract admin và migration](admin-data-contract.md).
- [Database production gates](../database/README.md).
- [Vercel payload limits](https://vercel.com/docs/functions/limitations).
