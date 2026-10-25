# Sungrow Service Center Dashboard

Trạng thái tài liệu: 26/10/2026. Backend đang chạy `1.11.18-attachment-storage`, Apps Script deployment chính **Version 73**. Người dùng đã xác nhận file đính kèm mới được upload bằng `sungrowservicecenter@gmail.com`.

## Bắt đầu từ đâu

- [AGENTS.md](AGENTS.md): quy tắc làm việc với repository.
- [CURRENT-IMPLEMENTATION.md](CURRENT-IMPLEMENTATION.md): quy tắc nghiệp vụ và lịch sử release; phần quy tắc tổng hợp đã cập nhật theo bản hiện hành.
- [PRODUCTION-STATE.md](PRODUCTION-STATE.md): phiên bản triển khai, danh mục mã nguồn, bằng chứng và giới hạn đối chiếu.
- [SYNC_SETUP.md](SYNC_SETUP.md): cấu trúc kết nối đang dùng.
- [security-architecture.md](security-architecture.md): xác thực, phân quyền, phiên đăng nhập và upload riêng.
- [DEPLOY-1.11.18-ATTACHMENT-STORAGE.md](DEPLOY-1.11.18-ATTACHMENT-STORAGE.md): hướng dẫn cho release upload hiện tại, không phải yêu cầu cài lại hệ thống đang chạy.

## Kiến trúc hiện hành

1. Website production: https://sungrow-service.sungrowvietnam.com.vn ; GitHub Pages phục vụ thư mục `docs/`.
2. Backend nghiệp vụ: các module trong `version final/`; giữ tài khoản thực thi và URL API chính hiện tại.
3. Google Sheets production là nguồn nghiệp vụ; `Dữ liệu dashboard` và `Chỉ mục hồ sơ` là dữ liệu dẫn xuất. Giữ nguyên lịch sử 2024/2025/2026.
4. `PortalSessions.gs` quản lý phiên tuyệt đối 8 giờ, phân quyền từ tab `Người dùng`.
5. Project riêng trong `attachment-storage/` chỉ lưu file đính kèm mới bằng Gmail chuyên dụng. Backend chính xác thực người dùng, kiểm tra quyền và ký HMAC trước khi gọi worker.

`apps-script/` là bản lịch sử; không dùng để ghi đè backend production. `version final/Index.html` là UI mở trực tiếp Apps Script; frontend website chính là `docs/index.html` và `docs/entry.html`.

## Cấu hình và triển khai

`docs/config.js` chỉ chứa URL API chính, OAuth Web Client ID và cấu hình công khai. URL worker, khóa HMAC, phiên đăng nhập và biên nhận upload nằm ở Script Properties phía máy chủ; không commit hoặc reset chúng.

- Đổi frontend: kiểm tra, tăng cache key tương ứng, push `main`.
- Đổi backend chính: thay đúng module của release, Save và New version trên deployment hiện có; giữ URL.
- Đổi worker: cập nhật project lưu trữ riêng; không chép `StorageWorker.gs` vào backend chính.
- Workflow GitHub Pages hiện chạy với mọi push `main`, kể cả thay tài liệu; GitHub không tự deploy Apps Script.

## Kiểm tra mã nguồn

```powershell
node "version final/tests/validate.mjs"
git diff --check
```

Kiểm thử local không thay thế kiểm tra quyền Google thật, quota hoặc độ trễ production. Không chạy migration/repair chỉ vì vừa copy code.

## Không đưa dữ liệu vận hành lên GitHub

Không commit hồ sơ khách hàng, Excel nguồn, file đính kèm, database export, token, mật khẩu, khóa HMAC, Script Properties dump hoặc danh sách người dùng thật. Các bản mô phỏng, ZIP triển khai và worktree cũ không tự động trở thành nguồn production. Xem giới hạn đồng bộ ở [PRODUCTION-STATE.md](PRODUCTION-STATE.md).
