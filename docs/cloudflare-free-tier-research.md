# Cloudflare free tier — frontend tĩnh, API và R2

Đối chiếu nguồn chính thức ngày **12/10/2026**. Đây là nghiên cứu/đề xuất, **không phải deployment đã chạy**; không tạo bucket, Worker, database hay backend mới.

## Kết luận cho Le Grande

**[INFERENCE] Phương án ít thay đổi:** giữ Next.js static export; có thể dùng **Cloudflare Pages Free cho frontend + Workers Free cho API + Neon PostgreSQL cho metadata + R2 Standard cho bytes đã phân loại**. Free tier phù hợp pilot có kiểm soát, không phải cam kết toàn hệ thống miễn phí hoặc luôn sẵn sàng. Không cần chuyển frontend sang SSR chỉ để có API. Khả năng Workers kết nối Neon được Cloudflare tài liệu hóa; quota/điều kiện Neon phải xét riêng, không nằm trong quota Cloudflare. [1][2][3]

Hiện repo dùng `output: "export"` trong [`next.config.ts`](../next.config.ts); [`scripts/publish-dev-pages.mjs`](../scripts/publish-dev-pages.mjs) xuất `out/` lên **GitHub Pages**, không phải Cloudflare Pages. Script hiện chỉ publish demo public và chủ động từ chối backend API. Đề xuất Cloudflare dưới đây không thay đổi script, URL hay deployment hiện hành.

## 1. Hạn mức và billing cần tính riêng

| Dịch vụ | Free / giới hạn đáng chú ý | Khi vượt hoặc lưu ý |
| --- | --- | --- |
| R2 **Standard** | 10 GB-month/tháng; 1 triệu Class A/tháng; 10 triệu Class B/tháng; egress Internet miễn phí | Phần tính phí: $0.015/GB-month, $4.50/triệu A, $0.36/triệu B. Không áp dụng free tier cho Infrequent Access. [4] |
| Workers Free | 100.000 request/ngày/account, reset 00:00 UTC; 10 ms CPU/invocation; 128 MB RAM/isolate | Vượt request trả lỗi 1027; CPU vượt mức có thể bị dừng với 1102. Thời gian đợi network/DB không tính CPU; xác thực, parse, hash vẫn tính. [2][5] |
| Pages Free | 500 builds/tháng, 1 build đồng thời, timeout build 20 phút; 20.000 files/site; tối đa 25 MiB/file | Request static không gọi Functions miễn phí và không giới hạn số lượng theo pricing. Pages Functions dùng **chung** quota Workers, không được thêm 100.000 request/ngày riêng. [6][7] |
| Hyperdrive, nếu chọn | Free: 100.000 database statements/ngày, reset 00:00 UTC | SELECT/INSERT/UPDATE/DDL đều tính; vượt mức operation thất bại. Không phải quota database Neon. Không cần thêm tầng này ngay chỉ để kết nối DB. [3][8] |

R2 cần hoàn tất checkout để thêm subscription. Free allowance **không phải hard cap tự ngắt**: pricing quy định usage vượt mức vẫn tính phí. GB-month được tính bằng trung bình **đỉnh dung lượng mỗi ngày** trong kỳ 30 ngày, không chỉ dung lượng cuối tháng; billing có làm tròn đơn vị. PUT/copy/list/multipart thuộc A; GET/HEAD thuộc B; delete/abort multipart miễn phí operation. Một file hoặc một lần xem PDF có thể tạo nhiều operation. [4][9]

Workers Paid bắt đầu **$5/tháng/account**, chưa bao gồm mọi overage và sản phẩm khác. Không tự nâng Paid trong phương án “bắt đầu miễn phí”. Budget alerts chỉ gửi email, **không pause/cap usage**; giới hạn CPU/request không phải trần hóa đơn account. [2][10]

## 2. Public media: CDN đúng đường, không đi qua API nếu không cần

