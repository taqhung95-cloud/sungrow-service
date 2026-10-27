# Revision, cache và đồng bộ dữ liệu hiện hành

Cập nhật: **27/10/2026**. Backend `1.11.20-sla-holds` đã được người dùng xác nhận deploy; số deployment version mới chưa được cung cấp. Frontend liveJS162/entry143 phát hành qua main sau backend. Xem [PRODUCTION-STATE.md](../PRODUCTION-STATE.md) để phân biệt xác nhận triển khai, kiểm thử local và thử dữ liệu thật.

## Ghi và invalidation

Mutation ghi bảng nghiệp vụ, cập nhật projection Dữ liệu dashboard, cập nhật Chỉ mục hồ sơ rồi tăng PORTAL_DATA_REVISION theo luồng hiện hành. Không quét/viết lại toàn bộ lịch sử khi lưu một hồ sơ. Revision không đại diện cho việc chỉ đọc hoặc chuyển qua lại giữa các thẻ.

Xóa mềm loại hồ sơ khỏi projection/index/list/KPI theo guard hiện hành. Không xóa lịch sử nguồn. Audit vẫn ghi actor thực, kể cả file do tài khoản lưu trữ riêng tạo.

## Đọc

- List dùng chỉ mục chung, lọc quyền và bộ lọc trước phân trang/serialize; không join toàn database mỗi request.
- Snapshot/cache đọc gắn revision; response có quyền được phân phạm vi user/role/center. Không trả PII từ response người khác.
- FastCaseReads đọc nhóm dòng theo case; raw bundle cache theo revision, render quyền từ actor hiện hành, có fallback và kiểm tra dữ liệu cũ.
- Frontend kiểm revision khoảng60giây, refresh dự phòng khoảng5phút và hỗ trợ đồng bộ thủ công; không tạo vòng poll riêng cho mỗi thẻ ẩn.
- Chỉ báo Có dữ liệu mới khi có revision/thay đổi liên quan thực tế, không vì mở/tải thẻ khác.
- Form/nháp đang sửa không bị ghi đè khi dữ liệu thay đổi; lưu thành công tận dụng snapshot phản hồi, backend cũ mới cần đọc bù.

## Phiên và giao vận

PortalSessions giữ phiên tuyệt đối8giờ bằng token hash trong Script Properties và đọc quyền hiện hành. Không dùng cache actor để bỏ qua việc khóa tài khoản/đổi quyền. Bridge kiểm origin/ancestor/channel; giới hạn request đồng thời và không tự gửi lại mutation không rõ kết quả.

Worker đính kèm chỉ được gọi trong luồng lưu trữ; không thêm phụ thuộc worker vào dashboard/login/list hoặc thao tác đọc phiên upload. Định tuyến phiên upload cũ/mới không làm đổi revision dữ liệu khi chỉ tải file tạm; commit nghiệp vụ vẫn chịu trách nhiệm đồng bộ nguồn.

## Triển khai

Theo module thay đổi và hướng dẫn release hiện hành. Không triển khai lại bộ ba Code/Legacy/Index từ tài liệu1.4.3 cũ. Không chạy reconcile/migration hàng loạt chỉ để cập nhật cache. GitHub Pages và Apps Script được triển khai riêng.
