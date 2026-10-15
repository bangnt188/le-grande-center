# Phụ lục: Tiêu chí nghiệm thu giao diện website Le Grande Centre

**Bản dự thảo để hai bên rà soát và ký xác nhận**  
**Phạm vi:** giao diện website công khai dành cho khách hàng/đối tác; nghiệm thu trang, nội dung đã duyệt và tương tác phía trình duyệt.

| Thông tin | Xác nhận |
|---|---|
| Bên A (chủ đầu tư/đại diện) | ______________________________________________ |
| Bên B (đơn vị thực hiện) | ______________________________________________ |
| Phiên bản tài liệu | 1.0 |
| Ngày ký | ____ / ____ / ______ |
| Domain/base path nghiệm thu | ______________________________________________ |

## 1. Phạm vi trang nghiệm thu

Nghiệm thu các trang giao diện công khai sau. Mỗi route phải mở được trực tiếp bằng URL và hiển thị đúng khi tải lại trang:

| Trang | Route |
|---|---|
| Trang chủ | / |
| Tổng quan dự án | /tong-quan/ |
| Tổng quan tầng / không gian kinh doanh | /tong-quan-tang/ |
| Tra cứu mặt bằng | /mat-bang/ |
| Chi tiết một mặt bằng | /mat-bang/[unitId]/ — một mẫu trang cho từng mã mặt bằng trong brochure (hiện có 81 URL) |
| Liên hệ / đăng ký tham quan | /lien-he/ |

Không thuộc phạm vi phụ lục này: trang quản trị/nội bộ (/admin-preview/), đăng nhập xác thực, cơ sở dữ liệu/backend, gửi lead thực, cập nhật tồn kho/tình trạng thuê trực tiếp, xác nhận lịch hẹn, giữ chỗ/đặt cọc, thanh toán, ký hợp đồng điện tử và tích hợp CRM. Form demo phải hiển thị rõ rằng chưa gửi yêu cầu thật.

## 2. Tiêu chí nghiệm thu dùng chung

- [ ] Header điều hướng tới đúng các trang Trang chủ, Mặt bằng, Không gian kinh doanh, Le Grande Centre và Đặt lịch tham quan; không có mục Khám phá 3D. Trang hiện tại được nhận biết. Chuyển trang từ vị trí cuộn bất kỳ phải mở trang đích từ đầu trang.
- [ ] Trên màn hình hẹp, nút Menu mở/đóng được; chọn liên kết điều hướng tới đúng trang và đóng menu; phím Escape đóng menu và trả focus về nút Menu.
- [ ] Footer hiển thị các liên kết điều hướng và thông tin liên hệ theo cấu hình đã được Bên A xác nhận. Liên kết điện thoại dùng tel:, email dùng mailto:, bản đồ mở đúng vị trí; Zalo và số hotline giữ đúng giá trị cấu hình độc lập.
- [ ] Nút/liên kết có tên dễ hiểu; có thể thao tác bằng bàn phím; focus nhìn thấy được. Dialog/popup đóng bằng nút đóng và Escape, focus trở lại nút đã mở.
- [ ] ContactDock trên các trang có footer hiển thị thao tác gọi/Zalo dùng đúng thông tin; trên mobile có thể mở/thu gọn, Escape đóng và trả focus.
- [ ] Kiểm tra bố cục ở desktop 1440px, mobile 390px và màn hình hẹp 320px. Nội dung, biểu mẫu và nút thao tác không bị cắt; trang không phát sinh cuộn ngang toàn tài liệu. Sơ đồ trong trang tra cứu mặt bằng được phép cuộn trong vùng sơ đồ riêng; sơ đồ trong popup vị trí trên trang chi tiết phải hiển thị trọn mà không cần cuộn ngang.
- [ ] Chuyển động không cản trở thao tác; khi thiết bị bật prefers-reduced-motion, hiệu ứng tự động/tạo chuyển động được giảm hoặc tắt theo thiết kế.
- [ ] Dữ liệu mặt bằng và trang PDF dùng đúng brochure được Bên A duyệt; thông tin liên hệ, logo, ảnh và nội dung cuối cùng được Bên A xác nhận trước khi ký nghiệm thu.

