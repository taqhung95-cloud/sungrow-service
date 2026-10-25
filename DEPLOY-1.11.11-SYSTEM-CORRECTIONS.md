> **Tài liệu lịch sử theo phiên bản.** Đối chiếu [quy tắc hiện hành](CURRENT-IMPLEMENTATION.md) và PRODUCTION-STATE.md trước khi dùng; không tự ghi đè backend hoặc chạy lại migration/repair từ hướng dẫn cũ.

# Quyền sửa hồ sơ — 1.11.11

Chỉ tài khoản **Quản lý hệ thống** (service_manager) được sửa thông tin gốc. Quản lý center và nhân viên không có quyền, kể cả quản lý center Sungrow. Áp dụng cho mọi loại thiết bị và hồ sơ đã hoàn tất. Các quyền cập nhật công việc thường ngày giữ nguyên.

## Các file cần thay trong Apps Script

Thay toàn bộ nội dung đúng 4 file bằng file cùng tên trong gói này:

1. Code.gs
2. LegacyDashboardApi.gs — cần thay để dashboard/báo cáo đọc các điều chỉnh số lượng/tiến độ.
3. FanLotRules.gs
4. FanLots.gs

Giữ các file Apps Script còn lại. Không thay Spreadsheet ID, tên sheet/cột hoặc URL Web App. Không cần chạy migration hoặc sửa tay database.

## Triển khai

1. Copy và thay đủ bốn file, rồi Save.
2. Có thể chạy kiemTraQuyenSuaHoSo để kiểm tra trong bộ nhớ. Kết quả đúng: ok:true, version:1.11.11-system-case-corrections, systemManagerOnly:true, allDeviceTypes:true, writtenToDatabase:false.
3. Deploy → Manage deployments → Edit Web App đang dùng → Version: New version → Deploy. Giữ nguyên Execute/access và URL.
4. Website Ctrl+F5, đăng nhập lại nếu phiên cũ còn giữ cấu hình quyền.

## Sử dụng

Quản lý hệ thống mở hồ sơ → Sửa thông tin hồ sơ. Thiết bị thường sửa S/N, Model, số lượng và các thông tin nguồn. Lô Fan sửa trên từng hàng S/N inverter, Model inverter, Model/Mã Fan, số quạt lỗi, hoàn tất, đã trả; tổng hồ sơ tự tính. Mỗi hàng vẫn nằm trên một dòng, có cuộn ngang khi hẹp.

Khi nhập nhầm số lượng, có thể điều chỉnh đồng thời số hoàn tất/đã trả để giữ 0 ≤ Đã trả ≤ Hoàn tất ≤ Số quạt lỗi. Đổi S/N inverter đưa bảo hành dòng về Chờ xác nhận; tra cứu không tự xác nhận bảo hành. Nhập lý do sửa rồi Lưu chỉnh sửa. Case ID, line ID và lịch sử cũ được giữ; điều chỉnh ghi thêm nhật ký. Đóng/mở lại lô theo số đã trả sẽ cập nhật ngày trả tương ứng. Không phát sinh nhân bản linh kiện.

Nếu thấy dữ liệu đã thay đổi, tải lại hồ sơ trước khi sửa tiếp. Nếu có giao dịch lô đang chờ đối soát, phải xử lý kết quả giao dịch đó trước; không xóa pending thủ công để ép lưu.

Frontend được phát hành qua GitHub Pages riêng. Chỉ cập nhật website chưa đủ để kích hoạt quyền và lưu dữ liệu phía server; cần thực hiện bước New version ở trên. Các kiểm thử dùng dữ liệu mẫu, không ghi thử database production.
