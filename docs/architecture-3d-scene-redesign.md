# Architecture Decision — Le Grande Centre 3D production viewer

Ngày: 07/10/2026. Trạng thái: đã triển khai scene hybrid/GLB và kiểm chứng static export; cổng nghiệm thu production cần thiết bị thật, SLA và phê duyệt hình ảnh của chủ dự án.

## 1. Hiểu và phạm vi

Viewer giúp khách B2B khám phá kiến trúc, tầng và vị trí minh họa. Theo phản hồi mới: trang chủ mở bằng ảnh hoàng hôn khách cung cấp; bấm “Khám phá” vào `/kham-pha/` full viewport có nút “Thoát”. Camera xoay ngang360° và nhìn từ trên cao, chỉ chặn zoom quá xa; presets không giới hạn góc orbit. Cảnh đầy cây, xe, người chuyển động, tông hoàng hôn theo ảnh, nhưng building giữ kiến trúc hiện có.

Nguồn building được giữ trong [model.ts](../src/app/model-3d/model.ts), hình khối lõi ước lượng `112 × 26 × 24`, mặt tiền `+Z`. Đã xuất GLB derivative có version/hash; không có CAD hay `.blend` master. Bounds toàn asset kể cả mái/canopy/ban công là `113.15 × 27.95 × 36.76` theo X/Y/Z và đã so sánh bằng runtime với nguồn procedural. Đơn vị vẫn `estimated-model-units`, không diễn giải bevel thành cm hoặc kích thước khảo sát. Viewer chỉ load GLB, không dựng lại building procedural lúc chạy.

Anh xác nhận từ tư liệu dự án hiện có quan hệ tổng quát: **phía trước → sân rộng → đường/vòng xoay và tượng đài; phía sau → hồ**. Quan hệ này được xem là verified ở mức phương hướng. Kích thước, biên đất, cao độ, tọa độ, hình dạng bờ hồ/vòng xoay, cây và nhà lân cận vẫn là illustrative cho tới khi có mặt bằng hoặc khảo sát. Hai ảnh AI là tham chiếu mood/rendering, không là dữ liệu hình học của Le Grande Centre.

## 2. Quyết định kiến trúc

**Giữ Next.js static export và Three.js hiện có; dùng kiến trúc hybrid: GLB cho asset có hình học phức tạp, Three.js cho site procedural, ánh sáng, camera và tương tác.** GLB không thay hợp đồng scene, ID tầng/slot hay camera presets. Backend quản lý nội dung nghiệp vụ và xuất một public projection đã duyệt; viewer chỉ nhận phần được phép công khai. Asset 3D vẫn được tự host, cache CDN và không cần server render.

```text
Next.js static site
├── Three.js viewer
│   ├── Building source hiện tại / GLB derivative sau này
│   ├── Procedural forecourt, road, roundabout, lake và ground
│   ├── Lighting, camera presets, hotspot/slot anchors
│   └── Interaction và quality tiers
├── Self-hosted GLB / texture / environment
└── Public viewer projection (JSON, versioned)
    └── GET read-only từ backend/CDN; không chứa dữ liệu admin/private

Backend nghiệp vụ
├── Nguồn chuẩn: floor / slot / tenant / publication / revision
├── Admin API: xác thực, phân quyền, mutation, audit
└── Public projection: allowlist field được duyệt cho khách xem
```

Không chuyển sang React Three Fiber chỉ để thay framework. Cân nhắc lại khi nhu cầu component/state/lifecycle chứng minh Three.js hiện tại khó bảo trì; framework mới không tự nâng chất lượng hình.

## 3. Ranh giới hình học và dữ liệu

### Hybrid GLB + Three.js

| Asset hoặc chức năng | Nguồn đề xuất | Quy tắc |
| --- | --- | --- |
| Building/facade | Giữ nguồn procedural Three.js hiện có cho tới khi có hoặc tạo được master model được duyệt. Khi ổn định, có thể xuất `building.glb` như derivative có version. | Không lấy ảnh AI làm nguồn Blender. Không đổi tỷ lệ/nhịp cửa chưa được xác nhận. ID tầng, slot anchor và view IDs nằm trong scene manifest, tách khỏi tên mesh sau export. |
| Cây, xe, người, đèn, ghế/kiosk và props phức tạp | Asset GLB riêng, self-host, có nguồn/license/hash. Có thể nhóm theo loại để load theo view. | Không tải asset từ URL ngoài lúc chạy; dùng asset không logo/nhận dạng chưa được cấp quyền. |
| Ground, sân, đường, curb, vạch, vòng xoay, mặt nước, fog, sky, hotspot, floor highlight | Three.js geometry/shader/code hoặc tham số hóa trong scene manifest. | Giữ kích thước/tọa độ site có nhãn verified/illustrative; không để business config sửa hình học hoặc shader tùy ý. |
| Nội thất nhìn qua kính | Lớp hình học nhẹ trong viewer hoặc asset đã tối ưu. | Chỉ dùng silhouette, ánh sáng ấm kín đáo và phòng tối để gợi chiều sâu; không mô tả nội thất/tenant như hiện trạng đã xác nhận. |

