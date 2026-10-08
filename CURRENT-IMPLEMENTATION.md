# Sungrow Service Center - Current Implementation Handbook

## Tối ưu đường đọc web — 08/10/2026

Frontend JS82/entry73: deadline bao gồm response.json và không retry các request đã timeout, vẫn hủy phản hồi đọc cũ. Backend local cần Code/Legacy cùng1.10.12-web-read-performance, ManagerDashboard và PortalReadDiagnostics: formatter ngày VN và thống kê hashSN tính JS (giữ output SHA256), workbook handle request-scope, cache response lớn dùng gzip, Manager đọc sharedtables strict revision. Không đổi KPI/schema/role/nguồn; diagnoseWebReadPaths đo build/cache/device/manager trước deploy. Regression local đạt, chưa đo1.10.12 production; hướng dẫn local version final/DEPLOY-1.10.12.md. Commit frontend không deploy backend tự động.

## Hotfix khởi tạo iframe — 08/10/2026

Frontend JS81/entry73: relay Đồng bộ được khởi tạo sau const$/state/helpers; sửa ReferenceError do gọi$trước khởi tạo khiến iframe đứng ở đăng nhập. Test entry-startup.mjs chạy toàn script ứng dụng trong DOM mock embedded/standalone, kiểm tra bước khôi phục phiên và tái hiện lỗi cũ. Không thay backend/schema/dữ liệu, không cần deploy Apps Script cho hotfix. Chưa smoke test browser live.

## Góc Đồng bộ và tải 15 tài khoản — frontend 08/10/2026

Frontend JS80/entry72: nút Đồng bộ ở góc phải thanh tiêu đề như dashboard; parent relay lệnh/trạng thái iframe với origin/source guard, ẩn syncbar giữa bộ lọc/bảng. Không gửi list trùng do ready handshake; ngừng chờ dashboard khi vào nhập liệu, không để phản hồi nền ghi đè trạng thái. Backend cần Code/Legacy cùng1.10.10-fast-reads: nén shared cache, follower chờ ngắn thay vì15s, giữ freshness/quyền/revision và thêm timing. Kiểm thử fixture15 scoped page requests/cold followers đạt, không phải15 session production. Hướng dẫn local version final/DEPLOY-1.10.10.md; không migration/seed, backend chưa deploy từ commit này.

## Đồng bộ nhập liệu và chuyển trang — frontend 07/10/2026

Frontend JS79/entry71: nút Đồng bộ/thời điểm đồng bộ trong danh sách; request đọc mới hủy request client cũ, sequence guard giữ trang vừa chọn. Deadline gồm đọc JSON, list30s/backoff giới hạn, không retry transport lồng. Revision poll so với danh sách tải thành công, invalidation cache trước tải lại; form/chi tiết mở giữ nguyên và hiện thông báo. Focus/online kiểm tra cập nhật. Không đổi backend/KPI/schema hoặc chạy migration; backend vẫn 1.10.9. Regression giả lập race, timeout body, lỗi tải, revision và bảo vệ editor đạt; chưa kiểm thử live hai tài khoản.

## Sắp xếp ngày nhận — frontend 07/10/2026

Frontend JS78/entry70 bổ sung nút Ngày nhận ↓/↑ cho danh sách hồ sơ và thiết bị dashboard; đổi chiều về trang 1, giữ bộ lọc. Backend cần Code.gs và LegacyDashboardApi.gs cùng 1.10.9-received-sort để sắp xếp toàn bộ kết quả trước phân trang, ngày trống luôn cuối. Không migration/seed, không đổi KPI/schema. Backend chưa deploy từ commit frontend; cần Save và New version trên deployment hiện tại. Hướng dẫn local version final/DEPLOY-1.10.9.md.

## Danh bạ khách hàng — frontend 06/10/2026

Frontend JS77/entry69 bổ sung gợi ý trong Tên khách hàng, tự điền bốn ô và chọn lưu/cập nhật profile riêng; guard chống phản hồi cũ và đổi center, loading/error, nhập tay khi backend chưa hỗ trợ. Backend cần Code.gs/LegacyDashboardApi.gs bản 1.10.8-customer-directory và CustomerDirectory.gs; initializeCustomerDirectory tạo tab Khách hàng/cột Mã khách hàng, audit/seed theo đợt nếu lấy khách từ hồ sơ cũ. Hồ sơ giữ snapshot, profile update không sửa case cũ. Chưa deploy backend hoặc seed production từ commit frontend.

## Tự điền Model theo SN — 06/10/2026

Frontend live-data76/entry68 dùng thêm Model từ response lookupWarranty, readOnly khi tìm thấy, nhập tay khi thiếu hoặc lookup lỗi; sequence chặn phản hồi cũ, không thêm request tra cứu. Backend local cần deploy 1.10.7-sn-model (Code.gs/LegacyDashboardApi.gs/Index.html) để trả Model từ All SN list. Backend cũ vẫn nhập Model thủ công. Không thay dữ liệu nguồn hoặc chạy migration để bật tính năng này.

