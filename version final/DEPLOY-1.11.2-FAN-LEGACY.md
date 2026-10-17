# 1.11.2 — chuyển nhóm Fan cũ thành hồ sơ lô thực sự

Hai hàm xemTruocNhomFanCu/apDungNhomFanCu của bản trước chỉ tạo liên kết nhóm. Bản này bổ sung FanLegacyMigration để chuyển các nhóm đã được chỉ định rõ, chưa có xử lý, sang hồ sơ lô vận hành được trên giao diện mới.

## File cần cập nhật từ bản 1.11.1

Thay toàn bộ Code.gs, LegacyDashboardApi.gs, ManagerDashboard.gs, FanLotRules.gs, FanLots.gs. Thêm Script FanLegacyMigration.gs. Thêm Script wrapper được chuẩn bị riêng từ các mã nhóm đã kiểm tra; wrapper thực tế không đưa lên Git vì chứa định danh nguồn. Giữ ReportExport.gs, PortalReadDiagnostics.gs và các module khác đã cài.

## Thứ tự bắt buộc

1. Copy đủ các file và Save.
2. Deploy → Manage deployments → Edit deployment hiện tại → New version → Deploy. Giữ nguyên URL và quyền truy cập.
3. Mở portal, Ctrl+F5 và đăng nhập lại bằng tài khoản quản lý toàn hệ thống. Backend mới cần ghi nhận khả năng giữ KPI của cả LegacyDashboardApi, ManagerDashboard và FanLotRules trước khi cho chuyển đổi.
4. Trong Editor, chạy hàm xem trước của wrapper. Kiểm tra nhóm, số case nguồn, tổng Fan, số S/N và kpiBefore/kpiAfter. Preview có hiệu lực 30 phút và khóa fingerprint/revision.
5. Chạy hàm áp dụng của wrapper. Hàm tạo backup toàn database và biên nhận snapshot trên Drive trước khi ghi. Không chạy hai hàm gom nhóm cũ thay cho hàm chuyển đổi này.
6. Kết quả cần ok:true, đúng số lô/số nguồn, kpiBefore bằng kpiAfter, partsBefore/partsAfter đều 0 và audit.ok:true. Giữ backupId/receiptId. Chạy lại sau mất phản hồi chỉ phục hồi đồng bộ, không chuyển hoặc ghi nhật ký lần nữa.
7. Chạy doiSoatFanTheoLo, diagnosePortalReadPath, diagnoseWebReadPaths. Mở nhóm trên portal để kiểm tra giao diện cập nhật từng S/N, tài liệu nguồn, bảo hành và số liệu dashboard.

## Phạm vi và cách bảo toàn dữ liệu

- Chỉ nhận nhóm Fan Quy trình mới, cùng khách hàng/ngày/center, mỗi nguồn có một công việc Đã nhận hàng, chưa chẩn đoán/hoàn tất/trả khách và không có linh kiện, lỗi xác nhận, tạm dừng hoặc luân chuyển. Dữ liệu khác bị chặn để xử lý riêng.
- Case nguồn đầu tiên làm hồ sơ lô. Các case còn lại vẫn giữ hàng nguồn, được lưu mềm bằng trạng thái Đã hủy với lý do chuyển vào mã lô, không phải hủy nghiệp vụ của khách. Không xóa vật lý.
- S/N lặp cộng Fan. Bảo hành từng S/N giữ nguyên; cùng S/N có kết luận mâu thuẫn sẽ bị chặn. Nguồn đã duyệt không bị tự chuyển về chờ xác nhận.
- Giữ nguyên ID công việc, ghi chú và hiện tượng ban đầu; chỉ đổi liên kết về case lô. Giữ tài liệu tại folder gốc, liên kết từng nguồn trong snapshot. Model inverter được giữ trong chi tiết nguồn; mã Fan chưa biết để trống, không tự suy ra PN.
- Lô chuyển đổi giữ trọng số KPI và số nguồn ban đầu; lô tạo mới vẫn theo định nghĩa 1 Thiết bị/Hồ sơ. Nguồn lưu mềm không tính thêm. Fan vật lý hiển thị riêng.
- Không ghi thêm linh kiện khi chuyển. Sau chuyển, ghi spare part theo PN/số thực dùng/ngày dùng vào Linh kiện sử dụng hiện hành, gắn công việc đang xử lý; không nhân theo số hồ sơ nguồn.
- Case/works/nhóm/nhật ký lô/nhật ký thay đổi được ghi trong cùng batch. Sau đó đồng bộ projection, chỉ mục, revision và đối soát. Có pending nếu chưa hoàn tất đồng bộ. Không ghi tab 2024/2025/2026.

## Trạng thái triển khai

Gói này không tự chạy chuyển đổi chỉ bằng cách push GitHub. Apps Script do người dùng cập nhật và thực thi. Chỉ coi hoàn thành production khi hàm áp dụng trả ok:true và readback/audit đạt; bản xem trước local không thay thế bước này.

## Nếu Apps Script báo APP_VERSION already declared

Lỗi nạp project xảy ra trước khi hàm được chọn thực thi. Thay toàn bộ nội dung LegacyDashboardApi.gs bằng file chuẩn, không tạo thêm bản sao hoặc nối code. File bắt đầu bằng `const LEGACY_DASHBOARD_API = (function () {` rồi `const LEGACY_API_VERSION = '1.11.2-fan-legacy';` và có đóng wrapper `})();`. APP_VERSION chỉ khai báo ở Code.gs. Save rồi chạy lại batFanTheoLo; khi không còn lỗi mới tiếp tục New version và các bước chuyển đổi ở trên. Nếu còn lỗi, dùng tìm kiếm toàn project để tìm thêm khai báo APP_VERSION hoặc bản sao Code.gs; không xóa module nghiệp vụ để né lỗi.
