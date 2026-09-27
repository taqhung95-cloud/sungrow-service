# Đồng bộ gần real-time và cache dữ liệu

Phiên bản: `1.4.2-projection-sync`

Dashboard giữ các tab năm 2024/2025/2026 làm dữ liệu nền. Các bản ghi nghiệp vụ khớp S/N + ngày nhận được dùng để cập nhật trạng thái của hồ sơ cũ; chỉ hồ sơ có `Nguồn dữ liệu = Quy trình mới` mới được bổ sung vào tổng số. Dữ liệu migrate không ghép được được báo trong `dataQuality.hybridMerge`, không tự cộng để tránh đếm trùng.

Mỗi thao tác tạo hoặc cập nhật hồ sơ đồng thời upsert đúng một dòng trong tab `Dữ liệu dashboard` theo `Mã hồ sơ`. Tab này là projection để đối soát; các bảng nghiệp vụ vẫn là nguồn giao dịch chính. Chạy `reconcileDashboardProjection()` một lần sau khi deploy để bổ sung các case quy trình mới đã tạo trước phiên bản này.

## Cơ chế đồng bộ

- Trang nhập liệu kiểm tra revision của database mỗi 15 giây.
- Dashboard quản lý cũng kiểm tra revision mỗi 15 giây; chỉ tải lại dashboard đầy đủ khi revision đổi. Chu kỳ refresh dự phòng 2 phút vẫn được giữ.
- Request kiểm tra revision không đọc toàn bộ Cases, WorkOrders và Transfers.
- Chỉ khi revision thay đổi, trang `Danh sách hồ sơ` mới tải lại dữ liệu.
- Khi tab được mở lại, trình duyệt có mạng trở lại hoặc cửa sổ được focus, hệ thống kiểm tra ngay.
- Nếu người dùng đang mở drawer/form xử lý hồ sơ, hệ thống không ghi đè màn hình. Một nút `Có dữ liệu mới · Bấm để tải lại` sẽ xuất hiện.
- Thay đổi do ứng dụng ghi được đánh revision ngay trong AuditLog. Luồng tải không dùng `DriveApp`, vì vậy deployment không phát sinh thêm OAuth scope Google Drive.

Đây là near-real-time, không phải WebSocket. Google Apps Script không cung cấp kết nối WebSocket lâu dài phù hợp cho kiến trúc hiện tại.

## Cải thiện độ trễ

- Kết quả `listCases` được cache tối đa 90 giây theo:
  - Google subject của đúng người dùng;
  - revision của database;
  - toàn bộ bộ lọc và phân trang.
- Khi có bất kỳ thay đổi nghiệp vụ nào, revision mới tạo cache key mới nên dữ liệu cũ không được dùng lại.
- Kết quả lớn hơn 90 KB không được đưa vào Apps Script Cache để tránh vượt giới hạn dịch vụ.
- Actor đã xác thực được cache 30 giây. Vì vậy polling không đọc lại tab Users mỗi 15 giây, nhưng thay đổi trạng thái hoặc phân quyền user vẫn có hiệu lực sau tối đa khoảng 30 giây.

## Phạm vi tự làm mới

- Tự làm mới ngay: trang `Danh sách hồ sơ` khi không có form/drawer đang mở.
- Các form `Tiếp nhận mới`, `Cập nhật hồ sơ`, `Luân chuyển center` không bị tự reset trong lúc nhập.
- Sau thao tác ghi dữ liệu thành công, luồng hiện có vẫn làm mới màn hình của người thực hiện.

## File cần triển khai lại

1. `Code.gs`
2. `LegacyDashboardApi.gs`
3. `Index.html`

Sau khi copy ba file vào Apps Script, tạo **New version** và deploy lại Web App. GitHub Pages dùng `docs/entry.html` mới sau khi push repository.