## Sửa hồ sơ — frontend 05/10/2026

Frontend JS cache 75, entry 67 bổ sung chọn Loại thiết bị và vòng xoay khi mở form/lưu, chặn nhấp lặp và dọn loading khi lỗi. Backend cần cập nhật Code.gs bản 1.10.6-device-type-repair để chấp nhận thay đổi loại; GitHub Pages không tự deploy Apps Script. Nhóm sửa dữ liệu máy đổi vẫn cần audit/repair trong Apps Script; chưa có thay đổi production từ commit frontend này.

Frontend layout 05/10/2026: cache JS `74`, CSS `32`. Rút gọn nhãn KPI/cột, giữ định nghĩa trong tooltip; phân bổ lại độ rộng bảng, giữ chú thích và so sánh một dòng. Không thay công thức hay dữ liệu backend.

## Frontend GitHub Pages — 05/10/2026

Frontend cache `live-data.js?v=73` phân biệt phát sinh trong kỳ với tồn tại ngày chốt, bổ sung tồn đầu kỳ và số hồ sơ. Hoàn tất kỹ thuật lấy `summary.technicalCompleted`; khi backend chưa hỗ trợ, hiển thị `—`, không suy từ chờ giao cộng đã trả. Backend Apps Script 1.10.5 cần triển khai riêng để có đủ trường và cách tính mới; publish frontend không tự cập nhật Apps Script hoặc dữ liệu Sheets. Commit frontend chỉ gồm hai file docs và ghi chú triển khai này; các thay đổi backend/migration local chưa được publish trong commit đó.

Tài liệu này mô tả quy tắc dữ liệu và cách triển khai của phiên bản production hiện tại. Đây là điểm bắt đầu cho các task mới, thay cho việc đọc lại toàn bộ lịch sử thay đổi.

Cập nhật lần cuối: `2026-10-03`.

## Release ứng viên 1.10.4-canonical-sync — chưa xác minh backend deploy

Dashboard production chuyển sang nguồn hồ sơ nghiệp vụ canonical đã migration, không ghép lại các năm lịch sử khi đọc. Snapshot compact/cache bảng cùng revision và không stale; không giữ ScriptLock ngoài shared reader. Danh sách server-side giữ mọi case hoạt động, kể cả thiếu ngày hoặc trước 2024. KPI kỳ vẫn lọc ngày có căn cứ; cumulative records khác cumulative received. Phân quyền dashboard theo center xử lý gần nhất vẫn khác phạm vi center liên quan của platform; không sửa quyền để ép tổng bằng nhau.

Frontend cache mới `live-data.js?v=72`, bỏ fallback sai dùng preview 250 dòng làm toàn bộ danh sách. Backend Code và Legacy đều `1.10.4-canonical-sync`. Test 10.000 case/regression đạt; replay snapshot sau DAT đạt 2.767 case hoạt động ở cả dashboard và danh sách, 6 thiếu ngày, 4 lượt đọc bảng cho toàn bộ các trang khi cache warm. Không chạy lại migration/repair cho release này. Hướng dẫn `version final/DEPLOY-1.10.4.md`; backend chưa deploy/xác minh live vì công cụ trình duyệt gặp lỗi khởi động. Giữ nguyên dữ liệu và các launcher private; không deploy launcher Editor public tạm.

## Thay đổi local chờ triển khai ngày 02/10/2026

Production đang ghi nhận phiên bản 1.10.2 và cache 69/64 như phần bên dưới. Bản local chuẩn bị: backend `1.10.3-case-corrections`, cache frontend `71/66`, form-drafts.js v1; chưa push, deploy hay nhập XBSolar. Người dùng đã cho phép triển khai và nhập ngày 02/10; hiện bị chặn bởi lỗi khởi tạo kênh trình duyệt (“windows sandbox … setup refresh had errors”) và chưa có phiên clasp. Không push frontend trước backend, không ghi Sheet trực tiếp để vượt kiểm soát.

Gói JSON đã được tải và đọc lại metadata tại đúng thư mục Drive riêng đang chứa database production; không chia sẻ file. Checkpoint và Script Properties nằm ngoài Git trong `../analysis/xbsolar/deployment-checkpoint.json` và `deployment-properties.txt`. Ba bảng live hồ sơ/công việc/linh kiện vừa được đối chiếu chỉ đọc vẫn khớp fingerprint snapshot. Đây chưa phải commit preflight: Preview phải đọc lại đủ 6 bảng khi thực thi.

