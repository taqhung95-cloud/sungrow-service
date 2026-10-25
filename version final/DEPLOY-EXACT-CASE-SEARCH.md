> **Tài liệu lịch sử theo phiên bản.** Đối chiếu [quy tắc hiện hành](../CURRENT-IMPLEMENTATION.md) và PRODUCTION-STATE.md trước khi dùng; không tự ghi đè backend hoặc chạy lại migration/repair từ hướng dẫn cũ.

# Tìm chính xác S/N/mã hồ sơ — 14/10/2026

Frontend liveJS128/entry110/exact-case-search JS1.

Backend: 1.10.25-exact-case-search (APP_VERSION đồng bộ ở hai file).

Thay nội dung Code.gs và LegacyDashboardApi.gs bằng hai file cùng thư mục này trong Apps Script.
Giữ các module hiện hành. Save, tạo New version
trên deployment Web App hiện tại, giữ nguyên URL.

Không migration, không đổi cấu trúc hoặc dữ liệu Sheet.

searchCases nhận tùy chọn exactKey, trả một hồ sơ đầy đủ trong cùng request
nếu chỉ có một kết quả; nhiều lần tiếp nhận trả danh sách tóm tắt, chỉ tải
getCaseDetail cho hồ sơ được chọn. Kiểm tra quyền xem và trạng thái hủy
giữ nguyên. Caller cũ không truyền tùy chọn vẫn nhận array như trước.

Frontend tương thích backend cũ bằng cách kiểm tra các trang chỉ mục,
nhưng cải thiện tốc độ đầy đủ cần triển khai Code.gs mới.
Không có số đo latency production trước/sau từ tài khoản thực trong đợt này.
