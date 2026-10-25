> **Tài liệu lịch sử theo phiên bản.** Đối chiếu [quy tắc hiện hành](CURRENT-IMPLEMENTATION.md) và PRODUCTION-STATE.md trước khi dùng; không tự ghi đè backend hoặc chạy lại migration/repair từ hướng dẫn cũ.

# Bổ sung quản lý Sungrow Center — 1.11.12

Quyền sửa thông tin gốc: Quản lý hệ thống và Quản lý Sungrow Service Center. Áp dụng mọi loại thiết bị, mọi center, kể cả hồ sơ đã hoàn tất. Quản lý các center khác và nhân viên mọi center không được sửa thông tin gốc. Quyền cập nhật công việc hằng ngày giữ nguyên.

## File cần thay

Nếu đã cài đủ bộ 1.11.11: chỉ thay toàn bộ nội dung **Code.gs** và **FanLots.gs** bằng hai file cùng tên trong gói này. LegacyDashboardApi.gs và FanLotRules.gs giữ nguyên.

Nếu chưa cài bộ 1.11.11: thay đủ bốn file trong gói: Code.gs, FanLots.gs, LegacyDashboardApi.gs, FanLotRules.gs. Hai file sau vẫn là bản đã kiểm thử của1.11.11. Không thêm/xóa sheet/cột hoặc chạy migration.

## Triển khai

1. Copy code vào đúng file trong Apps Script hiện tại, Save.
2. Có thể chạy kiemTraQuyenSuaHoSo: ok:true, version:1.11.12-sungrow-case-corrections, systemAndSungrowManagers:true, allDeviceTypes:true, writtenToDatabase:false. Hàm chỉ kiểm tra trong bộ nhớ.
3. Deploy → Manage deployments → Edit deployment Web App đang dùng → New version → Deploy. Giữ URL và cấu hình Execute/access hiện tại.
4. Website Ctrl+F5; đăng xuất/đăng nhập lại nếu phiên vẫn dùng thông tin quyền cũ.

Trong tab Người dùng, quản lý Sungrow cần vai trò Quản lý trung tâm/center_manager (hoặc alias sungrow_manager) và Trung tâm: Sungrow Service Center. Không cấp quyền bằng cách đổi vai trò của nhân viên Sungrow. Quản lý hệ thống vẫn dùng service_manager/Quản lý hệ thống.

Sửa hồ sơ tại Sửa thông tin hồ sơ. Lô Fan sửa SN/Model/số quạt lỗi/hoàn tất/đã trả trên từng dòng. Giữ 0≤đã trả≤hoàn tất≤số quạt lỗi, nhập lý do. Đổi SN đưa bảo hành dòng về Chờ xác nhận. Lịch sử/linh kiện gốc giữ nguyên, các điều chỉnh và dashboard được đồng bộ như bộ1.11.11.

Frontend phát hành qua Pages riêng. Backend chỉ có hiệu lực sau New version. Đã kiểm thử bằng dữ liệu mẫu, không ghi thử database production.
