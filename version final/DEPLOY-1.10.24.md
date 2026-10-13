# Ngày sử dụng linh kiện và bố cục cột — 13/10/2026

Frontend liveJS122 / entry104 / work-order-rules JS2 / work-order-locks JS2 / form-drafts JS3.

- Ô Ngày sử dụng xuất hiện trên từng dòng linh kiện, hiển thị đúng ngày đã lưu và cho sửa trực tiếp. Không tự đổi ngày lịch sử khi mở form hoặc đổi trạng thái.
- Nếu để trống, khi lưu vẫn lấy ngày hoàn tất kỹ thuật theo cơ chế hiện hành. Khi chưa hoàn tất và chưa nhập ngày, ngày sử dụng để trống.
- Ngày tương lai/sai thứ tự vẫn bị chặn; thông báo ghi rõ Part Number để tìm đúng dòng. Không còn lấy ngày sử dụng từ thuộc tính ẩn của dòng.
- Mã, tên, ngày, Xóa và Thêm của hai phần Lỗi xác nhận/Linh kiện dùng chung độ rộng và vị trí cột; số lượng có cột riêng. Màn hình nhỏ chia hai cột.
- Nháp lưu và khôi phục ngày sửa theo từng dòng; nháp cũ vẫn được bảo vệ bởi cơ chế kiểm tra xung đột.

Frontend có thể dùng với backend1.10.23 vì API đã hỗ trợ usedAt. Để đồng bộ thông báo lỗi phía máy chủ, copy toàn bộ Code.gs, LegacyDashboardApi.gs và WorkOrderRules.gs trong thư mục này vào Apps Script; Save → New version trên deployment hiện tại → Deploy, giữ URL. Backend1.10.24-editable-part-dates. Giữ nguyên các module khác. Không chạy migration hoặc sửa hàng loạt dữ liệu cũ.

Kiểm thử: Edge với biểu mẫu thật, ngày kế thừa tương lai được hiển thị, sửa ngày rồi lưu đúng payload, khôi phục nháp, canh cột trên desktop và không tràn ngang mobile; quy tắc nghiệp vụ và bộ validate hiện hành. Không ghi thử hồ sơ production.
