# Quản lý sửa thông tin lô Fan đã hoàn tất — 28/10/2026

Trạng thái: đã kiểm thử local; chưa deploy backend hoặc publish frontend. Không dùng thông báo bản này để suy số deployment version trên Google. Frontend production gần nhất165/entry146.

Nguyên nhân: Code.gs/publicCase cho quản lý canUpdate trên hồ sơ đóng, nhưng FanWorkOrders.gs/fwBegin_ chặn Đã hoàn tất trước khi xử lý work, bất kể quyền. Form Fan còn có thể tự chọn Đã nhận hàng khi scope trống, tạo thêm lỗi trạng thái/bảo hành không khớp dữ liệu cũ.

## Bản sửa

- Quản lý hệ thống và quản lý Sungrow theo actor đã chuẩn hóa được điều chỉnh metadata của công việc hiện tại trên lô đóng. Nhân viên/quản lý center khác vẫn bị chặn. Đã hủy/đang vận chuyển vẫn không sửa theo luồng này.
- Giữ trạng thái đóng, ngày sẵn sàng/trả, số nhận/hoàn tất/đã trả, part ledger cũ. Không apply lại technical/return hoặc mở lại case. Backend bắt buộc selection quantity0; UI bỏ cột hoàn tất thêm khi mở lô đã đóng.
- Giữ kết quả/ngày hoàn tất/loại đổi đã chốt trong luồng metadata, kể cả kết quả tổng hợp trống của lô có nhiều kết quả. Sửa ghi chú, GSP/MA, chẩn đoán, lỗi mới, SLA hoặc thêm linh kiện thực tế có ngày hợp lệ. Thay đổi nguồn/số lượng cần luồng correction/đối soát được phân quyền, không vượt guard bằng biểu mẫu kỹ thuật.
- Giữ nguyên idempotency, fingerprint, quyền, atomic batch, receipt/recovery/audit và sync index/projection/revision.

## Thao tác triển khai

1. Trong project Apps Script chính, thay đủ **Code.gs**, **FanWorkOrders.gs**, **WorkOrderRules.gs** từ thư mục `version final/` của nhánh phát hành. Code.gs phải khai báo `1.11.22-fan-closed-edits`; đã bao gồm sửa dropdown SLA1.11.21.
2. Save → Deploy → Manage deployments → Edit deployment chính → New version → Deploy. Giữ cùng URL/executor/access/Cloud/Properties. Không chạy migration, repair hoặc cleanup; không sửa worker upload.
3. Người dùng báo đã deploy, agent mới publish frontend166/entry147/sharedforms9/rules5/locks6 trên GitHub main. Không publish trước backend.
4. Tải lại hồ sơ, chọn inverter cần điều chỉnh, kiểm tra trạng thái/kết quả đã lưu rồi sửa thông tin. Không nhập lại linh kiện cũ như dòng mới. Không xác nhận trả thêm cho lô đã đóng.

## Kiểm tra

Validator đầy đủ đạt. Kiểm thử pipeline sau khi lô đã giao hết: quản lý sửa note, replay không ghi lại, số lượng/ngày giao/part ledger không đổi, không thêm event technical/return; nhân viên bị từ chối và xác nhận giao lại bị chặn. UI Edge headless kiểm tra trạng thái hoàn tất không bị reset, không có ô tăng hoàn tất, gửi quantity0 và giữ kết quả tổng hợp trống của lô nhiều kết quả. Chưa thử ghi dữ liệu thật trên Google sau deploy.
