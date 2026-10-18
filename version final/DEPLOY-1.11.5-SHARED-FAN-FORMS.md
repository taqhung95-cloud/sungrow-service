# 1.11.5 — Fan dùng biểu mẫu và thẻ chức năng hiện hành

Fan nhập thường giữ biểu mẫu chung. Fan theo lô cũng dùng biểu mẫu đó, thêm chọn một/nhiều S/N inverter và số Fan áp dụng; không mở màn hình nhập Fan riêng. Chưa cập nhật backend thì web tiếp tục cách đang chạy, không gửi payload mới vào backend cũ. Chỉ kích hoạt biểu mẫu chung khi backend đã có đủ năm file bên dưới. Không đổi URL, Spreadsheet ID, tên tab/cột hoặc chạy migration lại.

## 1. Cập nhật đúng năm file Apps Script

Trong project Apps Script hiện tại, thay **toàn bộ** nội dung từng file, không nối vào cuối code cũ:

| File | Thao tác | Mở code để copy |
|---|---|---|
| Code.gs | Thay toàn bộ file hiện có | [Code.gs](https://github.com/taqhung95-cloud/sungrow-service/blob/main/version%20final/Code.gs) |
| WorkOrderRules.gs | Thay toàn bộ file hiện có | [WorkOrderRules.gs](https://github.com/taqhung95-cloud/sungrow-service/blob/main/version%20final/WorkOrderRules.gs) |
| FanLots.gs | Thay toàn bộ file hiện có | [FanLots.gs](https://github.com/taqhung95-cloud/sungrow-service/blob/main/version%20final/FanLots.gs) |
| LegacyDashboardApi.gs | Thay toàn bộ file hiện có, giữ wrapper ở đầu/cuối | [LegacyDashboardApi.gs](https://github.com/taqhung95-cloud/sungrow-service/blob/main/version%20final/LegacyDashboardApi.gs) |
| FanWorkOrders.gs | Bấm **+ → Script**, đặt tên FanWorkOrders, dán toàn bộ code | [FanWorkOrders.gs](https://github.com/taqhung95-cloud/sungrow-service/blob/main/version%20final/FanWorkOrders.gs) |

Ở trang GitHub của mỗi file, bấm **Raw** hoặc nút copy nội dung file để lấy toàn bộ code. ManagerDashboard.gs, PortalBridge.html và các module đang có khác giữ nguyên. LegacyDashboardApi chỉ đồng bộ version release, giữ nguyên công thức/readers. Bản này không thay công thức KPI hoặc tạo một bảng linh kiện mới.

## 2. Kiểm tra trước khi deploy

Save tất cả. Chọn hàm **kiemTraFanBieuMauChung** trên thanh Run, chạy bằng tài khoản quản lý project như các lần kiểm tra trước. Execution log cần có:

```
FAN_SHARED_FORMS_CHECK
version: 1.11.5-shared-fan-forms
sharedFormsAvailable: true
enabled: true
writtenToDatabase: false
audit.ok: true
audit.pending: []
audit.errors: []
```

Hàm kiểm tra đọc các bảng nguồn/chỉ mục/nhật ký và lưu kết quả audit vào Script Properties; không sửa hàng dữ liệu nghiệp vụ. Nếu audit báo lệch, giữ nguyên dữ liệu và xem lỗi cụ thể; không chạy lại gom lô, chuyển case hoặc khôi phục đè backup.

## 3. Deploy trên Web App hiện tại

Deploy → Manage deployments → chọn Web App đang dùng → Edit → Version: **New version** → Deploy. Giữ URL hiện tại, Execute as: Me và Who has access: Anyone như deployment đang hoạt động. Trở lại portal, Ctrl+F5, đăng nhập lại để lấy capability mới.

Trong Console, `SungrowTransport.info()` phải cho version **1.11.5-shared-fan-forms** và state **ready**. Đây chỉ xác nhận deployment/kết nối; không thay cho kiểm tra nghiệp vụ bên dưới.

## 4. Cách nhập

1. Tìm hồ sơ Fan theo lô, bấm **Cập nhật công việc** ở đúng hàng chức năng như Inverter.
2. Chọn S/N inverter áp dụng. Chọn nhiều dòng nếu cùng cập nhật một trạng thái/kết quả. Ghi số Fan áp dụng của từng dòng; khi hoàn tất chỉ nhập số Fan hoàn tất thêm ở lần này.
3. Nhập GSP/MA, trạng thái, ngày, kết quả, lỗi, linh kiện và SLA ngay trong **một biểu mẫu**. GSP/MA, chẩn đoán, ghi chú và SLA thuộc hồ sơ/công việc chung; trạng thái, kết quả và lỗi gắn với S/N được chọn.
4. Linh kiện nhập **tổng số thực dùng**, ví dụ hai inverter dùng tổng ba Fan thay thế thì nhập số lượng 3, không nhập 3 cho mỗi S/N. Khi đang sửa chữa vẫn ghi linh kiện được, nhưng phải có ngày sử dụng. Nếu hoàn tất kỹ thuật và ngày dùng để trống, lấy ngày hoàn tất như các thiết bị khác.
5. Bấm **Lưu cập nhật** một lần để lưu các mục và S/N đã chọn trong một giao dịch. Không có nút lưu linh kiện riêng. Các S/N có kết quả khác nhau được cập nhật qua các lần lưu riêng, cùng biểu mẫu.

Linh kiện/lỗi đã lưu hiển thị trong chính bảng hiện hành và được giữ để đối soát nhật ký. Thêm dòng mới cho lần sử dụng mới; không nhập lại số lượng cũ. Chọn **Liên kết** ở bản ghi linh kiện cũ khi dùng nó làm bằng chứng cho lần hoàn tất/đổi Fan; thao tác này không cộng lại số lượng. Chỉnh hoặc xóa bản ghi cũ cần đối soát, không sửa trực tiếp làm lệch nhật ký.

**Xác nhận bảo hành** và **Giao trả khách hàng** giữ biểu mẫu quen thuộc, thêm chọn S/N. Giao trả nhập số Fan thực giao từng S/N; giao một phần chưa đóng cả hồ sơ. **Sửa thông tin hồ sơ** cho quản lý sửa metadata, giữ khóa số Fan/S/N/mốc ngày nguồn để không làm mất cân bằng. **Luân chuyển center/Xác nhận nhận hàng** vẫn áp dụng cho hồ sơ và toàn bộ Fan còn trong hồ sơ; một hồ sơ chỉ có một center đang giữ hàng.

## 5. Đối soát dashboard và xử lý mất phản hồi

- Thẻ KPI giữ **Thiết bị/Hồ sơ**: Fan thường = một thiết bị nguồn còn hiệu lực, dù số Fan là 2/3/5; một lô nhiều inverter = một hồ sơ. Không đưa số Fan vật lý thành số KPI.
- Linh kiện vào bảng **Linh kiện sử dụng** và cùng readers/dashboard/báo cáo hiện hành, theo PN, số lượng thực dùng, ngày dùng và center xử lý. Không nhân với Fan hoặc S/N.
- Lô chỉ được tính hoàn tất kỹ thuật khi toàn bộ Fan hoàn tất; chỉ được tính đã giao khi trả hết. Giao/hoàn tất từng phần vẫn giữ tiến độ và nhật ký từng S/N.
- Đổi bộ lọc ngày, center và loại thiết bị trên dashboard để kiểm tra đúng phạm vi. Các kiểm thử nguồn đã đối chiếu dữ liệu ghi thật trong fixture qua readers hiện hành, gồm KPI, tồn/chờ giao, tổng linh kiện, ngày, center, loại/model và tìm S/N. Chưa coi đó là số liệu production đã được xác nhận.
- Giao dịch có CAS, mã chống trùng và readback nguồn/công việc/linh kiện. Nếu mất phản hồi, giữ biểu mẫu và gửi lại đúng nội dung để dùng cùng mã thao tác. Nếu báo cần đối soát đồng bộ, chạy kiểm tra, xử lý trạng thái pending bằng cơ chế reconcile hiện hành; không tạo thao tác thay thế hoặc cộng linh kiện lần nữa.

Web chỉ kiểm tra nhẹ theo revision và phân trang như hiện tại. Chọn S/N trong biểu mẫu không gọi API từng dòng hoặc quét tab lịch sử. Không tạo hồ sơ thử hoặc sử dụng linh kiện giả trên dữ liệu production để kiểm tra giao diện.
