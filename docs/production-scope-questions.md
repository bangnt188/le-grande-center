# Le Grande Centre — Câu hỏi chốt phương án triển khai trong 1 tháng

Ngày: 08/10/2026. Người thực hiện: một freelancer phụ trách triển khai.
**Khung triển khai: 1 tháng. Ngân sách dự kiến: 30.000.000 VNĐ; chưa phải báo giá đã ký.**
Nguồn: phản hồi khách do người dùng cung cấp và hiện trạng source/local; chưa xác minh các luồng production end-to-end. Các phương án dưới đây là đề xuất để khách duyệt, không phải yêu cầu đã được xác nhận.

## Định hướng trao đổi với khách

**Kết quả đề xuất sau tháng triển khai:** website giới thiệu dự án và mặt bằng, trải nghiệm 3D hiện có, đội dự án tự cập nhật nội dung/căn/media qua CMS, tiếp nhận khách quan tâm để nhân viên tư vấn. Ưu tiên một hành trình hoàn chỉnh **xem dự án → tìm căn → gửi thông tin → nhân viên tiếp nhận**, thay vì nhiều màn hình nhưng chưa vận hành được.

Đã xác nhận: dự án có 6 tầng; menu 5 mục có trang riêng; ưu tiên hoàn thiện homepage. Đề xuất tận dụng giao diện, model 3D và các module đã có. Chưa đưa công cụ sửa hình học, quy trình giữ chỗ/hợp đồng, portal khách thuê, tích hợp CRM hoặc xử lý video trực tiếp vào lịch tháng này. Các luồng nghiệp vụ này được ghi nhận riêng vì cần chốt quy trình và quyền truy cập, tránh ảnh hưởng mục tiêu ra mắt trong một tháng.

**Cách mở cuộc họp:** “Trong một tháng, em đề xuất tập trung để khách xem dự án, tìm mặt bằng và liên hệ thuận tiện; đội mình chủ động cập nhật thông tin mà không phải nhờ kỹ thuật mỗi lần thay đổi. Với từng nội dung dưới đây, em có phương án đề xuất và điểm cần thống nhất. Anh/chị giúp xác nhận phương án đó có phù hợp cách vận hành của đội mình không, đặc biệt những phần cần có ngay khi mở website.”

**Nguyên tắc trao đổi:** hỏi theo kết quả và cách làm việc, không đưa danh sách tính năng để khách chọn hết. Giải thích được gì và cần phối hợp gì. Nhu cầu khác đề xuất được ghi nhận theo ưu tiên kinh doanh; chỉ đưa vào tháng triển khai khi đã đánh giá lại công việc, chi phí và mốc nghiệm thu. Không tự động hứa làm thêm chỉ vì giao diện demo đã có.

## Câu hỏi kèm phương án đề xuất và điểm cần thống nhất

### 1. Kết quả cần có khi mở website

- **Câu hỏi:** Khi website mở, anh/chị ưu tiên khách tự tìm mặt bằng và để lại thông tin, hay có một thao tác nghiệp vụ khác bắt buộc phải hoàn thành ngay trên hệ thống?
- **Phương án đề xuất:** Website + CMS nội dung + tiếp nhận khách quan tâm; nhân viên tiếp tục tư vấn và xử lý giao dịch theo quy trình đang dùng.
- **Điểm cần thống nhất / trade-off:** Cách này tập trung vào thu hút và tiếp nhận nhu cầu trong một tháng, nhưng chưa thay hệ thống giao dịch nội bộ. Nếu giữ chỗ/hợp đồng là điều kiện bắt buộc để sử dụng, cần chọn lại trọng tâm trước khi khóa lịch, không coi đó là một bước thêm vào form liên hệ.

### 2. Cấu trúc trang và ngôn ngữ