Pipeline hiện tại là Three.js authoring → GLTFExporter → GLB content-addressed; nguồn có thể tái tạo bằng `npm run models:export`. Blender/CAD master vẫn là lựa chọn tương lai khi có tư liệu được duyệt. Không đóng toàn site vào GLB: building, cây, xe, người, đèn, ghế và tượng đài tách riêng; site/hồ/đường là procedural.

### Scene manifest

Một manifest versioned gắn asset, scene và backend với nhau:

```ts
type SceneManifest = {
  sceneId: string;
  sceneVersion: string;
  units: "estimated-model-units" | "meters";
  front: "+Z";
  assetManifestHash: string;
  cameraPresets: Array<{ id: string; position: [number, number, number]; target: [number, number, number]; fov: number }>;
  floors: Array<{ floorId: string; order: number; elevation: number }>;
  slots: Array<{ slotId: string; floorId: string; anchorId: string; outlineId: string }>;
  context: Array<{ id: string; confidence: "verified" | "illustrative"; source: string }>;
};
```

Manifest do build/asset pipeline tin cậy phát hành, không được backend trả transform hoặc material bất kỳ. Backend có thể bật/tắt một preset ID đã có trong manifest và trả field nghiệp vụ công khai theo ID ổn định; không thể yêu cầu camera ra khỏi bounds hoặc sinh hotspot tùy ý. Bản vẽ thực tế sau này sẽ thay geometry/anchor theo migration có version, không làm thay đổi identity slot.

## 4. Thứ tự nâng chất lượng hình ảnh

Thứ tự đầu tư chốt theo ưu tiên anh nêu: **façade → lighting → site → context → interaction → optimization**. Chất lượng façade là cổng trước khi mở rộng scene; giữ công trình đang có và chỉ sửa phần chưa đạt.

### Phase 1 — Cổng realism façade

Chụp lại các góc chuẩn hiện tại để review. Đánh giá riêng kính, lớp sau kính, cạnh và cấu tạo mặt tiền. Chỉ chỉnh đến khi đạt ngưỡng review chủ quan `≥7/10` theo rubric được thống nhất: (1) kính có phản xạ/tint/roughness theo góc, không thành mảng đen hoặc gương phẳng; (2) có lớp phòng/sàn phía sau kính để tạo chiều sâu; (3) mặt trắng giữ chuyển sắc và không cháy; (4) bevel/reveal bắt highlight tự nhiên; (5) chi tiết hiện có vẫn đúng nhịp và không bị sửa kiến trúc bằng suy đoán.

Fake interior chỉ cần phòng tối, emissive ấm tiết chế và vài silhouette bàn/ghế nơi có bằng chứng phù hợp; tránh dựng toàn bộ nội thất nếu không có nguồn. Bevel vật lý `2–5 cm` chỉ là khoảng thử **sau xác định scale mét**. Không blanket-bevel mọi cạnh; profile/weighted normals chỉ dùng ở hard-surface mesh phù hợp và kiểm tra artifact sau merge/export.

### Phase 2 — Golden sunset và chiều sâu ánh sáng

Phản hồi mới thay mặc định daylight bằng **Golden Hour / Evening**: sky navy/amber, ánh sáng ấm, đường tối có phản xạ, cảnh quan giàu lớp. Daylight vẫn là lựa chọn xem chi tiết. Cân bằng sky/sun/IBL, shadow và AO; không dùng AO để che sai vật liệu.

Ánh sáng và chuyển động là minh họa, không khẳng định trạng thái hoạt động thực tế. Building không lấy hình học/façade từ ảnh tham khảo.

### Phase 3 — Site geometry và vật liệu nền

