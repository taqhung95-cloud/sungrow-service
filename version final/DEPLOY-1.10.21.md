# Phiên đăng nhập 8 giờ — 1.10.21

Frontend đã hỗ trợ nâng cấp sau khi backend được deploy. Backend cũ tiếp tục dùng Google ID token (~1 giờ), không tự biến thành phiên 8 giờ.

## File cần thay trong Apps Script

1. Thay toàn bộ `Code.gs` bằng `version final/Code.gs`.
2. Thay toàn bộ `LegacyDashboardApi.gs` bằng `version final/LegacyDashboardApi.gs`.
3. Tạo file script `PortalSessions` (nếu chưa có), dán toàn bộ `version final/PortalSessions.gs`.

Giữ nguyên các module hiện có như Notifications/ReportExport/CustomerDirectory/upload. Không dán `.gs` vào HTML. Không thay Spreadsheet ID, tab, header, quyền tài khoản; không chạy initialize/rebuild/migration.

Save → Deploy → Manage deployments → Edit deployment Web App hiện tại → New version → Deploy. Giữ nguyên URL và cấu hình deployment; không tạo deployment URL khác.

Ctrl+F5 trên web rồi đăng nhập lại một lần. Frontend đổi Google credential đang còn hạn thành phiên nội bộ; sau đó bootstrap/API sử dụng phiên này, không cần Google token còn hạn ở giờ thứ hai. Parent và iframe dùng cùng phiên.

## Quy tắc và giới hạn

- 8 giờ cố định tính từ tạo phiên; thao tác/F5 không gia hạn. Hết giờ, server từ chối và yêu cầu đăng nhập lại.
- Lưu trong sessionStorage của tab, không localStorage/URL. Tải lại trang vẫn giữ; không cam kết giữ qua đóng tab/trình duyệt. Đây không phải cookie HttpOnly: Apps Script/GitHub Pages hiện chạy khác origin; phải tiếp tục phòng XSS, không chia sẻ token.
- Token ngẫu nhiên 256-bit từ Web Crypto trong giao diện tin cậy, chỉ được chấp nhận sau xác thực Google; server chỉ lưu hash khóa phiên + GoogleSub/email/expiry trong Script Properties. Không lưu token vào Sheet/audit/log.
- Mỗi request phiên đọc bản ghi còn hạn/chưa thu hồi và đọc quyền hiện tại từ Người dùng. Tài khoản khóa, đổi quyền/center/định danh có hiệu lực trên request tiếp theo; không dùng actor cache để vượt quyền.
- Logout thu hồi server (tombstone chặn retry tạo lại), xóa token/ẩn giao diện cục bộ. Mất mạng không thể xác nhận thu hồi server: UI báo rõ, không tuyên bố đã thu hồi.
- Session không được đổi thành session mới: phải có Google credential còn hiệu lực; retry cùng credential/token không kéo dài thời hạn.
- Dọn bản ghi phiên hết hạn khi tạo phiên mới, chỉ prefix riêng; giới hạn 1.000 phiên đang giữ để bảo vệ quota Script Properties. Không thay thuộc tính khác.
- Giao diện Apps Script HTML trực tiếp cũ vẫn dùng Google token nếu không qua portal mới; phiên 8 giờ áp dụng GitHub/custom-domain portal và entry.html.

## Kiểm tra

GET API trả version `1.10.21-eight-hour-session`; bootstrap trả `portalSessions: true`. Nếu false, kiểm tra module PortalSessions và deployment New version.

Local: `node "version final/tests/portal-sessions.mjs"`, `node "version final/tests/session-client.mjs"`, browser `notifications-ui.mjs`, `validate.mjs`. Dùng mock, không thử ghi dữ liệu production.

Tham khảo: [Google xác thực ID token](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token), [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
