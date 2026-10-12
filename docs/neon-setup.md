# Neon setup hiện tại

Ngày 12/10/2026 đã link và deploy project Neon được chỉ định.

## Project và deploy

- Project ID: `wispy-sunset-10596642` (Neon hiển thị tên `mall-staging`); branch `production`, region Singapore.
- `neon.ts` khai báo preview bucket `media` với `public_read` và function `api` từ `hello.ts`, theo cấu hình yêu cầu.
- Function đã deploy: `https://br-tiny-butterfly-b3uuw92p-api.compute.c-4.ap-southeast-1.aws.neon.tech/`. GET trả HTTP 200 và `Hello from Neon Functions`.
- Dry-run chỉ đề xuất thêm function `api`. Bucket `media` đã có `public_read` trong cấu hình từ trước; lần deploy không đổi bucket hay credentials remote.
- CLI cảnh báo `preview.functions`/`preview.buckets` đã GA và có thể chuyển lên config root. Để giữ đúng snippet đã yêu cầu, file hiện vẫn dùng `preview`.

## Cài đặt local

- Neon CLI global đã cài và đăng nhập.
- Neon agent skills đã cài/cập nhật trong `.agents/skills/`.
- Project Codex MCP dùng OAuth trong `.codex/config.toml`; không lưu API key trong config project.
- `package.json`/`package-lock.json` có `@neon/config` và `@neon/env` do `neon config init`.
- `.neon` chứa link project/branch; `.env.local` chứa biến kết nối database/object storage. Cả hai thuộc cấu hình local và bị ignore; không commit hoặc đưa secret vào `NEXT_PUBLIC_*`.
- `neon link` đã pull các biến vào `.env.local`. Trạng thái file trước lệnh link không được chụp lại, nên không thể xác nhận liệu các giá trị cùng tên trước đó (nếu có) đã được giữ nguyên. Deploy dùng `--no-env-pull` để không ghi lại file này.

## Ranh giới hiện tại

Function `api` chỉ là smoke test công khai trả chuỗi cố định; chưa tích hợp Admin, auth, repository, SQL schema/migration, upload, Cloudflare R2 hay luồng quản lý media. Bucket public-read chỉ dành cho nội dung được phép công khai, không dùng cho tài liệu nội bộ.