- **Câu hỏi:** Với 5 mục đã thống nhất, nội dung nào giúp khách hiểu dự án và chọn mặt bằng nhanh nhất? Tiếng Việt đã phù hợp nhóm khách của đợt ra mắt này chưa?
- **Phương án đề xuất:** 5 mục có trang riêng, dùng chung hệ thống giao diện và dữ liệu; Tổng quan tầng giới thiệu công năng, Mặt bằng hỗ trợ tìm căn. Triển khai tiếng Việt trước.
- **Điểm cần thống nhất / trade-off:** Dùng chung template giữ trải nghiệm nhất quán và dễ cập nhật. Nếu nhóm khách cần thêm ngôn ngữ ngay, khách cung cấp bản dịch được duyệt; phải đánh giá công nhập/kiểm tra đa ngôn ngữ trong lịch tháng, thay vì mặc định thêm template và nội dung riêng cho mọi trang.

### 3. Danh mục căn và phương án ghép/tách

- **Câu hỏi:** Với phương án mặt bằng trong brochure đã cung cấp, đội Kỹ thuật xác nhận dùng nguyên danh mục này hay có bản điều chỉnh trước khi đăng? Khi ghép/tách, hiện ai xác nhận và cập nhật?
- **Phương án đề xuất:** 6 tầng, mã căn gốc ổn định; CMS đăng danh mục và phương án đã được Kỹ thuật duyệt, không tự chỉnh ranh giới. Khóa số căn và khối lượng nhập lần đầu từ danh sách thật trong mốc đầu tiên.
- **Điểm cần thống nhất / trade-off:** Nhân viên tự cập nhật thông tin, còn thay đổi mặt bằng đi qua Kỹ thuật để tránh sai diện tích/quan hệ. Tự ghép/tách trong phần mềm cần giữ ID gốc, chặn ghép qua sảnh và xử lý dữ liệu liên quan; chưa đưa chức năng này vào tháng triển khai. Danh mục demo không phải số căn thực tế đã xác nhận.

### 4. Sơ đồ mặt bằng và trải nghiệm 3D

- **Câu hỏi:** Sơ đồ 2D chọn ô theo brochure và link bản gốc đã phù hợp cách khách tìm mặt bằng chưa? Anh/chị cần 3D giới thiệu không gian hay làm căn cứ xác định vị trí/ranh giới?
- **Phương án đề xuất:** Tận dụng sơ đồ 2D, danh sách/chi tiết ô và bộ lọc đã dựng từ brochure; khách/Kỹ thuật xác nhận phương án trước công bố chính thức. Giữ 3D hiện có để khám phá, ghi rõ minh họa. Không dựng lại model chính trong lịch tháng này.
- **Điểm cần thống nhất / trade-off:** Chọn ô 2D giúp khách tìm nhanh và đối chiếu PDF, nhưng sơ đồ tái hiện bố trí không dùng để đo hoặc xác định ranh giới hợp đồng. Định vị 3D chính xác, biên tập ranh giới, đo/vẽ lại hoặc phối cảnh như ảnh render là công việc riêng cần dữ liệu kỹ thuật, không mặc định thuộc phần sơ đồ hiện có.

### 5. Thông số căn, bộ lọc và giá thuê

- **Câu hỏi:** Khách thường dựa vào tầng, diện tích, công năng hay trạng thái để lựa chọn? Thông tin giá nên công khai hay để đội tư vấn trao đổi theo nhu cầu?
- **Phương án đề xuất:** Bộ trường thống nhất: mã căn, tầng, diện tích xác nhận, công năng, mô tả, trạng thái được duyệt; filter theo các tiêu chí này. Giá thuê dùng liên hệ tư vấn nếu chưa có bảng giá được duyệt.
- **Điểm cần thống nhất / trade-off:** Bộ trường cố định giúp nhập đúng và khách dễ so sánh; chưa xây bộ filter tự cấu hình hay công cụ tính giá. Nếu công khai giá, phải có người cập nhật và quy tắc khi giá hết hiệu lực; website không tự suy ra giá từ hợp đồng.

### 6. Cách cập nhật trạng thái căn

