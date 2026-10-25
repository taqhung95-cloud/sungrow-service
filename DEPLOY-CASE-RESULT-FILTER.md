> **Tài liệu lịch sử theo phiên bản.** Đối chiếu [quy tắc hiện hành](CURRENT-IMPLEMENTATION.md) và PRODUCTION-STATE.md trước khi dùng; không tự ghi đè backend hoặc chạy lại migration/repair từ hướng dẫn cũ.

# Bộ lọc kết quả gần nhất

Chỉ thay Code.gs bằng bản1.11.10-case-result-filter trong version final. Giữ nguyên LegacyDashboardApi.gs/FanLotRules.gs/FanLots.gs và các file khác đã cập nhật trước đó.

Save → Deploy → Manage deployments → Edit Web App hiện tại → Version: New version → Deploy. Giữ nguyên URL và quyền. Website Ctrl+F5.

Vào Danh sách hồ sơ → Tất cả kết quả → chọn kết quả cần lọc. Danh mục được lấy từ kết quả đang có trong phạm vi được xem, kết hợp các bộ lọc khác; giá trị giống cột Kết quả gần nhất. Lọc trước phân trang, chuyển lựa chọn về trang1. Chọn Tất cả kết quả để bỏ lọc. Nếu dropdown bị khóa, kiểm tra deployment đã New version rồi tải lại phiên. Không chạy migration hoặc ghi lại dữ liệu.