Tạo mặt đất có ranh/chuyển tiếp nhìn thấy được, không là một tấm màu lớn. Dựng sân trước rộng, curb/vỉa hè/lát nền, đường, nút vòng xoay và tượng đài phía trước; hồ nước ở phía sau. Tách mặt nước, bờ, cây và đường thành nhóm để camera đọc rõ độ gần/xa. Nước dùng shader/reflection nhẹ có kiểm soát; không hiệu ứng game hoặc gợn sóng mạnh. Material đường, đá lát, bê tông và đất có roughness/normal đúng tỷ lệ, variation tiết chế.

Định vị trước/sau là verified theo xác nhận của anh. Biên site, số lane, đường kính vòng xoay, hình dáng/kích thước tượng đài và hồ, bờ kè, vỉa hè, cao độ vẫn illustrative nếu thiếu site plan.

### Phase 4 — Urban context

- **Foreground:** tòa nhà, sân/vỉa hè, đường/vòng xoay; chi tiết cao nhất. Dùng cây, xe và một ít người để truyền tỷ lệ nhưng không che cửa vào/mặt tiền.
- **Midground:** hồ, cây, khối nhà thấp/trung tầng, đèn đường; nhịp khối và khoảng lùi không lặp đều như blockout.
- **Background:** tree line, skyline thấp, fog và sky; mesh/texture đơn giản, giảm contrast theo khoảng cách. Chỉ dựng nhà/cảnh lân cận theo tư liệu hoặc giữ thành silhouette illustrative.

Tán cây tham khảo ảnh 1 về silhouette, bóng và cách đóng khung. Ảnh 2 dùng cho cảm giác chiều sâu/ánh sáng đô thị, không sao chép tháp, skyline, mặt hồ hay hình khối tòa nhà. Tránh biển tên tenant, biển đường cụ thể và phương tiện có logo chưa được xác nhận.

## 5. Camera và interaction

### Camera UX

Orbit ngang360° không giới hạn azimuth, polar cho phép gần thẳng từ trên cao nhưng không xuống dưới ground; pan tắt. Presets chỉ là điểm khởi đầu/reset, không phải hành lang quay hẹp.

| Preset | Mục tiêu |
| --- | --- |
| `front` | Góc mặt tiền và sân trước. |
| `aerial` | Góc khởi đầu: tòa nhà, vòng xoay/tượng đài và quan hệ tổng thể site. |
| `rearLake` | Mặt sau và hồ. |
| `side` | Đọc chiều dài và nhịp mặt bên. |
| `rooftop` | Chỉ bật khi mái có hình học được duyệt và góc nhìn hữu ích. |

FOV kiến trúc34°. Fit bounds tại preset/reset/resize, không ép fit lại khi kéo hoặc zoom. Cho zoom gần để quan sát; cap zoom xa theo viewport để không thu công trình thành chấm nhỏ. Không dùng minDistance=fit hay azimuth/polar±biên của preset nữa. Trên mobile giữ đủ không gian tương tác, controls luôn có nút thoát và reset.

### Interaction

```text
Overview → chọn tầng → camera focus tầng → highlight
         → chọn slot → thông tin public đã duyệt → gửi yêu cầu / liên hệ
```

- Tầng tiếp tục chọn bằng button/hotspot và có panel thông tin HTML accessible.
- Slot hover highlight trên desktop; click/tap chọn. Keyboard có đường chọn tương đương, không phụ thuộc hover/canvas.
- Floor/slot focus dùng scene anchors ổn định, không dựa trên tên mesh do Blender export.
- View buttons chuyển `front`, `aerial`, `rearLake`, `side`; `rooftop` là tuỳ chọn.
- Không thêm FPS/WASD. Khi WebGL không dùng được, giữ poster/ảnh, floor selector và CTA liên hệ hoạt động.
- Slot selection không tạo reservation, không đảm bảo availability. Backend phải kiểm tra trạng thái/khả dụng lại ở luồng yêu cầu nghiệp vụ.

## 6. Backend configuration và quyền

Tách cấu hình làm hai nguồn, không đưa database schema hoặc admin DTO trực tiếp vào viewer:

1. **Scene manifest tĩnh, theo version** — tọa độ model, asset, camera preset, floor/slot anchor, revision và độ tin cậy. Đóng cùng asset hoặc tải từ static CDN. Thay khi thay scene/build.
2. **Public viewer projection** — floor label, slot ID, public area/tenant info, public availability nếu đã duyệt, `publicationRevision`, `updatedAt` và danh sách preset IDs cho phép. Dữ liệu do backend chiếu theo allowlist từ publication đã duyệt; chỉ read-only với viewer.

