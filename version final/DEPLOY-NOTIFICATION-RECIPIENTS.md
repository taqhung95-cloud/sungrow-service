> **Tài liệu lịch sử theo phiên bản.** Đối chiếu [quy tắc hiện hành](../CURRENT-IMPLEMENTATION.md) và PRODUCTION-STATE.md trước khi dùng; không tự ghi đè backend hoặc chạy lại migration/repair từ hướng dẫn cũ.

# Quy tắc người nhận và noti hai hàng — 12/10/2026

Đây là bản bổ sung trên backend 1.10.20 đã cài. **Chỉ thay toàn bộ nội dung file Notifications.gs hiện có bằng file local cùng thư mục**, không tạo file trùng. Save → Manage deployments → Edit → New version → Deploy, giữ URL. Code.gs/LegacyDashboardApi.gs/ReportExport.gs không cần thay thêm cho bản bổ sung này.

- Yêu cầu duyệt: chỉ người có quyền duyệt trong phạm vi được xem nhận chuông; người gửi không nhận thông báo yêu cầu của mình. UI người gửi chỉ hiện xác nhận nhỏ “Đã gửi yêu cầu duyệt”, tự tắt sau2,5 giây; nút Đã gửi vẫn khóa để chống gửi trùng, không có banner email/ngày lớn.
- Kết quả duyệt: người gửi yêu cầu nhận thông báo sau khi duyệt; người duyệt và quản lý toàn hệ thống cũng xem kết quả. Nhân viên khác không tự nhận thông báo duyệt của người khác chỉ vì cùng center.
- Các thao tác khác (tạo/cập nhật/xóa/luân chuyển/trả khách): người thao tác, quản lý trung tâm liên quan (roleCode center_manager), quản lý toàn hệ thống. Vẫn kiểm tra phạm vi case/center, không mở dữ liệu đã hủy hay vượt quyền.
- Recipient lọc ở backend, cả list/badge/phân trang và đánh dấu đã đọc dùng cùng quy tắc. Metadata kết quả ghi người gửi từ audit; metadata cũ còn trong cửa sổ1000 dòng được nối lại với yêu cầu trước đó. Không sửa/xóa audit cũ, không thêm tab/cột.
- Mỗi noti đúng2 hàng: `Model - SN: … - Nội dung thay đổi` và `Bởi: … vào lúc …`. Dài quá thì dấu…, tooltip/aria giữ toàn bộ text; click mở chi tiết theo quyền. Yêu cầu pending vẫn màu cam riêng. Montserrat giữ nguyên.

Frontend liveJS106/entry89/notifications JS2/CSS3 đã kiểm thử desktop/mobile, toast tự tắt và không banner sender, hai dòng đơn/hàng cao tối đa60px, màu pending, font, open case; backend kiểm thử sender/approver/actor/center manager/global, peer staff không nhận, kết quả gửi lại requester, metadata cũ/mark-read và cache/paging. Không tạo test trên production. Tải lại web Ctrl+F5 sau deploy để loại frontend/notification cũ.
