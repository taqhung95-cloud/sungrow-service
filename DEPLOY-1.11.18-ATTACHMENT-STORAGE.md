# Upload riêng — 1.11.18

Trạng thái: code đã chuẩn bị; CHƯA bật production. Chỉ bật sau khi dịch vụ mới qua preflight và kiểm tra deployment thật. Không dùng hướng dẫn chuyển toàn bộ backend sang Gmail khác trước đây.

## Hai project, không thay URL chính

| Project | Tài khoản thực thi | File cần thêm/thay |
|---|---|---|
| Apps Script nghiệp vụ hiện tại | Giữ nguyên tài khoản hiện tại | Thay Code.gs, TemporaryUploads.gs, SupplementalAttachments.gs; thêm AttachmentStorage.gs từ version final |
| Apps Script lưu trữ mới, riêng biệt | sungrowservicecenter@gmail.com | StorageWorker.gs và appsscript.json từ attachment-storage |

Không chép StorageWorker.gs vào project chính: worker có doGet/doPost riêng. Không chép Code.gs hoặc các module database vào project lưu trữ. Không thay manifest chính hay xóa bất kỳ module hiện hữu nào. Phải đối chiếu source runtime hiện tại trước khi thay file để tránh ghi đè bản mới hơn.

Không sửa docs/config.js, Google Client ID, domain, Google Cloud/IAM/OAuth của hệ thống chính, Spreadsheet ID, schema, bảng lịch sử hoặc phân quyền portal. Thay đổi này không cần deploy frontend/GitHub Pages.

## Bước 1 — project lưu trữ

1. Mở project Apps Script riêng bằng đúng sungrowservicecenter@gmail.com; thêm StorageWorker.gs và manifest riêng. Không chuyển chủ project nghiệp vụ.
2. Gmail này cần quyền ghi tại root tạm và từng root center đã cố định trong worker. Giữ thư mục ở chế độ Hạn chế. Không mở public/domain. Chỉ sửa quyền còn thiếu sau khi kiểm tra và xác nhận đúng folder/tài khoản; không cấp Cloud Owner hoặc quyền quản lý nghiệp vụ.
3. Tạo chuỗi bí mật ngẫu nhiên ít nhất 32 byte (ví dụ 64 ký tự hex từ trình quản lý mật khẩu). Đặt Script Property ATTACHMENT_STORAGE_SECRET bằng chuỗi đó tại project lưu trữ. Không lưu chuỗi vào code, Git, URL, log hoặc chat.
4. Chạy kiemTraDichVuLuuTru. Đây là kiểm tra chỉ đọc quyền và danh tính, không tạo file. Người dùng tự hoàn tất yêu cầu cấp quyền Google nếu xuất hiện. Phải nhận executor sungrowservicecenter@gmail.com và đủ sáu root restricted:true.
5. Deploy Web app mới: Execute as Me của Gmail chuyên dụng. Backend gọi server-to-server nên endpoint cần nhận được POST không qua trang đăng nhập (Who has access: Anyone); tất cả lệnh storage vẫn bắt buộc HMAC, timestamp và nonce, folder/file vẫn private. Xác nhận cụ thể bước cấp quyền/công khai endpoint trước khi áp dụng bằng UI. Nếu chính sách Google không cho cấu hình này, dừng; không đổi Google Cloud/đăng nhập chính để lách.
6. Lấy URL /exec của dịch vụ lưu trữ. URL này CHỈ đi vào Script Properties của backend chính, không vào frontend.

## Bước 2 — backend chính

1. Sao lưu nội dung bốn file sẽ thay trên project thực tế và tên phiên bản deployment hiện hành. Giữ nguyên module/session/property/trigger khác.
2. Thay ba file và thêm AttachmentStorage.gs theo bảng trên. Chưa bật ATTACHMENT_STORAGE_MODE.
3. Đặt ATTACHMENT_STORAGE_URL bằng URL worker /exec, ATTACHMENT_STORAGE_SECRET bằng đúng bí mật dùng chung ở bước 1. Không đặt UPLOAD_EXECUTOR_EMAIL theo hướng dẫn cũ.
4. Chạy kiemTraKhoDinhKemRieng. Kết quả phải ok:true, storage.executor đúng Gmail mới, đủ root; mainExecutor vẫn là tài khoản cũ. enabled:false ở bước này là bình thường. Chức năng này không tự bật chế độ mới.
5. Tạo New version trên deployment backend HIỆN TẠI, giữ nguyên deployment ID và URL. Không tạo Web app nghiệp vụ mới. Kiểm tra API trả version 1.11.18-attachment-storage và đăng nhập/list/detail hoạt động.
6. Sau khi kiểm tra runtime đủ module, đặt ATTACHMENT_STORAGE_MODE = dedicated-v1. Không cần deploy lại khi chỉ sửa Script Property. TEMP_UPLOAD_ENABLED và trigger cleanup hiện hữu giữ nguyên; không chạy lại initializeTemporaryUploads để đổi tài khoản.