Next.js đang `output: "export"`, GitHub Pages không cung cấp request-time API/auth. Vì vậy cấu hình business động cần endpoint riêng HTTPS hoặc public JSON được publish lên CDN từ backend; đây không cần server render. Không nhúng credentials/API secret vào bundle. Nếu public API lỗi hoặc projection quá cũ, vẫn cho xem 3D nhưng ẩn availability/tenant claims cũ, hiển thị trạng thái không khả dụng hoặc thời điểm cập nhật. Chốt freshness SLA trước production. Lệnh gửi yêu cầu phải xác nhận lại với API có thẩm quyền.

Contract đầu vào nên version hóa và validate runtime: IDs phải tồn tại trong manifest, floor/slot relation hợp lệ, preset nằm trong allowlist, text/URL được giới hạn, scene revision tương thích. `sceneVersion` mismatch thì tắt chọn slot với thông báo có thể xem công trình; không gán dữ liệu sai anchor. Public projection không có PII, deal rent, hold deadline, internal note, quyền admin, object key hay tài liệu hợp đồng. Tên/logo tenant chỉ hiển thị khi đã duyệt; URL asset nếu có phải trỏ đến asset self-hosted trong manifest allowlist. Endpoint public chỉ đọc, không gửi credentials, cache theo revision và CORS allowlist đúng origin của website. Endpoint admin riêng xác thực session, phân quyền từng hành động, kiểm tra CSRF/CORS/Origin theo topology và ghi audit; không dùng viewer public để mutate inventory.

## 7. Asset optimization và quality tiers

- GLB 2.0 là format trao đổi/phân phối. Dùng `EXT_meshopt_compression` cho geometry khi đo được giảm tải; KTX2/Basis cho texture phù hợp GPU. Không nén cùng geometry bằng cả Draco và Meshopt nếu không có use case đo được.
- Tự host decoder/transcoder đúng phiên bản với Three.js, kiểm tra asset tại build time, theo dõi bytes truyền và thời gian decode. Tài liệu Three.js `GLTFLoader` xác nhận loader cần được cấu hình với `MeshoptDecoder` và `KTX2Loader` tương ứng; KTX2 cần kiểm tra khả năng renderer trước load.
- Cây/xe/vật dụng lặp dùng `InstancedMesh` khi geometry/material tương thích; xa camera giảm LOD hoặc chuyển billboard/cluster. Không buộc mọi asset thành một GLB, và không tạo instance nếu asset có animation/material phải tách.
- Quality tiers: **HIGH** desktop mạnh; **MEDIUM** laptop/mobile mới; **LOW** mobile yếu. LOW giảm DPR, shadow resolution, mật độ cây/người, post-processing và far-context trước khi hạ chi tiết building, slot, floor interaction hoặc camera.
- Người và xe có chuyển động theo tuyến được yêu cầu; animate khi viewer hiển thị và người dùng cho phép. Dừng khi pause, reduced-motion, hidden tab, context loss hoặc thoát. Khi dừng chuyển động, chỉ render theo tương tác. Dispose GLB/texture/material/skeleton/PMREM theo vòng đời viewer.

Chưa đặt con số FPS, bytes hay VRAM khi chưa profile scene đầy đủ và chưa thống nhất nhóm điện thoại/network mục tiêu. Phase 6 cần ghi baseline desktop/mobile thực tế trước; chủ sở hữu sản phẩm chốt ngưỡng sau số đo.

## 8. Security, nội dung và trade-off

**Threat model:** asset malformed/độc hại tiêu tốn decoder hoặc GPU; lộ bản vẽ/tài liệu private trong bundle; license/nhãn hiệu asset không rõ; payload backend vượt quyền làm lộ tenant/availability; cảnh minh họa bị hiểu nhầm là cam kết khảo sát.

**Controls:** chỉ nhận/publish asset có nguồn, license, checksum và giới hạn bytes/texture/mesh; allowlist định dạng, loại URI ngoài và metadata nhạy cảm; decoder/transcoder tự host; public API trả projection tối thiểu, freshness/revision rõ; dữ liệu admin private ở endpoint khác; chú thích gần viewer: “Vị trí tổng quát theo tư liệu dự án; kích thước và cảnh nền xung quanh là minh họa.”