- Quản lý toàn hệ thống có nút **Sửa thông tin hồ sơ** trong màn hình cập nhật: SN, model, số lượng, ngày nhận/sẵn sàng/trả, khách hàng, đơn vị gửi, ghi chú và Drive.
- API `correctCase` bắt buộc lý do và revision mới nhất; xác thực quyền trong ScriptLock; chỉ sửa các cột cho phép. Giữ nguyên ID hồ sơ, provenance, công việc và quan hệ luân chuyển. Chặn SN/ngày nhận trùng khi đổi định danh, ngày sai thứ tự và ghi đè từ trang cũ.
- Ghi nhật ký trước/sau, đồng bộ projection/index và tăng revision. Nếu đồng bộ không hoàn tất, trả thông báo dữ liệu đã lưu để người dùng kiểm tra trước khi tiếp tục. Hồ sơ lịch sử còn thiếu ngày vẫn được sửa thông tin khác.
- Linh kiện và lỗi tiếp tục sửa qua **Cập nhật công việc**, sử dụng ID dòng hiện hữu. Linh kiện có tên nhưng chưa có PN vẫn được giữ/sửa; không loại bỏ khi lưu. Không tạo case mới để sửa dữ liệu.
- Kiểm thử bổ sung: `node "version final/tests/case-corrections.mjs"`; kiểm thử regression hiện hành vẫn bắt buộc.
- Bổ sung nháp trình duyệt theo email đã xác thực + thao tác + ID hồ sơ/công việc: giữ khi submit thất bại, khôi phục khi nguồn còn khớp, không tự gửi database; nguồn đã đổi chỉ cho đối chiếu/xóa nháp cũ. Nháp hết hạn sau 7 ngày, không lưu token hoặc nội dung file; file đính kèm phải chọn lại sau tải trang. Cache/index cho nhiều người và chống tạo trùng hiện hành vẫn giữ nguyên. Kiểm thử `form-drafts.mjs` kiểm tra account, reload, nguồn đổi, linh kiện có tên thiếu PN, quota và xóa sau thành công.
- Audit XBSolar đọc lại live ngày 02/10 phát hiện SN A2011057375 có ba lượt XB đang trỏ cùng HS-OLD-2024-0526. Người dùng đã xác nhận ba lần xử lý riêng; lượt đầu Sungrow → XB giữ ID production, hai lượt sau riêng. Mapping mới: 605 append, 106 merge, 0 hold; không dùng kết quả 603/108 cũ để ghi. Hai dòng linh kiện trùng dùng lại ID production, không append mù. Writer migration đã hoàn thiện và kiểm thử local, chưa deploy/chạy production; helper append cũ đang khóa.
- Người dùng chốt 19 case chỉ có Test là **Hoàn tất kỹ thuật**, XB bổ sung linh kiện và chi tiết/kết quả xử lý sau. Giữ ngày hiện hữu và linh kiện trống; không tự gán Đã sửa chữa/Không sửa chữa. Output migration mới nhất nằm ở `analysis/xbsolar/output-v12/converted.json` ngoài thư mục production-auth-audit; Google Sheet kết quả đã có ghi chú và 19 dòng follow-up.

## 1. Phiên bản và kiến trúc hiện tại

- Backend version: `1.10.2-ticket-coverage`.
- Frontend cache keys hiện tại: `live-data.js?v=69`, embedded entry `v=64`.
- Frontend production: GitHub Pages tại `https://taqhung95-cloud.github.io/sungrow-service/`.
- Backend production: Google Apps Script Web App; URL `/exec` nằm trong `docs/config.js`.
- Database production: Google Spreadsheet ID `1EoYBTSAPPOne1VCUMTLQ7W_1jjDOQnQloDWdZyXM5xI`.
- Dữ liệu bảo hành tham chiếu: Google Spreadsheet ID `1CPQkL-FJVxaXwuPKJUO-PnK9ML3s2KYXg8ZvmnfPev8` hoặc Script Property `WARRANTY_LOOKUP_SHEET_ID` nếu được cấu hình.
- Năm lịch sử bắt đầu từ `2024`; dashboard đọc đến năm hiện tại.
- SLA nhận-trả: tối đa `7` ngày.

Luồng tổng quát:

```text
Trình duyệt/GitHub Pages
  -> Google Sign-In lấy ID token
  -> Apps Script doPost
  -> xác thực token + user/role/center
  -> đọc/ghi Google Sheets
  -> cache/index/projection theo database revision
```

## 2. File nào là nguồn chuẩn

| Thành phần | File chuẩn | Ghi chú |
|---|---|---|
| Nghiệp vụ platform | `version final/Code.gs` | Hồ sơ, công việc, bảo hành, luân chuyển, Drive, phân quyền, cache/index |
| API dashboard | `version final/LegacyDashboardApi.gs` | `dashboard.read`, `tickets.page`, `tickets.search`, `portal.call` |
| Portal GitHub | `docs/index.html` | Khung dashboard |
| Logic frontend | `docs/live-data.js` | Auth, API, render dashboard, iframe platform |
| Platform nhập liệu | `docs/entry.html` | Danh sách, tiếp nhận, cập nhật, luân chuyển |
| Giao diện bổ sung | `docs/visual-polish.css` | CSS production |
| Cấu hình công khai | `docs/config.js` | Apps Script URL, OAuth client ID, entry page |
| UI Apps Script | `version final/Index.html` | Bản tương ứng khi mở Web App trực tiếp |
| Regression guard | `version final/tests/validate.mjs` | Phải chạy trước deploy |

