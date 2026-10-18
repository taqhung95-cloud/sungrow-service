# Tab toàn website và tra bảo hành Fan — 1.11.8

Frontend: liveJS147 / entry128. Backend: 1.11.8-workspace-fan-warranty.

## Phần website

GitHub Pages triển khai toàn bộ `docs/` sau khi validation thành công. Người dùng tải lại website bằng Ctrl+F5.

- Tab dùng chung cho dashboard, báo cáo, nhập liệu và hồ sơ mọi loại thiết bị. Không giới hạn cứng số tab.
- Thanh tab cao34px, chữ12px; menu tab chữ12px, dòng28px; SVG cùng kiểu icon. Bỏ footer để bù không gian.
- Chỉ một iframe/phiên nhập liệu. Tab hồ sơ giữ DOM/form/file trong bộ nhớ khi chuyển; cảnh báo đóng tab chưa lưu. Khi đóng xác nhận bỏ nội dung, bản nháp phục hồi đã lưu trên trình duyệt vẫn theo cơ chế hiện hành.
- Giữ tối đa4 ngữ cảnh hồ sơ sạch trong bộ nhớ; tab logic không bị đóng. Hồ sơ đã nhập dở không bị loại khỏi bộ nhớ. Mở lại ngữ cảnh sạch đã được giải phóng sẽ đọc chi tiết lại.
- Tạm ngừng heartbeat nhập liệu khi iframe ẩn. Dashboard, báo cáo và nhập liệu dùng cơ chế đồng bộ hiện hành, không tạo interval cho mỗi tab. Hủy yêu cầu đọc hồ sơ đã rời; không hủy hoặc tự gửi lại mutation.
- Hồ sơ lịch sử giữ provenance `year-row` và chi tiết chỉ đọc; không chuyển ID lịch sử sang API hồ sơ vận hành.
- Trạng thái tab chỉ ở bộ nhớ phiên, không chia sẻ giữa tài khoản; đăng xuất xóa khung nhập liệu/tab. Đây không phải lưu bộ tab qua đóng trình duyệt.

## Phần Apps Script — chỉ cần thay Code.gs nếu đã ở1.11.7

1. Mở [Code.gs trên GitHub](https://github.com/taqhung95-cloud/sungrow-service/blob/main/version%20final/Code.gs), bấm **Raw** rồi copy toàn bộ code.
2. Trong dự án Apps Script đang dùng, mở **Code.gs**, chọn toàn bộ nội dung và dán thay thế. Không tạo thêm một bản Code.gs/không dán sang LegacyDashboardApi.gs.
3. **Save**. Vào **Deploy → Manage deployments → Edit (bút chì)**, chọn **New version → Deploy** trên Web App hiện tại. Giữ nguyên URL, Execute as và Who has access đang hoạt động.
4. Quay lại website, **Ctrl+F5**.
5. Chọn Fan thường, nhập Model/Mã Fan (ví dụ ES000173) và S/N inverter có trong nguồn bảo hành. Kiểm tra chip Còn/Hết bảo hành và ngày hết hạn; Model Fan phải giữ nguyên.
6. Chuyển Theo lô, nhập/dán S/N inverter. Dưới mỗi S/N xuất hiện kết quả tra bảo hành, bao gồm chưa có thông tin hoặc chưa tra được. S/N trùng tái sử dụng cùng kết quả.
7. Kiểm tra thêm Inverter: S/N vẫn tự điền Model inverter như trước.

Không cần chạy migration hoặc hàm ghi dữ liệu. Nếu chưa deploy Code.gs mới, frontend vẫn tra qua API đơn hiện hành, tối đa2 yêu cầu đồng thời. Sau khi deploy backend mới, `getBootstrap` trả `warrantyBatchLookup:true`: gộp tối đa20 S/N/yêu cầu, một lần tìm nguồn cho các S/N chưa có cache, cache dùng chung5phút có xác thực trước cache. Không cần sửa config hoặc URL.

## Ý nghĩa dữ liệu

Model của hồ sơ Fan luôn là Model/Mã Fan do người nhập xác định. S/N inverter dùng để tra nguồn All SN list; Model inverter trả về không được gán vào Model Fan. Chip kết quả là tra cứu tham khảo từ nguồn bảo hành hiện hành, không tự đổi kết luận bảo hành đã được quản lý xác nhận. Cơ chế duyệt, quyền, journal, parts ledger, KPI Thiết bị/Hồ sơ và tỷ trọng model vật lý giữ nguyên.

Không có S/N/không khớp nguồn/thiếu ngày hoặc gói bảo hành thì hiển thị đúng tình trạng thiếu thông tin, không tự kết luận còn bảo hành. Các hồ sơ Fan cũ đã nhập nhầm Model inverter cần xác định mã Fan thực tế rồi sửa qua chức năng hồ sơ; không suy mã Fan từ S/N hoặc linh kiện đã dùng.

API TextFinder dùng tìm toàn ô và regex đã escape ký tự trong từng S/N, theo [tài liệu Google](https://developers.google.com/apps-script/reference/spreadsheet/text-finder#useRegularExpression(Boolean)); không quét các sheet lịch sử2024/2025/2026 hoặc sửa nguồn bảo hành.

## Đối soát và quay lại

- Chạy `node "version final/tests/validate.mjs"`: KPI/filters/parts, migration, auth/cache, batch bảo hành và syntax chung.
- Chạy Edge với `PLAYWRIGHT_MODULE` được cấu hình: `node "version final/tests/workspace-ui.mjs"`. Kiểm tra >20tab, một iframe, giữ nháp Fan/Inverter, không đọc lại khi quay về hồ sơ đã cache, S/N trùng không gọi lại, Inverter tự điền Model, Fan không bị ghi đè, menu12px, tắt poll iframe ẩn và không cắt dashboard ở1920×1080/1366×768.
- Chạy thêm cùng test với `WARRANTY_BATCH=false` để xác nhận frontend tương thích backend cũ.
- Kiểm thử dùng dữ liệu giả lập, không tạo/sửa hồ sơ thật. Chưa phải kết quả load-test nhiều tài khoản thật đồng thời.
- Nếu cần quay lại, dùng phiên bản deployment Apps Script trước đó và revert commit frontend này qua GitHub Pages. Không phải phục hồi dữ liệu vì release không migration/ghi nguồn.
