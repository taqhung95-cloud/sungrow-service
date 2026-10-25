> **Tài liệu lịch sử theo phiên bản.** Đối chiếu [quy tắc hiện hành](CURRENT-IMPLEMENTATION.md) và PRODUCTION-STATE.md trước khi dùng; không tự ghi đè backend hoặc chạy lại migration/repair từ hướng dẫn cũ.

# Quyền xóa hồ sơ của quản lý hệ thống — 1.11.14

Tài khoản có vai trò gốc service_manager, Quản lý hệ thống hoặc Quản lý dịch vụ được xóa mềm hồ sơ của mọi center và mọi loại thiết bị, kể cả đã xác nhận bảo hành, đã hoàn tất, đã luân chuyển hoặc lô Fan có lịch sử xử lý.

Quản lý Sungrow Center giữ quyền sửa thông tin theo bản1.11.12. Vai trò gốc center_manager/sungrow_manager không tự có quyền xóa mở rộng. Quản lý center/nhân viên giữ quyền hủy tiếp nhận giới hạn như trước.

## File cần thay

Nếu đã cài bộ1.11.12 vừa gửi, chỉ thay toàn bộ nội dung **Code.gs** bằng file trong gói này. Giữ nguyên LegacyDashboardApi.gs, FanLots.gs, FanLotRules.gs và các file khác. Không cần sửa sheet, đổi quyền account, chạy migration hay xóa tay database.

1. Mở Apps Script đang dùng, thay Code.gs, Save.
2. Deploy → Manage deployments → Edit Web App hiện tại → Version: New version → Deploy. Giữ URL và Execute/access.
3. Website Ctrl+F5, đăng xuất và đăng nhập lại nếu đang giữ dữ liệu quyền cũ.

Frontend được cập nhật qua GitHub Pages riêng; backend chỉ có hiệu lực sau New version.

## Cách sử dụng

Mở Danh sách hồ sơ → nút X của hồ sơ cần xóa → nhập lý do → kiểm tra mã hồ sơ rồi xác nhận. Hồ sơ đã hoàn tất/đã xác nhận bảo hành sẽ có nút X khả dụng cho quản lý hệ thống.

Xóa mềm chuyển trạng thái sang Đã hủy, lưu người/ngày/lý do và audit. Hồ sơ ẩn khỏi danh sách/KPI; lịch sử công việc, lỗi, linh kiện, luân chuyển, tài liệu và dữ liệu nguồn được giữ nguyên. Không xóa vật lý. Không cho xóa lô Fan đang có giao dịch chưa đối soát; hoàn tất đối soát trước khi thử lại.

Đã kiểm thử bằng dữ liệu mẫu. Không thực hiện xóa thử dữ liệu production.
