# Sungrow Service Center Dashboard

Dashboard theo dõi hiệu quả vận hành theo tháng cho Sungrow Service Center, DAT Center, XBSolar Center và BKE Center.

## Chạy thử giao diện

Mở `docs/index.html` để xem giao diện mẫu. Khi chưa cấu hình API, dashboard vẫn hiển thị dữ liệu minh họa và trạng thái **Chưa cấu hình API**.

## Kết nối Google Sheets

Kiến trúc triển khai:

1. Google Sheets là nguồn dữ liệu vận hành.
2. Apps Script trong `apps-script/` đọc và chuẩn hóa dữ liệu, kiểm tra Google ID token và quyền center.
3. GitHub Pages phục vụ frontend trong `docs/`.
4. `docs/config.js` chỉ chứa Apps Script URL và OAuth Web Client ID công khai; không lưu client secret, token hay dữ liệu nguồn.

Hướng dẫn chi tiết nằm trong [SYNC_SETUP.md](SYNC_SETUP.md). Kiến trúc bảo mật nằm trong [security-architecture.md](security-architecture.md).

## Dữ liệu không đưa lên repository

File Excel nguồn, file khóa Office, token đăng nhập, OAuth client secret và danh sách người dùng thực tế không được commit. Danh sách quyền được lưu trong Script Properties của Apps Script.
