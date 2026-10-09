# Motion công khai

Các trang công khai dùng `ScrollMotion` từ `@mall/ui/motion` để quản lý Lenis và GSAP ScrollTrigger. `PublicPageLayout` truyền selector nội dung và `refreshKey={active}` cho entrance một lần với `expo.out` và stagger ngắn. Homepage dùng `<ScrollMotion />` không có selector, nên không có reveal ẩn/blur cho chữ hoặc ảnh nội dung. App không còn controller Lenis/GSAP riêng.

Trang chủ có năm chương: hero, giới thiệu dự án, công năng tầng, phim dự án và liên hệ. `LayeredScrollStory` từ `@mall/ui` sở hữu CSS sticky và thứ tự lớp: `Hero` giữ nguyên góc nhìn, kích thước ảnh và vị trí chữ; `Surface` trượt từ dưới lên che hero. Mỗi surface có mây/ảnh phối cảnh ở lớp 0, các section nội dung ở lớp 1. GSAP chỉ dịch chuyển nền; chữ và ảnh nội dung luôn rõ. App chỉ truyền ảnh và các biến màu `--ui-layered-*` trong `viewer.module.css`, giữ màu chữ hero riêng.

Thư viện nối Lenis RAF vào GSAP ticker; sự kiện cuộn gọi `ScrollTrigger.update()`. Cleanup gỡ listener, ticker và instance khi unmount. Khi bật `prefers-reduced-motion`, kể cả đang mở trang, hero trở lại luồng cuộn thường và thư viện dừng/revert motion; toàn bộ nội dung vẫn hiển thị. Tắt tùy chọn này khôi phục chuyển động. Touch không bị làm mượt cưỡng bức.

Ảnh hero giữ tải ưu tiên cao ở trang chủ; ảnh nội dung khai báo giải mã bất đồng bộ, còn ảnh nền thư mục investor letter đã lazy-load. Video dự án giữ `preload="none"`, poster và phát khi vào viewport như mô tả trong README.

Interface, biến màu và demo tái sử dụng: `packages/ui/docs/motion.md`, `/motion.html#layered-scroll` trong preview component-ui. Ba implementation cũ `home-cloud-motion.tsx`, `home-cloud-story.module.css`, `scroll-motion.tsx` đã được thay thế hoàn toàn.