- **Câu hỏi:** Hiện ai xác nhận một căn được phép đăng là còn trống/đang khai thác, và đội mình cập nhật thông tin đó theo nhịp nào?
- **Phương án đề xuất:** Người có quyền nhập trạng thái đã duyệt trong CMS; có ghi nhận người/thời điểm sửa. Danh sách trạng thái và quyền công bố được thống nhất trước khi nối dữ liệu thật.
- **Điểm cần thống nhất / trade-off:** Đội dự án kiểm soát nội dung công bố nhưng cần cập nhật đúng thời điểm; trạng thái hiển thị không phải cơ chế giữ chỗ hoặc chặn giao dịch trùng. Tự tính từ hợp đồng/giữ chỗ cần nguồn dữ liệu giao dịch và quy tắc xử lý xung đột, ngoài phạm vi tháng này.

### 7. Thông tin đơn vị thuê/thương hiệu

- **Câu hỏi:** Website cần giới thiệu thương hiệu và vị trí của họ, hay đội vận hành còn cần quản lý hồ sơ pháp nhân thuê trong cùng hệ thống?
- **Phương án đề xuất:** Hồ sơ thương hiệu công khai có ID, tên/logo/mô tả và căn liên quan; không lấy tên làm khóa định danh. Khách duyệt nội dung và quyền sử dụng logo.
- **Điểm cần thống nhất / trade-off:** Đáp ứng giới thiệu đối tác nhưng chưa thay hồ sơ pháp lý. Pháp nhân, kỳ thuê, người liên hệ và hợp đồng cần phạm vi dữ liệu/quyền riêng; không gom các thông tin này vào hồ sơ công khai để tiết kiệm thao tác.

### 8. Ảnh, video và nhập nội dung

- **Câu hỏi:** Bộ ảnh/video hiện có đã sẵn sàng đăng chưa, và ai sẽ bàn giao theo mã tầng/căn? Video có thể dùng link từ kênh của dự án không?
- **Phương án đề xuất:** CMS upload ảnh, video dùng link nền tảng đã duyệt; nhập một đợt từ bộ tệp khách bàn giao rõ mã. Căn có thể xuất bản với ảnh/thông tin được duyệt, không chờ tất cả căn có video.
- **Điểm cần thống nhất / trade-off:** Link video giúp dùng ngay nội dung sẵn có, nhưng phụ thuộc giao diện/chính sách nền tảng phát. Upload/nén/streaming video riêng thêm hạ tầng và kiểm thử, chưa đưa vào tháng này. Số tệp nhập đầu và quota storage phải khóa theo bộ media thật; quay/chụp/biên tập là công việc sản xuất nội dung, tách khỏi phát triển website.

### 9. Bản vẽ và đối tượng được tải

- **Câu hỏi:** Bản vẽ nào được chia sẻ công khai cho khách thuê, bản nào chỉ gửi sau khi đội tư vấn xác nhận?
- **Phương án đề xuất:** Website đăng PDF khách/Kỹ thuật đã duyệt công bố; tài liệu nhạy cảm tiếp tục do người có trách nhiệm gửi theo quy trình hiện tại. Không đưa hồ sơ private/DWG lên đường dẫn công khai.
- **Điểm cần thống nhất / trade-off:** PDF công khai dễ tiếp cận nhưng người nhận có thể lưu/chia sẻ; điền form không biến file thành tài liệu bảo mật. Cổng private, phiên bản/thu hồi và nhật ký tải cần kiểm tra quyền backend, chưa đưa vào lịch tháng. Nếu tài liệu private là phần bắt buộc, phải thiết kế lại phạm vi trước khi triển khai, không giải quyết bằng “ẩn link”.

### 10. Tiếp nhận khách quan tâm

