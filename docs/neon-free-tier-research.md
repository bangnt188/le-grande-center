# Neon Free: PostgreSQL và Object Storage cho Le Grande

Đối chiếu nguồn chính thức ngày **12/10/2026**. Đây là nghiên cứu/đề xuất, **không tạo tài khoản, provision cloud, triển khai backend hoặc kiểm thử tài khoản Le Grande**.

## 1. Neon Object Storage có thật, không phải dung lượng PostgreSQL

- Neon công bố bộ backend, gồm Object Storage, **GA ngày 17/09/2026**. Plans hiện tại ghi Object Storage có trên mọi gói, kể cả Free. Không còn cơ sở kết luận Neon chỉ cung cấp PostgreSQL hoặc storage vẫn chỉ có private preview. [1][2]
- Bài người dùng gửi ngày **02/10/2026** nâng **Postgres từ 0,5 lên 1 GB/project**, tự áp dụng cho project hiện hữu. Cùng bài ghi riêng **5 GB Object Storage/project**. Hai hạn mức độc lập; 1 GB không phải quota upload file. [3]
- Region Object Storage hiện được liệt kê: AWS Ohio, N. Virginia, Frankfurt và **Singapore (`aws-ap-southeast-1`)**. Không mặc định mọi region PostgreSQL đều có Object Storage. [4]
- **Tình trạng dịch vụ không chứng minh tài khoản đã được bật.** API đọc `GET /projects/{project_id}/branches/{branch_id}/storage` trả `200` cùng `enabled`, endpoint, region và `force_path_style` khi branch dùng được. `404` có các lý do `org_not_entitled`, `region_unavailable`, `branch_directory_missing`, `branch_not_found`; lý do cuối cũng có thể là không đủ quyền. Chưa gọi API này cho Le Grande. [5]

### Xử lý nguồn cũ/mâu thuẫn

| Nguồn | Cách hiểu khi lập kế hoạch |
| --- | --- |
| Changelog 03/07/2026 nói private preview [6] | Mốc lịch sử; thông báo GA 17/09 mới hơn. |
| Bài GA 17/09 còn ghi PostgreSQL 0,5 GB [1] | Đã được bài 02/10 và pricing hiện tại thay bằng 1 GB. |
| API Storage hiện vẫn gắn nhãn Beta [5] | Nhãn endpoint chưa đồng nhất với công bố GA sản phẩm; ghi rõ khác biệt, không suy ra mọi API đã ổn định hoặc account tự được cấp quyền. |
| Blog nhấn mạnh 100 project × 1 GB [3] | Pricing/Plans bổ sung **20 GB tổng PostgreSQL trên account**; không hứa có 100 GB Postgres miễn phí. [2][7] |

Ưu tiên Pricing/Plans cho quota và giá, tài liệu kỹ thuật cho hành vi API; không dùng blog cũ để phủ nhận giới hạn hiện tại.

## 2. Hạn mức Free đang công bố

| Thành phần | Hạn mức và hệ quả |
| --- | --- |
| PostgreSQL | **1 GB/project; 20 GB tổng account**, hai giới hạn được áp dụng độc lập. Dùng cho record/metadata, không lưu PDF/video dạng `bytea` để tận dụng quota. [2][7] |
| Object Storage | **5 GB/project**, usage bao gồm các branch trong project; không phải thêm 5 GB cho mỗi bucket/branch. Maximum object hiện tại **5 GiB**, kể cả multipart; vẫn chịu tổng quota Free 5 GB. Đừng nhầm GB với GiB hoặc giới hạn S3 tương lai với tính năng hiện có. [2][4][8] |
| Public transfer | **5 GB/project/tháng dùng chung PostgreSQL + Object Storage + Functions**. Không phải 5 GB cho từng dịch vụ; presigned download không làm egress biến mất. [2][7] |
| DB compute | **100 CU-hours/project/tháng**, tổng các compute/branch/read replica; autoscale tối đa **2 CU**. 0,25 CU × 400 giờ = 100 CU-hours, không đủ chạy liên tục cả tháng. Free bắt buộc scale-to-zero sau 5 phút idle. [2][7] |
| Managed Better Auth | Tối đa **60.000 MAU** trên Free; MAU là user duy nhất xác thực ít nhất một lần trong kỳ tháng. Không tự nhân quota theo 100 project vì bảng giá không xác nhận cách cộng đó. Đây là authentication, không thay membership/grant/authorization của Le Grande. [2][3] |
| Functions, nếu sau này chọn | **1 triệu invocation/tháng; 10 active + 400 waiting Capacity-Hours/tháng**. Plans ghi áp dụng cả trần account và trần project độc lập; không coi mỗi project tạo thêm một suất account. Đây không phải CU-hours của PostgreSQL. Chưa đề xuất triển khai Functions trong lần này. [2] |
| Project/branch/restore | 100 project; 10 branch/project; cửa sổ instant restore 6 giờ, giới hạn history 1 GB. Free không có uptime SLA, protected branches hoặc private networking. [2][7] |