## 3. Tiêu chí theo từng trang

### 3.1. Trang chủ — /

- [ ] Hero hiển thị tên dự án, nội dung giới thiệu và hai CTA: **Xem mặt bằng** mở /mat-bang/; **Đặt lịch tham quan** mở /lien-he/.
- [ ] Phim giới thiệu tự phát ở trạng thái tắt tiếng, lặp lại; nút bật/tắt âm thanh chỉ đổi trạng thái sau thao tác của người dùng. Khi nguồn video không tải được, nội dung dự phòng/link mở phim vẫn dùng được.
- [ ] CTA giới thiệu dự án mở /tong-quan/; CTA vị trí mở đúng vị trí trên bản đồ và hiển thị địa chỉ đã duyệt.
- [ ] Khi cuộn tới phối cảnh tách lớp, người dùng có thể chọn nhóm tầng; card hiển thị nhóm/tầng, công năng và diện tích tham khảo đúng tầng. Chọn tầng trong card cập nhật nội dung; CTA mở đúng tầng tại /mat-bang/#tang-N; nút X/Escape đóng card và trả focus.
- [ ] Dải loại hình kinh doanh mở rộng bằng pointer, bàn phím và chạm; CTA của từng loại hình mở mặt bằng đúng tầng tham khảo.
- [ ] Gallery tổng quan cho phép chọn từng góc nhìn; ảnh, chú thích và trạng thái lựa chọn đổi đồng bộ.
- [ ] Các mặt bằng nổi bật mở đúng trang chi tiết; CTA **Khám phá tất cả mặt bằng** mở trang tra cứu.
- [ ] CTA liên hệ mở /lien-he/; hotline gọi đúng số khi thiết bị hỗ trợ.

### 3.2. Tổng quan dự án — /tong-quan/

- [ ] Hiển thị hero, nội dung tổng quan và thư ngỏ theo nội dung đã duyệt.
- [ ] CTA **Khám phá 6 tầng** mở /tong-quan-tang/.
- [ ] Tài liệu có sẵn mở/tải đúng tệp và đúng nội dung: brochure dự án, trang sơ đồ trong brochure và quyết định được công bố.
- [ ] Tài liệu chưa được cung cấp (sơ đồ kỹ thuật riêng, giấy phép xây dựng nếu chưa có tệp được duyệt) được ghi rõ trạng thái chờ; không hiển thị liên kết tải giả hoặc tệp không liên quan.
- [ ] CTA trao đổi nhu cầu thuê mở /lien-he/.

### 3.3. Tổng quan tầng / không gian kinh doanh — /tong-quan-tang/

- [ ] Khi cuộn qua các phần nội dung, hình ảnh và nội dung tầng đổi đúng theo các nhóm: tầng 1–2, tầng 3–4, tầng 5 và tầng 6; tên công năng, mô tả và dải tầng khớp dữ liệu đã duyệt.
- [ ] CTA **Tìm hiểu mặt bằng tầng N** mở /mat-bang/#tang-N và chọn đúng tầng/nhóm tầng.
- [ ] Không hiển thị CTA Khám phá công trình 3D.
- [ ] Trên mobile, hiệu ứng cuộn không che nội dung hoặc nút; khi giảm chuyển động, nội dung vẫn đọc và thao tác được.

### 3.4. Tra cứu mặt bằng — /mat-bang/

