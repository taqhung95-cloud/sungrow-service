# 1.10.14 — Nhóm file đính kèm và trạng thái cập nhật

## Triển khai

1. Thay toàn bộ Code.gs, LegacyDashboardApi.gs và TemporaryUploads.gs bằng các file cùng thư mục với tài liệu này, rồi Save.
2. Trên deployment Web App hiện tại: Edit → New version → Deploy. Giữ nguyên URL.
3. Reload website; nếu đang nhập form, lưu lại thông tin trước khi reload.
4. Nếu upload tạm đã được khởi tạo ở 1.10.13, không cần chạy lại initializeTemporaryUploads. Nếu chưa khởi tạo, quản lý chạy hàm này một lần bằng tài khoản có quyền ghi folder tạm và folder center.

Không migration, repair hoặc rebuild index cho release này. Frontend chỉ bật 4 nhóm khi bootstrap báo uploadCategories=true; backend cũ vẫn dùng picker chung.

## Quy tắc

- Mẫu thu thập thông tin sự cố: tối đa 1 file.
- Hình ảnh thiết bị tại công trình, Log file, Log sóng sự cố (nếu có): nhiều file, cùng chia sẻ giới hạn tổng 10 file.
- Mỗi file tối đa 8 MiB. Giữ loại DOC/DOCX, PDF, XLS/XLSX, ZIP/RAR, JPG/JPEG, PNG; không thêm giới hạn định dạng riêng từng nhóm.
- Giữ yêu cầu ít nhất 1 file tổng cộng, không bắt buộc riêng từng nhóm.
- Chọn file là bắt đầu upload tuần tự vào folder tạm; progress đếm file Drive đã xác nhận. TTL24h/cleanup theo lịch và quyền owner+center giữ nguyên.
- File tạm cũ chưa có nhóm: chọn nhóm trong danh sách đã tải, không cần upload lại. Các hồ sơ đã tạo trước đây không bị đổi tên/file.
- Khi tạo case, file được giữ trong folder case hiện hành, tên có tiền tố 01_Mau thu thap su co / 02_Hinh anh cong trinh / 03_Log file / 04_Log song su co. Không tạo subfolder, không đổi schema database hay ACL Drive. File chưa phân nhóm từ frontend cũ vẫn tương thích backend.
- Thao tác mutation nghiệp vụ ở giao diện nhập liệu hiện thông báo có vòng xoay từ lúc gửi API đến khi nhận kết quả/lỗi/timeout, chặn gửi mutation thứ hai trong cùng phiên UI. Đọc dữ liệu và trang khác không bị khóa. Không tự retry mutation khi mất phản hồi; spinner không khẳng định tác vụ đã thành công.

## Kiểm chứng

validate.mjs, temporary-uploads.mjs và intake-idle.mjs (actual frontend, API local giả lập) kiểm tra category/limits/auth/center/retry, metadata-only recategorization, persisted filename category, reload và spinner đang chờ máy chủ. Không upload hay tạo case production; chưa kiểm thử tải đồng thời 15 tài khoản trên deployment mới.
