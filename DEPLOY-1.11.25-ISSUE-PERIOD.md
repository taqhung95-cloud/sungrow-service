# Dashboard: lỗi theo ngày xác nhận — 1.11.25

1. Trong Apps Script backend chính, thay toàn bộ `LegacyDashboardApi.gs` bằng `version final/LegacyDashboardApi.gs` của bản này.
2. Nếu project đang dùng trợ lý, thay `QuickAssistantKnowledge.gs` bằng file cùng tên trong `version final/` để giải thích mốc kỳ đồng bộ.
3. Save → Deploy → Manage deployments → Edit Web App hiện tại → New version → Deploy. Giữ URL, tài khoản thực thi, Cloud và Properties.
4. Website: bấm Đồng bộ rồi tải lại dashboard. Không cần sửa frontend, ReportExport hoặc chạy migration.

## Kết quả

- Nhận SG125CX-P3 ngày02/10, xác nhận lỗi Mất lưới ngày03/11: model thuộc tháng10, lỗi thuộc tháng11.
- Linh kiện sử dụng ngày03/11: vẫn thuộc tháng11 theo Ngày sử dụng đã lưu.
- Hồ sơ nhiều lỗi: giữ đủ các nhóm lỗi xác nhận trong kỳ; cùng nhóm không nhân theo số dòng trùng.
- Lô Fan: lọc ngày xác nhận từng dòng lỗi, giữ số Fan bị lỗi, không biến thành số hồ sơ.
- Lỗi chưa có Ngày xác nhận lỗi hợp lệ không tự gán ngày nhận/ngày hoàn tất. Có thể bổ sung đúng ngày qua thao tác hồ sơ được cấp quyền; bản này không tự sửa dữ liệu.

## File không cần thay

Code.gs, ReportExport.gs, FanWorkOrders.gs, frontend và project upload giữ nguyên. Bản Legacy này đã giữ reader báo cáo linh kiện1.11.24 và các sửa SLA/assistant hiện có trên main.

Kiểm thử: `node "version final/tests/validate.mjs"`.
