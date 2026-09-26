# Sungrow Service Center — Version Final

Ứng dụng Google Apps Script hợp nhất dashboard quản lý và platform nhập liệu center trên cùng một Google Sheets database.

## Nguồn đã đồng bộ

- Baseline nhập liệu: `data-entry-app` v0.3.9-pilot.
- Bản final: v1.1.2-final.
- Spreadsheet production duy nhất: `Sungrow Service Center - Database Production`.
- Spreadsheet ID: `1EoYBTSAPPOne1VCUMTLQ7W_1jjDOQnQloDWdZyXM5xI`.
- Vị trí Drive: `1B9khxWST5ba9tXTJFT3HUwpkt75QDVK5`.

File Google Sheets trên chứa nguyên các tab lịch sử `2024`, `2025`, `2026` và các tab chuẩn hóa phục vụ nhập liệu. Mã nguồn final không xóa, di chuyển hoặc ghi lại dữ liệu lịch sử.

## Phân quyền

- Dashboard chỉ xuất hiện với account được backend xác định là `isGlobalManager`.
- Role hiện tại được giữ nguyên từ tab `Người dùng`.
- `Quản lý dịch vụ`, hoặc `Quản lý trung tâm` thuộc `Sungrow Service Center`, có quyền quản lý toàn bộ center.
- Account center không thấy tab dashboard và tiếp tục thao tác theo role/center hiện hữu.
- API `getManagerDashboard` kiểm tra quyền ở server; ẩn menu không phải lớp bảo mật duy nhất.
- Token Google được kiểm tra `aud`, `iss`, `exp`, `email_verified` và `sub`. Ở lần đăng nhập hợp lệ đầu tiên, `sub` được khóa vào cột `GoogleSub`; các lần sau ưu tiên định danh này thay vì chỉ dựa vào email.

Account đã khởi tạo trong tab `Người dùng`:

- Quản lý toàn hệ thống: `taqhung.95@gmail.com`.
- Sungrow: `sungrow@gmail.com` (quản lý), `sungrow_nv@gmail.com` (nhân viên).
- XBSolar, BKE, DAT, JGP: lần lượt `xbsolar@gmail.com`, `bke@gmail.com`, `dat@gmail.com`, `jgp@gmail.com`.

Các account trên phải là Google Account thật. Không lưu mật khẩu trong Sheet hoặc source code.

## Một database duy nhất

Dashboard đọc trực tiếp các tab chuẩn hóa trong cùng Spreadsheet: `Hồ sơ thiết bị`, `Công việc trung tâm`, `Luân chuyển thiết bị`, `Lỗi thiết bị`, `Linh kiện sử dụng`, `Tạm dừng SLA`, `Người dùng`, `Nhật ký thay đổi` và `Dữ liệu dashboard`.

Mọi thao tác ghi của center tiếp tục gọi API gốc. Sau khi ghi thành công, `refreshDashboardData_()` làm mới tab `Dữ liệu dashboard` trong chính file này.

Form tiếp nhận ghi thêm thông tin khách hàng và gửi hàng: tên, địa chỉ, số điện thoại, email tùy chọn, công ty gửi, người gửi, đơn vị vận chuyển và mã vận đơn. Các cột cũ vẫn được ghi song song để bảo toàn dashboard và dữ liệu lịch sử.

## Một link GitHub Pages duy nhất

- Tất cả quản lý và center truy cập `https://taqhung95-cloud.github.io/sungrow-service/`.
- Người dùng đăng nhập Google ngay trên GitHub Pages. Backend kiểm tra account, role và center từ database trước khi trả dữ liệu.
- Account quản lý ở lại dashboard cũ; account center tự chuyển sang `entry.html` trên cùng GitHub Pages.
- Apps Script Web App chỉ là API phía sau, không phải link cung cấp cho người dùng.
- Google ID token chỉ lưu trong `sessionStorage` của tab trình duyệt, không nằm trong URL.

## File triển khai

- `Code.gs`: toàn bộ nghiệp vụ nhập liệu và role hiện hữu.
- `ManagerDashboard.gs`: API KPI quản lý chỉ đọc, dùng cùng database.
- `LegacyDashboardApi.gs`: backend cách ly cho dashboard cũ, chỉ cho role quản lý và đọc database production.
- `Index.html`: giao diện hợp nhất; quản lý thấy nguyên dashboard cũ, center thấy platform nhập liệu theo role.
- `../docs/index.html`: dashboard cũ được giữ nguyên trên GitHub Pages.
- `../docs/entry.html`: platform nhập liệu dành cho center và quản lý trên cùng GitHub Pages.
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
5. Deploy > Manage deployments > Edit > New version; Execute as `Me`, access theo chính sách account Google của tổ chức.
6. Kiểm tra lần lượt account quản lý, quản lý Sungrow, nhân viên Sungrow và ít nhất một account center. Sau lần login đầu, xác nhận cột `GoogleSub` đã có giá trị.
7. Thử account không có trong tab `Người dùng`, account inactive và account có `GoogleSub` sai; cả ba phải bị từ chối.

Việc cập nhật code local hoặc push GitHub không tự deploy Google Apps Script.
