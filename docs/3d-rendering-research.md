# Nghiên cứu kiến trúc render 3D cho B2B

Ngày đối chiếu: 2026-10-07. Trạng thái: đã nghiên cứu API và mã nguồn; đây là đề xuất kiến trúc, chưa xác nhận chất lượng hay hiệu năng bằng một triển khai browser.

## 1. Hiểu hiện trạng và nguồn sự thật

Repo đang dùng `three@0.186.1`, `@types/three@0.186.0`, `WebGLRenderer`; các addon được xuất qua `three/addons/*` trong package đang cài. Nguồn: [package.json](../package.json), `node_modules/three/package.json`.

[viewer.tsx](../src/app/model-3d/viewer.tsx), tại snapshot baseline trước cải tiến, có Sky → PMREM, environment intensity `.08`, hemisphere `.6`, directional `2.2`, ACES exposure `.85`, shadow 2048² phủ 240×220 đơn vị, normalBias `.08`; chỉ render khi camera/control/trạng thái thay đổi.

[model.ts](../src/app/model-3d/model.ts) dựng hình procedural, ghép mesh theo vật liệu; lõi đặc nằm sát sau kính, transmission `.06`/`.28`, dùng chung bản đồ hạt cho bump/roughness. Đây là biểu diễn tỷ lệ ước tính, chưa phải dữ liệu khảo sát.

Nguồn authoring hiện có là mô hình procedural và media trong repo. Không có CAD, GLB, Blender master hay bộ PBR/HDR gốc. Hướng cải tiến phải hoạt động từ những nguồn này; ảnh render đẹp hơn không xác nhận diện tích, hướng hay kết cấu thực tế.

Ràng buộc đối chiếu media do người điều phối xác nhận: giữ sắc kính charcoal navy ở tầng trên và hình khối quan sát được; tăng phản xạ theo góc nhìn không đồng nghĩa đổi toàn bộ mặt đứng thành kính trong.

## 2. Thiết kế và bằng chứng tương thích

### Quyết định A — duy trì nguồn procedural, nâng baseline WebGL

Chọn một nguồn hình học/vật liệu có phiên bản; viewer tương tác và đầu ra offline cùng dẫn xuất từ nguồn đó. Giữ metadata về giả định, ID tầng/nhóm và vật liệu trước bước ghép mesh; tối ưu draw call không được làm mất khả năng chọn tầng hay kiểm tra nguồn hình khối. Đây là đề xuất của dự án.

