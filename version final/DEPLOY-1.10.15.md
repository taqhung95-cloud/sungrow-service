# 1.10.15 — Khoảng ngày và SLA thực tế

## Cập nhật Apps Script

1. Thay toàn bộ `Code.gs` và `LegacyDashboardApi.gs` bằng hai file cùng thư mục này, rồi Save.
2. Deployment Web App hiện tại: Edit → New version → Deploy. Giữ nguyên URL và quyền hiện hành.
3. Reload web. `getBootstrap` trả `version: 1.10.15-dashboard-range`, `dashboardRanges: true`; Day/Week/Custom và lịch chọn ngày được bật.

Không chạy migration, repair, rebuild index, khởi tạo database hoặc upload lại. Không thay các file nghiệp vụ khác cho riêng thay đổi KPI này.

## Giao diện và quy tắc

- Giữ header, sidebar, năm thẻ KPI và bố cục các panel. Bộ lọc Day/Week/Month/Year/Custom, khoảng ngày, center, so sánh nằm một hàng trong header cũ.
- Chọn ngày bằng hai ô lịch native trong hộp chọn khoảng ngày. Đầu ngày 00:00 và cuối ngày 23:59 theo lịch Việt Nam. Nguồn hiện tại có độ chính xác ngày, chưa bổ sung trường khách gửi/khách nhận riêng.
- Week bắt đầu thứ Hai; các preset đang diễn ra kết thúc hôm nay. Khoảng tùy chọn có thể qua năm. Cùng kỳ dịch lùi một tháng hoặc một năm; trọn tháng đối chiếu trọn tháng, ngày không tồn tại được chặn tại cuối tháng.
- Tiếp nhận/hoàn tất kỹ thuật/đã giao theo từng ngày sự kiện. Tồn đầu kỳ và tồn tại ngày chốt giữ cả hồ sơ nhận từ trước khoảng chọn.
- KPI đạt 7 ngày chỉ dùng toàn bộ thời gian nhận–trả thực tế. Thời gian sau trừ tạm dừng chỉ để đối chiếu, không thay đổi đạt/trượt.
- Thẻ SLA có tỷ lệ đạt chính và thời gian trung bình thực tế/trừ dừng/chênh lệch (ngày). Trung bình có trọng số số lượng thiết bị.
- Bảng vận hành có một cột SLA gồm hai dòng thực tế/trừ dừng; phân bổ lại khoảng trống Center/Nhận định, không cuộn ngang.
- Các khoảng `Tạm dừng SLA` được liên kết theo mã công việc, cắt trong vòng đời nhận–trả, gộp chồng nhau trước khi trừ. Khoảng chưa kết thúc được chốt ở ngày trả đối với hồ sơ đã giao. Tính ngày theo chênh lệch ngày lịch; nhận và trả cùng ngày là 0 ngày, như quy tắc hiện hành.
- Backend cũ: Month/Year vẫn hoạt động, các lựa chọn đòi hỏi khoảng ngày chưa được bật. Không suy ra thời gian trừ dừng từ nguồn thiếu dữ liệu.

## Kiểm chứng

`node "version final/tests/validate.mjs"`, `dashboard-range.mjs`, `dashboard-layout.mjs`.

Kiểm thử local bằng frontend thật với API giả lập tại 1920/1440/1280/1024; ảnh trong `analysis/dashboard-preview/` dùng dữ liệu tổng hợp, không phải ảnh dữ liệu production. Chưa xác nhận deployment Apps Script mới hoặc smoke test bằng tài khoản production.
