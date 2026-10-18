# 1.11.7 — Tỷ trọng model Fan theo số Fan thực nhận

## Quy tắc đã sửa

- Các thẻ KPI tiếp nhận/hoàn tất/chờ giao/đã giao giữ đơn vị Thiết bị/Hồ sơ: Fan nhập thường1, mỗi lô1.
- Riêng Tỷ trọng model dùng số lượng thực nhận của Fan, cả nhập thường và theo lô, trong kỳ và center đang chọn. Model lấy từ trường Model/Mã Fan của hồ sơ, không lấy model/S/N inverter liên quan hoặc suy từ PN linh kiện đã sử dụng.
- Ví dụ hai hồ sơ cùng model ES000173 có tổng9 Fan: dòng **Fan | ES000173**, SL9. Nếu tổng Fan trong kỳ12 thì tỷ trọng75%. Hai hồ sơ đó vẫn tính2 ở các thẻ KPI.
- Đã hoàn tất/giao trả một phần không làm giảm số Fan tiếp nhận của model. Hồ sơ hủy/nguồn đã nhập lô không cộng lại. Mẫu số khi lọc Fan là tổng số Fan thực nhận của tất cả model Fan trong kỳ, gồm nhóm chưa xác định model.
- Fan trống model hoặc chỉ ghi Fan hiện **Fan | Chưa xác định model**, giữ đủ số Fan trong mẫu số. Mã cũ lưu nhầm model inverter cần được quản lý sửa đúng trong Sửa thông tin hồ sơ; không tự thay mã Fan hoặc gán ES000173 từ ví dụ.
- Khi chọn tất cả loại thiết bị, tổng biểu đồ là số lượng thực nhận (thiết bị khác cộng số lượng thiết bị, Fan cộng số quạt), khác đơn vị KPI hồ sơ. Các thống kê lỗi/model duy nhất khác và ledger linh kiện giữ nguyên.

## Apps Script: thay hai file sau bản1.11.6

1. [Code.gs](https://github.com/taqhung95-cloud/sungrow-service/blob/main/version%20final/Code.gs): Raw/Copy, thay toàn bộ file đang có.
2. [LegacyDashboardApi.gs](https://github.com/taqhung95-cloud/sungrow-service/blob/main/version%20final/LegacyDashboardApi.gs): thay toàn bộ gồm wrapper đầu/cuối.
3. Save. Chạy **kiemTraFanBieuMauChung**, cần version `1.11.7-fan-model-quantity`, audit.ok:true, pending/errors rỗng. Không chạy migration/gom lô.
4. Deploy → Manage deployments → Web App hiện tại → Edit → **New version** → Deploy, giữ URL hiện tại.
5. Website Ctrl+F5, đăng nhập lại. Transport ready/version1.11.7. Chọn cùng kỳ/center, chọn Fan trong Tỷ trọng model: donut ghi đơn vị Fan, SL từng model cộng số quạt. KPI phía trên tiếp tục Thiết bị/Hồ sơ.

Nếu chưa cài EntrySuggestions và bản1.11.6, làm thêm [hướng dẫn1.11.6](DEPLOY-1.11.6-FAN-UI-CATALOG.md). Giao diện mới nhận diện dữ liệu model theo capability trong response: backend cũ sẽ hiện yêu cầu cập nhật tại riêng thẻ model thay vì tiếp tục đưa số hồ sơ thành số Fan.

Không đổi cấu trúc/tab/cột/ID hoặc dữ liệu nguồn. ModelQuantity là thuộc tính trong response/cache của reader, lấy Số lượng hiện hành của Fan thường hoặc tổng snapshot lô; không tạo ledger/công thức linh kiện khác và không thêm lần đọc Sheet. Tests xác nhận9ES000173/12Fan=75%, KPI5đơn vị với3Fan-case+2Inverter, bộ lọc ngày/center/quyền/hủy và warm cache không thêm reads. Đây là fixture, không tự gán số9/ES000173 vào dữ liệu production.
