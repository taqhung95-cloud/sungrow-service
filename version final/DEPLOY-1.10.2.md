# Deploy 1.10.2 — đồng nhất phạm vi thiết bị và giải thích độ phủ ngày nhận

Version: `1.10.2-ticket-coverage`

## File Apps Script cần thay

1. Thay toàn bộ `Code.gs` bằng `version final/Code.gs`.
2. Thay toàn bộ `LegacyDashboardApi.gs` bằng `version final/LegacyDashboardApi.gs`.
3. Bấm **Save**.

## Dữ liệu lịch sử

Nếu quy trình đối soát chưa hoàn tất, tiếp tục chạy lần lượt:

1. `auditHistoricalWarrantyData`
2. `repairHistoricalWarrantyData`
3. `auditHistoricalDashboardProjection`
4. `repairHistoricalDashboardProjection`
5. `rebuildPortalCaseIndex`

Mỗi hàm phải báo `Execution completed` trước khi chạy hàm kế tiếp.

## Deploy

1. Vào **Deploy → Manage deployments → Edit**.
2. Chọn **New version** trên deployment Web App hiện tại.
3. Bấm **Deploy**.
4. Kiểm tra bootstrap hiển thị `1.10.2-ticket-coverage`.
5. Mở website và bấm `Ctrl + Shift + R`.

Khi chọn **Tất cả trung tâm**, quản lý toàn hệ thống sẽ thấy cả hồ sơ có tên center chưa chuẩn hóa. Biểu đồ ghi rõ **Tích lũy có ngày nhận** và hiển thị số hồ sơ không thể phân bổ vào năm/tháng do ngày nhận thiếu, sai hoặc lệch năm nguồn.
