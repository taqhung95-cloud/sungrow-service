# 1.11.4 — Kết nối dashboard ổn định

## Vì sao sửa

Kết quả WEB_READ_DIAGNOSTICS của production ngày17/10: dashboard-build878ms/cache181ms; browser có request35.62s và chuỗi echo/exec bị CORS. Tránh phụ thuộc fetch cross-origin ContentService bằng một iframe HTMLService với google.script.run. Giữ dispatcher/xác thực và dữ liệu hiện tại. Không chạy migration hoặc khôi phục backup.

Bản cập nhật web18/10 chỉ cần tải lại trang, không cần thay Apps Script nếu đang dùng1.11.4. Các bước dưới đây dành cho triển khai backend lần đầu.

## Ba file Apps Script

1. Thay TOÀN BỘ nội dung Script Code.gs bằng Code.gs trong gói.
2. Thay TOÀN BỘ nội dung Script LegacyDashboardApi.gs bằng file cùng tên trong gói. Giữ wrapper ở đầu/cuối file, không tạo bản sao hoặc nối code cũ.
3. Bấm + cạnh Files → HTML → đặt tên PortalBridge → dán TOÀN BỘ PortalBridge.html trong gói. Không tạo Script .gs cho file HTML này.
4. Save. Deploy → Manage deployments → chọn Web App đang dùng → Edit → Version: New version → Deploy. Giữ nguyên URL, Execute as: Me, Who has access: Anyone. Các module Fan và nghiệp vụ khác giữ nguyên.
5. Mở lại portal, Ctrl+F5 và đăng nhập lại. Bấm Đồng bộ một lần.
6. Trong Console chạy SungrowTransport.info(). Cần thấy state: ready, version: 1.11.4-stable-transport. Lệnh chỉ hiện trạng thái kết nối, không token hoặc dữ liệu nguồn. Kiểm tra dashboard, danh sách và chi tiết; không cần tạo hồ sơ hoặc ghi linh kiện để thử kết nối.

## Phát hành an toàn

Frontend18/10 khởi tạo sớm, mở tối đa hai frame (dự phòng sau12s), chờ tối đa32s. Chỉ gửi API sau ready. Lần thử tiếp theo tạo kết nối mới ngay nếu khởi tạo thất bại. Chế độ tương thích deployment cũ chỉ có thể fallback trước dispatch; production tắt chế độ này. Khi bridge ready, mọi API dùng bridge; không chuyển sang REST sau lỗi thao tác lưu đã gửi. Production đã xác minh ngày17/10/2026; config.js hiện đặt appsScriptTransport: bridge và index/entry dùng config?v=2, nên không fallback REST khi kết nối lỗi. Không đổi URL hoặc đưa token vào config. Mọi tên miền mới cần bổ sung allowlist Code.gs có kiểm tra.

## Đã kiểm tra và giới hạn

Node regression kiểm tra dispatcher thật/whitelist, JSON Date, origin/channel/ancestor, giới hạn4 call, hủy yêu cầu, timeout, không ghi lại save chưa rõ kết quả, fallback chỉ trước dispatch, và không thêm giới hạn upload8MB. Browser fixture chạy dashboard và entry thật qua wrapper Google nhiều tầng, không có POST ContentService, chia sẻ kết nối và không replay lỗi save. CI chạy validation trước deploy Pages. Live bridge1.11.4 đã được xác minh qua3 roundtrip từ tên miền production, không CORS/ContentService POST. Khi triển khai lại ở môi trường khác vẫn cần bước6. Google vẫn có thể gián đoạn, khi đó hệ thống báo lỗi rõ và không tự gửi lại thao tác ghi không xác định kết quả.