- R2 mặc định private. Chỉ bật public với bucket dành riêng cho ảnh/video/brochure thực sự công khai; không trộn hợp đồng vào bucket này. Dùng **custom domain gắn trực tiếp với bucket** để có Cloudflare Cache. `r2.dev` dành cho development, bị rate-limit và không cung cấp các tính năng cache/access control như custom domain; CNAME trỏ vào `r2.dev` không phải đường được hỗ trợ. [11]
- Cache mặc định chỉ áp dụng một số loại file. **[INFERENCE]** Với asset public immutable, dùng key có version/hash, metadata `Cache-Control` phù hợp và Cache Rules giới hạn đúng hostname/path public; kiểm tra cache HIT thực tế trước khi ước tính số lần đọc R2. Cache miss/revalidation vẫn có thể về origin; TTL không bảo đảm hit rate hoặc miễn phí tuyệt đối. Free/Pro/Business có giới hạn file cacheable **512 MB**, khác với giới hạn asset Pages 25 MiB. [11][12]
- Không đồng nhất “R2 egress miễn phí” với “mọi request miễn phí”. Khi request cần đọc R2 vẫn có Class B; nếu đi qua Worker còn dùng quota Worker. Pricing của tính năng **Workers Caching** cũng tính cache-hit request theo request rate của Worker; cache không mặc nhiên loại bỏ phí request. Không cần bật tính năng này cho kiến trúc đang đề xuất. [2][4]

## 3. Private documents: giữ thiết kế bảo mật hiện có

Giữ contract tại [`private-documents-r2.md`](private-documents-r2.md), không đổi thành public để tiết kiệm phí:

1. Bucket tài liệu tắt cả `r2.dev` lẫn custom domain public. Worker truy cập bằng **R2 binding**, không đưa credential vào frontend. Worker domain là endpoint ứng dụng, không phải public domain của bucket. R2 binding hỗ trợ stream và ranged reads. [11][13]
2. API kiểm tra session, staff/membership/grant và scope property/organization; resolve `versionId → object_key` từ PostgreSQL; kiểm tra quyền cho cả GET/HEAD/Range. Chỉ phục vụ version clean và trạng thái hợp lệ; stream `200/206` đúng contract, không buffer cả file.
3. Trả `Cache-Control: private, no-store`, không đưa hợp đồng vào public Cache API/Cache Everything. Cloudflare mặc định không cache `private`/`no-store`; không cấu hình rule override cho private endpoint. Với security-critical Worker route, chọn **fail closed** khi hết quota, không bypass authorization về origin. [5][12]
4. Presigned URL là **bearer credential dùng lại được đến expiry**, không phải link gắn với session hay dùng một lần. R2 presigned URL chạy trên S3 API domain, không dùng custom domain bucket. Chỉ cấp sau kiểm tra quyền nếu policy download cho phép; không lưu signed URL trong DB/log. CORS không thay authorization. [14]
5. Upload vẫn cần quota reservation nguyên tử, giới hạn bytes thực nhận, quarantine/scan/finalize và reconciliation theo [`storage-quota.md`](storage-quota.md). Không thay bounded upload bằng unrestricted presigned PUT rồi tin `File.size`. Quét virus/OCR/conversion và backup/restore chưa được chứng minh miễn phí; không bỏ các gate này để vừa 10 ms CPU.

Metadata PostgreSQL giữ document/version ID, provider, bucket/key, MIME, bytes, hash, ownership/grant, scan state và audit; không nhét file bytes hay signed URL vào bảng. **[INFERENCE]** Khi phân chia R2 và Neon Object Storage, giữ một nơi có thẩm quyền cho metadata/quyền và vị trí từng version; không cộng dung lượng PostgreSQL vào dung lượng object storage. Tài liệu này xác nhận phía Cloudflare, không tự suy luận quota hay tính năng private của Neon Object Storage.

## 4. Ranh giới deploy frontend và backend