| Lựa chọn | Lợi ích | Trade-off |
| --- | --- | --- |
| Three.js hiện tại + asset GLB theo nhóm | Giữ viewer, tương tác và deploy tĩnh; dễ thay cây/xe/props độc lập. | Cần manifest và asset pipeline có version/provenance. |
| Building procedural làm nguồn hiện tại | Không phụ thuộc file master chưa có; bắt đầu từ model sẵn có. | Chỉnh hình học lớn khó author hơn Blender/CAD; cần định nghĩa migration khi có source chính thức. |
| Static frontend + public API/projection riêng | Không cần SSR/render server; frontend/CDN scale độc lập backend. | Dữ liệu live cần cache/freshness/fallback; API production chưa phải capability của trang Pages. |
| Raster WebGL + AO/IBL | Tương tác nhanh hơn path tracing trên đa số thiết bị; thích hợp viewer. | Ánh sáng không đạt path-traced offline; cần profile pass/shadow/texture trên mobile. |

## 9. Lộ trình triển khai

| Phase | Phạm vi | Cổng hoàn thành |
| --- | --- | --- |
| 0 — Nguồn thật và baseline | Khóa camera screenshot, mapping phía trước/sau, danh sách verified/illustrative, floor/slot IDs hiện có và thiết bị mục tiêu. | Không dùng kích thước ảnh AI làm geometry; chốt đơn vị/tỷ lệ hoặc tiếp tục đánh dấu model units. |
| 1 — Building realism | Review kính, fake interior, reveal/bevel, PBR façade; chỉ chỉnh phần thiếu. | Review rubric façade đạt `≥7/10` ở góc front/side; không sai nhịp/hình khối. |
| 2 — Lighting | Golden sunset mặc định theo phản hồi mới; daylight tùy chọn. | Giữ chuyển sắc building, sky navy/amber, phản xạ và ánh sáng bám cảnh. |
| 3 — Site | Sân trước, curb/vỉa hè, đường, vòng xoay/tượng đài; hồ sau; map vật liệu và chuyển tiếp ground. | Bốn hướng không lộ mép ground; quan hệ hướng đúng; phần kích thước chưa khảo sát được đánh dấu illustrative. |
| 4 — Context | GLB có license cây/xe/người/props, nhà nền, mật độ cảnh quan và chuyển động theo tuyến. | Không che lối vào; provenance rõ; pause/reduced-motion/lifecycle đúng. |
| 5 — Camera và interaction | Ảnh → fullscreen3D → thoát; xoay360°/overhead, cap zoom xa, presets và floor/slot HTML. | Camera không bị khóa hành lang; vào/thoát không giữ WebGL thừa; IDs khớp manifest/projection. |
| 6 — Optimization | Meshopt/KTX2 theo profiling, instancing, quality tiers, cache/prefetch asset theo view. | Ghi kích thước tải, decode, FPS, VRAM và WebGL failures trên thiết bị thật; chốt ngưỡng trước production. |
| 7 — QA/security production | Rà desktop/mobile, API failure/stale/mismatch, license/security scan và public data allowlist. | Không có secret/private data; fallback hoạt động; availability không được trình bày như cam kết; không lỗi load/interaction. |

### Ưu tiên tổng thể

**Façade realism → Lighting → Site → Context → Interaction → Optimization.** Contract IDs, security boundary và nguồn dữ liệu cần chốt ở Phase 0 để không làm lại scene; việc triển khai UI/slot/live BE đến Phase 5–7 khi geometry và public projection sẵn sàng.

## Tài liệu kỹ thuật liên quan

