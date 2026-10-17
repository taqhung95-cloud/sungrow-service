# 1.11.4 — Kết nối dashboard ổn định

## Vì sao sửa

Kết quả WEB_READ_DIAGNOSTICS của production ngày17/10: dashboard-build878ms/cache181ms; browser có request35.62s và chuỗi echo/exec bị CORS. Tránh phụ thuộc fetch cross-origin ContentService bằng một iframe HTMLService với google.script.run. Giữ dispatcher/xác thực và dữ liệu hiện tại. Không chạy migration hoặc khôi phục backup.

## Ba file Apps Script

1. Thay TOÀN BỘ nội dung Script Code.gs bằng Code.gs trong gói.
2. Thay TOÀN BỘ nội dung Script LegacyDashboardApi.gs bằng file cùng tên trong gói. Giữ wrapper ở đầu/cuối file, không tạo bản sao hoặc nối code cũ.
3. Bấm + cạnh Files → HTML → đặt tên PortalBridge → dán TOÀN BỘ PortalBridge.html trong gói. Không tạo Script .gs cho file HTML này.
4. Save. Deploy → Manage deployments → chọn Web App đang dùng → Edit → Version: New version → Deploy. Giữ nguyên URL, Execute as: Me, Who has access: Anyone. Các module Fan và nghiệp vụ khác giữ nguyên.
5. Mở lại portal, Ctrl+F5 và đăng nhập lại. Bấm Đồng bộ một lần.
6. Trong Console chạy SungrowTransport.info(). Cần thấy state: ready, version: 1.11.4-stable-transport. Lệnh chỉ hiện trạng thái kết nối, không token hoặc dữ liệu nguồn. Kiểm tra dashboard, danh sách và chi tiết; không cần tạo hồ sơ hoặc ghi linh kiện để thử kết nối.

## Phát hành an toàn

Frontend tương thích deployment cũ: nếu handshake không có sau20s và chưa gửi API thì có thể dùng REST cũ một lần. Khi bridge ready, mọi API dùng bridge; không chuyển sang REST sau lỗi thao tác lưu đã gửi. Sau khi xác minh production, đặt appsScriptTransport: bridge trong config.js để bỏ fallback cũ. Không đổi URL hoặc đưa token vào config. Mọi tên miền mới cần bổ sung allowlist Code.gs có kiểm tra.

## Đã kiểm tra và giới hạn

Node regression kiểm tra dispatcher thật/whitelist, JSON Date, origin/channel/ancestor, giới hạn4 call, hủy yêu cầu, timeout, không ghi lại save chưa rõ kết quả, fallback chỉ trước dispatch, và không thêm giới hạn upload8MB. Browser fixture chạy dashboard và entry thật qua wrapper Google nhiều tầng, không có POST ContentService, chia sẻ kết nối và không replay lỗi save. CI chạy validation trước deploy Pages. Kiểm thử này chưa chứng minh live bridge đã cài; cần bước6 sau deploy. Google vẫn có thể gián đoạn, khi đó hệ thống báo lỗi rõ và không tự gửi lại thao tác ghi không xác định kết quả.
