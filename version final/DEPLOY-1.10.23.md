# Khóa chéo biểu mẫu cập nhật công việc — 13/10/2026

## File Apps Script cần cập nhật

Copy toàn bộ nội dung từ các file canonical trong thư mục `version final`:

1. Code.gs
2. LegacyDashboardApi.gs
3. WorkOrderRules.gs — thêm file mới.

Giữ nguyên PortalSessions, Notifications, TemporaryUploads, SupplementalAttachments, ReportExport và các module đã cài. Save → New version trên Web App hiện tại → Deploy cùng URL. Không migration, initialize, rebuild hoặc sửa dữ liệu Sheet cũ. Backend mới `1.10.23-work-order-cross-locks`. Ctrl+F5 để nhận frontend liveJS121 / entry103 / work-order-rules JS1 / work-order-locks JS1.

## Quy tắc

- Đã nhận hàng/Đang kiểm tra/Chờ linh kiện/Đang sửa chữa/Đang kiểm tra sau sửa/Đang theo dõi: khóa Kết quả xử lý, Ngày hoàn tất kỹ thuật, Loại thiết bị đổi; server từ chối nếu có dữ liệu cuối ở trạng thái này.
- Hoàn tất kỹ thuật: bắt buộc có kết quả và ngày hoàn tất. Loại thiết bị đổi chỉ mở/bắt buộc với Đổi thiết bị; các kết quả khác phải để trống loại đổi.
- Chờ xác nhận bảo hành: chỉ nhận hàng/kiểm tra, khóa thông tin hoàn tất và nhập linh kiện; vẫn cho xóa dòng sai để xử lý dữ liệu cũ.
- Đã chuyển hàng đi/Đã đóng công việc không được chọn mới trong cập nhật kỹ thuật. Chỉ giữ nguyên trạng thái đã lưu để quản lý sửa thông tin; luân chuyển/giao trả dùng chức năng chuyên biệt. Hồ sơ hoàn tất khóa đổi trạng thái công việc; sửa thông tin kỹ thuật không mở lại hồ sơ đã giao.
- Các ngày thực tế không ở tương lai theo ngày Việt Nam. Ngày chẩn đoán không trước ngày center nhận; ngày hoàn tất không trước ngày chẩn đoán hoặc center nhận. Ngày nhận linh kiện ≤ ngày sử dụng. Tạm dừng: có lý do+ngày bắt đầu, kết thúc không trước bắt đầu; kết thúc trống vẫn cho phép. Không đổi công thức SLA thực tế/trừ dừng.
- Mã lỗi có tên lỗi; dòng linh kiện có tên và số lượng >0. Kiểm tra toàn bộ dòng trước khi ghi work/case/children để tránh lưu một phần do lỗi nhập liệu.

Frontend và backend dùng cùng hợp đồng validation, so khớp nội dung hai file rules trong test. Form giữ nguyên dữ liệu cũ mâu thuẫn và hiển thị lý do, chặn gửi; không âm thầm xóa. Đổi trạng thái về đang xử lý sẽ hỏi xác nhận trước khi xóa thông tin hoàn tất trong form. Các thay đổi chỉ ghi khi Lưu cập nhật. Khôi phục nháp chạy lại khóa chéo; Xóa dòng cuối cũng xóa select/ngày trong form.

Trạng thái hồ sơ Sẵn sàng trả khách chỉ suy ra khi trạng thái kỹ thuật phù hợp + kết quả + ngày hoàn tất. Nếu quay lại xử lý chưa hoàn tất, bỏ ngày sẵn sàng cũ trên chính hồ sơ cập nhật; hồ sơ Đã hoàn tất giữ trạng thái đã giao. Không sửa hàng loạt dữ liệu tồn tại trước release.

Kiểm thử local: ma trận trạng thái/kết quả/bảo hành/đổi thiết bị, ngày sai/future, dữ liệu children không hợp lệ bị chặn trước mọi write, suy ra trạng thái hồ sơ; Edge dùng biểu mẫu thật kiểm tra bảo toàn dữ liệu lỗi, xác nhận/cancel khi xóa, khóa/mở trường và chặn submit. Không thử ghi production từ Codex.
