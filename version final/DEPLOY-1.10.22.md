# Bổ sung đính kèm và bố cục kéo-thả — 13/10/2026

## Các file cần copy vào Apps Script

Thay toàn bộ nội dung các file canonical trong thư mục `version final`:

1. Code.gs
2. LegacyDashboardApi.gs
3. TemporaryUploads.gs
4. SupplementalAttachments.gs — tạo file mới nếu chưa có.

Giữ PortalSessions.gs (phiên 8 giờ), Notifications.gs, ReportExport.gs, CustomerDirectory.gs và các module đang chạy. Không đổi Sheet, header, dữ liệu hoặc quyền Drive. Không chạy initialize, migration hoặc rebuild.

Save → Manage deployments → Edit Web App hiện tại → New version → Deploy cùng URL. Phiên bản API mới `1.10.22-supplemental-attachments`. Frontend liveJS117 / entry100 / case-uploads JS8 CSS5 / attachment-ui JS1 / supplement-attachments JS1; Ctrl+F5 sau deploy. Nút được ẩn khi bootstrap chưa hỗ trợ và chỉ hiện khi backend trả canSupplementAttachments=true.

## Vị trí và thao tác

Danh sách hồ sơ → Chi tiết thiết bị → Tài liệu thiết bị → **＋ Bổ sung đính kèm**, ngay dưới liên kết thư mục Drive. Chọn/kéo-thả/dán file vào nhóm, chờ tải xong rồi **Lưu vào hồ sơ**. Năm nhóm như tiếp nhận mới, có Hình ảnh tại center. Danh sách cuộn riêng, icon xem/tải xuống/Xóa. File mới có thể xem từ bản local; file đã khôi phục mở Drive và cần quyền Drive của tài khoản đang mở trình duyệt.

Nhân viên cần quyền updateWorkOrder, thuộc center đang giữ hàng và có công việc còn được xử lý. Hồ sơ hoàn tất chỉ quản lý toàn hệ thống được bổ sung. Không bổ sung hồ sơ hủy, thiếu link folder hoặc folder ngoài vùng lưu trữ cấu hình. Thư mục đích lấy từ canonical caseId, không nhận URL/folderId từ browser; không tạo thư mục hồ sơ mới, không đổi tên thư mục, không ghi đè/xóa file cũ. Chỉ vùng tạm mới dùng cho file trước khi lưu.

Phiên bổ sung ràng buộc account/caseId/center/folderId, mỗi file có uploadId cố định. Lưu kiểm tra quyền và trạng thái hiện tại, danh sách chính xác dưới lock; Drive I/O ở ngoài lock. Chuyển file từ staging vào folder hiện có bằng fileId; lỗi/ack mất dùng lại file đã chuyển, không tạo bản sao. Journal giữ receipt COMMITTED đến cleanup; audit tìm theo caseId + attachmentSessionId để retry không lặp thông báo. Audit title Bổ sung đính kèm dùng audience case_updated hiện có. Projection/index/revision đồng bộ, không đổi ngày/trạng thái/KPI của hồ sơ.

Khi đang tải/lưu, web chặn đóng/đổi hồ sơ và cảnh báo khi rời trang. Sau timeout hoặc đóng trình duyệt, mở lại cùng hồ sơ để khôi phục; file local không còn thì chọn lại đúng file để thử lại mã cũ. Lỗi restore giữ phiên, khóa gửi mới và có Kiểm tra lại. File đang gắn hoặc đã gắn không được xóa qua vùng tạm. Center/link thay đổi sẽ báo lỗi, không tự chọn folder thay thế.

Hạn mức Apps Script/Drive/đường truyền và lưu tạm24 giờ vẫn áp dụng. Chưa phải resumable/chunked payload cho file lớn. Bản mới chỉ đổi UI portal GitHub; Index.html trực tiếp của Apps Script vẫn là UI cũ.

## Kiểm thử local

Supplement backend: đúng folder/prefix, không overwrite, tài khoản thiếu quyền, expired auth, case hủy/hoàn tất, center/link đổi, root/ngoài vùng/file-link bị chặn; retry sau chuyển file/audit lỗi/ack mất, không duplicate. UI Edge desktop/mobile: vùng nhóm/icons/scroll, chọn nhiều TXT/CSV, khóa leave khi busy, retry commit không upload lại, spinner đơn. Hồi quy validate và notifications UI. Không upload/ghi dữ liệu test lên production từ Codex.
