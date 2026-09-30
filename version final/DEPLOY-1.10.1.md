# Deploy 1.10.1 — danh sách thiết bị toàn bộ năm

Version: `1.10.1-all-ticket-history`

## File Apps Script cần thay

1. Thay toàn bộ `Code.gs` bằng `version final/Code.gs`.
2. Thay toàn bộ `LegacyDashboardApi.gs` bằng `version final/LegacyDashboardApi.gs`.
3. Bấm **Save**.

## Dữ liệu lịch sử

Nếu quy trình đối soát 1.10.0 chưa hoàn tất, tiếp tục chạy lần lượt:

1. `auditHistoricalWarrantyData`
2. `repairHistoricalWarrantyData`
3. `auditHistoricalDashboardProjection`
4. `repairHistoricalDashboardProjection`
5. `rebuildPortalCaseIndex`

Mỗi hàm phải báo `Execution completed` trước khi chạy hàm kế tiếp.

Nếu các hàm trên đã hoàn tất trước đó thì không cần chạy lại chỉ để bật danh sách toàn bộ năm.

## Deploy

1. Vào **Deploy → Manage deployments → Edit**.
2. Chọn **New version** trên deployment Web App hiện tại.
3. Bấm **Deploy**.
4. Kiểm tra bootstrap hiển thị version `1.10.1-all-ticket-history`.
5. Mở website và bấm `Ctrl + Shift + R`.

Danh sách thiết bị sẽ tự xây chỉ mục dùng chung cho dữ liệu 2024 đến năm hiện tại ở lần tải đầu. Các lần phân trang, tìm kiếm và lọc tiếp theo dùng cache theo revision database; không cần chạy thêm hàm khởi tạo.
