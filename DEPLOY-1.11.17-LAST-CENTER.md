# Center cuối xử lý và giao trả — 1.11.17

## File cần thay

Trên bộ đang chạy, thay toàn bộ nội dung ba file Code.gs, FanLots.gs, FanWorkOrders.gs. Thêm file script mới tên TransferRepair.gs và copy nội dung file cùng tên trong gói.

Giữ nguyên các file khác, gồm LegacyDashboardApi.gs, FanLotRules.gs và FastCaseReads.gs (nếu đã cài bản1.11.16 tối ưu tốc độ). Không cần đổi schema, URL, Spreadsheet ID hoặc chạy migration.

## Triển khai

1. Copy đủ bốn file, Save.
2. Deploy → Manage deployments → Edit Web App đang dùng → New version → Deploy. Giữ URL và Execute/access.
3. Website Ctrl+F5. Center cuối được chọn ngày giao trả trực tiếp; center tiếp nhận ban đầu giữ trong lịch sử.

## Sửa hồ sơ HS-20261015-092607-7D323A

Chạy trong Apps Script Editor bằng tài khoản quản lý:

1. Chạy kiemTraLuanChuyen7D323A. Hàm chỉ xem trước, writtenToDatabase:false. Dự kiến changedRecords:3 và resultingStatus:Sẵn sàng trả khách.
2. Chạy suaLuanChuyen7D323A. Hàm giữ công việc CV-20261015-154648-AF003F đã hoàn tất kỹ thuật21/10, đóng công việc nhận trùng CV-20261015-152557-CA2136 và đánh dấu Đã hủy lượt chuyển trùng. Giữ mọi row, ID, lịch sử và tài liệu.
3. Hàm đồng bộ dashboard/chỉ mục/revision và ghi audit. Nếu dữ liệu đã thay đổi, bản trùng có lỗi/linh kiện/SLA/chặng tiếp theo, hàm dừng thay vì tự gộp/xóa. Chạy lại sau thành công không sửa lặp.
4. Tải lại hồ sơ: trạng thái Sẵn sàng trả khách, ngày sẵn sàng21/10/2026. Sungrow được mở Giao trả khách hàng và nhập ngày trả thực tế.

Hàm sửa KHÔNG ghi ngày trả khách, không xác nhận giao hàng thay người dùng, không đổi kết quả/linh kiện của công việc đã hoàn tất. Đây là bước sửa dữ liệu hồ sơ cũ riêng với bước deploy code; chưa chạy bước2 thì bản trùng cũ vẫn còn.

## Chống lặp và trách nhiệm center

Gửi lại cùng lượt đang chờ nhận trả về IDs cũ; không thêm work. Nhận lại cùng lượt/cùng ngày không reset tiến độ. Đổi ngày nhận phải sửa riêng. Lượt cũ sau khi center đã đổi sẽ bị chặn. Mọi lần tạo lượt chuyển hoặc xác nhận nhận ghi đồng bộ một batch, giữ khóa ghi.

Center đang giữ hàng chịu trách nhiệm xử lý/giao trả cho toàn bộ hồ sơ, kể cả Fan theo lô. Center cũ không được giao trả thay khi đã bàn giao. Kết quả hoàn tất kỹ thuật vẫn độc lập số spare part dùng thực tế.

Frontend Pages phát hành riêng; backend chỉ có hiệu lực sau New version. Các kiểm thử dùng dữ liệu mẫu, chưa ghi thay đổi hồ sơ thật trong phiên làm việc này.
