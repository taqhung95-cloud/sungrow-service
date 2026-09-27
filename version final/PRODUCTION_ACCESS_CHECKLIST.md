# Checklist phân quyền production

## 1. Nguồn xác thực và phân quyền

- Google Identity Services cấp ID token tại GitHub Pages.
- Apps Script xác minh `aud`, `iss`, `exp`, `email_verified` và `sub` với Google.
- Tab `Người dùng` trong database production là allowlist và nguồn role/center duy nhất.
- `USERS_JSON` không còn được đọc. Có thể xóa property này sau khi deploy bản mới.
- Web App triển khai `Execute as: Me`; người dùng không cần được share trực tiếp Google Sheet. Mọi lượt đọc/ghi đi qua backend và được lọc theo actor.

## 2. Cột bắt buộc trong tab `Người dùng`

| Email Google | GoogleSub | Họ và tên | Vai trò | Trung tâm | Đang hoạt động |
|---|---|---|---|---|---|
| Email Google thật, không trùng | Để trống trước lần login đầu hoặc giữ nguyên giá trị đã khóa | Tên hiển thị | Một role hợp lệ | Tên center đúng tuyệt đối | `TRUE` / `Có` |

Role hợp lệ: `Quản lý dịch vụ`, `Quản lý trung tâm`, `Nhân viên trung tâm`; hoặc mã tương ứng `service_manager`, `center_manager`, `center_staff`.

Center hợp lệ: `Sungrow Service Center`, `XBSolar Center`, `DAT Center`, `BKE Center`, `JGP Center`.

Không tự sửa `GoogleSub` sau khi đã khóa. Nếu cần chuyển tài khoản, vô hiệu hóa dòng cũ và tạo dòng mới để giữ audit rõ ràng.

## 3. Ma trận kiểm thử bắt buộc

| Tình huống | Kết quả mong đợi |
|---|---|
| Quản lý dịch vụ đăng nhập | Thấy dashboard và toàn bộ platform |
| Quản lý Sungrow đăng nhập | Chỉ thấy platform và dữ liệu Sungrow Service Center |
| Quản lý center khác | Chỉ thấy dữ liệu center; được chuyển center/giao trả trong phạm vi |
| Nhân viên center | Không thấy dashboard; không được chủ động chuyển center/giao trả |
| Center A sửa request thành Center B | Backend trả từ chối |
| Account không có trong Sheet/inactive | Không vào được hệ thống |
| Email hoặc GoogleSub active bị trùng | Đăng nhập bị từ chối; audit báo lỗi |
| Token sai client ID/hết hạn/email chưa xác minh | Không nhận dữ liệu |
| Center từng xử lý nhưng không còn giữ/tiếp nhận hồ sơ | Chỉ thấy lịch sử xử lý của mình; không nhận PII/link Drive |

## 4. Trình tự trước khi cấp link cho đại lý

1. Cập nhật các dòng user thật trong tab `Người dùng`.
2. Chạy `auditUserAccessConfiguration()` và lưu kết quả `ok: true`.
3. Deploy Apps Script thành version mới.
4. Nếu OAuth app còn ở `Testing`, thêm account vào Audience > Test users.
5. Mở cửa sổ ẩn danh, thử đủ ba role và các ca từ chối trong bảng trên.
6. Chỉ gửi link GitHub Pages: `https://taqhung95-cloud.github.io/sungrow-service/`.
7. Sau lần login đầu, kiểm tra `GoogleSub` đã được điền và Nhật ký thay đổi ghi đúng email/center.
