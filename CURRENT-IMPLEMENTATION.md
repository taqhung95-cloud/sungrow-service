# Sungrow Service Center - Current Implementation Handbook

Tài liệu này mô tả quy tắc dữ liệu và cách triển khai của phiên bản production hiện tại. Đây là điểm bắt đầu cho các task mới, thay cho việc đọc lại toàn bộ lịch sử thay đổi.

Cập nhật lần cuối: `2026-10-01`.

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

Cập nhật cùng commit khi thay đổi một trong các mục sau:

- version hoặc file canonical;
- schema/tab/header;
- quyền hoặc capability;
- trạng thái/transition;
- cách merge/count KPI;
- cache/revision/concurrency;
- các bước deploy/migration;
- cache key frontend hoặc kiến trúc hosting.
