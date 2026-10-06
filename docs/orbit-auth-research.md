# Rà soát Orbit auth/authz để thiết kế thư viện TypeScript

Ngày rà soát: 2026-10-06. Phạm vi: đọc source `shared/orbit-lib`, không sửa Orbit, không chạy dịch vụ hay kiểm chứng cấu hình production. Các nhận định dưới đây là hành vi của source đã đọc; không phải kết luận kiểm toán toàn hệ thống.

## Kết luận kiến trúc

Nên học các hợp đồng phân quyền của Orbit: quyền theo resource/action, quyền màn hình tách khỏi phạm vi dữ liệu, payload gắn tenant/user/version, và enforcement ở backend. Không nên mang nguyên framework Go, Redis pool, gRPC hay các nhánh tương thích legacy sang thư viện TypeScript. Authenticated identity và effective permissions là hai hợp đồng riêng trong Orbit: [Auth middleware](/Users/suntech/orbit/shared/orbit-lib/middleware/auth.go:27), [AuthZChecker](/Users/suntech/orbit/shared/orbit-lib/model/authz_types.go:250).

## Pattern nên học

| Pattern từ source | Ý nghĩa khi xây lib |
|---|---|
| `ScreenPermission` có actions, denied, scope, conditions; `MenuPermission` gom nhiều screens. [Types](/Users/suntech/orbit/shared/orbit-lib/model/authz_types.go:71) | Cùng màn hình/component có thể trả capability khác nhau; không cần fork giao diện theo từng role. Domain app khai báo resource và action; lib chỉ xử lý policy. |
| `CheckAccess(action="")` chỉ kiểm tra menu visibility; action cụ thể phải kiểm tra grants. [Checker](/Users/suntech/orbit/shared/orbit-lib/authz/checker.go:60) | Quyền mở màn hình không đồng nghĩa được sửa, duyệt hoặc tải file. UI chỉ hiển thị capability do backend cấp; API vẫn kiểm tra riêng mỗi action. |
| Missing menu/screen/action trả false; scope không có trả `ScopeDenied`. [Checker](/Users/suntech/orbit/shared/orbit-lib/authz/checker.go:84), [Scope](/Users/suntech/orbit/shared/orbit-lib/authz/checker.go:160) | Default deny là nền tảng evaluator; phân biệt `denied` với `policy unavailable`, không chuyển lỗi thành allow. |
| Identity bắt buộc CompanyID và AccountID dương; cache key có tenant/account/version. [Keys](/Users/suntech/orbit/shared/orbit-lib/authz/permission_cache_keys.go:18) | Cache cùng một user ở hai tenant phải tách biệt. Không cache chỉ theo user hoặc role. |
| Effective payload kiểm tra identity/version; map menus rỗng hợp lệ và có nghĩa deny-all. [Validation](/Users/suntech/orbit/shared/orbit-lib/model/authz_types.go:130) | Valid policy không nhất thiết có grants. Snapshot đọc từ cache phải được kiểm tra envelope, không chỉ JSON parse. |
| Loader truy vấn DB theo `(company_id, account_id)` và kiểm tra payload/version; lỗi thiếu/hỏng/unavailable được phân loại. [DB loader](/Users/suntech/orbit/shared/orbit-lib/authz/permission_loader.go:168), [LoadError](/Users/suntech/orbit/shared/orbit-lib/authz/permission_loader.go:25) | Adapter storage cần authoritative lookup có tenant scope; backend nên dừng request khi không thể xác lập quyền. |
| Scope filtering và write validation đặt ở service, không chỉ menu/UI. [Query scope](/Users/suntech/orbit/shared/orbit-lib/service/data_scope.go:26), [Write scope](/Users/suntech/orbit/shared/orbit-lib/service/data_scope.go:93) | Kiểm tra read/list, update/delete, create/reparent, và quan hệ FK. Permission `contracts.view` vẫn phải giới hạn tenant/khách hàng hợp đồng. |
| Checker cache permissions trong request locals. [Request cache](/Users/suntech/orbit/shared/orbit-lib/authz/checker.go:330) | Nạp policy một lần mỗi request; tránh nhiều adapter roundtrip. Request cache không thay thế revocation xuyên request. |
| Redis có `PublishVersioned` atomic, không cho version cũ ghi đè version mới. [Publisher](/Users/suntech/orbit/shared/orbit-lib/redis/client.go:266) | Nếu thêm shared cache, cần compare-and-set/atomic publication để chặn policy stale phục hồi quyền đã thu hồi. |
| Decision log chứa user, tenant, action, scope, decision/reason. [Audit](/Users/suntech/orbit/shared/orbit-lib/middleware/authz.go:61) | Lib trả decision có reason code; app ghi audit với request ID, tránh log raw session/token và nội dung hồ sơ. |

