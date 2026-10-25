> **Tài liệu lịch sử theo phiên bản.** Đối chiếu [quy tắc hiện hành](../CURRENT-IMPLEMENTATION.md) và PRODUCTION-STATE.md trước khi dùng; không tự ghi đè backend hoặc chạy lại migration/repair từ hướng dẫn cũ.

# Yêu cầu duyệt bảo hành và chuông thông báo — 1.10.20-warranty-notifications

## Cập nhật backend

1. Thay nội dung `Code.gs` và `LegacyDashboardApi.gs` bằng **các file local hiện hành cùng thư mục này**, cùng version `1.10.20-warranty-notifications`.
2. Tạo file script mới `Notifications`, dán toàn bộ `Notifications.gs`. Giữ các runtime đang có, gồm `ReportExport.gs` nếu đã cài Báo cáo. Không cần thay `Index.html` cho frontend GitHub Pages đang sử dụng.
3. Save → Deploy → Manage deployments → Edit → **New version** → Deploy trên deployment Web App hiện tại; không đổi URL/cấu hình thực thi.
4. Tải lại và đăng nhập lại GitHub Pages. Bootstrap cần có `notifications: true`; iframe entry87/liveJS104. Trước backend mới, chuông và nút gửi yêu cầu bị khóa với hướng dẫn cập nhật; không gọi API chưa tồn tại.
5. Kiểm thử bằng hồ sơ thực tế phù hợp: DAT/XB/BKE/JGP hoặc nhân viên Sungrow không có approveWarranty thấy “Yêu cầu duyệt”; tài khoản được duyệt vẫn dùng “Duyệt bảo hành”/“Xác nhận bảo hành”. Không tạo hoặc sửa hồ sơ production chỉ để chạy test giả lập.

Không initialize/migration/repair/rebuild, không thêm tab/header, không sửa lịch sử 2024–2026/ID/quyền Drive. Chỉ giao diện GitHub Pages được cập nhật trong gói này; backend chưa được triển khai tự động từ Codex.

## Quy tắc nghiệp vụ và quyền

- Nút Yêu cầu duyệt chỉ hoạt động khi có quyền xem hồ sơ và bảo hành còn Chờ xác nhận. Cho gửi trên hồ sơ đã hoàn tất nhưng chưa xác nhận; không mở lại hồ sơ, không đổi tình trạng bảo hành, không bỏ khóa kỹ thuật.
- Người có quyền approveWarranty dùng endpoint xác nhận hiện tại, không đi qua endpoint yêu cầu. Quyền duyệt không được cấp thêm hoặc suy ra chỉ từ nhãn vai trò ở frontend.
- Backend xác thực và kiểm tra phạm vi ở mỗi API. Tài khoản center chỉ đọc thông báo có center liên quan (tiếp nhận/giữ/chặng xử lý/luân chuyển), quản lý toàn hệ thống xem toàn bộ phạm vi. Notification click chỉ gửi caseId; API chi tiết lại kiểm tra quyền. Hồ sơ đã xóa chỉ hiện sự kiện, không mở dữ liệu đã hủy.
- Một hồ sơ có tối đa một yêu cầu đang chờ. Bấm lại/retry không tạo audit trùng. Xác nhận/hủy làm yêu cầu cũ kết thúc; yêu cầu không tự xác nhận bất cứ trạng thái bảo hành nào.
- Sự kiện: yêu cầu duyệt, xác nhận (kèm người duyệt/kết quả), tạo, sửa thông tin, cập nhật kỹ thuật, xóa mềm, luân chuyển/nhận hàng, trả khách. Không gửi email/push ngoài website.
- Chuông cạnh nút Đồng bộ có số chưa đọc; yêu cầu chờ duyệt nền cam nhạt + nhãn riêng, thông báo thường nền xanh/ trắng. Bấm sự kiện đánh dấu đã đọc và mở chi tiết nếu còn quyền; có Đánh dấu đã đọc, Tải lại, Xem thêm, Esc/outside đóng. Chỉ một chuông ở parent khi mở iframe.

## Lưu trữ và tốc độ

Thông báo là metadata `__notification` trong Dữ liệu sau của tab Nhật ký thay đổi hiện có; giữ dữ liệu audit nghiệp vụ. Chỉ các sự kiện phát sinh sau khi cập nhật backend có metadata thông báo, không tự biến lịch sử cũ thành thông báo.

Thay đổi thủ công trên Google Sheet không đi qua audit của web nên không tự phát sinh thông báo. Ghi chú đề nghị chỉ được trả trong chi tiết hồ sơ cho người có quyền duyệt, không đưa vào popup thông báo cho các tài khoản khác.

Danh sách đọc tối đa **1.000 dòng nhật ký gần nhất**, phân trang20/50 ở server, có ghi chú giới hạn trên popup; đây không phải kho tra cứu toàn bộ audit từ trước đến nay. Đọc lại dùng gzip/chunk shared cache theo revision và dòng cuối; không quét các tab lịch sử hoặc toàn bộ audit theo mỗi lần bấm. Poll nhẹ khoảng60–75 giây khi tab đang hiển thị; mutation và Đồng bộ cập nhật lại thông báo.

Trạng thái đã đọc lưu compact bitset/mốc đã đọc trong Script Properties, khóa theo danh tính + phạm vi quyền; không lưu token/PII, không dùng UserProperties chung của tài khoản thực thi Web App. Nhận thêm phạm vi quyền dùng khóa riêng để không bỏ sót thông báo. Đánh dấu đã đọc không đổi dữ liệu hồ sơ/KPI/revision, không sinh thông báo mới.

Yêu cầu duyệt ghi audit bền vững, sync projection/index và bump revision theo quy tắc hiện hành; trạng thái đang chờ trong chi tiết được đọc theo đúng caseId từ audit, không thêm cột. Không xóa/chỉnh thứ tự các dòng audit đã ghi vì ID thông báo dùng số dòng append-only.

## Kiểm thử

`node "version final/tests/notifications.mjs"`, `notifications-ui.mjs` (Playwright Edge với PLAYWRIGHT_MODULE), `reports.mjs`, `validate.mjs`, `git diff --check`.

Đã kiểm tra local: auth/center/global, chặn cross-center/giả ID đọc, không trả contact/note/raw audit, hồ sơ hoàn tất còn pending, retry chống trùng, kết thúc khi duyệt/hủy, badge/read state riêng tài khoản và không tái chưa đọc sau300 lượt, bounded tail/cache/paging, frontend approver/requester, parent→iframe scope recheck, màu/nhãn, escaping, desktop/mobile và fallback backend cũ. Không gửi test vào database production.