Free là gói $0, không phải trial, không yêu cầu thẻ. Theo FAQ pricing, hết CU-hours hoặc egress sẽ suspend compute đến kỳ tiếp theo; vượt quota PostgreSQL chặn ghi, không xóa dữ liệu. **Các nguồn đã đọc chưa mô tả đầy đủ lỗi/khả năng đọc Object Storage khi hết quota storage hoặc egress**: phải xác nhận trước production, không hứa tài liệu vẫn luôn tải được. [7]

Khi chuyển gói trả phí: Object Storage **$0,023/GB-month**, không tính riêng phí mỗi operation; public egress có **500 GB/project/tháng dùng chung**, vượt mức **$0,10/GB**. PostgreSQL storage **$0,35/GB-month**; Launch DB compute **$0,106/CU-hour**. Nâng gói không có nghĩa toàn bộ usage vẫn miễn phí. [2][7]

## 3. S3, private access và presigned URL

- Có S3 API thực: PUT/GET/HEAD/DELETE, list, multipart, Range, presigned GET/PUT và browser POST. Dùng AWS SDK/boto3/CLI; **SigV4, path-style**, JavaScript cần `forcePathStyle: true`. Endpoint/region lấy từ branch thực, không hardcode Ohio từ ví dụ. “S3-compatible” không đồng nghĩa hỗ trợ toàn bộ AWS S3. [5][8][9]
- Bucket mặc định **`private`**: đọc/ghi cần credential; **`public_read`** cho anonymous read, ghi vẫn cần credential. Đổi access qua Neon Console/API; `PutBucketAcl`, `PutBucketPolicy`, `PutObjectAcl` không hỗ trợ, trả `501`. [9][10]
- Credential có `storage:read` hoặc `storage:write` (**write bao gồm read**), gắn vào branch và dùng được cho các branch hậu duệ. Branch copy-on-write giúp cô lập thay đổi nhưng vẫn thừa kế file lúc fork: **không phải cơ chế làm sạch dữ liệu production cho dev**. [10][11]
- Cảnh báo quan trọng trong docs: **`expires_at` của storage credential hiện chưa được enforce**; phải revoke credential rõ ràng, không dùng trường đó làm ranh giới bảo mật. Điều này khác với expiry của presigned URL, được docs mô tả hỗ trợ qua `X-Amz-Expires`. [9][11]
- Presigned URL cho người không có credential tải/upload **một object cụ thể trong thời hạn**; docs minh họa GET 3.600 giây, PUT 300 giây, không phải policy Le Grande hoặc cam kết TTL tối đa. Backend phải kiểm tra quyền rồi mới ký; giữ storage secret server-side, không đưa cả read credential vào browser. [8][11]
- **[INFERENCE — khuyến nghị bảo mật]** Signed URL là bearer access: không coi là dùng một lần hoặc gắn với phiên đăng nhập; logout/revoke session không phải bằng chứng đã thu hồi URL. Không log/lưu URL dài hạn; CORS không thay authorization. Với hồ sơ cần kiểm tra quyền mỗi request, giữ mô hình API stream private GET/HEAD/Range trong [thiết kế hiện có](private-documents-r2.md), không thay bằng public bucket để tiết kiệm chi phí.
- Hạn chế ảnh hưởng hợp đồng: **versioning và lifecycle config được lưu nhưng không enforce**, object trả `version-id: null`; Object Lock enforcement còn hạn chế; S3 encryption configuration/cross-region replication không hỗ trợ. Không suy ra dữ liệu không mã hóa chỉ vì thiếu API cấu hình encryption; cũng không tuyên bố có WORM/retention/backup pháp lý từ nhãn S3. [9]

