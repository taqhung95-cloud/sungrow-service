# Sungrow Service Center — Version Final

Ứng dụng Google Apps Script hợp nhất dashboard quản lý và platform nhập liệu center trên cùng một Google Sheets database.

## Nguồn đã đồng bộ

- Baseline nhập liệu: `data-entry-app` v0.3.9-pilot.
- Backend production hiện tại: `1.10.2-ticket-coverage`.
- Quy tắc và quy trình deploy mới nhất: [`../CURRENT-IMPLEMENTATION.md`](../CURRENT-IMPLEMENTATION.md).
- Spreadsheet production duy nhất: `Sungrow Service Center - Database Production`.
- Spreadsheet ID: `1EoYBTSAPPOne1VCUMTLQ7W_1jjDOQnQloDWdZyXM5xI`.
- Vị trí Drive: `1B9khxWST5ba9tXTJFT3HUwpkt75QDVK5`.

File Google Sheets trên chứa nguyên các tab lịch sử `2024`, `2025`, `2026` và các tab chuẩn hóa phục vụ nhập liệu. Mã nguồn final không xóa, di chuyển hoặc ghi lại dữ liệu lịch sử.

## Phân quyền

- Dashboard chỉ xuất hiện với account được backend xác định là `isGlobalManager`.
- Tab `Người dùng` là nguồn phân quyền duy nhất. Không còn dùng `USERS_JSON` trong Script Properties.
- Role được chuẩn hóa về ba mã: `service_manager`, `center_manager`, `center_staff` (vẫn chấp nhận nhãn tiếng Việt tương ứng).
- `Quản lý dịch vụ`, hoặc `Quản lý trung tâm` thuộc `Sungrow Service Center`, có quyền quản lý toàn bộ center và xem dashboard tổng thể.
- Account center không thấy tab dashboard và tiếp tục thao tác theo role/center hiện hữu.
- API `getManagerDashboard` kiểm tra quyền ở server; ẩn menu không phải lớp bảo mật duy nhất.
- Token Google được kiểm tra `aud`, `iss`, `exp`, `email_verified` và `sub`. Ở lần đăng nhập hợp lệ đầu tiên, `sub` được khóa vào cột `GoogleSub`; các lần sau ưu tiên định danh này thay vì chỉ dựa vào email.

| Role trong Sheet | Phạm vi đọc | Quyền ghi |
|---|---|---|
| `Quản lý dịch vụ` / `service_manager` | Tất cả center, dashboard | Toàn bộ nghiệp vụ, xác nhận bảo hành |
| `Quản lý trung tâm` / `center_manager` | Center được gán | Tiếp nhận, cập nhật, nhận/chuyển center, giao trả |
| `Nhân viên trung tâm` / `center_staff` / `center_editor` | Center được gán | Tiếp nhận, cập nhật, xác nhận nhận luân chuyển; không chủ động chuyển center hoặc giao trả |

Riêng `Quản lý trung tâm` có `Trung tâm = Sungrow Service Center` được nâng thành quản lý dịch vụ để giữ đúng quy tắc vận hành hiện tại. Mọi quyền ghi đều được kiểm ở Apps Script; việc ẩn menu chỉ phục vụ giao diện.

Account đã khởi tạo trong tab `Người dùng`:

- Quản lý toàn hệ thống: `taqhung.95@gmail.com`.
- Sungrow: `sungrow@gmail.com` (quản lý), `sungrow_nv@gmail.com` (nhân viên).
- XBSolar, BKE, DAT, JGP: lần lượt `xbsolar@gmail.com`, `bke@gmail.com`, `dat@gmail.com`, `jgp@gmail.com`.

Các account trên phải là Google Account thật. Không lưu mật khẩu trong Sheet hoặc source code.

## Một database duy nhất

Dashboard đọc trực tiếp các tab chuẩn hóa trong cùng Spreadsheet: `Hồ sơ thiết bị`, `Công việc trung tâm`, `Luân chuyển thiết bị`, `Lỗi thiết bị`, `Linh kiện sử dụng`, `Tạm dừng SLA`, `Người dùng`, `Nhật ký thay đổi` và `Dữ liệu dashboard`.

Mọi thao tác ghi của center tiếp tục gọi API gốc. Sau khi ghi thành công, `syncDashboardProjectionCase_()` thêm hoặc cập nhật đúng một dòng trong tab `Dữ liệu dashboard` theo `Mã hồ sơ`, không xóa và dựng lại toàn bộ dữ liệu cũ. Các bảng nghiệp vụ vẫn là nguồn chính; tab này là projection để đối soát và tương thích dashboard.

Form tiếp nhận ghi thêm thông tin khách hàng và gửi hàng: tên, địa chỉ, số điện thoại, email tùy chọn, công ty gửi, người gửi, đơn vị vận chuyển và mã vận đơn. Các cột cũ vẫn được ghi song song để bảo toàn dashboard và dữ liệu lịch sử.

## Một link GitHub Pages duy nhất

- Tất cả quản lý và center truy cập `https://taqhung95-cloud.github.io/sungrow-service/`.
- Người dùng đăng nhập Google ngay trên GitHub Pages. Backend kiểm tra account, role và center từ database trước khi trả dữ liệu.
- Dashboard và platform dùng chung một portal, một sidebar và một phiên đăng nhập. Platform mở ngay trong vùng nội dung với các nhánh `Danh sách hồ sơ`, `Tiếp nhận mới`, `Cập nhật hồ sơ`, `Luân chuyển center`.
- Account quản lý có cả dashboard và platform; account center tự mở nhánh platform theo role mà không tải sang URL đăng nhập khác.
- Apps Script Web App chỉ là API phía sau, không phải link cung cấp cho người dùng.
- Google ID token chỉ lưu trong `sessionStorage` của tab trình duyệt, không nằm trong URL.

