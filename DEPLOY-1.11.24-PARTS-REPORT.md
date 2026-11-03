# Xuất báo cáo linh kiện sử dụng — 1.11.24

## Các file thay trong Apps Script chính

1. `version final/ReportExport.gs` → thay toàn bộ file `ReportExport.gs`.
2. `version final/LegacyDashboardApi.gs` → thay toàn bộ file `LegacyDashboardApi.gs`.
3. Nếu project đã có trợ lý: thay `QuickAssistantKnowledge.gs` bằng `version final/QuickAssistantKnowledge.gs` để hướng dẫn báo cáo đồng bộ. Không thêm module trợ lý vào project chưa dùng trợ lý chỉ vì báo cáo.

Không thay Code.gs, URL, Cloud/OAuth, Properties hoặc project lưu trữ đính kèm. Không chạy migration hay function sửa dữ liệu.

## Trình tự

1. Thay hai file bắt buộc, cập nhật file hướng dẫn trợ lý nếu có, rồi Save.
2. Deploy → Manage deployments → chọn Web App hiện tại → Edit → New version → Deploy. Giữ URL/tài khoản thực thi.
3. Frontend GitHub dùng reports.js?v=4 và reports.css?v=4. Frontend mới tương thích backend cũ: mẫu linh kiện ẩn cho đến khi bootstrap có schema parts.
4. Tải lại web (Ctrl+F5), mở thẻ Báo cáo → Linh kiện sử dụng.
5. Chọn từ/đến ngày sử dụng và center nếu cần; nhập Part Number hoặc tên để tìm.
6. Chọn các cột → Xem trước → Xuất Excel. Xem trước tối đa20 dòng; Excel lấy đầy đủ kết quả, phân trang200 dòng và kiểm revision đến hết file.

## Đối chiếu sau deploy

- Lô Fan dùng4 linh kiện, có liên kết nhiều inverter: tổng số lượng vẫn4, không nhân với số Fan.
- Hồ sơ chuyển từ centerA sangB: lần dùng tạiA thuộc báo cáoA, lần dùng tạiB thuộcB.
- Cùng Part Number dùng hai lần: giữ hai dòng nguồn, không gộp/xóa.
- Ngày lọc là Ngày sử dụng đã lưu, không phải ngày nhận hồ sơ hay giao trả. Dòng thiếu ngày/số lượng hợp lệ không tự tính vào kỳ.
- Hồ sơ hủy/nguồn đã chuyển lô không cộng lại; dữ liệu chỉ có trong tab lịch sử chưa vào ledger không được tự suy ra.
- Quyền xuất giữ như báo cáo hiện tại: quản lý toàn bộ center. Không mở thêm quyền kho trong release này.

## Kiểm thử mã

`node "version final/tests/validate.mjs"`

UI fixture: đặt PLAYWRIGHT_MODULE tới Playwright đã cài, chạy `node "version final/tests/parts-report-ui.cjs"`. Chạy với profile headless riêng, không gọi dữ liệu production.
