# Motion công khai

Các trang công khai dùng chung Lenis và GSAP ScrollTrigger: `/`, `/tong-quan/`, `/tong-quan-tang/`, `/mat-bang/` và `/lien-he/`. ScrollTrigger làm section, ảnh và nhóm nội dung vào khung nhìn theo vị trí cuộn; từng section có stagger ngắn với `expo.out`. Chuyển động chỉ dùng opacity/transform và chạy một lần mỗi lần vào route.

Lenis nối RAF vào GSAP ticker; sự kiện cuộn gọi `ScrollTrigger.update()`. Cleanup gỡ listener, ticker và instance khi layout unmount. Trên thiết bị bật `prefers-reduced-motion`, Lenis và reveal không khởi tạo; luật CSS hiện hành vẫn giảm các transition/animation còn lại. Touch không bị làm mượt cưỡng bức.

Ảnh hero giữ tải ưu tiên cao ở trang chủ; ảnh nội dung khai báo giải mã bất đồng bộ, còn ảnh nền thư mục investor letter đã lazy-load. Video dự án giữ `preload="none"`, poster và phát khi vào viewport như mô tả trong README.
