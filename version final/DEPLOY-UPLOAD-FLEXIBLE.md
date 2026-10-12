# Đính kèm gọn và bỏ giới hạn ứng dụng — 12/10/2026

Cập nhật tiếp: liveJS115 / entry98 / case-uploads JS6 thêm nhóm **Hình ảnh tại center** (`centerPhotos`), prefix lưu file `05_Hinh anh tai center`. Vẫn chỉ cần thay TemporaryUploads.gs và deploy phiên bản mới theo hướng dẫn dưới đây.

Frontend liveJS114 / entry97 / case-uploads JS5, CSS4 đã chuẩn bị cho thanh chọn nhóm + Thêm file, danh sách cuộn riêng, nút Xóa cùng hàng dropdown; TXT/CSV được chọn cùng các định dạng cũ.

## File cần thay trong Apps Script

Chỉ thay toàn bộ nội dung **TemporaryUploads.gs** bằng file cùng tên tại thư mục `version final` hiện hành. Giữ các file Code.gs, LegacyDashboardApi.gs, PortalSessions.gs và các module đang dùng.

Save → Manage deployments → chỉnh Web App hiện tại → New version → Deploy. Giữ nguyên URL. Không chạy initializeTemporaryUploads, migration hoặc sửa Google Sheet. Sau đó Ctrl+F5 trên portal.

Backend mới bỏ các mức 8 MB/file, 10 file/hồ sơ và 1 file mẫu sự cố; thêm MIME TXT/CSV. Các định dạng nhị phân cũ vẫn kiểm tra signature; TXT/CSV lưu nguyên bytes, không đọc thành HTML hoặc thực thi nội dung/formula. Quyền tài khoản/center, retry cùng uploadId, phiên tạm 24 giờ và file đã gắn vào hồ sơ được giữ nguyên.

Thông tin phiên nhiều file tự chia thành nhiều Script Properties khi vượt 8 KB: ghi các phần trước, đổi con trỏ sau cùng; lỗi ghi giữ nguyên phiên cũ. Đọc được phiên dạng cũ, commit/cleanup dọn các phần tương ứng. Không quay về module cũ khi còn phiên đang dùng định dạng chia phần.

Không có cam kết dung lượng/số file vô hạn: bộ nhớ trình duyệt, đường truyền, timeout hiện hữu (upload 120 giây), thời gian chạy Apps Script, dung lượng Drive và hạn mức Script Properties vẫn áp dụng. Upload hiện vẫn gửi từng file base64; chưa phải giao thức resumable chia nhỏ file. Lỗi mạng/hạn mức giữ phiên và mã upload để kiểm tra/thử lại, không tự xóa file cũ.

Nguồn hạn mức: https://developers.google.com/apps-script/guides/services/quotas

Kiểm thử local: TXT/CSV tiếng Việt, file 9 MB, 12 file vào hồ sơ, nhiều mẫu sự cố, phiên 150 metadata/file chia phần và lỗi ghi con trỏ; hồi quy quyền/center/retry/cleanup; trình duyệt desktop/mobile chọn 14 file, Xóa/đổi nhóm, căn hàng và scrollbar.
