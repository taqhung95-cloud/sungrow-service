# 1.10.13 — Upload tạm theo phiên, tối đa 10 file

## File cần cập nhật

- Thay `Code.gs` và `LegacyDashboardApi.gs` bằng bản cùng version `1.10.13-staged-uploads`.
- Thêm `TemporaryUploads.gs` vào cùng Apps Script project.
- Giữ nguyên các runtime khác (CustomerDirectory.gs, ManagerDashboard.gs...). Không chạy migration, seed hay rebuild index.
- Frontend GitHub Pages: entry.html, live-data.js, index.html; thêm case-uploads.js và case-uploads.css. Cache JS87/entry77. Index.html trực tiếp của Apps Script vẫn dùng luồng ZIP/RAR cũ; tính năng mới ở GitHub portal.

## Các bước thực hiện

1. Save ba file backend trên trong Apps Script.
2. Đăng nhập bằng tài khoản quản lý toàn hệ thống, chạy `initializeTemporaryUploads` một lần. Chấp thuận quyền Drive/trigger của project nếu Google yêu cầu. Hàm kiểm tra folder đã cho và tạo trigger `cleanupTemporaryUploads` mỗi giờ nếu chưa có; không sửa dữ liệu nghiệp vụ.
3. Kiểm tra kết quả: folderId `181f6qWxeV3N9Sv8ua7aqWjT-V7Ak4trY`, expiresHours24, maxFiles10, maxFileMB8, enabled true.
4. Deploy > Manage deployments > Edit deployment Web App hiện tại > New version > Deploy. **Execute as: Me** (tài khoản triển khai có quyền ghi vào folder tạm và các folder center). Giữ URL /exec hiện tại.
5. Reload GitHub portal. Chọn center trước, chọn các file nhỏ để kiểm tra. Upload phải diễn ra trước khi bấm Tạo hồ sơ; không tạo case chỉ vì chọn file.
6. Kiểm tra 2 tài khoản staff khác nhau: mỗi người chỉ xem/bỏ/gắn file của chính phiên mình; tài khoản chỉ xem không được upload. Không cần share folder tạm cho staff.
7. Thử tạo case, mở link folder center, kiểm tra đủ file, tên nguyên bản và không upload lại. Kiểm tra KPI/danh sách cập nhật như trước.

Nếu backend chưa deploy/khởi tạo, frontend giữ luồng một ZIP/RAR <=8MB cũ; không bật nút nhiều file giả vờ hỗ trợ.

## Phạm vi và an toàn

- DOC/DOCX, PDF, XLS/XLSX, ZIP/RAR, JPG/JPEG, PNG; 1–10 file đang gắn, 0 < mỗi file <=8MiB. Tối đa tổng 80MiB, truyền từng file riêng.
- Kiểm tra đuôi và chữ ký container; không phải công cụ quét virus. Không mở rộng sang DOCM/XLSM/EXE hay CSV.
- Folder tạm là Restricted, chỉ admin/owner hiện có. Các users được quyền createCase trong app dùng backend để upload, không được cấp quyền Drive trực tiếp.
- Upload tuần tự ở client; backend tối đa4 lượt đang xử lý và trả UPLOAD_BUSY trước khi ghi khi đầy. Thử chờ có giới hạn với cùng uploadId. Không giữ ScriptLock trong Drive I/O, không bump revision hay invalidation KPI mỗi file.
- Progress là số file Drive đã xác nhận, không phải % byte đã truyền. File đang gửi/chờ lưu chưa được tính hoàn tất.
- Mã phiên/requestId lưu localStorage theo email+center; không lưu nội dung file hay thêm token. Reload có thể phục hồi file đã upload. File chưa xác nhận có thể cần chọn lại đúng file; backend kiểm tra hash/uploadId trước gửi lại.
- Tạo case dùng mã phiên + uploadIds, gắn với owner+center+requestId; chuyển cả folder đã xác nhận sang folder center. Nguồn dữ liệu, schema/KPI và idempotency tạo case giữ nguyên. File cũ không tự share public.
- Sau24h không thể dùng phiên OPEN nữa. Worker mỗi giờ xử lý tối đa10 phiên/lượt, dưới4 phút; trash chỉ folder do phiên upload quản lý, không có liên kết canonical case, không đang upload/claim có lease, không chứa file/folder lạ. Không xóa vĩnh viễn. Có backlog thì dọn có thể muộn hơn24h.
- CLAIMED chưa xác nhận case được bảo vệ1 giờ; cleanup đối chiếu case links, kể cả case đã hủy, trước dọn. Journal của case lưu thành công được giải phóng; Drive files đã gắn không bị cleanup.
- Tối đa40 phiên đang lưu và guard dung lượng ScriptProperties; nếu đầy, quản lý kiểm tra cleanup, không tạo tiếp hàng loạt.

## Kiểm thử

`node "version final/tests/validate.mjs"` gồm TemporaryUploads VM: loại file/kích thước/count/quyền/center/idempotency/lost response/không Drive trong lock/cleanup bảo vệ case.

`PLAYWRIGHT_MODULE` trỏ tới package Playwright local rồi chạy `node "version final/tests/intake-idle.mjs"`: frontend thật/API fake, upload2 file trước create, progress, reload, remove, payload chỉ references và idle6m01s.

Không coi fixture là đo15 phiên production hoặc Safari live. Không đổi luồng làm mới xác thực trong release này.
