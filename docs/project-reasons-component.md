# Architecture Decision — Section Lý Do Lựa Chọn để dùng sau

## Hiểu

Lấy section `#amenities` của https://legrandecentre.vn/ để lưu sẵn, chưa yêu cầu đưa vào trang hiện tại. Giữ nguyên tên, mô tả, 6 lý do và CTA từ nguồn.

## Thiết kế

- `project-reasons-model.ts`: contract readonly của nội dung và enum icon.
- `legacy-content.ts`: `LEGACY_PROJECT_REASONS`, copy từ nguồn được cung cấp.
- `project-reasons.tsx`: `ProjectReasons` nhận content qua props; layout 3/2/1 cột, SVG native, màu xanh/vàng, số 01–06 và CTA theo web cũ.
- `project-reasons.module.css`: scope riêng, có responsive/reduced motion. Component hiển thị được ngay; không cần script reveal để mở nội dung.
- HTML/CSS gốc giữ tại `docs/design-evidence/legacy/` để đối chiếu. Không import stylesheet toàn trang của web cũ vào app.

Lý do: giữ nội dung và trình bày độc lập, thuận tiện ghép vào nhiều trang; phần mang nội dung/route Le Grande nằm ở feature ứng dụng theo README. Trade-off: native reconstruction từ HTML/CSS công khai, không phải source React/Git của website cũ. Không thêm route hay mount section ngoài scope.

## Validate security

React render text và SVG cố định; không dùng raw HTML/script nguồn. CTA dùng route nội bộ có trong ứng dụng. Copy quảng bá giữ nguyên theo yêu cầu lưu nguồn, chưa xuất bản trên các trang hiện tại. Không truy cập dữ liệu quản trị hoặc thêm backend.

## Đề xuất và sử dụng

Khi muốn dùng, chọn vị trí trong composition của trang:

```tsx
import { ProjectReasons } from "@/features/public/project-reasons";
import { LEGACY_PROJECT_REASONS } from "@/features/public/legacy-content";

<ProjectReasons content={LEGACY_PROJECT_REASONS} />
```

Nếu ghép nhiều instance trên cùng trang, truyền `id` khác nhau. CTA có thể bỏ qua bằng cách cung cấp content không có `cta`. Khi nối CMS, adapter ánh xạ bản nội dung công khai vào contract này, không thêm fetch vào renderer.

Kiểm tra: `tsc --noEmit` đạt; không chạy test suite. Section đang lưu sẵn nên chưa có visual verification trong một trang được mount.