- **Câu hỏi:** Ai tiếp nhận khách quan tâm và cần những thông tin nào để liên hệ lại? Kiểm tra danh sách trong CMS đã phù hợp cách làm việc chưa?
- **Phương án đề xuất:** Form ngắn: tên, kênh liên hệ, căn/tầng quan tâm, nội dung; lưu vào CMS để nhân viên xử lý. Chống spam, giới hạn truy cập và chính sách lưu/xóa dữ liệu là điều kiện bắt buộc.
- **Điểm cần thống nhất / trade-off:** Lead được lưu độc lập với email, nhưng nhân viên cần kiểm tra danh sách. Nếu thông báo email là cần thiết, chốt nhà cung cấp và kiểm tra gửi thật từ mốc đầu trước khi đưa vào giá/lịch. Phân công tự động, nhắc việc, CRM/Zalo/SMS không mặc định đi kèm form và chưa đưa vào tháng này.

### 11. Quy trình cho thuê trong demo

- **Câu hỏi:** Trong các màn hình yêu cầu thuê, lịch hẹn, giữ chỗ, hợp đồng và portal, có bước nào mà đội mình không thể tiếp tục xử lý theo cách hiện tại khi website ra mắt?
- **Phương án đề xuất:** Đợt này hoàn chỉnh luồng tiếp nhận nhu cầu; giao dịch tiếp tục theo quy trình của đội dự án. Các màn hình nghiệp vụ demo dùng để hiểu nhu cầu, không ghi vào bàn giao production tháng này.
- **Điểm cần thống nhất / trade-off:** Go-live tập trung, còn nghiệp vụ chưa tự động hóa. Nếu có bước bắt buộc cần chạy trong hệ thống ngay, phải thống nhất lại kết quả ưu tiên và đánh giá công triển khai trước khi nhận lịch. Không đặt nhiều luồng vào một tháng rồi chỉ bàn giao giao diện chưa xử lý hết hạn/quyền/trùng giao dịch.

### 12. Người cập nhật và người xuất bản

- **Câu hỏi:** Đội mình có thể chỉ định người được cập nhật/xuất bản và duyệt nội dung nội bộ trước khi đăng, hay cần phần mềm bắt buộc đi qua từng người duyệt?
- **Phương án đề xuất:** Tài khoản định danh, không dùng chung; một nhóm được cập nhật/xuất bản theo quy định nội bộ. Khóa danh sách tài khoản trước triển khai. Có đăng nhập, quyền phía server và nhật ký thay đổi cơ bản.
- **Điểm cần thống nhất / trade-off:** Ít bước trong CMS, nhưng quy trình kiểm tra chéo do đội dự án thực hiện; cùng nhóm có quyền tương đương. Nếu bắt buộc NTM nhập → Kỹ thuật xác nhận → BGĐ duyệt trong phần mềm, đó là một luồng riêng cần đánh giá trước khi khóa tháng. Không cắt bảo mật bắt buộc, kể cả MFA nếu chính sách yêu cầu, để giữ thêm màn hình.

### 13. Xuất bản và thời gian website cập nhật

- **Câu hỏi:** Sau khi bấm xuất bản, đội mình cần website cập nhật trong khoảng thời gian nào để không ảnh hưởng tư vấn cho khách?
- **Phương án đề xuất:** Xuất bản chủ động, báo rõ kết quả/thất bại và có cách xử lý lại; chỉ đưa nội dung được duyệt ra public. Đo khoảng trễ trên môi trường thật rồi ghi ngưỡng nghiệm thu trước khi khóa cam kết.
- **Điểm cần thống nhất / trade-off:** Kiểm soát được nội dung và cache, không cập nhật liên tục từng thay đổi đang soạn. Real-time ở mọi màn hình chưa nằm trong tháng này. Nếu dữ liệu dùng để quyết định giữ chỗ, không coi website có độ trễ là nguồn giao dịch duy nhất.

### 14. Tài khoản dịch vụ, website cũ và chi phí vận hành