- [ ] Chọn được nhóm **Tầng 1–2** và từng tầng 3, 4, 5, 6. Lựa chọn cập nhật sơ đồ/danh sách và trạng thái đang chọn; hash #tang-N chọn đúng tầng; liên kết có tham số unit chọn đúng mặt bằng và mở đúng popup.
- [ ] Bộ lọc **Tầng**, **Diện tích**, **Trạng thái công khai** và **Loại hình** áp dụng đồng thời; diện tích chia đúng các ngưỡng dưới 100 m², 100–150 m² và trên 150 m²; trạng thái công khai lọc đúng Còn trống, Liên hệ và Đã thuê. **Xóa bộ lọc** khôi phục danh sách; không có kết quả thì hiển thị thông báo và thao tác xóa bộ lọc.
- [ ] Chuyển giữa **Map** và **List**; mỗi mặt bằng còn trong bộ lọc được nhận biết và chọn được. Sơ đồ có thể cuộn ngang bên trong vùng sơ đồ để xem đầy đủ, không làm trang tràn ngang.
- [ ] Chọn một mặt bằng mở popup đúng mã/tầng, diện tích theo brochure, loại hình, thông tin hướng tham khảo/kích thước nếu có và trạng thái hiển thị. Đóng popup bằng nút X/Escape; sau khi đóng có thể tiếp tục từ vị trí vừa chọn.
- [ ] Với 11 cặp shophouse A.1–A.11/B.1–B.11, giao diện hiển thị từng căn, diện tích từng tầng và tổng hai tầng; cho phép chọn thuê riêng từng căn hoặc kết hợp, không mặc định bắt buộc thuê cả cặp.
- [ ] Từ popup có thể mở trang chi tiết, mở yêu cầu tư vấn hoặc email soạn sẵn đúng mã mặt bằng; liên kết brochure mở đúng trang của tầng.
- [ ] Phần hướng/nguồn sơ đồ giải thích rõ đây là thông tin tham khảo và dẫn tới nguồn đối chiếu đã duyệt.

### 3.5. Chi tiết mặt bằng — /mat-bang/[unitId]/

- [ ] Mỗi URL hợp lệ hiển thị đúng mã, tầng, diện tích, loại hình, kích thước nếu có, mô tả tầng và trang brochure tương ứng. Mã không tồn tại trả về trang không tìm thấy, không tạo dữ liệu giả.
- [ ] Gallery đổi ảnh bằng thumbnail, nút ảnh trước/sau và phím mũi tên trái/phải; ảnh/chú thích/trạng thái thumbnail khớp. Nút **Xem tất cả ảnh** mở gallery dialog; có thể điều hướng, đóng bằng X/Escape và trả focus. Ảnh được ghi rõ là ảnh dự án tham khảo, không phải ảnh riêng của căn.
- [ ] Gallery tự chuyển ảnh mỗi 3 giây theo phạm vi đã duyệt, dừng ở ảnh cuối và tạm dừng khi dialog ảnh mở; hiệu ứng chuyển ảnh tuân theo reduced motion.
- [ ] Nút bản đồ mở popup sơ đồ của đúng tầng, tô rõ căn đang xem, hiển thị toàn sơ đồ không cuộn ngang; chọn căn khác mở đúng trang chi tiết căn đó.
- [ ] Với căn thuộc cặp A.n/B.n, hiển thị diện tích từng tầng và tổng diện tích; ghi rõ khách có thể thuê riêng từng căn hoặc kết hợp; liên kết chuyển sang căn đối ứng/tầng đối ứng hoạt động đúng.
- [ ] CTA **Yêu cầu tư vấn** mở lựa chọn Zalo, gọi điện hoặc yêu cầu gọi lại. Form gọi lại kiểm tra họ tên, số điện thoại và đồng ý liên hệ; với shophouse cho phép chọn thuê riêng/kết hợp. Thông báo cho biết đây là demo, chưa gửi/lưu yêu cầu thật.
- [ ] CTA tham quan mở /lien-he/ với đúng unit và intent=visit; brochure mở đúng PDF/trang tầng; CTA email/gọi điện dùng đúng thông tin liên hệ.
- [ ] Liên kết quay lại sơ đồ tầng, căn trước/căn tiếp và danh sách căn khác mở đúng trang; căn đầu/cuối tầng không hiển thị liên kết điều hướng giả.