- [Architecture Decision — renderer/material pass trước](architecture-3d-visual-quality.md)
- [Nghiên cứu rendering và trade-off AO/path tracing](3d-rendering-research.md)
- [Hồ sơ license HDRI hiện tại](../public/model-3d/ASSET-LICENSE.md)
- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) — GLTF, Meshopt, KTX2 và các extension được hỗ trợ.
- [Three.js OrbitControls](https://threejs.org/docs/pages/OrbitControls.html) — giới hạn zoom, polar và azimuth.
- [Next.js static export](https://nextjs.org/docs/app/guides/static-exports) — nguồn tham khảo cho ranh giới export; config hiện tại là `output: "export"`.

## 10. Baseline lần triển khai trước — không phải số đo bản redesign mới

### Phạm vi đã triển khai

- GLB trước khi cutover viewer: 7 asset tự author, nguồn/license/SHA-256/bytes trong `public/model-3d/asset-manifest.json`; building giữ toàn nhịp hình học cũ. Ảnh khách gửi chỉ tham chiếu đá ấm, đường charcoal, olive planting, cột/tượng đài và mood cảnh quan; không sao chép building.
- `model.ts` là nguồn authoring; `assets.ts` tải theo allowlist/checksum/giới hạn bytes và dispose geometry/material/texture/ImageBitmap/instance buffers. `runtime.ts` quản lý camera/render/lifecycle; `site.ts` giữ nhóm ground/forecourt/road/roundabout/lake/banks/context.
- Façade: kính physical dielectric, tint/Fresnel/transmission/normal; lớp sàn/cột/phòng lõm phía sau; mineral normal/roughness GLB-compatible; reveal/rounded edges hiện có giữ nguyên model units. Không thêm tenant hay nội thất giả hoạt động toàn tầng. Review nội bộ front/side đã thấy chuyển sắc trắng, phản xạ kính và chiều sâu; điểm `≥7/10` của chủ dự án vẫn cần duyệt, không coi tự chấm là nghiệm thu.
- Daylight warm afternoon mặc định: HDR CC0 tự host, PMREM, sun/fill, contact GTAO không phủ kính, shadow tĩnh. Evening có sky/sun ấm và lantern emissive; không có idle animation hoặc giả đèn nội thất toàn tầng.
- Sân trước rộng và arrival route không trồng cây chắn cửa; curb, paving joints, texture normal/roughness, đường có biên/vạch/crosswalk, vòng xoay bậc đá/cây bụi và monument GLB; hồ sau có bờ không đều, normal/roughness/reflection tĩnh. Không có cạnh tấm ground trong các góc đã kiểm tra.
- Context: cây/xe/người/đèn/ghế instanced theo material; cây bụi vòng xoay và grove không đều; silhouette nhà ngoài hồ, LOD/fog. Không mô tả skyline/cây/biên đất là surveyed.
- Bốn preset `front/aerial/rearLake/side`, FOV34, pan tắt, azimuth/polar/zoom giới hạn, fit theo bounds/aspect và reset. Roof service geometry không đủ căn cứ bật visitor rooftop preset.
- Floor IDs `T1–T6`; 66 slot IDs `T#-B1…B11`, anchors/outline IDs ổn định và schematic illustrative. Chọn tầng focus/highlight; raycast hover/click/tap và HTML keyboard selection; email mang floor/slot, không tạo reservation. Preset allowlist được thực thi cả khi chọn tầng.
- Public projection JSON tự host read-only, không import admin snapshot: schema/scene/IDs/relation/preset/text/date được validate, field private loại bỏ, claim chỉ nhận nếu publisher duyệt riêng. Giới hạn payload 64KiB, freshness bảo thủ 24h, clock skew 5 phút. Bản hiện có chỉ brochure/slot minh họa, không area/tenant/availability. Không tự cập nhật timestamp; hết hạn ẩn slot/claims, vẫn xem building/tầng/CTA.
- HIGH/MEDIUM/LOW có auto heuristic và UI override. LOW không tạo GTAO, giảm DPR/MSAA/shadow/density/context trước building. Static asset cache theo URL hash; publication revalidate. Chưa thêm Meshopt/KTX2 vì cần so sánh tải/decode trên thiết bị mục tiêu, không thêm decoder vô điều kiện.

### Các kiểm chứng đã chạy

`npm run check:scene-assets`, `npm run test:scene` (6 behavior/security tests), `npx tsc --noEmit`, `npm run build` đều pass. Build static được mở trực tiếp qua Vite preview `/le-grande-center/`, không phụ thuộc Next dev server. Artifact public loại admin mặc định.

Chromium desktop 1440×1000 và viewport mobile 390×844: bốn preset fit toàn bounds, camera trên ground; floor/slot click, keyboard Enter, raycast click canvas, quality change giữ selection; không horizontal overflow. Idle window quan sát 800ms: 0 render mới. Axe-core viewer: 0 violations, 1 incomplete cần manual review. Detector thiết kế chỉ advisory palette/type; identity HTML cũ được giữ, màu site theo ảnh tham chiếu.

Fault injection đã chạy: publication 503/stale/scene mismatch → không slot/claim cũ, vẫn chọn tầng và xem 3D; building GLB503 → poster/tầng/CTA; tree GLB503 → cảnh báo, building vẫn xem được; WebGL unavailable → poster/HTML selection/CTA; `WEBGL_lose_context` loss → poster, restore → controls hoạt động lại. Public asset scan không gặp key/connection string/field private trong tập đã quét; không coi regex scan thay security audit toàn hệ thống.

### Baseline đo tại workstation, không phải chứng nhận điện thoại

GLB tổng **3,675,264 bytes**, building **3,220,176 bytes**, context **455,088 bytes**, HDR **1,173,154 bytes**; GLB+HDR **4,848,418 bytes** chưa gồm JS/font/poster/publication. Building 12 material meshes, normal maps nhúng; texture tối đa1024. Hash và external URI/resource limits được check trước build và checksum trước parse.

| Tier · desktop emulation | Median CPU submit/render ms (5 resets) | Calls | Triangles (mọi pass) | GLB decode tổng ms | Texture objects |
| --- | ---: | ---: | ---: | ---: | ---: |
| HIGH | 1.0 | 114 | 1,728,743 | 12.4 | 29 |
| MEDIUM | 0.9 | 114 | 1,180,471 | 12.4 | 29 |
| LOW | 0.8 | 99 | 655,108 | 9.6 | 23 |

Mobile viewport390/MEDIUM: một frame submit7.3ms, tổng GLB decode11.2ms; không suy diễn số đo này thành GPU frame time. Orbit smoke ghi71 rAF samples/881.5ms (~80.5Hz browser cadence), **không phải FPS của điện thoại hoặc GPU**. Scene demand-render nên FPS lúc idle không phải mục tiêu. Browser WebGL không cung cấp VRAM resident đáng tin cậy; chưa ghi VRAM giả. Shader compile/shadow update frame đầu khác steady-state.

### Cổng production chưa thể đóng bằng công cụ hiện có

Chưa có điện thoại vật lý/GPU profiler, nhóm network mục tiêu, ngưỡng FPS/bytes/VRAM hoặc SLA được chủ dự án chốt; chưa có xác nhận rubric façade và site plan surveyed. Không tuyên bố Phase6/7 nghiệm thu production hoàn tất. Cần chạy cùng static export trên thiết bị thật, ghi painted FPS/GPU time/VRAM/context failures, chủ dự án duyệt góc front/side và chốt freshness/threshold. Backend live/admin/auth/mutation không được triển khai thêm: plan cho phép publication JSON tĩnh, chưa có dữ liệu công khai live được duyệt hay endpoint production để kết nối. CDN immutable/cache/CORS thực tế cần cấu hình trên host khi deploy; phiên này không deploy.

## 11. Redesign theo phản hồi — 08/10/2026

- Trang chủ dùng chính ảnh khách cung cấp (`explore-cover.webp`,321,578bytes); không có canvas/GLB requests trước khi bấm “Khám phá”. Route `/kham-pha/` phủ viewport, có “Thoát”, panel tầng/slot đóng được và thao tác bàn phím tương đương.
- Palette public đổi sang slate/charcoal/amber/limestone; ảnh cover được ghi rõ là ý tưởng. Building vẫn SHA-256 `578abef2f86d3bac7093bf03e48fd7c4a590d1d6c6ee958d5ebc6bfc33ea6650`, không thay bằng building trong ảnh.
- Asset tải thật: Poly Haven Island Tree02+Shrub02 (CC0), Khronos CarConcept và CesiumMan với skin/walkingclip (CC-BY4). Nguồn tải được pin URL/hash, license/tác giả/thay đổi ghi trong `ASSET-LICENSE.md` và có link ở panel. Tổng7GLB **8,695,060bytes**, không dùng decoder mới.
- Sửa lỗi cây trơ do simplifier xóa leaf islands: giữ các lá nguyên được lấy mẫu phân bố, bù diện tích tán và giảm từng lá. Bồn cây được đặt theo cao độ mặt bồn; background masses lùi xa/giảm chiều cao.
- Golden horizon hướng về camera mở đầu; sky/IBL/fog/sun đồng bộ màu ấm. Lake/road phản xạ, lamps có light pools. Đây là scene real-time minh họa, không phải bản render ảnh path-traced hay xác nhận thiết kế cảnh quan.
- Camera ngang không giới hạn azimuth, polar gần thẳng từ trên cao; zoom gần không bị ép fit. Preset/reset/resize fit một lần; cap khoảng cách xa còn65% cap cũ, không thấp hơn khoảng fit ban đầu. Đã drag qua phía sau (azimuth.495→−2.533), overhead polar.008 và zoom gần; portrait bounds nằm trong frame sau sửaFOV.
- Xe chạy hai làn vòng qua đảo; người có animation khớp chân và tuyến đi bộ riêng. Medium quan sát11xe/12người, tọa độ cả hai thay đổi qua600ms. Pause/reduced-motion/contextloss/thoát dừng RAF; restore chạy lại. Hidden-tab guard được kiểm bằng visibilitychange mô phỏng vì browser automation không phát document.hidden khi đổi tab.
- Kiểm chứng1440×960 và390×844: canvas fullviewport, không overflow, toolbar không đè nút motion; ảnh→3D→Thoát trả canvas về0. Floor3/slotT3-B2 mở mailto đúngID khi publication còn mới; Escape đóng panel. Khi WebGL unavailable vẫn chọn tầng4 và thoát/xemphim được.
- Axe-core public:0violations,2incomplete cần manual review. Build/static route, TypeScript,6 projection behavior tests và asset checksum/rig/license gates pass. Không nâng timestamp publication để giấu expiry; sau24h panel ẩn claims/slots như contract.
- Medium desktop quan sát228calls và7,137,443triangles tổng mọi pass ở frame cập nhật shadow. Không suy ra paintedFPS/VRAM/điện thoại thật từ số này. Các cổng production ở mục10 vẫn giữ nguyên.

## 12. Xóa dấu hiệu nhãn hiệu khỏi asset — 08/10/2026

- Khronos ghi rõ CesiumMan source texture chứa trademark và license model loại trừ logo/trademark. GLB phân phối bỏ hoàn toàn diffuse texture, thay bằng material slate tự tạo; rig + walking clip vẫn giữ. Gate xác nhận pedestrian GLB có 0 image/texture và còn skeleton/57 animation tracks. CC BY attribution vẫn giữ; không tuyên bố liên kết/endorsement Cesium.
- Khronos CarConcept README xác nhận source có Khronos logos. Export bỏ mesh license plate, steering emblem/logo/badge theo tên node, bỏ material đánh dấu license/logo; gate xác nhận node/material xuất không còn các nhãn này. Ảnh/render và mesh-name gate chỉ là kiểm tra có phạm vi, không phải pháp lý xác nhận tuyệt đối.
- Tất cả asset khác trong manifest rà theo nguồn khai báo: cây/shrub Poly Haven CC0; building/đèn/ghế/monument do project authorship; cover là ảnh khách cung cấp chưa xác minh quyền phân phối. Không tìm thấy nhãn hiệu được mô tả trong các asset này; không bảo đảm không có quyền thương hiệu/nhân thân/quyền ảnh ẩn. Mục `ASSET-LICENSE.md` nêu rõ các giới hạn và phải giữ attribution CC-BY khi phát hành.

## 13. Giảm giới hạn zoom xa — 08/10/2026

- `maxDistance` giảm còn65% cap cũ (`max(280, distanceToFit × 1.15) × .65`) và không thấp hơn `distanceToFit` để khung mở đầu luôn trọn vẹn. Với góc mặc định cap mới trùng khoảng fit, không còn zoom lùi xa; zoom gần, xoay ngang 360° và nhìn từ trên cao vẫn hoạt động.

## 14. Lấp đầy hậu cảnh nhẹ — 08/10/2026

- Thay vòng26/18/10 block thưa bằng các cụm nhà/cây procedural quanh360°, giữ trống khu project, mặt hồ và hành lang đường. Không clone GLB building chính và không tăng mật độ cây GLB nhiều polygon ở xa. Nhà nền biến thiên footprint/chiều cao/màu; mái tối, cửa sổ128px và emissive ấm giảm về0 khi chọn daylight.
- Toàn bộ hậu cảnh dùng5 `InstancedMesh`: thân nhà, mái, sân, thân cây, tán cây. Shared geometry/material; không cast/receive shadow, không alpha transparency; geometry cây thấp36triangle mỗi lobe. Không thêm GLB/download/decoder. Tán cây và các mesh có role context, không vào structural AO.

| Tier | Nhà phụ | Cây nền | Triangle geometry hậu cảnh (một pass) |
|---|---:|---:|---:|
| HIGH | 794 | 2250 | 325584 |
| MEDIUM | 470 | 1342 | 194064 |
| LOW | 336 | 918 | 133272 |

- Smoke tạo/dispose scene cả3tier xác nhận5batch và shadow off. Browser desktop1440×960 MEDIUM:231calls /7,523,408triangles tổng các pass ở frame cập nhật shadow; không phải chi phí riêng5batch. Low viewport390×844:150calls /2,878,918triangles; không overflow. Front/rear screenshots thấy đô thị che phần ground/horizon trống; orbit azimuth−3.17, khoảng camera193.395 vẫn dưới cap. Exit cả2viewport trả về home. Những số này không chứng minh paintedFPS/VRAM hay GPU điện thoại thật. Cổngproduction mục10 vẫn giữ nguyên.
