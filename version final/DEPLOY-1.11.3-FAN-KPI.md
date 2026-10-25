> **Tài liệu lịch sử theo phiên bản.** Đối chiếu [quy tắc hiện hành](../CURRENT-IMPLEMENTATION.md) và PRODUCTION-STATE.md trước khi dùng; không tự ghi đè backend hoặc chạy lại migration/repair từ hướng dẫn cũ.

# 1.11.3 — KPI Thiết bị/Hồ sơ cho Fan

Fan nhập thường tính 1 thiết bị cho mỗi hồ sơ đang có hiệu lực. Mỗi lô Fan tính 1 hồ sơ, bao gồm lô tạo mới và lô đã chuyển đổi. Các loại thiết bị khác giữ quy tắc hiện hành. Hồ sơ nguồn đã nhập lô không cộng thêm. Áp dụng cùng đơn vị cho KPI, tỷ trọng model, bảng center, lũy kế, SLA và báo cáo dựa trên canonical reader. Không hiển thị dòng Fan theo lô: ... chiếc trên thẻ KPI; giữ tên Thiết bị/Hồ sơ.

Số Fan thực tế, tiến độ từng S/N, bảo hành, hồ sơ nguồn, tài liệu và spare part giữ nguyên. legacyImport.kpiQuantity trong snapshot cũ là chứng từ đối soát tại thời điểm chuyển đổi, không còn là trọng số KPI hiện hành. Không sửa snapshot hoặc nhật ký đã ghi, không chuyển đổi lại dữ liệu.

## Cập nhật Apps Script thủ công

1. Thay toàn bộ nội dung đúng 5 file: Code.gs, LegacyDashboardApi.gs, ManagerDashboard.gs, FanLotRules.gs, FanLegacyMigration.gs. Giữ các module còn lại. Không tạo bản sao file hoặc nối code vào cuối file cũ.
2. Save. Deploy → Manage deployments → Edit Web App hiện tại → New version → Deploy. Giữ URL và cấu hình Execute as: Me, Who has access: Anyone.
3. Mở dashboard, Ctrl+F5, đăng nhập lại nếu cần. Hai lô 9 và 3 Fan đóng góp tổng 2 hồ sơ. Thiết bị ở đây là inverter: Fan nhập thường của một inverter tính1 thiết bị dù có nhiều Fan; mỗi lô tính1 hồ sơ. Phải đối soát cả hồ sơ Fan thường, không chỉ trừ phần trọng số hai lô; không dùng dự báo33 xuống23 trước đây.
4. Chạy doiSoatFanTheoLo để kiểm tra dữ liệu vận hành. Không chạy lại chuanBiFanTheoLo, chuyen12CaseFanThanhLo hoặc khôi phục backup cho bản sửa KPI này.

GitHub chỉ tự cập nhật giao diện; KPI mới có hiệu lực sau khi deploy đủ backend. Backend/Frontend cùng release 1.11.3-fan-kpi, liveJS135, entry117, rules4. Đổi version giúp bỏ cache KPI cũ; không thêm lượt đọc bảng hoặc quét lịch sử. Linh kiện vẫn lấy số thực dùng từ Linh kiện sử dụng, không nhân hoặc quy đổi theo Fan/hồ sơ.
