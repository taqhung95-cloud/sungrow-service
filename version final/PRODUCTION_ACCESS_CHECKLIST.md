# Checklist quyền production hiện hành

Cập nhật: **27/10/2026**. Backend `1.11.20-sla-holds` đã được người dùng xác nhận deploy; số deployment version mới chưa được cung cấp. Frontend liveJS162/entry143 phát hành qua main sau backend. Xem [PRODUCTION-STATE.md](../PRODUCTION-STATE.md) để phân biệt xác nhận triển khai, kiểm thử local và thử dữ liệu thật.

## Xác thực

- Google ID token hợp lệ với aud/iss/exp/email_verified/sub; tab Người dùng là nguồn role/center/trạng thái.
- Email/GoogleSub trùng, account inactive hoặc định danh không khớp phải bị từ chối.
- Phiên portal tuyệt đối8giờ, hash phía server, logout/expiry và retry không kéo dài phiên; quyền hiện hành tiếp tục được kiểm.
- Không tự sửa GoogleSub đã khóa, không xóa session/property để xử lý lỗi upload.

## Ma trận quyền cần kiểm tra khi có thay đổi code liên quan

| Tình huống | Kết quả |
|---|---|
| Quản lý hệ thống gốc | Dashboard và quản lý toàn cục, sửa nguồn, xóa mềm mở rộng theo guard |
| Quản lý Sungrow | Dashboard/quản lý toàn cục và sửa nguồn; không tự nhận quyền xóa mở rộng |
| Quản lý center khác | Phạm vi được cấp; không sửa nguồn không giới hạn |
| Nhân viên center | Theo center; không chủ động chuyển center, có thể nhận chuyển/giao trả khi đủ điều kiện |
| Center cũ sau luân chuyển | Không cập nhật chặng đã đóng hoặc giao trả thay center đang giữ hàng |
| Đổi center/case ID trên client | Server kiểm lại và từ chối ngoài quyền |
| User không có quyền hoặc đã bị khóa | Không nhận dữ liệu dù biết URL/API |
| Account lưu trữ chuyên dụng | Chỉ thực thi storage; không tự có quyền quản lý database/portal |

## Drive và kho riêng

Worker đúng Gmail sungrowservicecenter@gmail.com; preflight đủroot/private/quyền. Backend chính giữ executor/URL, clientID/Cloud và database. Yêu cầu/response có HMAC và nonce. Secret không vào code/log/Git hoặc URL.

Kiểm Owner của file mới, không chỉ Owner của folder. Phiên upload đã mở trước cutover giữ đường cũ; dùng phiên mới khi thử. File cũ không tự chuyển owner.

## Kiểm thử và trạng thái

Chạy validator local trước thay code. Chỉ audit/repair thực tế khi đã có phạm vi riêng. Người dùng đã xác nhận upload bằng owner mới; điều đó không thay thế thử đủ account/center/lỗi/quota cho một release thay phân quyền khác.

Website người dùng: https://sungrow-service.sungrowvietnam.com.vn . Không yêu cầu nhân viên mở Apps Script hoặc đăng nhập Gmail lưu trữ. Không gửi dữ liệu quyền/phiên/khách hàng lên GitHub để làm bằng chứng.
