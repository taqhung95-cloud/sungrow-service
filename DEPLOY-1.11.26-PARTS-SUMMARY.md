# Báo cáo linh kiện tổng hợp theo mã — 1.11.26

## File cần cập nhật trong backend Apps Script chính

1. `version final/ReportExport.gs` → thay toàn bộ `ReportExport.gs`.
2. `version final/LegacyDashboardApi.gs` → thay toàn bộ `LegacyDashboardApi.gs`.
3. Nếu đã dùng trợ lý: thay `QuickAssistantKnowledge.gs` bằng file cùng tên trong `version final/` để đồng bộ hướng dẫn. Không cần thêm bộ trợ lý vào project chưa dùng.

Không thay Code.gs, URL, Cloud/OAuth, Properties hoặc worker đính kèm; không chạy migration.

## Thao tác

1. Thay các file trên, Save.
2. Deploy → Manage deployments → Edit Web App hiện tại → New version → Deploy. Giữ URL/tài khoản thực thi.
3. Frontend reports.js?v=5 đã chuẩn bị publish GitHub; Ctrl+F5 rồi mở Báo cáo → Linh kiện sử dụng.
4. Chọn Kiểu xuất: **Tổng hợp theo Part Number** (mặc định). Chọn kỳ ngày sử dụng, center và từ khóa nếu cần. Xem trước hoặc Xuất Excel.
5. Để đối chiếu nguồn, đổi sang **Chi tiết từng lần sử dụng** trong cùng mẫu, dùng đúng kỳ/center. Tổng số lượng hai chế độ phải bằng nhau khi không lọc từ khóa.

## Ý nghĩa

- Một PN một dòng tổng trên toàn bộ center đã chọn. Ví dụ ES000173 dùng4+2+3chiếc → một dòng9chiếc.
- Tổng hợp: PN, tên, tổng số lượng. Ngày/hồ sơ/công việc/center không phải cột tổng hợp vì có thể có nhiều giá trị; xem ở chế độ chi tiết.
- Chọn bỏ cột không thay đổi cách gộp. Gộp trước phân trang; không cộng riêng20dòng xem trước.
- PN khác hoa/thường được gộp; mã thiếu không bị gộp tất cả thành một mã giả, giữ riêng theo tên.
- Tìm tên ở bản tổng hợp giữ tổng lượng đầy đủ của PN khớp, kể cả tên ghi khác; bản chi tiết tìm trên từng dòng nguồn.
- Số dòng/số mã khác số chiếc: 365dòng có thể chứa tổng857chiếc; bản này hiển thị riêng tổng số lượng thực tế theo bộ lọc, không ấn định một con số.
- Dùng cùng ledger Ngày sử dụng và center công việc. Không nhân số Fan hoặc liên kết; giữ bản ghi thiếu ngày/số lượng ngoài kỳ như quy tắc trước.

Backend cũ: kiểu tổng hợp chưa xuất hiện; cập nhật đủ hai file và tạo New version. Không tự sửa quyền hoặc dữ liệu để bật chức năng.

Kiểm thử: `node "version final/tests/validate.mjs"`; UI `node "version final/tests/parts-report-ui.cjs"` với PLAYWRIGHT_MODULE.