- **Câu hỏi:** Ai phụ trách domain/tài khoản dịch vụ và thanh toán vận hành? Có URL hoặc nội dung website cũ nào cần giữ để khách đang dùng không bị gián đoạn?
- **Phương án đề xuất:** Tài khoản thuộc khách; dùng dịch vụ managed để giảm công vận hành server. Khóa danh sách URL chuyển hướng/nội dung cần giữ ở mốc đầu; gửi dự toán storage/DB/hosting/email theo đầu vào và lượng truy cập dự kiến để khách duyệt trước.
- **Điểm cần thống nhất / trade-off:** Managed giảm việc chăm sóc server nhưng vẫn có phí/quota và phụ thuộc nhà cung cấp. Không giả định free tier đáp ứng vận hành lâu dài. Migration toàn bộ SEO/nội dung hoặc yêu cầu nơi lưu dữ liệu cụ thể có thể đổi khối lượng/kiến trúc; phải đánh giá sớm, không để phát hiện ở tuần bàn giao.

### 15. Nội dung, mốc duyệt và tiến độ một tháng

- **Câu hỏi:** Ai tổng hợp phản hồi/duyệt nội dung, và đội mình có thể bàn giao danh mục, bản vẽ, media theo các mốc thống nhất không?
- **Phương án đề xuất:** Một đầu mối tổng hợp phản hồi và người nghiệm thu được chỉ định; duyệt giao diện/phạm vi ở mốc đầu, duyệt nội dung/luồng trên staging trước go-live. Khóa khối lượng nhập và vòng chỉnh trong phụ lục trước nhận giá/lịch.
- **Điểm cần thống nhất / trade-off:** Phản hồi tập trung giúp dành tuần cuối cho kiểm thử và bàn giao. Nếu đầu vào/duyệt chậm, hai bên thống nhất điều chỉnh mốc hoặc phần nội dung được phép xuất bản; không bù bằng bỏ kiểm thử hay tự đăng thông tin chưa duyệt. Sửa lỗi so với yêu cầu đã ký khác với đổi thiết kế/thêm chức năng.

### 16. Tiếp quản, backup và hỗ trợ

- **Câu hỏi:** Sau bàn giao, ai cập nhật website và xử lý yêu cầu hỗ trợ? Có yêu cầu bắt buộc về thời gian phục hồi hoặc hỗ trợ ngoài giờ không?
- **Phương án đề xuất:** Bàn giao mã nguồn/quyền tài khoản, hướng dẫn vận hành và đào tạo; có backup, thử phục hồi trước bàn giao. Chốt thời gian lưu backup, mức mất dữ liệu/thời gian phục hồi chấp nhận được và kỳ bảo hành trong báo giá. Sửa lỗi đã ký tách khỏi công việc bổ sung.
- **Điểm cần thống nhất / trade-off:** Khách chủ động tiếp quản, cần một người phụ trách sau go-live. Giám sát định kỳ, SLA/ngoài giờ là phương thức vận hành phải bố trí riêng, không mặc định thuộc tháng phát triển. Một freelancer không tự cam kết trực 24/7 khi chưa có tổ chức hỗ trợ tương ứng.

### 17. Thống nhất đầu tư và thứ tự ưu tiên

- **Câu hỏi:** Mức dự kiến 30 triệu được dành cho phát triển hay gồm cả dịch vụ/media/bảo trì? Trong kết quả tháng đầu, những việc nào nhất định phải có để đội dự án sử dụng được?
- **Phương án đề xuất:** Báo một phạm vi go-live rõ ràng theo các câu trên; tách công phát triển, khối lượng nhập/sản xuất nội dung và phí vận hành. Đối chiếu phần đã làm/hợp đồng cũ trước khi gửi giá cuối cùng, không tự coi mức dự kiến là cam kết cho mọi yêu cầu.
- **Điểm cần thống nhất / trade-off:** Ưu tiên theo tác động tới vận hành và thời điểm cần sử dụng. Nếu có yêu cầu bắt buộc khác phạm vi đề xuất, trình phương án thay thế trong tháng hoặc điều chỉnh kế hoạch/chi phí để khách chủ động quyết định. Không cộng yêu cầu rồi mới báo phát sinh, không xem việc ghi nhận nhu cầu là đã nhận triển khai.