Không mặc định dùng `apps-script/Code.gs`, `ManagerDashboard.gs` hoặc README/deploy cũ làm nguồn code mới nhất.

## 3. Mô hình dữ liệu

### 3.1 Tab nghiệp vụ

| Tab | Vai trò |
|---|---|
| `Hồ sơ thiết bị` | Một dòng cho một hồ sơ/case; nguồn chính của thông tin tiếp nhận và trạng thái tổng |
| `Công việc trung tâm` | Một hồ sơ có thể có nhiều công việc, mỗi center một hoặc nhiều chặng xử lý |
| `Luân chuyển thiết bị` | Quan hệ gửi/nhận giữa hai center |
| `Lỗi thiết bị` | Lỗi/hiện tượng gắn với `Mã công việc` |
| `Linh kiện sử dụng` | Linh kiện gắn với `Mã công việc` |
| `Tạm dừng SLA` | Khoảng thời gian tạm dừng gắn với `Mã công việc` |
| `Người dùng` | Nguồn phân quyền duy nhất |
| `Nhật ký thay đổi` | Audit thao tác |
| `Dữ liệu dashboard` | Projection tương thích dashboard, không phải nguồn nghiệp vụ chính |
| `Chỉ mục hồ sơ` | Index nhẹ phục vụ danh sách/phân trang/tìm kiếm platform |
| `2024`, `2025`, `2026`, ... | Dữ liệu lịch sử theo năm; giữ nguyên làm nguồn đối soát |

### 3.2 Khóa và provenance

- Hồ sơ mới dùng `Mã hồ sơ` dạng `HS-*`; công việc `CV-*`; luân chuyển `LC-*`.
- Request tạo hồ sơ có `requestId` riêng để chống tạo trùng khi mạng timeout hoặc frontend nhận 404 sau khi backend đã ghi.
- Dữ liệu lịch sử dùng `Mã dòng dữ liệu cũ` dạng `year!row`, ví dụ `2025!342`.
- Không ghép dữ liệu chỉ bằng S/N. Cùng một S/N có thể là nhiều lượt sửa chữa khác nhau.
- Khi merge lịch sử và nghiệp vụ, ưu tiên theo thứ tự:
  1. provenance `year!row` chính xác;
  2. `Mã hồ sơ`/case ID;
  3. khóa mạnh S/N + ngày nhận khi chỉ có đúng một kết quả;
  4. nếu mơ hồ thì bỏ qua và báo data-quality, không tự ghép.
- Repair lịch sử bỏ qua hồ sơ đã được người dùng chỉnh sửa sau import.

### 3.3 Center chuẩn

- `Sungrow Service Center` — alias lịch sử: `WSHCM`.
- `XBSolar Center` — alias: `XB`, `XB Solar`, `XBSOLAR`.
- `DAT Center` — alias: `DAT`.
- `BKE Center` — alias: `BKE`.
- `JGP Center` — alias: `JGP`.

Quản lý dịch vụ xem được dữ liệu center chưa chuẩn hóa khi lọc “Tất cả trung tâm”; dữ liệu này phải được báo là chưa xác định thay vì âm thầm loại bỏ.

## 4. Quy tắc tiếp nhận và bảo hành

### 4.1 Tạo hồ sơ

- Bắt buộc: ngày nhận, center, loại thiết bị, model, số lượng, tên/địa chỉ/SĐT khách hàng, hiện tượng ban đầu và file hồ sơ theo form hiện hành.
- S/N bắt buộc, ngoại trừ loại thiết bị `Fan`.
- Email là tùy chọn nhưng nếu có phải đúng định dạng.
- Số lượng tối thiểu là `1`.
- GSP và MA không nhập ở form tiếp nhận; cập nhật tại công việc kỹ thuật, tối đa 100 ký tự.
- Hồ sơ mới luôn được ghi:
  - `Trạng thái hồ sơ = Mới tiếp nhận`;
  - `Tình trạng bảo hành = Chờ xác nhận`;
  - công việc đầu tiên `Trạng thái xử lý = Đã nhận hàng`;
  - `Nguồn dữ liệu = Quy trình mới`.
- Kết quả tra cứu S/N trên form chỉ là thông tin tham chiếu hiển thị. Kết quả nghiệp vụ vẫn phải được quản lý xác nhận sau khi tạo hồ sơ.

### 4.2 Tra cứu bảo hành

- Bảng tra cứu cần các cột `SN`, `Start date`, `Warranty package`.
- Badge frontend:
  - còn hạn: xanh lá;
  - hết hạn: đỏ;
  - không có/không đủ thông tin: xám.
- Ngày hiện tại phải được so sánh với ngày hết hạn; không được coi một thiết bị là hết bảo hành khi chưa tới hạn.
- Trạng thái xác nhận hợp lệ trong nghiệp vụ:
  - `Trong bảo hành`;
  - `Ngoài bảo hành`;
  - `Sửa làm hàng good`.