### 3.6. Liên hệ / đăng ký tham quan — /lien-he/

- [ ] Hiển thị hotline, email, địa chỉ và liên kết bản đồ; tel:, mailto: và Google Maps mở đúng đích.
- [ ] Form tư vấn có các trường: họ tên, tên doanh nghiệp, điện thoại, email, loại hình, diện tích, thời gian dự kiến, mặt bằng quan tâm, ghi chú và đồng ý liên hệ. Bắt buộc ở luồng tư vấn thường: họ tên, điện thoại, email, loại hình và đồng ý; tên doanh nghiệp, diện tích, thời gian dự kiến, mặt bằng quan tâm và ghi chú là tuỳ chọn. Luồng tham quan bổ sung ngày/buổi bắt buộc; form có shophouse liên thông bổ sung lựa chọn phạm vi thuê bắt buộc. Các lỗi phải chỉ rõ trường cần sửa.
- [ ] Kiểm tra dữ liệu: họ tên 2–100 ký tự; tên doanh nghiệp tối đa 150; điện thoại 9–15 chữ số, tối đa 32 ký tự; email hợp lệ, tối đa 254; loại hình hợp lệ; diện tích/thời gian nếu có phải thuộc lựa chọn; mã mặt bằng tối đa 150; ghi chú tối đa 2.000 ký tự; đồng ý liên hệ bắt buộc. Phạm vi thuê riêng/kết hợp bắt buộc khi form có cặp shophouse.
- [ ] Khi đến từ trang chi tiết, unit được điền đúng; diện tích/mã mặt bằng liên quan được gợi ý. Với cặp shophouse có lựa chọn thuê riêng hoặc kết hợp và tổng diện tích đúng.
- [ ] Với intent=visit, tiêu đề/form đổi sang đăng ký tham quan; ngày hôm nay hoặc tương lai và buổi sáng/chiều là bắt buộc; ngày quá khứ/không hợp lệ bị từ chối. Mặt bằng quan tâm và ghi chú được điền theo lựa chọn trước đó.
- [ ] Khi có lỗi, hiển thị lỗi cạnh trường và đưa focus tới lỗi đầu tiên; khi hợp lệ, chỉ hiển thị kết quả demo/cooldown theo giao diện. Trang phải luôn nói rõ dữ liệu không được gửi/lưu và lịch hẹn chưa được xác nhận; không hiển thị thông báo như thể nhân viên đã nhận yêu cầu thật.

### 3.7. Ẩn 3D theo yêu cầu khách hàng — 13/10/2026

- [ ] Không có link/CTA khám phá 3D ở header desktop/mobile, homepage, tổng quan tầng hoặc admin media.
- [ ] Mở trực tiếp /kham-pha/ và /model-3d/asset-manifest.json, /model-3d/viewer-projection.json trên website trả 404.
- [ ] Source/viewer/tooling được bảo tồn trong repo https://github.com/bangnt188/3d-model-mall, không import/build vào website.
- [ ] Cảnh tầng 2D vẫn thao tác và mở đúng sơ đồ/thông tin tầng; mobile không giữ khoảng trống của CTA 3D đã gỡ.
- [ ] Asset 3D trên R2 vẫn public theo quyết định chủ dự án; tắt route không phải thu hồi quyền tải direct URL asset.

## 4. Quy ước dữ liệu và nội dung cần xác nhận