## 4. Đề xuất bảo thủ cho Le Grande

**[INFERENCE — phương án sử dụng, chưa triển khai]**

1. **Neon PostgreSQL:** metadata nghiệp vụ, document/version, quyền và audit; lưu locator `provider`, `bucket`, `object_key` cùng scope project/branch khi dùng Neon, MIME, bytes, hash, scan state. Không lưu bytes hoặc presigned URL trong DB. Giữ nguyên yêu cầu transaction, quyền và production gates ở [backend-readiness](backend-readiness.md).
2. **R2:** tiếp tục media public nặng/nhiều lượt tải (ảnh/video/3D/brochure); giữ bucket private riêng cho original hợp đồng theo [quyết định hiện có](private-documents-r2.md). Không chuyển bản ký sang Neon chỉ để cộng thêm quota khi retention/restore chưa được chứng minh.
3. **Neon Object Storage:** phần chia tải phù hợp là file nội bộ nhỏ, ít tải, chưa phải bản ký gốc: bản nháp hoặc attachment có thể tái tạo, bucket private. Chỉ bật sau khi xác nhận branch/account hỗ trợ và hoàn tất quyền/scan. Nếu workload này chưa tồn tại, chưa cần tạo bucket/adapter thứ hai; 5 GB miễn phí không phải lý do để phát sinh pipeline.
4. **Ngân sách minh họa, không phải quota đã cấu hình:** giữ file Neon khoảng **≤1 GB**, download Neon **≤1 GB/tháng** lúc đầu, để dư shared egress cho DB/API; cảnh báo trước trần. File 5 MB tải 1.000 lần đã xấp xỉ 5 GB egress, có thể làm cạn quota chung dù chỉ lưu một file.
5. Auth provider vẫn cần lựa chọn/binding rõ ràng; 60.000 MAU không tự hoàn thiện RBAC, revoke, grant hoặc tenant isolation. Chỉ đăng ký email không hoàn thành backend production.

Trước khi đưa dữ liệu thật lên Neon: owner xác nhận plan/quota, region và API storage state; kiểm tra private unauthenticated access bị từ chối, presign expiry, credential revoke, GET/HEAD/Range, hạn mức thực tế; thống nhất scan/quarantine, backup/restore và retention. **Chưa thực hiện các kiểm tra này; chưa có bằng chứng account Le Grande enabled.** Free phù hợp khởi đầu ít tải, không phải cam kết vận hành hồ sơ pháp lý miễn phí vô thời hạn.

## Nguồn chính thức đã đọc

1. [Neon backend GA — 17/09/2026](https://neon.com/blog/neon-backend-is-ga).
2. [Neon Plans — quota, shared egress, Object Storage, Auth, Functions](https://neon.com/docs/introduction/plans).
3. [Bài người dùng gửi — 1 GB Postgres/project, 02/10/2026](https://neon.com/blog/neon-free-plan-1-gb-per-project).
4. [Object Storage overview — region, quota, object limit](https://neon.com/docs/storage/overview).
5. [API Storage state — availability và các reason 404](https://neon.com/docs/reference/api/storage).
6. [Changelog 03/07/2026 — private preview lịch sử](https://neon.com/docs/changelog/2026-07-03).
7. [Pricing hiện tại — account cap và xử lý hết quota](https://neon.com/pricing).
8. [Objects — upload, multipart, Range, presigned URLs](https://neon.com/docs/storage/objects).
9. [S3 compatibility — supported operations và giới hạn enforcement](https://neon.com/docs/storage/s3-compatibility).
10. [Buckets — private/public_read, copy-on-write](https://neon.com/docs/storage/buckets).
11. [Storage authentication — scope, lineage, expiry warning, revoke](https://neon.com/docs/storage/authentication).