- Chỉ `service_manager` hoặc Quản lý Sungrow có capability `approveWarranty` được xác nhận.
- Nếu đổi từ một trạng thái đã xác nhận sang trạng thái khác, bắt buộc có ghi chú.

### 4.3 Giới hạn trước xác nhận bảo hành

Khi vẫn `Chờ xác nhận`, công việc chỉ được ở giai đoạn trước sửa chữa (`Đã nhận hàng`, `Đang kiểm tra`). Không được:

- hoàn tất kỹ thuật;
- nhập kết quả xử lý;
- sử dụng linh kiện;
- giao trả khách.

## 5. Trạng thái và luồng xử lý

Luồng chính:

```text
Mới tiếp nhận
  -> Đang xử lý
  -> Đang luân chuyển (nếu chuyển center)
  -> Đang xử lý (center nhận xác nhận nhận hàng)
  -> Sẵn sàng trả khách
  -> Đã hoàn tất
```

Quy tắc quan trọng:

- `Hoàn tất kỹ thuật` bắt buộc có `Ngày hoàn tất kỹ thuật` và `Kết quả xử lý`.
- Nếu kết quả là `Đổi thiết bị`, bắt buộc có loại thiết bị đổi.
- Công việc `Đã chuyển hàng đi` hoặc `Đã đóng công việc` không được center thường cập nhật tiếp.
- Chỉ center tiếp nhận được giao trả khách.
- Thiết bị phải quay về center tiếp nhận trước khi giao trả.
- Ngày nhận luân chuyển không được trước ngày gửi; ngày trả không được trước ngày tiếp nhận hoặc ngày sẵn sàng trả.
- Center ngoài Sungrow chỉ được chuyển về Sungrow.
- Sungrow được chuyển đến mọi center khác.
- `center_staff` được xác nhận nhận luân chuyển nhưng không được chủ động tạo luân chuyển.

## 6. Quy tắc xóa hồ sơ

Xóa là **soft delete**, không xóa dòng vật lý.

Điều kiện được xóa:

- `Tình trạng bảo hành = Chờ xác nhận`;
- chưa có luân chuyển;
- thiết bị vẫn đang ở center tiếp nhận;
- người thao tác thuộc center tiếp nhận hoặc là quản lý toàn hệ thống;
- có lý do xóa, tối đa 500 ký tự.

Khi xóa:

- đặt `Trạng thái hồ sơ = Đã hủy`;
- ghi người/ngày/lý do hủy và audit;
- loại khỏi `Dữ liệu dashboard`;
- cập nhật `Chỉ mục hồ sơ`;
- tăng database revision.

Hồ sơ `Đã hủy` phải bị loại khỏi danh sách platform, dashboard, tìm kiếm thiết bị và KPI. Bộ lọc dashboard còn dùng case ID, provenance và S/N + ngày nhận để chặn bản lịch sử tương ứng xuất hiện trở lại.

## 7. Phân quyền

| Role chuẩn | Dashboard | Tạo hồ sơ | Cập nhật | Chuyển center | Nhận chuyển | Trả khách | Xác nhận BH |
|---|---:|---:|---:|---:|---:|---:|---:|
| `service_manager` | Có | Có | Có | Có | Có | Có | Có |
| `center_manager` | Không | Có | Có | Có | Có | Có | Không |
| `center_staff` | Không | Có | Có | Không | Có | Có | Không |

- Tab `Người dùng` là nguồn quyền duy nhất.
- Quản lý Sungrow được nâng quyền quản lý toàn hệ thống theo quy tắc hiện hành.
- Token Google được kiểm tra `aud`, `iss`, `exp`, `email_verified`, `sub`.
- Lần đăng nhập đầu tiên khóa `GoogleSub` vào user; các lần sau ưu tiên `GoogleSub` hơn email.
- Trùng email, trùng GoogleSub, user inactive hoặc GoogleSub sai đều phải bị từ chối.
- Ẩn menu frontend không phải bảo mật; mọi quyền ghi/đọc đều phải kiểm lại ở backend.

## 8. File hồ sơ và Google Drive

- Chỉ nhận `.zip`/`.rar`, tối đa 8 MB theo UI hiện hành.
- Mỗi center có một Drive folder riêng được khai báo trong `CASE_EVIDENCE_FOLDERS`.
- Folder con đặt theo ngày nhận, S/N, model và khách hàng.
- Link Drive được ghi vào `Liên kết hồ sơ Drive` và chỉ trả ra frontend nếu là URL `drive.google.com` hoặc `docs.google.com` hợp lệ.
- Không tự cấp quyền public.
- Tài khoản chạy Web App phải có quyền ghi vào tất cả folder cần sử dụng.
- Upload chạy ngoài database lock. Receipt `CREATE_UPLOAD_<requestId>` ngăn upload lặp khi kết quả request không chắc chắn.
- Nếu frontend timeout nhưng case đã tạo, phải gọi `getCreationStatus(requestId)`; không tự gửi lại file/case mù quáng.