`EffectComposer` và các pass dưới đây nằm trong package Three.js hiện có, tương thích `WebGLRenderer`; composer này không phải pipeline dùng trực tiếp với `WebGPURenderer`. [EffectComposer](https://threejs.org/docs/pages/EffectComposer.html)

| Chất lượng cần đạt | Pipeline đề xuất | Giới hạn |
| --- | --- | --- |
| Baseline tương tác | `renderer.render` + native antialias + Sky/PMREM | Ít render target; không có AO theo màn hình |
| Cạnh nét với compositor | `RenderPass → SMAAPass → OutputPass` | SMAA xử lý Linear-sRGB; texture tra cứu tải bất đồng bộ |
| Compositor nhẹ hơn | `RenderPass → OutputPass → FXAAPass` | FXAA cần sRGB, có thể làm mềm chi tiết nhỏ |
| Thêm độ sâu tiếp xúc | Chèn `GTAOPass` trước AA/output | Chỉ bật khi kính và ngân sách GPU được xử lý phù hợp |

Thứ tự trên đã đối chiếu với 0.186.1: SMAA phải **trước** OutputPass; FXAA phải **sau** OutputPass. `FXAAPass` có sẵn và tự cập nhật inverse resolution khi `setSize`. [SMAAPass](https://threejs.org/docs/pages/SMAAPass.html), [OutputPass](https://threejs.org/docs/pages/OutputPass.html), [FXAAPass](https://threejs.org/docs/pages/FXAAPass.html)

`OutputPass` lấy tone mapping/exposure và output color space từ renderer. Giữ một lần chuyển Linear-sRGB → sRGB; không bổ sung gamma correction lần hai. Map màu dùng sRGB, roughness/normal/bump là dữ liệu không màu; HDR/EXR dùng Linear-sRGB. [Color Management](https://threejs.org/manual/pages/color-management.html)

`antialias: true` của canvas không tự cấp MSAA cho render target của composer. Composer 0.186.1 tạo buffer HalfFloat không cấu hình samples; render target mặc định `samples = 0`. Nếu dùng MSAA, cấu hình render target theo khả năng GPU và chi phí bộ nhớ thay vì xếp nhiều AA đồng thời. [RenderTarget](https://threejs.org/docs/pages/RenderTarget.html), [mã EffectComposer](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/postprocessing/EffectComposer.js)

Demand rendering phải invalidate khi resize/DPR/camera/vật liệu/asset thay đổi. Nếu chọn SMAA, phải render lại sau khi texture tra cứu sẵn sàng; mã hiện có chỉ đánh dấu `needsUpdate` khi image load. Composer, các pass, PMREM output, texture và shadow có vòng đời dispose riêng. [EffectComposer](https://threejs.org/docs/pages/EffectComposer.html), [mã SMAAPass](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/postprocessing/SMAAPass.js)

### AO và shadow phải phân biệt kính với kết cấu đặc

GTAO có chi phí cao hơn SSAO. Mã 0.186.1 dựng normal/depth bằng `MeshNormalMaterial`, chỉ tự ẩn point/line; mesh có transmission hoặc transparent không tự được loại ra. Không áp AO đại trà rồi dùng độ sáng để che sai lệch. [GTAOPass](https://threejs.org/docs/pages/GTAOPass.html), [mã GTAOPass](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/postprocessing/GTAOPass.js)

Thiết kế cần nhãn explicit `opaque structure`/`glazing`. Loại kính khỏi normal/depth bằng một prepass riêng và public API `setGBuffer(depthTexture, normalTexture)`; giữ kính trong beauty render. AO radius/thickness phải theo scale của scene, dùng cường độ vừa phải. [GTAOPass.setGBuffer](https://threejs.org/docs/pages/GTAOPass.html)

Loại kính khỏi G-buffer mới loại vai trò **occluder**: chế độ Default vẫn nhân AO vào toàn beauty buffer, nên pixel kính có thể nhận AO của lõi phía sau. Muốn kính không **nhận** AO cần mask/composite có chủ đích; nếu chưa đảm bảo đúng, giữ AO tắt cho baseline. Suy luận từ nhánh blend fullscreen trong [mã GTAOPass](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/postprocessing/GTAOPass.js).

Chọn cấu kiện đặc, mullion, slab, canopy làm shadow caster; glazing thường `castShadow = false`, ground nhận shadow. Đây là xấp xỉ chủ động: shadow map WebGL không tự mô phỏng bóng truyền qua kính hay caustics; depth material không sao chép transmission. [Shadows](https://threejs.org/manual/pages/shadows.html), [mã WebGLShadowMap](https://github.com/mrdoob/three.js/blob/r186/src/renderers/webgl/WebGLShadowMap.js)

2048 pixel phủ ngang 240 đơn vị cho khoảng `.117` đơn vị/texel trước filtering; chi tiết `.065` đơn vị có thể nhỏ hơn một texel. Fit shadow camera vào vùng caster/receiver cần thiết trước khi tăng resolution. normalBias lớn giảm acne nhưng có thể làm méo/tách bóng. Phép tính là chẩn đoán theo config hiện tại, chưa phải đo hiệu năng. [Shadows](https://threejs.org/manual/pages/shadows.html), [LightShadow](https://threejs.org/docs/pages/LightShadow.html)

### Environment, vật liệu và kính

`.08` là hệ số môi trường đang dùng. Trong `node_modules/three/src/renderers/WebGLRenderer.js:2738`, khi vật liệu Standard/Physical có `envMap === null`, uniform env intensity được **gán** từ `scene.environmentIntensity`; `envMapIntensity: 1.1/1.15` trong model không nhân thêm với `.08`. [Scene](https://threejs.org/docs/pages/Scene.html), [mã WebGLRenderer](https://github.com/mrdoob/three.js/blob/r186/src/renderers/WebGLRenderer.js)

Giữ Sky+PMREM cho baseline với asset hiện có. Khi có HDRI được duyệt, `HDRLoader` đọc RGBE `.hdr`, `EXRLoader` đọc OpenEXR, rồi `PMREMGenerator.fromEquirectangular` tạo reflection theo roughness. Đây là lựa chọn mở rộng, không cần GLB/Blender master. [HDRLoader](https://threejs.org/docs/pages/HDRLoader.html), [EXRLoader](https://threejs.org/docs/pages/EXRLoader.html), [PMREMGenerator](https://threejs.org/docs/pages/PMREMGenerator.html)

PMREM lọc ánh sáng môi trường; không tự phản chiếu hình học cục bộ như một path tracer. Calibrate hướng environment/sun, exposure và vật liệu cùng nhau; tăng environment intensity riêng lẻ chưa đủ căn cứ để quyết định hình ảnh đúng. Nhận định thiết kế dựa trên phạm vi [PMREMGenerator](https://threejs.org/docs/pages/PMREMGenerator.html).

Physical transmission giữ phản xạ của vật liệu dielectric; khi transmission khác 0, opacity nên là 1. Thickness/attenuation phải hợp scale; một lớp kính trước lõi đặc không tạo không gian nội thất chỉ bằng tăng transmission. Physical material cũng tăng chi phí pixel. [MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html)

### Quyết định B — tối ưu asset khi cần phân phối lớn

glTF 2.0/GLB là đầu ra phân phối tùy chọn của nguồn procedural đã duyệt, không là điều kiện bắt đầu. Khi độ phức tạp tăng: bake ánh sáng phù hợp, giữ nhóm/ID cần tương tác, tạo texture theo vật liệu, rồi xuất asset có phiên bản. Đây là migration path đề xuất.

`GLTFLoader.setMeshoptDecoder` đọc geometry nén Meshopt; `setKTX2Loader` gắn texture loader. `KTX2Loader` cần JS/WASM transcoder và `detectSupport(renderer)` trước load để chọn định dạng GPU. Meshopt/KTX2 giải bài toán dung lượng/decode/texture memory; chúng không tự tăng độ chân thực của nguồn hình học. [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html)

R3F diễn đạt scene Three.js qua React; Drei cung cấp helper. Suy luận: chuyển framework giữ cùng model/ánh sáng/vật liệu không tự nâng chất lượng render. Chỉ chọn khi quản lý scene/state/lifecycle cần kiến trúc component; Fiber 9 ghép React 19, Fiber 10 hiện được tài liệu đánh dấu alpha. [R3F Introduction](https://r3f.docs.pmnd.rs/getting-started/introduction), [Canvas](https://r3f.docs.pmnd.rs/api/canvas), [Drei](https://drei.docs.pmnd.rs/getting-started/introduction)

### Quyết định C — ảnh/video production dẫn xuất offline

Cycles là engine path tracing production, hỗ trợ PBR, CPU/GPU và nhiều GPU. Đề xuất: dẫn xuất hình học procedural đã duyệt sang scene offline; ánh xạ vật liệu, environment, light rig và color management được review riêng trước khi xuất ảnh/video. Không giả định importer glTF giữ toàn bộ ý đồ ánh sáng. [Blender Rendering](https://www.blender.org/features/rendering/)

| Tiêu chí | Viewer WebGL | Browser path tracing | Cycles offline |
| --- | --- | --- | --- |
| Tương tác xem tầng/góc | Phù hợp baseline | Phải cân đối thời gian hội tụ | Trả ảnh/video đã render |
| Chất lượng ánh sáng | PBR raster, IBL, shadow; AO tùy chọn | Tích lũy sample, giảm noise theo thời gian | Kiểm soát sample, light rig, màu và chất lượng đầu ra |
| Phụ thuộc compute lúc xem | GPU người xem | GPU người xem, yêu cầu API tương thích | Website chỉ tải media từ static storage/CDN |
| Chi phí | GPU budget mỗi lần tương tác | Nhiều sample, pin/nhiệt/memory | Thời gian sản xuất và render ở workstation/job offline |

Bảng là đánh giá kiến trúc, chưa phải benchmark. Browser path tracer hiện tại của tác giả đã đi theo WebGPU: v0.0.25 yêu cầu Three ≥r185 và deprecate `WebGLPathTracer`; v0.0.26 được công bố 2026-09-29. API khuyến nghị `WebGPUPathTracer`; không gắn trực tiếp vào composer WebGL hiện tại. [Docs/changelog của tác giả](https://gkjohnson.github.io/tools/docs/three-gpu-pathtracer/)

Sample tích lũy khi camera đứng yên và bắt đầu lại khi camera đổi; mobile cần giảm frame budget/DPR. Vì vậy path tracing chỉ đáng đánh giá như chế độ nâng cao có fallback sau khi asset đủ tốt; không là baseline bắt buộc cho khách B2B. [Docs của tác giả](https://gkjohnson.github.io/tools/docs/three-gpu-pathtracer/), [WebGPU API](https://github.com/gkjohnson/three-gpu-pathtracer/blob/main/src/webgpu/API.md)

## 3. Validate security và phát hành asset

Threat model ngắn: asset giả/malformed gây lỗi decoder hoặc cạn CPU/GPU; URL/decoder ngoài quyền kiểm soát thay đổi; model công khai làm lộ dữ liệu tenant/hợp đồng hoặc thông tin chưa duyệt. Đây là phạm vi rủi ro của pipeline asset đề xuất. [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)

Biện pháp đề xuất: chỉ phát hành asset/metadata công khai đã duyệt; pin phiên bản Three/decoder, tự host JS/WASM/HDRI đã kiểm tra, manifest có hash/nguồn/license; allowlist URI và định dạng; giới hạn bytes, kích thước texture sau decode và độ phức tạp geometry. Validate trước publish ở job cách ly khi nhận nguồn bên ngoài. [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html), [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)

Poly Haven cấp CC0 cho asset HDRI/texture/model, cho phép thương mại và phân phối lại; điều này không bao phủ logo, văn bản hay ảnh showcase trên website. Tải asset được cấp phép, lưu license/provenance và phát hành bản tự host; không suy diễn quyền từ ảnh preview. [Poly Haven License](https://polyhaven.com/license)

Website phục vụ viewer/media tĩnh từ CDN, compute nặng nằm ở GPU người xem hoặc job authoring offline; không cần server render theo từng request. Trạng thái khảo sát/khả dụng/quyền riêng tư vẫn do dữ liệu nghiệp vụ quyết định, không suy ra từ hình render. Đây là quyết định kiến trúc dự án.

## 4. Đề xuất và migration path

1. Chốt nguồn procedural có phiên bản và các góc đối chiếu media; chỉnh chi tiết quan sát được, UV/vật liệu, tỷ lệ daylight/reflection, cấu hình shadow và native AA trước.
2. Khi cần compositor, thêm addon sẵn có với thứ tự màu/AA đúng; AO chỉ bật khi chính sách kính và GPU budget được chứng minh phù hợp.
3. Khi cần ảnh/video chia sẻ, dẫn xuất scene offline từ cùng nguồn đã duyệt, review ánh xạ vật liệu/ánh sáng, xuất media có phiên bản; giữ viewer tương tác độc lập với job render.
4. Khi asset vượt ngân sách tải/VRAM, dẫn xuất GLB + Meshopt + KTX2; khi có yêu cầu component hóa mới cân nhắc R3F/Drei. Browser path tracing là một lựa chọn đánh giá sau cùng.

Trade-off: baseline raster cho tương tác nhanh và phân phối tĩnh; độ chân thực tối đa cần đầu tư hình học/vật liệu cùng render offline. Không có số FPS, ngân sách GPU hay lời hứa photorealism nào được xác nhận trong ghi chú này.

Giới hạn nguồn: URL Three API hiện dùng `/docs/pages/*.html`, manual dùng `/manual/pages/*.html`; `/manual/en/color-management.html` trả 404, link hash chỉ trả shell. Blender Rendering và manual English trực tiếp trả 402 qua công cụ duyệt; thông tin Cycles ở đây dựa trên kết quả tìm kiếm từ trang Blender chính thức, chưa kiểm tra cấu hình một bản Blender cài cụ thể. API.md tại root của path tracer trả 404; đường dẫn đúng đã tìm được là `src/webgpu/API.md`.

Giới hạn thực hiện: nghiên cứu chỉ tạo ghi chú này; không cài package, đổi UI/runtime, chạy test, tải HDRI hoặc render Cycles. Phần baseline được triển khai sau ghi chú phải báo cáo bằng diff và bằng chứng riêng.