## File triển khai

- `Code.gs`: toàn bộ nghiệp vụ nhập liệu và role hiện hữu.
- `ManagerDashboard.gs`: API KPI quản lý chỉ đọc, dùng cùng database.
- `LegacyDashboardApi.gs`: backend cách ly cho dashboard cũ, chỉ cho role quản lý và đọc database production.
- `Index.html`: giao diện hợp nhất; quản lý thấy nguyên dashboard cũ, center thấy platform nhập liệu theo role.
- `../docs/index.html`: dashboard cũ được giữ nguyên trên GitHub Pages.
- `../docs/entry.html`: view nhập liệu được nhúng trong portal; người dùng không điều hướng trực tiếp sang URL này.
- `appsscript.json`: manifest Apps Script.
- `tests/validate.mjs`: kiểm tra cú pháp và guard quan trọng trước deploy.

## KPI bản final

- Thiết bị tiếp nhận, hoàn tất kỹ thuật và đã trả khách trong kỳ.
- Tồn cuối kỳ, tồn quá 7 ngày và chờ xác nhận bảo hành.
- SLA nhận–trả trong tối đa 7 ngày.
- Phân bổ theo center, trạng thái, model; xu hướng tháng và danh sách cần xử lý.

Số lượng KPI dùng trường `Số lượng`; không mặc định mỗi hồ sơ luôn bằng một thiết bị.

## Deploy

1. Mở Apps Script project đang dùng cho ứng dụng nhập liệu.
2. Chép `Code.gs`, `ManagerDashboard.gs`, `LegacyDashboardApi.gs`, `Index.html` và `appsscript.json` từ thư mục này.
3. Không chạy hàm migration, không đổi Spreadsheet ID production và không xóa các tab lịch sử.
4. Trong Google Cloud OAuth client, bảo đảm Authorized JavaScript origin có `https://taqhung95-cloud.github.io`.
5. Chạy `auditUserAccessConfiguration()` trong Apps Script. Chỉ deploy khi báo cáo trả `ok: true`.
6. Deploy > Manage deployments > Edit > New version; Execute as `Me`, access theo chính sách account Google của tổ chức.
7. Nếu OAuth consent đang ở `Testing`, thêm mọi tài khoản thử nghiệm vào Google Auth Platform > Audience > Test users. Khi phát hành chính thức, chuyển publishing status theo chính sách Google Cloud của dự án.
8. Kiểm tra lần lượt account quản lý, quản lý Sungrow, nhân viên Sungrow và ít nhất một account center. Sau lần login đầu, xác nhận cột `GoogleSub` đã có giá trị.
9. Thử account không có trong tab `Người dùng`, account inactive, account trùng email/GoogleSub và account có `GoogleSub` sai; tất cả phải bị từ chối.

Việc cập nhật code local hoặc push GitHub không tự deploy Google Apps Script.

## Triển khai bổ sung: bảo hành và tệp hồ sơ

1. Sao lưu bản deployment đang chạy. Chép lại `Code.gs`, `LegacyDashboardApi.gs` và `appsscript.json` từ bản này; frontend tương ứng là `docs/entry.html`, `docs/live-data.js`, `docs/visual-polish.css`. Không thay các tab dữ liệu lịch sử.
2. Nguồn tra cứu hiện là Google Sheet `1CPQkL-FJVxaXwuPKJUO-PnK9ML3s2KYXg8ZvmnfPev8`. Bảo đảm tài khoản chạy Web App có quyền xem file này. Không cần bật Advanced Drive service để đọc bảng bảo hành.
3. Có thể chạy `configureWarrantyLookupSheet()` một lần để kiểm tra đủ các cột `SN`, `Start date`, `Warranty package` và lưu ID vào Script Property `WARRANTY_LOOKUP_SHEET_ID`. Nếu không chạy, code vẫn dùng ID mặc định ở trên.
4. Từ nay cập nhật trực tiếp trên cùng Google Sheet này thì hệ thống đọc dữ liệu mới mà không phải chuyển đổi lại. Nếu thay bằng một file Google Sheet khác, cập nhật Script Property `WARRANTY_LOOKUP_SHEET_ID` bằng ID file mới.
5. Tài khoản chạy Web App phải có quyền ghi vào 5 thư mục center đã cấu hình. Tệp `.zip/.rar` tối đa 8 MB; folder con được tạo theo `ngày nhận-SN-model-khách hàng`. Không cấp quyền công khai tự động.
6. Deploy **New version** của Apps Script, rồi kiểm tra GitHub Pages đã xuất bản bản frontend tương ứng. Thử lần lượt: S/N Standard/Extended/cũ/hết hạn/không tìm thấy; Fan không SN; GSP/MA; upload cho từng center; kiểm tra dữ liệu chỉ hiện đúng phạm vi center; kiểm tra dashboard lịch sử và mới.
7. Thử đồng thời ít nhất 10 tài khoản Google thật trong môi trường triển khai. Việc kiểm tra cú pháp local không thay thế được kiểm thử tải OAuth, quota Apps Script và quyền Drive thực tế.