## 9. Quy tắc dashboard và số liệu

### 9.1 Nguồn hybrid

Dashboard ghép:

- tab lịch sử theo năm;
- dữ liệu nghiệp vụ hiện hành;
- projection `Dữ liệu dashboard` để tương thích;
- các bảng lỗi, linh kiện và công việc để lấy thông tin chi tiết mới nhất.

Một record nghiệp vụ mới không được nhân đôi với dòng lịch sử đã map. Một provenance không khớp không được fallback sang S/N để tránh ghép sai lượt sửa chữa.

### 9.2 Phạm vi các con số

- **Danh sách hồ sơ**: hồ sơ nghiệp vụ không hủy, theo quyền người dùng, phân trang từ `Chỉ mục hồ sơ`.
- **Danh sách thiết bị dashboard**: toàn bộ năm từ 2024 đến năm hiện tại, nguồn hybrid, phân trang/tìm kiếm server-side.
- **Thiết bị tiếp nhận trong kỳ**: record có ngày nhận hợp lệ và nằm trong tháng/năm đang chọn.
- **Tích lũy**: tổng có thể phân bổ theo ngày nhận hợp lệ; nhãn UI giữ ngắn là `Tích lũy`, thông tin độ phủ ngày nằm trong tooltip/note.
- **Đã trả**: dựa trên ngày trả khách.
- **SLA**: chỉ tính record có ngày nhận và ngày trả hợp lệ, ngày trả không trước ngày nhận; đạt khi không quá 7 ngày.
- **Linh kiện theo kỳ**: theo ngày kiểm tra/sửa hoặc ngày sử dụng đã chuẩn hóa tùy nguồn; số lượng lấy từ quantity, không mặc định một dòng bằng một linh kiện.
- **KPI số thiết bị**: khi trường `Số lượng` tồn tại, không được mặc định mỗi hồ sơ luôn bằng một thiết bị.

Tổng Danh sách hồ sơ, Danh sách thiết bị và Tích lũy không được ép bằng nhau một cách cơ học. Khi lệch, đối soát theo: hồ sơ hủy, quyền center, provenance, ngày nhận thiếu/sai, center chưa chuẩn hóa, bản ghi trùng/mơ hồ và số lượng.

## 10. Cache, tốc độ và truy cập đồng thời

### 10.1 Database revision

- Script Property `PORTAL_DATA_REVISION` là khóa invalidation chung.
- Mỗi mutation thành công phải gọi theo thứ tự phù hợp:
  1. ghi bảng nghiệp vụ;
  2. `syncDashboardProjectionCase_(caseId)` hoặc remove projection nếu hủy;
  3. `syncPortalCaseIndexCase_(caseId)`;
  4. `bumpPortalDatabaseRevision_()`.
- Frontend poll revision khoảng 60 giây và tự đồng bộ định kỳ khoảng 5 phút; user vẫn có nút đồng bộ thủ công.

### 10.2 Cache đọc

- Danh sách hồ sơ đọc `Chỉ mục hồ sơ`, không join lại toàn database mỗi lần.
- Cache list theo user + filter + revision, tối đa khoảng 5 phút và chỉ lưu response nhỏ hơn giới hạn CacheService.
- Shared table cache dùng revision và lease; chỉ một request dựng snapshot, request đồng thời có thể dùng stale-while-refresh thay vì cùng đọc Sheet.
- Lease hết hạn khoảng 45 giây để tránh builder chết làm khóa vĩnh viễn.
- Dashboard và ticket index cache theo version + revision + role + scope + kỳ; ticket index toàn năm được tái sử dụng cho phân trang/tìm kiếm.
- Response lớn được chia chunk để không vượt giới hạn 100 KB của CacheService.

### 10.3 Ghi đồng thời

- Google Sheets không có row transaction; mutation trên record hiện hữu dùng `ScriptLock`.
- Nếu một nhân viên khác đang ghi, request sau bị từ chối sớm và phải tải lại record mới nhất, không chờ rồi ghi đè dữ liệu cũ.
- Tạo hồ sơ dùng request ID idempotent, tách upload Drive khỏi lock và khóa lúc commit database.
- Không đặt thao tác Drive hoặc full-sheet scan bên trong lock dài.

### 10.4 Quy tắc hiệu năng khi thêm chức năng

- Không gọi `getDataRange()` nhiều lần cho cùng tab trong một request.
- Không rebuild toàn bộ projection/index sau mỗi mutation; chỉ cập nhật case bị tác động.
- Không tải toàn bộ 1.500+ hồ sơ về browser rồi mới phân trang.
- Không cache dữ liệu thiếu revision hoặc cache response stale vào cache user/filter.
- Khi thêm một bảng vào response dashboard, cân nhắc kích thước serialization và chunk cache.

## 11. Quy tắc giao diện

