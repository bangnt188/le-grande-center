# Cấu trúc chuẩn bị backend và multi-provider storage

Ngày: 12/10/2026. Phạm vi đã thực hiện: sắp xếp code đang có, tách DTO khỏi fixture, cập nhật import. **Không thêm endpoint, driver, credential, bucket, kết nối Neon/R2 hoặc migration.** Hành vi giao diện và deploy giữ nguyên.

## 1. Cấu trúc hiện có sau sắp xếp

```text
src/
├── app/                             # Next routes và composition giao diện
├── features/
│   ├── public/                      # Website công khai; giữ nguyên
│   ├── contact/                     # Form; giữ nguyên chế độ hiện tại
│   └── admin/
│       ├── demo/
│       │   ├── data.ts              # Snapshot, slot và media fixtures
│       │   ├── b2b-data.ts          # Fixture và nhãn hiển thị; không còn clock cố định
│       │   ├── b2b-commands.ts      # Nghiệp vụ browser dùng thử, không phải BE auth/DB
│       │   ├── validation.ts        # Kiểm tra fields/ngày/ID của bản dùng thử
│       │   ├── indexed-db.ts        # Snapshot/Blob transaction và revision CAS
│       │   └── repository.ts        # Mutation, byte accounting và URL tạm
│       ├── http-repository.ts       # Transport browser → API
│       ├── use-admin-data.ts        # Hook chọn repository, giữ state UI
│       ├── admin-editor.tsx        # Form lưu/hủy, dirty guard và tải lại không mất draft
│       ├── admin-records.tsx       # Khách tiềm năng, media, settings
│       ├── tenant-records.ts       # Projection khách thuê từ hồ sơ/slot
│       └── …                       # Component/hook quản trị hiện có
├── shared/
│   └── admin/
│       ├── contracts.ts            # Snapshot, command và repository interface
│       ├── b2b-model.ts            # Chỉ DTO/types B2B, không chứa fixtures
│       ├── space-model.ts          # Kiểu tầng/slot/group và hàm thuần hiện có
│       └── storage-policy.ts       # Kiểu usage và kiểm tra quota UX hiện có
└── server/
    └── workspace-api.ts            # Composition API hiện có, có server-only

database/
├── schema.sql                      # Baseline PostgreSQL chưa apply cloud
└── README.md                       # Production gates
packages/
├── backend/                        # Submodule @shared/backend: primitives dùng chung
└── ui/                             # Submodule @mall/ui; giữ nguyên
```

Không chuyển cả repo thành `apps/web` + `apps/api`: hiện chỉ có một ứng dụng Next và một composition API; đổi root lúc này kéo theo build/submodule/deploy mà chưa giải quyết kết nối nào. Đã bỏ re-export tương thích `src/app/admin-preview/space-model.ts`; mọi caller dùng đường dẫn mới trực tiếp.

## 2. Quy tắc phụ thuộc

- `shared/admin` không import `features`, `server`, React, DB driver hoặc secrets. Giữ nguyên interface hiện hành, không đồng nhất DTO demo với toàn bộ schema SQL.
- `features/admin` import shared types/hàm thuần và gọi repository. `AdminRepository` có `File`, `dispose` và preview demo: đây là interface của consumer, không bắt server triển khai interface browser đó.
- `server` import DTO từ `shared`, không lấy contract từ thư mục UI và không import `demo`. `server-only` vẫn bảo vệ composition khỏi client bundle.
- `space-model` và `storage-policy` là hàm thuần hiện có, **không phải** transaction, authorization hay quota enforcement production. Chuyển thư mục không nâng các kiểm tra demo thành nghiệp vụ production.
- `packages/backend` giữ primitives độc lập ứng dụng (access, transaction, HTTP, SQL, R2/Cloudinary). Không copy các provider vào ứng dụng hoặc sửa submodule chỉ để thay layout Mall.
- `database/schema.sql` vẫn là nguồn SQL duy nhất. Không đổi tên thành migration đã chạy, không sinh migration rỗng.

## 3. Vị trí viết BE khi bắt đầu implementation

Các đường dẫn dưới đây là **thiết kế vị trí, chưa tạo thư mục/file rỗng**:

| Vị trí dự kiến | Trách nhiệm |
| --- | --- |
| `src/server/auth/` | Bind verified session; load membership/grants và revoke/disabled từ nguồn thật. |
| `src/server/db/` | Kết nối Neon PostgreSQL, role runtime, transaction và repository SQL. Reuse `@shared/backend/pg-connection` khi driver/runtime phù hợp; không tạo lớp DB thứ hai. |
| `src/server/media/` | Quyền media, chọn đích lưu, pending/finalize, quota reservation, metadata, private delivery và cleanup. |
| `src/server/media/providers/` | Chỉ thêm adapter khi kết nối provider thật. Reuse R2 implementation của thư viện; Neon adapter dùng endpoint/region/path-style thực tế, không giả định chữ ký R2 hiện tại chạy nguyên trạng. |
| `src/server/leasing/` | Command nghiệp vụ có transaction, revision/idempotency và audit; không copy mô phỏng demo làm production. |
| `database/migrations/` | Chỉ tạo khi có migration được review; không chạy baseline lên DB có dữ liệu. |

Transport entrypoint nằm ở runtime được chọn khi triển khai, không thêm `app/api` vào static export rồi coi đó là API online. Runtime phải được kiểm chứng với package backend, transaction và private stream trước khi chốt.

## 4. Giải pháp tận dụng free tier

Đây là **đề xuất**, chưa đổi chính sách lưu trữ của tài khoản. Nguồn và hạn mức đã đối chiếu: [Neon](neon-free-tier-research.md), [Cloudflare](cloudflare-free-tier-research.md).

