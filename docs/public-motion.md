# Motion công khai

Các trang công khai dùng `ScrollMotion` từ `@mall/ui/motion` để quản lý Lenis và GSAP ScrollTrigger. `PublicPageLayout` truyền selector nội dung và `refreshKey={active}` cho entrance một lần với `expo.out` và stagger ngắn. Homepage v2 dùng cùng controller qua `HomeScrollStory`, chỉ reveal các section nội dung bên trong surface; hero và phim giữ hiển thị ngay. App không có controller Lenis/GSAP riêng.

Homepage v2 có hero, phim, giới thiệu, vị trí, phân khu tầng, gallery loại hình kinh doanh, mặt bằng tham khảo, tổng quan, lý do lựa chọn và liên hệ. `LayeredScrollStory` từ `@mall/ui` tái sử dụng hiệu ứng v1: `Hero` giữ nguyên góc nhìn và chữ; `Surface` trượt lên che hero. Surface có mây ở lớp 0, các section nội dung ở lớp 1. GSAP dịch chuyển nền; entrance nội dung dùng `expo.out`, không blur chữ/ảnh. Các biến màu `--ui-layered-*` nằm trong `homepage-v2.module.css`; sticky hero dùng chiều cao header public chung làm offset. Composition v1 được giữ riêng nhưng không được homepage import/render.

Thư viện nối Lenis RAF vào GSAP ticker; sự kiện cuộn gọi `ScrollTrigger.update()`. Cleanup gỡ listener, ticker và instance khi unmount. Khi bật `prefers-reduced-motion`, kể cả đang mở trang, hero trở lại luồng cuộn thường với offset 0 và thư viện dừng/revert motion; toàn bộ nội dung vẫn hiển thị. Tắt tùy chọn này khôi phục chuyển động. Touch không bị làm mượt cưỡng bức.

Hero dùng ảnh khách cung cấp `hero.webp` với ưu tiên tải cao; ảnh “Nhịp Thở Mới” dùng `introduction.webp`, lazy-load và giải mã bất đồng bộ. Video giữ `preload="none"`, poster, điều khiển native và chỉ phát khi người dùng chọn, không tự phát trong homepage v2. Header public chung giữ underline mở rộng khi hover/focus hoặc active; reduced motion tắt transition. Menu mobile đóng khi điều hướng hoặc Escape và trả focus về summary.

Interface, biến màu và demo tái sử dụng: `packages/ui/docs/motion.md`, `/motion.html#layered-scroll` trong preview component-ui. Ba implementation cũ `home-cloud-motion.tsx`, `home-cloud-story.module.css`, `scroll-motion.tsx` đã được thay thế hoàn toàn.