- Nút mũi tên thao tác luôn hiển thị.
- Nút `X` nằm kế bên mũi tên; đỏ khi được xóa, xám/disabled khi không được xóa.
- GSP và MA nằm trước cột Thiết bị/SN trên danh sách thiết bị; dữ liệu được nhập trong cập nhật công việc.
- Link hồ sơ Drive phải click được sau khi upload thành công.
- Trạng thái đồng bộ hiển thị `Đã đồng bộ` hoặc `Chưa đồng bộ` kèm thời gian, có khoảng cách rõ ràng.
- Linh kiện sử dụng ưu tiên bố trí ngang/compact.
- Pagination danh sách thiết bị và danh sách hồ sơ dùng cùng ngôn ngữ/kích thước.
- Vòng xoay chỉ dành cho trạng thái tải/gửi thực tế: loading row, tìm kiếm, tải chi tiết, đồng bộ hoặc nút đang gửi.
- `Đang xử lý` trong cột trạng thái là dữ liệu nghiệp vụ, tuyệt đối không gắn spinner.
- Loading phải có `role=status`/`aria-live` phù hợp; hỗ trợ `prefers-reduced-motion`.

## 12. Quy trình sửa code

1. Kiểm tra `git status` và bảo toàn thay đổi không liên quan.
2. Đọc `AGENTS.md` và đúng phần liên quan trong tài liệu này.
3. Tìm code bằng `rg`; không đọc toàn bộ repo nếu không cần.
4. Nếu sửa backend, kiểm tra cả `Code.gs` và `LegacyDashboardApi.gs` vì version/cache/merge liên kết nhau.
5. Nếu sửa mutation, xác nhận projection, case index, revision và audit đều được cập nhật.
6. Nếu sửa frontend embedded:
   - sửa `docs/entry.html`;
   - giữ `version final/Index.html` tương ứng nếu cùng component;
   - tăng query `v=` của iframe trong `docs/live-data.js`.
7. Nếu sửa `docs/live-data.js`, tăng query `live-data.js?v=` trong `docs/index.html`.
8. Bổ sung regression assertion vào `version final/tests/validate.mjs`.
9. Chạy:

```powershell
node "version final/tests/validate.mjs"
git diff --check
```

10. Commit với thông điệp mô tả outcome; chỉ push/deploy khi được yêu cầu hoặc nằm trong workflow người dùng đã giao.

## 13. Ma trận triển khai

### A. Chỉ thay đổi GitHub frontend (`docs/*`)

Áp dụng cho CSS, spinner, bố cục, text, render, filter phía trình duyệt.

1. Chạy validation.
2. Bump cache key:
   - `entry.html` đổi -> tăng `v=` iframe trong `docs/live-data.js`;
   - `live-data.js` đổi -> tăng `live-data.js?v=` trong `docs/index.html`;
   - CSS đổi -> tăng `visual-polish.css?v=` trong `docs/index.html`.
3. Commit và push `origin/main`.
4. Chờ GitHub Pages 1–3 phút.
5. `Ctrl + Shift + R`.

Không cần cập nhật Apps Script cho trường hợp này.

### B. Thay đổi backend Apps Script

Áp dụng cho dữ liệu, quyền, API, cache backend, workflow, KPI/merge.

1. Thay toàn bộ:
   - `version final/Code.gs` -> file `Code.gs` trong project Apps Script;
   - `version final/LegacyDashboardApi.gs` -> file cùng tên trong Apps Script.
2. Nếu release có thay UI trực tiếp Apps Script, thay thêm `version final/Index.html`.
3. Save.
4. Chạy audit/migration được ghi rõ cho release; không chạy repair tùy tiện.
5. **Deploy -> Manage deployments -> Edit -> New version -> Deploy** trên deployment hiện tại.
6. Không tạo deployment URL mới.
7. Kiểm tra `getBootstrap`/endpoint trả đúng `APP_VERSION`.
8. Reload GitHub portal.

Push GitHub không tự deploy Apps Script; Save Apps Script cũng không cập nhật deployment đang chạy nếu chưa tạo New version.

### C. Thay đổi cả frontend và backend

1. Deploy backend Apps Script trước, giữ nguyên URL.
2. Push frontend có cache key mới.
3. Kiểm tra bằng account quản lý và ít nhất một account center.
4. Test cold load, refresh, hai user thao tác đồng thời, upload, tìm kiếm và phân trang.

## 14. Audit/repair lịch sử

Chỉ chạy khi cần đối soát hoặc release yêu cầu, theo đúng thứ tự:

1. `auditHistoricalWarrantyData` — chỉ đọc.
2. `repairHistoricalWarrantyData` — sửa bảo hành lịch sử an toàn.
3. `auditHistoricalDashboardProjection` — chỉ đọc.
4. `repairHistoricalDashboardProjection` — sửa projection theo provenance.
5. `rebuildPortalCaseIndex` — dựng lại index hồ sơ.
6. Tùy chọn `warmPortalReadCache` — làm nóng index nhẹ.

