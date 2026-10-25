> **Tài liệu lịch sử theo phiên bản.** Đối chiếu [quy tắc hiện hành](CURRENT-IMPLEMENTATION.md) và PRODUCTION-STATE.md trước khi dùng; không tự ghi đè backend hoặc chạy lại migration/repair từ hướng dẫn cũ.

# 1.11.16 — đọc gộp và rút ngắn luồng tải/lưu

Triển khai trên bộ backend1.11.15 hiện tại. Thay toàn bộ Code.gs, thêm file FastCaseReads.gs, Save rồi New version trên deployment hiện tại, giữ URL. Không đổi dữ liệu, schema hoặc quyền; không chạy migration. Sheets API và các OAuth scope sử dụng đã có trong bộ Fan hiện hành. Không cần bật Advanced Service riêng vì dùng REST qua UrlFetchApp.

Frontend liveJS160/entry141/workspace4 tương thích backend1.11.15. Có bốn thay đổi: đọc dashboard hiện tại/so sánh song song; iframe tái dùng bootstrap từ parent cùng origin và cùng token; nút Đồng bộ danh sách không chờ đọc danh mục; mutation yêu cầu chi tiết mới trong cùng phản hồi. Sau khi backend1.11.16 được deploy, tab đang lưu dùng snapshot do server trả về, không cần một RPC getCaseDetail tiếp theo. Nếu không đọc được chi tiết sau khi ghi thành công, mutation vẫn trả thành công và UI đọc lại riêng; không gửi lại mutation.

FastCaseReads.gs đọc schema bằng1request, các cột khóa bằng1batchGet và các dòng nguồn/con bằng1getByDataFilter. Cache schema10phút, locator theo globalrevision5phút, bundle nguồn theo caseId+revision2phút; quyền và dữ liệu công khai được kiểm tra/render sau authentication ở mỗi yêu cầu, không cache actor hay response chung giữa các vai trò. Một lần mở mới với locator đã có chỉ cần1requestSheets; cache bundle phù hợp revision không cần requestSheets cho bundle. Kiểm tra revision sau đọc, giữ sốdòng/thứtự, kiểuDate/number/boolean/error, leading-zeroSN; phát hiện locator trỏ nhầm và fallback sang reader hiện hành. Đồng bộ thủ công hồ sơ bypass cả ba cache để đọc nguồn mới.

Các sốrequest trên chỉ tính reader nguồn, không phải toàn luồngRPC: xác thực phiên và module phụ có thể còn đọc Sheets. Không hứa sốgiây dựa trên mock. Tooltip sau đọc hồ sơ hiển thị serverMs/cache/path để nhận biết `batch` hoặc `legacy`. Giữ khóa chống ghi đồng thời, CAS, audit, soft-delete1.11.14 và snapshot nhật ký Fan.

Kiểm chứng: validate.mjs; fast-case-reads.mjs (3cold/0warm, revision, explicitrefresh, permission, dates, private notes, rowmove, failurefallback); dashboard-sync-clock.mjs (hai lượt đọc bắt đầu trước khi một lượt hoàn tất); workspace-ui.mjs trênEdge (dữ liệu giả) kiểm tra snapshot sau lưu không đọc lại, backendcũ vẫn đọc lại1lần, chỉ1bootstrap, bảnnháp và tab/realtime/Fan/correction/delete giữ đúng.

Rollback frontend bằng commit trước; backend chọn version deployment trước. Không có thay đổi nguồn cần hoàn tác. Code.gs1.11.16 không có FastCaseReads.gs vẫn chạy reader cũ, nhưng chưa nhận tối ưu đọc gộp.
