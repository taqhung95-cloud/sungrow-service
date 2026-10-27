# Lưu lý do tạm dừng SLA mới — 27/10/2026

Trạng thái: Code1.11.21-sla-dropdown đã kiểm thử local, chưa deploy. Backend1.11.20 đã được người dùng xác nhận deploy; frontend163/entry144 đã phát hành.

## Nguyên nhân và phạm vi

Đã đọc quy tắc thực tế của cột Lý do tạm dừng: ONE_OF_LIST strict với6giá trị cũ, thiếu “Chờ khách nhận hàng” và “Yếu tố khách quan sau sẵn sàng giao”. Sheets có thể từ chối ghi lý do mới sau khi mã cũ đã cập nhật một số giá trị. Đây không phải giới hạn quyền quản lý sửa hồ sơ đã hoàn tất.

Code mới preflight đúng ô của các khoảng được gửi trước mọi ghi hồ sơ/công việc: giữ quy tắc strict và lựa chọn cũ, bổ sung lựa chọn chính thức cần thiết. Không xóa validation, không mở quyền ghi tùy ý, không thay cấu trúc, không chạy migration. Cả luồng thường và Fan dùng chung guard. Rule không hỗ trợ thì trả thông báo rõ trước khi ghi nghiệp vụ.

Quản lý vẫn được điều chỉnh hồ sơ đã hoàn tất; nhân viên không được dùng thao tác này để vượt quyền. Giữ ngày trả và trạng thái hoàn tất. Các ràng buộc ngày vẫn có hiệu lực cho quản lý.

## Người dùng thao tác Apps Script

1. Trong project chính, thay toàn bộ nội dung **Code.gs** bằng `version final/Code.gs` tại commit của release này. Dòng đầu phải là `const APP_VERSION = '1.11.21-sla-dropdown';`.
2. Save → Deploy → Manage deployments → Edit deployment chính → New version → Deploy. Giữ URL, executor, quyền truy cập, OAuth, Properties và worker.
3. Tải lại hồ sơ. Kiểm tra hai khoảng17–21/10 và21–26/10 cùng lý do thực tế rồi lưu. Nếu form nạp dòng trống do lần lỗi trước, bỏ dòng đó khỏi form trước khi lưu. Không tạo lại hồ sơ hoặc nhập lại linh kiện. Luồng lưu giữ ID của khoảng cũ; dòng con không dùng sẽ được đối soát theo cơ chế hiện có khi lưu thành công.

Không cần thay WorkOrderRules.gs, FanWorkOrders.gs, LegacyDashboardApi.gs hoặc frontend cho riêng bản sửa này. Mã đã được kiểm thử, chưa có bằng chứng thử lưu thành công trên Google thật sau deploy1.11.21.

## Kiểm thử

`node "version final/tests/validate.mjs"` và `git diff --check`.

Test sla-dropdown chạy pipeline cập nhật thật trong VM với rule Sheets strict giả lập: quản lý sửa hồ sơ đóng, giữ trạng thái/ngày trả, hai khoảng lưu đúng, loại dòng con ghi dở, giữ các lựa chọn trước, lỗi rule chặn trước ghi và nhân viên bị từ chối. Bộ hồi quy Fan/luân chuyển/parts/cache/upload vẫn đạt. Không suy test giả lập thành đã sửa dữ liệu production.
