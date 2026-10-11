# Báo cáo quản lý — 1.10.19-manager-reports

Giao diện GitHub Pages có mục Báo cáo riêng, chỉ hiện cho actor.isGlobalManager === true. Backend kiểm tra cùng quyền trên cả getReportBootstrap và readReportPage; không cấp quyền mới cho tài khoản center.

## Cập nhật Apps Script hiện tại

1. Dùng các file **local hiện hành** cùng thư mục này: thay nội dung `Code.gs` và `LegacyDashboardApi.gs` trong dự án Apps Script production. Hai file phải cùng version `1.10.19-manager-reports`.
2. Tạo file script mới tên `ReportExport`, dán toàn bộ `ReportExport.gs`. Giữ nguyên các runtime khác đang có. Không cần thay `Index.html`; mục Báo cáo được triển khai ở frontend GitHub Pages.
3. Save → Deploy → Manage deployments → Edit → chọn New version → Deploy. Dùng deployment Web App hiện tại, **giữ nguyên URL và cấu hình chạy**.
4. Đăng xuất/đăng nhập lại trên GitHub Pages. Bootstrap phải có `reportExports: true`. Trước khi cập nhật backend, mục Báo cáo chỉ báo cần phiên bản mới; phần dashboard/nhập liệu vẫn dùng bình thường.
5. Tài khoản quản lý toàn bộ: chọn mẫu, ngày, trung tâm và cột; Xem trước tối đa 20 dòng, Xuất Excel lấy toàn bộ kết quả. Kiểm tra số dòng Excel với số hồ sơ hiển thị. Với tài khoản center, menu bị ẩn và API vẫn từ chối nếu gọi trực tiếp.

Không chạy initialize/migration/repair/rebuild, không thêm trigger, không sửa ID/tab/header hoặc quyền Drive. Báo cáo chỉ đọc; file `.xlsx` tạo trong trình duyệt và tải về máy, không lưu tạm lên Drive.

## Phạm vi bản đầu

- Chi tiết hồ sơ: mỗi dòng một lượt tiếp nhận (không gộp S/N), lọc ngày tiếp nhận/hoàn tất kỹ thuật/giao trả hoặc tồn tại ngày chốt; thêm trạng thái, bảo hành, loại thiết bị, từ khóa và trung tâm.
- Tổng hợp trung tâm: luồng tiếp nhận/hoàn tất/giao trả trong kỳ, tồn đầu kỳ/tại ngày chốt, quá hạn, chờ giao, SLA theo quy tắc dashboard. Chỉ lọc kỳ và trung tâm; không áp bộ lọc chi tiết gây lệch số tổng hợp.
- Trạng thái, bảo hành và trung tâm là thông tin hiện tại/chặng gần nhất, không tái dựng toàn bộ lịch sử ở từng ngày. Tồn có thể gồm hồ sơ trước ngày bắt đầu. Thiếu số lượng giữ trống, không tự tính là 1.
- Thông tin khách hàng và ghi chú nội bộ mặc định không chọn. Chỉ lấy thêm liên hệ từ bảng hồ sơ khi người dùng chọn các cột này.
- Excel có sheet Thông tin báo cáo và sheet dữ liệu; ngày/số/% đúng kiểu, S/N/điện thoại là text, dòng đầu cố định và có filter. Không chuyển text nguồn thành công thức Excel.
- Giới hạn 20.000 dòng / 32 MB; ô nội dung trên giới hạn Excel bị báo lỗi, không cắt âm thầm. Có trạng thái xoay tròn, tiến độ và Hủy.
- Phân trang 200 dòng, chốt revision/asOf/fingerprint; nếu dữ liệu đổi trong lúc xuất, hủy xuất và yêu cầu thử lại. Dùng canonical shared cache, không quét tab lịch sử theo trang và không ghi Sheet.
- Sửa trực tiếp hồ sơ trên Sheet vẫn chịu cơ chế revision/cache hiện tại của hệ thống; báo cáo không thêm cơ chế phát hiện onEdit riêng.

## Kiểm thử local

`node "version final/tests/reports.mjs"`, `reports-ui.mjs` (Playwright Edge, PLAYWRIGHT_MODULE), `reports-xlsx.py` (openpyxl), `validate.mjs`, `git diff --check`.

Fixture không có dữ liệu production. Đã kiểm tra phân quyền, ranh giới ngày Việt Nam, số lượng chưa biết, stock/flow, export đủ404 dòng qua ba trang, không xuất liên hệ mặc định, revision đổi, hủy, backend cũ, logout, desktop/mobile và mở XLSX bằng openpyxl. Chưa thay deployment Apps Script từ Codex; cần bước1–4 phía trên để bật export production.