## Bước 3 — người dùng thử tạo case

- Dùng giao diện bình thường, tạo một hồ sơ thử do người dùng nhập. Không có màn hình đăng nhập Gmail mới cho nhân viên.
- Kiểm tra Owner của file đính kèm là sungrowservicecenter@gmail.com, file đúng thư mục center và người có quyền vẫn mở được.
- Kiểm tra audit vẫn là người tạo hồ sơ, không phải Gmail lưu trữ; case/Fan/model/bảo hành/KPI/linh kiện không thay đổi do upload.
- Thử bổ sung file vào hồ sơ cũ; file cũ và liên kết gốc giữ nguyên.
- Không tạo dữ liệu nghiệp vụ giả trên production bằng công cụ kiểm thử tự động.

## Tương thích, giới hạn và phục hồi

- Phiên tạm mới được đóng dấu storageMode=dedicated-v1. Phiên đã tồn tại trước lúc bật vẫn dùng cơ chế cũ để hoàn tất; vì vậy một phiên đang mở từ trước có thể tạo file bằng email cũ. Muốn thử tài khoản mới, mở một phiên tiếp nhận mới sau khi bật.
- Tắt mode chỉ ngừng chọn worker cho phiên mới. Các phiên đã gắn worker vẫn phải đi qua worker. Không xóa URL/secret/adapter khi còn phiên đó. Không tự fallback sang email cũ nếu worker lỗi.
- Worker/main ký request/response; nonce hết hạn 5 phút; biên nhận upload theo cùng ID, tên, kích thước và SHA-256. Mất phản hồi: kiểm tra/thử lại cùng phiên, không chọn file lại. Reservation 10 phút bảo vệ thao tác đang chạy; retry sau lỗi tạo chưa có file chỉ tiếp tục khi lease đã hết.
- Giới hạn truyền qua hai Apps Script: tối đa 32 MB/file ở luồng staged mới; đường ZIP/RAR cũ giữ 8 MB. Đây là giới hạn kỹ thuật mới của transport, cần thông báo nếu người dùng dùng file lớn hơn. Không thay giới hạn tổng số file; quota Apps Script/Drive vẫn áp dụng.
- Lệnh xóa chỉ tác động file tạm theo phiên có chữ ký. Cleanup chính kiểm tra liên kết/request canonical trước khi gọi worker. Folder bổ sung đã commit chỉ được dọn khi trống; file đã chuyển vào hồ sơ giữ nguyên.
- Receipt SW_PUT hoàn tất được dọn sau 72 giờ; receipt tạo chưa xác định giữ đến cleanup. Cleanup trigger chính điều phối; không thêm trigger nghiệp vụ vào Gmail lưu trữ.
- Đường ZIP/RAR cũ vẫn giữ guard CREATE_UPLOAD_ hiện hữu: khi mất phản hồi trước khi lưu link, không tự gửi lại file; cần quản lý đối soát. Không xóa receipt để thử lại một cách mù quáng.

## Rollback

Giữ URL chính không đổi. Nếu worker lỗi, có thể bỏ ATTACHMENT_STORAGE_MODE cho phiên mới sau khi thông báo rõ các phiên mới quay lại tài khoản cũ; hoặc ngừng nhận upload mới đến khi sửa. Không xóa secret/URL/module vì phiên dedicated đang tồn tại vẫn cần chúng. Nếu rollback Code.gs, chỉ dùng bản đã có adapter guard hoặc đợi toàn bộ phiên dedicated kết thúc/được đối soát trước; không quay về bản cũ rồi gửi lại file đang dở. Giữ nguyên file, ID, receipt, folder và dữ liệu hồ sơ.

## Kiểm thử đã chạy local

node "version final/tests/validate.mjs" và git diff --check.

Test attachment-storage dùng code worker/adapter thật trong mô phỏng Drive: HMAC/nonce/replay/expiry/wrong account, ownership mới/cũ, mất phản hồi không tạo thêm file, prepare/remove, ZIP cũ, bổ sung giữ actor/audit, cleanup giữ canonical/file đã chuyển, lỗi worker không fallback và API đọc phiên không gọi worker. Chưa thay thế được thử quyền Drive, deploy/authorization, giới hạn/quota, độ trễ và ownership trên Google thật.
