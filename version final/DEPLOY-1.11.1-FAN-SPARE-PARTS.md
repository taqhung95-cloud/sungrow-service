# 1.11.1 — Fan sử dụng chung sổ linh kiện

## Quy tắc nghiệp vụ

Fan nhập thường, hồ sơ Fan cũ và Fan theo lô sử dụng cùng bảng **Linh kiện sử dụng**, cùng Mã công việc và luồng đồng bộ dashboard hiện hành. Không tạo bảng tiêu hao mới, không cộng spare part từ nhật ký Fan. Dashboard vẫn lấy PN, số lượng thực dùng, ngày sử dụng và center xử lý từ nguồn linh kiện hiện hành.

Khi lưu kết quả kỹ thuật từng S/N:

- Chọn kết quả xử lý và số Fan hoàn tất lần này.
- Mở **Spare part sử dụng → Ghi nhận / Chọn**. Nhập PN, tên, số lượng thực dùng, ngày sử dụng. Có thể ghi nhiều PN, tối đa 20 dòng mỗi lần lưu.
- Nếu linh kiện đã được ghi nhận tại công việc này, chọn bản ghi có sẵn thay vì nhập lại. Liên kết không tăng tiêu hao.
- Đổi Fan cần có spare part mới hoặc bản ghi đã có. Sửa bảo hành cũng có thể ghi linh kiện ngay cùng lần lưu. Số linh kiện độc lập với số Fan hoàn tất; không nhân theo Fan, S/N hoặc hồ sơ.
- Nhấn **Lưu dòng** để lưu kết quả và linh kiện trong cùng giao dịch. Không nhập lại số lượng này ở mục linh kiện bổ sung.

Mục **Linh kiện sử dụng** riêng vẫn dùng khi cần ghi nhận linh kiện trước lúc hoàn tất kỹ thuật. Nguồn lưu và cách tổng hợp giống nhau. Ngày dùng phải từ ngày center nhận hàng đến ngày xử lý; không tự đổi ngày cũ khi liên kết.

## Cập nhật Apps Script

Gói 1.11.1 có đủ bảy module backend. Thay đúng file trong project hiện tại: Code.gs, LegacyDashboardApi.gs, ManagerDashboard.gs, ReportExport.gs, FanLotRules.gs, FanLots.gs, PortalReadDiagnostics.gs. Giữ nguyên các module khác. Không đổi Spreadsheet ID, tab, URL hoặc dữ liệu nguồn.

Nếu chưa triển khai Fan lần nào, làm theo **DEPLOY-1.11.0-FAN.md** đi kèm để tạo backup, chuẩn bị schema, đối soát và bật tính năng, nhưng sử dụng code **1.11.1** trong gói này.

Nếu đã chuẩn bị Fan theo lô, schema vẫn là `fan-lots-1`: không cần chạy lại chuẩn bị schema hoặc chuyển đổi dữ liệu cũ. Chạy `doiSoatFanTheoLo`, `diagnosePortalReadPath` và `diagnoseWebReadPaths` trước khi tạo New version trên deployment Web App hiện tại. Audit cần `ok: true`, `errors: []`, `pending: []`. Nếu chưa đạt, giữ dữ liệu để đối soát; không khôi phục đè bản sao lưu.

Sau deploy, đăng nhập lại hoặc Ctrl+F5. Frontend chỉ cho lưu kết quả Fan kèm linh kiện khi bootstrap có `fanLotPartsWithTechnical: true`, tránh backend cũ bỏ sót thông tin spare part. API/backend version là `1.11.1-fan-spare-parts`.

## Đối chiếu sau triển khai

1. Chọn một thao tác nghiệp vụ thật. Đối chiếu PN/số lượng/ngày dùng trong Linh kiện sử dụng với công việc và lịch sử xử lý Fan.
2. Chọn đúng kỳ và center trên dashboard Linh kiện; so tổng PN của Fan và các thiết bị khác theo sổ chung, không so với số Fan hoàn tất.
3. Kiểm tra giao trả từng phần không làm tăng thêm spare part. Liên kết bản ghi có sẵn cũng không tăng tổng.
4. Chạy lại `doiSoatFanTheoLo`. Bản ghi mới được kiểm tra ID duy nhất, Mã công việc, PN, số lượng và ngày dùng; retry/pending vẫn đồng bộ projection, chỉ mục và revision theo luồng cũ.

Kiểm thử local dùng dữ liệu giả: thao tác Fan tạo 9 linh kiện, Inverter có 5, Fan cũ có 2 → tổng chung 16; PN chung 14, PN khác 2. Kiểm tra ngày dùng, lũy kế năm, chi tiết thiết bị, lưu lỗi, gửi lại và liên kết cũ đều đạt. Đây không phải số liệu production.

Trong lần phát triển này chưa cập nhật database hoặc chạy Apps Script production. GitHub chỉ triển khai frontend; backend cần người dùng cập nhật thủ công như trên.
