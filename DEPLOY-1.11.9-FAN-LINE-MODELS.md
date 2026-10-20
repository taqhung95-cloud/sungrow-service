# Cập nhật Fan nhiều Model — 1.11.9

Frontend Pages triển khai riêng. Lưu và tổng hợp Model từng S/N cần backend mới trước khi tạo lô mới. Không migration, không đổi Spreadsheet/tên tab/cột/URL Web App.

1. Trong Apps Script hiện tại, thay toàn bộ nội dung đúng4file bằng file cùng tên trong version final: Code.gs, LegacyDashboardApi.gs, FanLotRules.gs, FanLots.gs. Giữ các file khác.
2. Save. Chạy kiemTraFanNhieuModel: kết quả ok:true, version:1.11.9-fan-line-models, models:2, fans:5, kpiCases:1, writtenToDatabase:false. Hàm chỉ kiểm tra dữ liệu mẫu trong bộ nhớ.
3. Deploy → Manage deployments → Edit deployment Web App đang dùng → Version: New version → Deploy. Giữ nguyên URL và cấu hình Execute/access.
4. Website Ctrl+F5. Thông báo cần cập nhật1.11.9 trong bảng Fan phải biến mất. Nếu còn, kiểm tra đúng deployment/đủ4file và tải lại phiên.

S/N tự tra Model inverter/bảo hành. Người nhập điền Model/Mã Fan thực tế và số Fan cho từng dòng. Không suy mã Fan từ inverter. CùngSN chỉ một mã Fan; cùngSN cùngmã cộng số lượng. Excel: SN | Model/Mã Fan | Số Fan | Ghi chú (tùy chọn), Tab giữa cột. Dữ liệu giả SN-MAU-A/FAN-A/2 và SN-MAU-B/FAN-B/3 →1hồ sơ,5Fan,2Model; không coi mã minh họa là mã Fan thật.

Hồ sơ cũ không viết lại. Tỷ trọng Model dùng Model dòng nếu có, không có thì giữ Model hồ sơ cũ. Quản lý sửa mã tại Sửa thông tin hồ sơ → Model Fan theo S/N, ghi lý do; không tạo lại công việc hoặc spare part. KPI tiếp nhận/chờ giao/đã giao theo Thiết bị/Hồ sơ; parts theo sổ thực dùng.

Đã kiểm thử fixture: atomic create/retry; sửa theo quyền/CAS/audit/revision, giữ tiến độ; Model quantities, dashboard kỳ/center/quyền/cache; các luồng Fan/inverter, một hàng màn hình hẹp. Chưa ghi thử lên database production. Chỉ xác nhận backend live sau bước3.