- **Frontend hiện tại:** có thể build bằng pipeline repo `npm run build` rồi deploy **`out/`** lên Pages; không thay bằng một lệnh Next thuần làm bỏ qua prebuild/postbuild. Khi đổi host, cấu hình `NEXT_PUBLIC_SITE_URL` đúng domain/path mới để `basePath` không còn giữ đường GitHub Pages. Đây là việc deploy tương lai, chưa thực hiện. Cloudflare có hướng dẫn riêng cho Next static export. [1]
- **API tương lai:** deploy Worker riêng; chỉ route `/api/*` qua Worker nếu dùng cùng origin, để asset tĩnh không gọi Functions/Worker vô ích. Với admin/portal private nên giữ endpoint xem tài liệu cùng origin hoặc reverse proxy cùng origin như design hiện có. Nếu API dùng subdomain khác, phải thiết kế credentialed CORS, cookie/session và CSRF rõ ràng; không coi CORS là lớp kiểm soát quyền.
- **Điểm dễ nhầm:** `output: "export"` không chạy Next Route Handler phụ thuộc request/cookie, POST upload hay Server Actions tại request time. Static GET có thể được tạo lúc build nhưng không phải backend. Chỉ thêm `src/app/api/...` không làm API chạy trên artifact Pages; Pages Functions/Worker là runtime được deploy riêng, không phải Next server tự xuất hiện. Muốn cùng Next runtime phải chuyển deployment có chủ đích và kiểm tra tương thích, không nằm trong lần sắp xếp thư mục này. [1][15]
- **PostgreSQL:** Workers có thể dùng Neon serverless driver; giữ connection string trong Worker secret. Hyperdrive là lựa chọn Cloudflare khuyến nghị cho pooling nhưng có quota riêng; không ghép driver serverless với Hyperdrive như hai tầng pooling mặc định. Cần kiểm tra library/Node API, transaction semantics và CPU của backend thực tế trước khi chọn runtime production; chưa khẳng định package backend hiện tại chạy nguyên trạng trên Worker. [3][8]

## 5. “Trong free tier” không đồng nghĩa “có trần chi phí chắc chắn”

Giữ quota ứng dụng đã chốt: **8.500.000.000 bytes**, tính `used + reserved` trên toàn scope R2 được kiểm soát, gồm original, versions, thumbnails, quarantine và backup cùng scope. Cảnh báo theo [`storage-quota.md`](storage-quota.md): trên 65% vàng, trên 85% đỏ, chạm trần chặn upload; usage không rõ thì chặn upload. Đây là policy repo, không phải mức mặc định Cloudflare. Không cấp mỗi bucket/project thêm một ngân sách 8,5 GB độc lập.

**[INFERENCE] Trước pilot:** giới hạn writer, dùng ledger/reservation phía server, đối soát R2; theo dõi riêng storage/A/B, Workers request/CPU và DB usage; đặt budget alerts và chống abuse theo endpoint. Giới hạn bytes chỉ giảm rủi ro storage, không khống chế phí operations, retries, writer ngoài scope hay usage đã phát sinh. Cache không bảo đảm không mất availability khi hết quota, và không được đánh đổi quyền truy cập private. Chưa có số đo workload/traffic nên **không cam kết hóa đơn $0 hoặc production readiness**. [4][5][10]

## Nguồn chính thức

1. [Cloudflare Pages — Next.js static export](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/).
2. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).
3. [Workers — kết nối Neon](https://developers.cloudflare.com/workers/databases/third-party-integrations/neon/).
4. [R2 pricing, operation classes và GB-month](https://developers.cloudflare.com/r2/pricing/).
5. [Workers limits và fail-open/fail-closed](https://developers.cloudflare.com/workers/platform/limits/).
6. [Pages limits](https://developers.cloudflare.com/pages/platform/limits/).
7. [Pages Functions pricing và static requests](https://developers.cloudflare.com/pages/functions/pricing/).
8. [Hyperdrive pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/).
9. [R2 — subscription checkout](https://developers.cloudflare.com/r2/get-started/).
10. [Cloudflare budget alerts](https://developers.cloudflare.com/billing/manage/budget-alerts/).
11. [R2 public buckets, custom domains và r2.dev](https://developers.cloudflare.com/r2/buckets/public-buckets/).
12. [Cloudflare default cache behavior và cache limits](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/).
13. [R2 Workers API, streams và ranged reads](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).
14. [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).
15. [Next.js static exports và unsupported features](https://nextjs.org/docs/app/guides/static-exports).