## Kế hoạch đề xuất trong khung 1 tháng

Đây là kế hoạch để chốt với khách, chưa phải lịch đã cam kết. Một tháng là thời gian triển khai dự kiến của một người, không tương đương 30 ngày công toàn thời gian. Ngày bắt đầu/kết thúc, đầu vào và thời gian khách duyệt cần ghi rõ khi xác nhận triển khai.

| Mốc | Kết quả cần đạt | Đầu vào/điều kiện |
| --- | --- | --- |
| Tuần 1 — Chốt và kiểm chứng | Khóa giao diện, dữ liệu/phạm vi/quyền, khối lượng nội dung; kiểm chứng một luồng đăng nhập → sửa/lưu → xuất bản trên hạ tầng dự kiến | Đầu mối duyệt, danh mục/bản vẽ/media đại diện, quyền dịch vụ thuộc khách. Không đợi tuần cuối mới phát hiện module demo chưa nối production |
| Tuần 2 — Hoàn chỉnh luồng nội dung | Website/trang căn/filter theo phạm vi đã ký; CMS lưu bền vững, liên kết media và quyền truy cập | Dữ liệu đã duyệt, schema và cách xuất bản đã kiểm chứng; không thêm model 3D hoặc workflow giao dịch mới |
| Tuần 3 — Dữ liệu thật và nghiệm thu thử | Nhập bộ nội dung đã khóa; kiểm tra upload/download, Lead, xuất bản, thiết bị mục tiêu; khách dùng staging và tổng hợp lỗi | Nội dung đủ quyền công bố, tiêu chí nghiệm thu và phản hồi theo mốc |
| Tuần 4 — Go-live và bàn giao | Sửa lỗi UAT, kiểm tra quyền/backup/restore/deploy, đào tạo và chuyển tài khoản | Khách xác nhận nội dung và luồng; giữ thời gian kiểm thử/bàn giao, không dùng tuần này để mở thêm tính năng |

**Cổng trước khi nhận giá/lịch cuối cùng:** phải đủ bằng chứng về module/hạ tầng có thể hoàn thành luồng thật trong kế hoạch. Nếu khối lượng dữ liệu hoặc phụ thuộc chưa đáp ứng, bên thực hiện trình lại phạm vi/mốc để khách duyệt **trước khi cam kết**, không dùng bảng kế hoạch như bằng chứng rằng mọi mục chắc chắn làm xong trong một tháng.

## Cách chốt với khách

- Ghi từng câu thành: **phù hợp đề xuất / cần điều chỉnh**, nội dung điều chỉnh, lý do sử dụng và người xác nhận. Không cần chọn toàn bộ tính năng; tập trung vào việc cần làm ngay khi mở website.
- Chốt phụ lục: số tầng/căn/tài khoản, bộ trường/filter, sơ đồ/3D, media/quota/khối lượng nhập, ngôn ngữ, cách duyệt/xuất bản, ngưỡng cập nhật, mốc cung cấp/duyệt, ngày bàn giao, vòng chỉnh, backup/restore và kỳ bảo hành. Không giữ số lượng trống trong báo giá đã ký.
- Ghi riêng phí dịch vụ tháng/năm, sản xuất nội dung, bảo trì và điều kiện thuế/hóa đơn. Chủ sở hữu/thanh toán tài khoản phải rõ trước khi mở dịch vụ trả phí.
- Với thay đổi sau duyệt: mô tả lợi ích và việc thay đổi, ảnh hưởng lịch/chi phí, xin xác nhận rồi triển khai. Đầu việc ngoài tháng này không được trình bày như phần bàn giao tháng đầu hoặc nghĩa vụ làm miễn phí sau đó.

