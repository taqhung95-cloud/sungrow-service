# Bổ sung Model inverter cho hồ sơ Fan theo lô cũ

Đã cài1.11.9: chỉ thay nội dung FanLots.gs bằng version final/FanLots.gs hiện tại. Giữ nguyên Code.gs, LegacyDashboardApi.gs, FanLotRules.gs và các file khác. Save → Deploy → Manage deployments → Edit Web App đang dùng → New version → Deploy, không đổi URL/quyền. Website Ctrl+F5.

Mở hồ sơ → Sửa thông tin hồ sơ → bảng Model theo S/N inverter. Cột giữa tự tra Model inverter cho S/N thiếu; cột phải vẫn là Model/Mã Fan. Có nút Tra lại Model inverter để thử lại khi nguồn tra thiếu/lỗi. Chờ tra xong, nhập lý do sửa và Lưu chỉnh sửa. Model chỉ ghi khi lưu, không cần cập nhật công việc hoặc nhập lại linh kiện.

Không tra được: không ghi đè Model đã lưu, không gán Model inverter thành Model Fan. Hồ sơ/tiến độ/số lượng/KPI/linh kiện giữ nguyên; không migration. Nếu còn thông báo cần cập nhật FanLots.gs, kiểm tra đúng deployment và đã New version rồi tải lại phiên.