- [ ] Mã mặt bằng, tầng, diện tích và trang PDF được đối chiếu với brochure chính thức do Bên A duyệt.
- [ ] 11 cặp shophouse A.1–A.11/B.1–B.11 được trình bày như các căn có thể thuê riêng hoặc kết hợp; tổng diện tích là tổng diện tích hai tầng, không thay cho diện tích riêng từng căn.
- [ ] Tình trạng thuê hiển thị trên UI hiện là dữ liệu mô phỏng; không được hiểu là tồn kho trực tiếp hoặc cam kết còn trống.
- [ ] Hướng/kích thước nào ghi “tham khảo” chỉ là dữ liệu theo brochure/bố trí, không xác nhận hướng cửa, tầm nhìn hoặc kích thước khảo sát.
- [ ] Ảnh ở trang chi tiết là ảnh dự án dùng tham khảo bố cục, không đại diện ảnh bàn giao riêng từng căn.
- [ ] Công năng tầng 5–6 và các nội dung ghi “dự kiến” được giữ rõ là định hướng/dự kiến; không chuyển thành cam kết đã vận hành.
- [ ] Bên A xác nhận trước nghiệm thu các giá trị liên hệ, địa chỉ, Zalo, logo, nội dung, tài liệu và ảnh sẽ công bố. Tài liệu chưa được cung cấp phải hiện trạng thái chờ, không dùng file thay thế.

## 5. Kịch bản nghiệm thu liên trang

- [ ] Trang chủ → **Xem mặt bằng** → chọn A.1 → mở chi tiết A.1; dữ liệu mã/tầng/diện tích nhất quán.
- [ ] Chi tiết A.1 → mở sơ đồ vị trí → A.1 được tô nổi; chọn căn khác mở đúng URL; đóng popup trả focus đúng.
- [ ] Chi tiết A.1 → **Đăng ký tham quan thực tế** → /lien-he/; unit, ngày/giờ và nội dung quan tâm được điền đúng theo quy tắc ở trên.
- [ ] Từ A.1 chuyển sang căn B.1/căn đối ứng; UI vẫn cho chọn thuê riêng hoặc kết hợp và tổng hai tầng đúng.
- [ ] Trang tổng quan tầng → CTA tầng bất kỳ → /mat-bang/#tang-N; trang đích chọn đúng tầng.
- [ ] Không tìm thấy CTA 3D trên website; mở trực tiếp /kham-pha/ trả 404.
- [ ] Mở trực tiếp một URL mặt bằng hợp lệ và một mã không hợp lệ; URL hợp lệ hiển thị đúng dữ liệu, mã không hợp lệ không hiển thị mặt bằng giả.

## 6. Ghi nhận kết quả ký nghiệm thu

| Phạm vi | Đạt | Chưa đạt | Ghi chú / mã lỗi cần xử lý |
|---|:---:|:---:|---|
| Trang chủ | [ ] | [ ] | |
| Tổng quan dự án | [ ] | [ ] | |
| Tổng quan tầng | [ ] | [ ] | |
| Tra cứu mặt bằng | [ ] | [ ] | |
| Chi tiết mặt bằng (toàn bộ URL hợp lệ) | [ ] | [ ] | |
| Liên hệ / đăng ký tham quan | [ ] | [ ] | |
| Ẩn 3D theo yêu cầu khách hàng | [ ] | [ ] | |
| Tiêu chí dùng chung và liên trang | [ ] | [ ] | |

**Thiết bị/trình duyệt đã dùng nghiệm thu:** ______________________________________________  
**Các nội dung/tài liệu đã được Bên A phê duyệt:** _________________________________________  
**Kết luận:** [ ] Chấp nhận  [ ] Chấp nhận sau khi ghi nhận các mục chưa đạt ở trên  [ ] Chưa chấp nhận

| Đại diện Bên A | Đại diện Bên B |
|---|---|
| Họ tên: __________________________ | Họ tên: __________________________ |
| Chức vụ: _________________________ | Chức vụ: _________________________ |
| Chữ ký: __________________________ | Chữ ký: __________________________ |
| Ngày: ____ / ____ / ______ | Ngày: ____ / ____ / ______ |