## Thỏa hiệp và điểm không nên sao chép

1. **Middleware không default deny trên mọi đường đi.** Khi `menuID==0` và resolver hoặc identity nil, code `c.Next()` theo legacy; route ngoài convention cũng skip. Có explicit AuthZBypass, ScopeBypass và SuperAdmin bypass. Hệ thống mới phải đăng ký route public/self-service rõ ràng, protected route thiếu policy phải deny; role quản trị chỉ có grants trong tenant. [Legacy pass-through](/Users/suntech/orbit/shared/orbit-lib/middleware/authz.go:214), [Bypass](/Users/suntech/orbit/shared/orbit-lib/middleware/authz.go:137), [SuperAdmin](/Users/suntech/orbit/shared/orbit-lib/middleware/authz.go:259).

2. **Revocation auth phụ thuộc Redis nhưng lỗi Redis bị bỏ qua.** Blacklist và lockUser chỉ reject khi `err==nil && value=="1"`. Device binding đọc policy lỗi trả false và cache local 5 phút. Không lấy các nhánh này làm mẫu cho guarantee khóa tài khoản tức thời. [Auth revocation](/Users/suntech/orbit/shared/orbit-lib/middleware/auth.go:57), [Device binding](/Users/suntech/orbit/shared/orbit-lib/middleware/auth.go:85).

3. **Policy version chưa tự chứng minh revocation tức thời.** Payload cache TTL 5 phút; mỗi lần cache lookup đọc version pointer rồi payload và kiểm tra khớp. Nhưng loader write-through dùng hai lệnh SetJSON/SetString, chưa dùng helper atomic `PublishVersioned`; writer cũ có thể ghi pointer lùi nếu cạnh tranh. Chưa rà soát toàn bộ writer/compiler/invalidation nên không kết luận toàn Orbit có/không có bảo đảm thu hồi tức thời. Thiết kế lib mới phải quy định nguồn version authoritative và giới hạn stale, ưu tiên read authoritative cho thao tác nhạy cảm. [Cache read/write](/Users/suntech/orbit/shared/orbit-lib/authz/permission_loader.go:271), [Atomic helper](/Users/suntech/orbit/shared/orbit-lib/redis/client.go:282).

4. **Không dùng comment để thay source làm authority.** Loader comment nói dispatch `AUTHZ_SOURCE`, nhưng implementation chọn Core→Redis, service khác→gRPC; gRPC unset fallback Redis/DB. [Dispatch](/Users/suntech/orbit/shared/orbit-lib/authz/permission_loader.go:109), [Fallback](/Users/suntech/orbit/shared/orbit-lib/authz/permission_loader.go:225). `config/roles.go` chỉ có user/admin và rights getUsers/manageUsers; auth middleware nhận `requiredRights` nhưng không dùng. Đây không phải RBAC runtime đầy đủ để port. [Roles](/Users/suntech/orbit/shared/orbit-lib/config/roles.go:3), [Auth signature/body](/Users/suntech/orbit/shared/orbit-lib/middleware/auth.go:27).