Mỗi hàm phải `Execution completed` trước khi chạy hàm kế tiếp. Nếu audit/repair lỗi data validation, sửa code để mở rộng validation hợp lệ; không xóa validation toàn cột và không sửa dữ liệu nguồn bằng tay để ép hàm chạy.

Repair phải:

- khớp `year!row`;
- không ghi đè hồ sơ đã user chỉnh sửa;
- báo `skipped` khi thiếu nguồn, mơ hồ hoặc identity thay đổi;
- đồng bộ cả hồ sơ và projection liên quan.

## 15. Checklist nghiệm thu nhanh

- Login: manager, center manager, center staff, user không hợp lệ.
- Danh sách hồ sơ: cold load, cache load, refresh, search, filter, pagination, chi tiết.
- Tiếp nhận: S/N có/không có bảo hành, Fan không S/N, upload, request timeout/idempotency.
- Bảo hành: pending, xác nhận, đổi kết quả có ghi chú.
- Kỹ thuật: GSP/MA, lỗi, linh kiện, hoàn tất bắt buộc ngày/kết quả.
- Luân chuyển: routing ngoài center -> Sungrow; Sungrow -> center; nhận hàng.
- Xóa: case pending được xóa; case đã xác nhận/đã chuyển không được xóa; không xuất hiện lại ở dashboard.
- Dashboard: tháng/năm, tất cả center, ticket toàn năm, số trang, cumulative/date coverage, SLA.
- Concurrency: hai người sửa cùng record; request sau phải được yêu cầu reload thay vì ghi đè.
- UI loading: có spinner khi tải thật; không có spinner cạnh nhãn nghiệp vụ `Đang xử lý`.

## 16. Khi nào cập nhật tài liệu này

### Chuẩn bị migration XBSolar — 02/10/2026

Bản local dựa trên remote HEAD mới nhất 84f77af505d3f03f589857ec46152b49c6b1955b. 711 hồ sơ XB được lập gói: **605 thêm mới, 106 hợp nhất, 0 tạm giữ**. A2011057375 có lượt đầu Sungrow → XB và hai lượt XB độc lập; không gộp ba lần thành một. Ba cặp ID giữ lượt 2025 độc lập, ghép XB vào ID 2026 theo xác nhận. A2542704238 là XB → Sungrow → XB trả khách; không dùng ngày máy gốc chuyển Mekong làm ngày trả khách. Hai linh kiện đã tồn tại giữ ID và số lượng, không nhập trùng. 19 hồ sơ hoàn tất kỹ thuật có ghi chú XB bổ sung chi tiết sau.

Đã xây writer local trên backend ứng viên 1.10.3-case-corrections: XBSolarMigrationPlan.gs và XBSolarMigration.gs, chỉ lệnh Editor riêng tư; preflight toàn bộ nguồn live/hash/schema, backup Drive, journal theo hồ sơ, ScriptLock và khóa ghi tạm thời, batch nguồn nguyên tử, đọc lại, audit, projection/index/revision, resume chống lặp và rollback có kiểm tra xung đột. Giữ các ID cũ và provenance; rollback hồ sơ mới bằng hủy mềm. Các tab lịch sử không bị ghi.

HS-OLD-2025-0459 / A2010216461 có quản lý chỉnh sửa: giữ toàn bộ giá trị hồ sơ/công việc đã sửa, chỉ nối ghi chú và thêm lịch sử nguồn. Khác biệt về ngày, trạng thái và bảo hành được ghi trong báo cáo để quản lý đối soát. Hai công việc cũ HS-OLD-2024-0015/0017 có ngày chuyển 02/01/2024 trước ngày nhận 19/01/2024; preview báo riêng, giữ nguyên hai giá trị nguồn, không tự sửa lịch sử Sungrow. Migration chặn lỗi thứ tự ngày mới.

**Chưa deploy hoặc nhập production.** Preview phải khớp live mới nhất; gói cũ sẽ bị chặn nếu nguồn đã thay đổi. Backend/frontend phải deploy đồng bộ bản mới nhất. Các chức năng khác giữ nguyên ngoài quyền quản lý sửa thông tin hồ sơ và khóa ghi tạm thời khi nhập. Helper applyXBSolarImport() cũ vẫn khóa, không đưa vào deployment/API allowlist.

Hướng dẫn: [XBSOLAR-MIGRATION-CONTROLS.md](version%20final/XBSOLAR-MIGRATION-CONTROLS.md). Gói/snapshot/báo cáo riêng tư ở ../analysis/xbsolar/ (Git ignore). Khi triển khai phải hoàn tất smoke test account quản lý và center trước khi chạy nhập.

Cập nhật cùng commit khi thay đổi một trong các mục sau:

- version hoặc file canonical;
- schema/tab/header;
- quyền hoặc capability;
- trạng thái/transition;
- cách merge/count KPI;
- cache/revision/concurrency;
- các bước deploy/migration;
- cache key frontend hoặc kiến trúc hosting.