| Dữ liệu | Đích đề xuất | Lý do / giới hạn |
| --- | --- | --- |
| User, nghiệp vụ, media metadata, quyền, audit | Neon PostgreSQL | Lưu dữ liệu có cấu trúc; không lưu bytes/base64 hoặc presigned URL. |
| Ảnh công khai, video, model 3D, texture, brochure public | R2 Standard public bucket riêng | Egress R2 miễn phí; custom domain/cache giảm origin reads. Không đổi URL video homepage trong lần này. |
| Bản gốc hợp đồng, tài liệu cần retention và kiểm tra quyền mỗi request | R2 Standard private bucket riêng | Giữ thiết kế private hiện có; không chuyển bản ký chỉ để cộng quota. |
| Attachment nội bộ nhỏ, ít tải, draft có thể tái tạo | Neon Object Storage private, khi thực sự có nhu cầu | Quota object riêng nhưng egress dùng chung DB/Functions; cần xác minh account/region và credential revoke. |

Không chia ngẫu nhiên 50/50, không tự chuyển provider khi R2 gần đầy. Quota PostgreSQL không cộng vào quota object storage; hai bucket R2 không có hai suất free riêng. Neon preview branch thừa kế dữ liệu lúc fork, không dùng như bản dev đã ẩn dữ liệu nhạy cảm.

Giữ nguyên ngưỡng UX hiện hành 8,5 GB và cảnh báo 65%/85%; đây chưa phải meter đa provider. Khi triển khai, ledger phải tách theo provider/account/project và đo cả bytes `used + reserved`, versions, quarantine, backup, operations và egress. Có thể đề xuất cảnh báo sớm 80% cho quota provider mới, nhưng không thay policy hiện tại trong refactor. Hết/không rõ quota thì chặn upload an toàn, không hạ quyền private hoặc chuyển đích âm thầm.

Frontend tiếp tục GitHub Pages trong lần này. Phương án dùng hai tài khoản đã có về sau: frontend static trên Cloudflare Pages + Worker API riêng + Neon PostgreSQL/Auth + R2; Neon Storage là đích phụ có chủ đích. Workers Free có giới hạn CPU rất thấp: cần đo auth/SQL/stream, không khẳng định thư viện Node hiện tại chạy nguyên trạng. Neon Functions là lựa chọn Node được nghiên cứu trong báo cáo Neon, không triển khai thêm runtime thứ hai mặc định. Không dùng paid Vercel/Cloudinary chỉ vì tài liệu cũ có nhắc đến; cũng không bỏ auth, scan hoặc backup để hứa toàn hệ thống $0.

## 5. Contract media tương lai — chưa đổi API hiện tại

- Định danh ổn định: `id`, `provider`, `bucket`, `objectKey`, `mimeType`, `sizeBytes`, `visibility`. Backend giữ thêm ownership/property/organization, version, hash, scan state và vị trí project/branch Neon; frontend không được tự quyết định scope/provider/key.
- DB lưu locator, không lưu signed URL có thời hạn. URL đọc được tạo sau kiểm tra quyền; private GET/HEAD/Range có cùng policy. Public bucket chỉ chứa dữ liệu đã công bố.
- Interface provider nên nhỏ: upload/presign theo capability, read/head và delete. `getUsage` thuộc ledger + đối soát/billing, không gọi list toàn bucket mỗi lần upload. `move` là workflow copy → verify hash → đổi locator có transaction → dọn bản cũ theo retention, không phải thao tác atomic xuyên cloud.
- Sửa điểm rủi ro của luồng “upload xong mới ghi metadata”: backend phải kiểm tra quyền, reserve quota và ghi **pending upload** trước khi cấp đường upload. Sau upload, xác minh bytes/MIME/hash/scan rồi finalize metadata và reservation. Upload lỗi/DB commit lỗi cần cleanup/reconciliation; object storage và PostgreSQL không có transaction chung.
- Presigned PUT không tự chứng minh hard size cap. Tài liệu riêng vẫn cần bounded ingress/quarantine/scan như [storage-quota](storage-quota.md). Chưa có scan sạch thì chưa phục vụ.
- HTTP adapter hiện tại vẫn POST multipart `/media`. Không đổi sang presigned upload trong lần chỉ sắp xếp thư mục này; khi đổi phải migrate cả FE/BE cùng contract, không giữ hai đường upload mập mờ.

## 6. Kiểm chứng lần sắp xếp này

- `npm exec -- tsc --noEmit`: pass.
- `npm run test:admin`: 3/3 pass; `npm run test:backend:consumer`: 2/2 pass.
- `npm run build`: pass, gồm export và script loại admin khỏi artifact public. Vite UI có cảnh báo `use client` khi build thư viện; không đổi thư viện trong refactor này.
- Chromium trên Next dev/Turbopack tại `/le-grande-center/admin-preview/`: mở hồ sơ doanh nghiệp, lưu ghi chú, chuyển Media rồi quay lại thấy đúng ghi chú đã lưu. Đổi quota demo 100% làm nút thêm tệp disabled; về 45% bật lại. Không có console error/page error trong lượt thao tác.
- Server dev đã có trên cổng 3106 được giữ nguyên. Lần thử cổng 3118 bị Next từ chối vì một dev server đã chạy; không kill server của người dùng.
- Không kiểm tra credential/account Neon/R2, upload cloud hoặc auth production. Không có LSP/GitNexus tool khả dụng trong phiên; cập nhật import dựa trên TypeScript AST và các caller tìm được, rồi typecheck/build/runtime.