**Mẫu chốt gửi khách:** “Em đề xuất tháng này hoàn chỉnh website và luồng cập nhật/tiếp nhận khách quan tâm để đội mình dùng được ngay. Mình thống nhất các điểm trên, khối lượng nội dung và mốc duyệt; em xác nhận phạm vi, giá và lịch bàn giao trước khi triển khai. Những nhu cầu vận hành khác em ghi nhận riêng để không ảnh hưởng mục tiêu ra mắt; nếu có việc bắt buộc ngay, em sẽ trình lại cách phân bổ công việc trước khi mình quyết định.”

## Nghiệm thu theo kết quả đã chốt

- Website đúng trang/nội dung được duyệt, tìm căn/liên hệ dùng được trên thiết bị đã thống nhất; 3D giữ đúng phạm vi minh họa và giới hạn camera, không nghiệm thu bằng yêu cầu render/định vị chính xác chưa ký.
- Người có quyền đăng nhập; dữ liệu tồn tại sau reload và tài khoản khác có quyền thấy được; tài khoản không có quyền bị từ chối ở backend, không chỉ bị ẩn menu.
- Ảnh/PDF đúng căn/tầng và chỉ công bố nội dung được duyệt; file private không bị đưa vào public. Quyền sử dụng tài sản do bên có trách nhiệm xác nhận trước xuất bản.
- Lead được lưu thật, chỉ người được phép xem/xử lý; kiểm tra chống spam và chính sách lưu/xóa. Email chỉ là tiêu chí nếu đã được xác nhận trong phạm vi.
- Xuất bản cập nhật website trong ngưỡng đã chốt, thất bại có cách xử lý; backup/restore và việc tiếp quản tài khoản được thử trên môi trường thật.
- Không dùng màn hình demo thay cho bằng chứng vận hành; không lấy việc có route hay static build làm chứng nhận auth/DB/CMS/Lead production.

## Cơ sở hiện trạng cho bên triển khai

- Website có homepage/menu 5 mục, các trang nội dung và khám phá 3D; TypeScript/static build và smoke local đã chạy. Chưa xác minh DB/auth/CMS/Lead/deploy production end-to-end.
- CMS demo có Tầng – Căn/Mặt bằng – Tenant – Media – Lead; tổng quan dùng cùng snapshot. Tenant hiện tổng hợp từ tên trên căn, chưa phải hồ sơ định danh pháp nhân/thương hiệu production.
- Media demo có liên kết dự án/tầng/căn gốc/nhóm căn, tham chiếu căn bằng ID ổn định `slot:<id>`; validation demo không thay quyền backend.
- Các màn hình doanh nghiệp, ghép/tách, lịch hẹn, yêu cầu thuê, giữ chỗ, hợp đồng và portal chỉ là cơ sở thảo luận, không mặc định có trong go-live.
- Demo vẫn là dữ liệu mẫu/lưu trong phiên; không nhập Lead hoặc tài liệu nhạy cảm thật. Public chỉ nhận nội dung được duyệt, không lộ thông tin liên hệ khách, hợp đồng hay ghi chú nội bộ. Upload cần kiểm soát ở backend.
- Homepage hiện dùng nội dung công khai/tài sản cùng site, không thu PII; chỉ tải runtime 3D khi vào trang khám phá. Thêm Lead production phải đánh giá lại bảo mật, không lấy kiểm tra homepage cũ làm bằng chứng.
- Phần cho thuê public đã thay 5 ô Canva bằng 81 ô có mã trong brochure trang 5–10; sơ đồ chọn ô/diện tích/kích thước có nguồn, chưa phải danh mục khả dụng đã duyệt. CMS demo vẫn có 66 căn mẫu, chưa được chuyển ID/ghép vào catalog brochure. Media, phương án đang sử dụng và geometry kỹ thuật cần khách/Kỹ thuật xác nhận.
- 3D giữ building hiện có, không sao chép building từ ảnh tham khảo; cảnh quan minh họa và tài sản phải giữ attribution/quyền sử dụng. Cập nhật sơ đồ public theo brochure không đồng nghĩa triển khai thêm nghiệp vụ thuê hoặc CMS production.