5. **Action alias cần normalize trước allow và deny.** Screen checker so Denied với action raw rồi mới alias list/get→view. Do đó deny `view` không khớp request `list` ở đoạn này, trước khi wildcard/allow được xét. Policy lib mới nên dùng một canonical action cho cả deny/grant, bỏ wildcard ở MVP nếu không cần. [Screen checker](/Users/suntech/orbit/shared/orbit-lib/authz/checker.go:286).

6. **Scope phụ thuộc reflection và caller wiring.** Default query filter chỉ thêm tenant/branch/department khi model có field tương ứng và identity value dương. Scope bypass trả query nguyên trạng. Write path comment mô tả custom-condition nhưng branch đó đang comment; không thể giả định custom read condition tự bảo vệ write. Thiết kế mới dùng explicit scope contract và tenant bắt buộc trên resource sở hữu tenant, không suy ra an toàn qua tên field. [Read scope](/Users/suntech/orbit/shared/orbit-lib/service/data_scope.go:48), [Write branch](/Users/suntech/orbit/shared/orbit-lib/service/data_scope.go:104).

7. **Không tái dùng token/membership logic chưa kiểm chứng.** Auth nhận verifier qua callback và sau đó có thể lấy company/branch/department từ hậu tố token. Source đoạn này không chứng minh membership của hậu tố được kiểm tra. `utils.VerifyToken` parse bằng shared secret và check type, không có parser options explicit issuer/audience/algorithm allowlist ở hàm đó; chưa chứng minh callback production dùng hàm này. Adapter mới phải xác minh identity bằng provider/session contract đã chọn, rồi kiểm tra membership tenant từ nguồn tin cậy. [Auth callback/suffix](/Users/suntech/orbit/shared/orbit-lib/middleware/auth.go:36), [Verifier](/Users/suntech/orbit/shared/orbit-lib/utils/verify.go:9).

## Ranh giới lib đề xuất cho TypeScript serverless

Đây là đề xuất mới dựa trên patterns trên, không phải API hiện hữu của Orbit:

- Core thuần TypeScript: `Principal`, tenant membership, permission catalog, `PolicySnapshot`, `authorize(resource, action, scope)` và decision reason. Không Fiber/GORM/Redis/process singleton/DB connection trong core. Source Orbit hiện buộc checker vào Fiber và types vào GORM: [Types imports](/Users/suntech/orbit/shared/orbit-lib/model/authz_types.go:3), [Loader dependencies](/Users/suntech/orbit/shared/orbit-lib/authz/permission_loader.go:78).
- Adapter tách rời: session/authentication, policy store, audit sink; Fetch Request handler cho edge/Worker. Storage đọc DB authoritative trước, cache optional sau. Nguồn session/policy lỗi phải fail closed; authz denied thường 403, invalid session 401, dependency unavailable 503.
- App khai báo khoảng 4–5 role thành preset grants; không hardcode nghiệp vụ mall vào lib. Tên role chỉ là grouping, enforcement dựa permission/resource/scope. Role catalog được chốt theo nhu cầu sản phẩm.
- API capabilities cho một màn hình chung trả các action flags và phạm vi dữ liệu; client dùng flags để ẩn/disable controls. Backend lặp lại authorization với resource thật và query tenant scoping, kể cả download/view file.
- Threat model tối thiểu: giả tenant/resource ID, gọi API khi nút ẩn, session đã bị khóa, policy snapshot stale, cache poisoned/mis-scoped, create/update chuyển record sang tenant khác. Những trường hợp này cần executable acceptance cases khi triển khai.
- Migration: bắt đầu permission catalog + evaluator + session/policy adapter contracts; nối adapter thật và check endpoint; sau đó UI consumption. Không tuyên bố authentication production đã hoàn tất khi chỉ có evaluator/memory adapter.

## Giới hạn chứng cứ

Không đọc toàn bộ service Core compiler/writer, hệ thống login/refresh, DB tenant resolver hoặc mọi router consumer; không đánh giá deployment hay penetration test. Rà soát này đủ để chọn contract và tránh copy nhánh legacy, chưa đủ để chứng nhận Orbit hoặc thư viện mới đạt chuẩn bảo mật production.
