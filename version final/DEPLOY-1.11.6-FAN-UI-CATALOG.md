# 1.11.6 — Bảng Fan gọn, danh mục lỗi và gợi ý linh kiện

## Cập nhật Apps Script

Nếu đã cài đủ năm file của 1.11.5, bản này chỉ cần ba file dưới. Những file FanWorkOrders.gs, FanLots.gs, WorkOrderRules.gs giữ phiên bản đã cài. Nếu chưa cài 1.11.5, hoàn tất [hướng dẫn trước](DEPLOY-1.11.5-SHARED-FAN-FORMS.md), dùng Code/Legacy mới nhất và bổ sung EntrySuggestions bên dưới.

| File | Cách thực hiện |
|---|---|
| [Code.gs](https://github.com/taqhung95-cloud/sungrow-service/blob/main/version%20final/Code.gs) | Mở Raw/Copy, thay toàn bộ nội dung file hiện có. |
| [LegacyDashboardApi.gs](https://github.com/taqhung95-cloud/sungrow-service/blob/main/version%20final/LegacyDashboardApi.gs) | Thay toàn bộ, gồm wrapper đầu/cuối. Không nối vào code cũ. |
| [EntrySuggestions.gs](https://github.com/taqhung95-cloud/sungrow-service/blob/main/version%20final/EntrySuggestions.gs) | + → Script → đặt tên EntrySuggestions → dán toàn bộ. |

1. Save tất cả. Chạy **kiemTraFanBieuMauChung**. Cần version `1.11.6-fan-ui-catalog`, sharedFormsAvailable/enabled/audit.ok đều true, pending/errors đều rỗng.
2. Chạy **kiemTraGoiYNhapLieu** bằng tài khoản quản lý project. Log `ENTRY_SUGGESTIONS_CHECK` có issueNames/partNumbers lớn hơn 0 và writtenToDatabase:false. Số lượng danh mục có thể thay đổi theo dữ liệu thực.
3. Deploy → Manage deployments → Web App hiện tại → Edit → **New version** → Deploy. Giữ URL/Execute as/Who has access đang hoạt động.
4. Portal → Ctrl+F5 → đăng nhập lại. `SungrowTransport.info()` cần ready và version `1.11.6-fan-ui-catalog`. Giao diện mới đã phát hành qua Pages; gợi ý PN dùng chung và cách nhóm lỗi cần backend mới.

Không migration, không chạy gom lô, không sửa tab lịch sử hoặc tạo nghiệp vụ giả để kiểm tra. Hàm kiểm tra chỉ đọc nghiệp vụ/cache; audit Fan có thể cập nhật metadata Script Properties như trước.

## Đáp ứng 15 yêu cầu

| Mục | Hành vi mới |
|---|---|
| 1 | Tóm tắt hồ sơ là bảng S/N inverter, số quạt lỗi, bảo hành, trạng thái, đã trả, còn lại. Dòng thấp, header cố định, vùng cuộn giới hạn. |
| 2 | Cập nhật công việc dùng cùng bảng; nội dung/header canh giữa, cột Chọn 52px. Nhãn Số Fan xử lý đổi thành Hoàn tất thêm khi chọn Hoàn tất kỹ thuật. Chỉ nhập số hoàn tất thêm trong lần lưu này. |
| 3 | Bỏ đoạn ghi chú riêng bên trên các dòng linh kiện. Quy tắc giữ chứng từ đã lưu vẫn được kiểm soát, hướng dẫn liên kết nằm trong tooltip của nút Liên kết. |
| 4 | Bảo hành dùng cùng kích thước/căn cột/vùng cuộn, chọn các inverter áp dụng kết luận ở biểu mẫu chuẩn bên dưới. |
| 5 | Giao trả dùng cùng bảng, cột Giao lần này. Chỉ inverter có Fan đã hoàn tất nhưng chưa trả mới chọn được. Nhập số thực giao, một lần lưu cho nhiều S/N; chỉ đóng hồ sơ khi trả hết. |
| 6 | Luân chuyển toàn bộ Fan còn trong hồ sơ sang một center, không chọn/chia inverter. |
| 7 | Hai ô số inverter/tổng Fan tự tính có nền xám, không nhập tay. Chưa có dòng ghi Chưa thêm inverter, thay 0 S/N. |
| 8 | Dán Excel có hướng dẫn 3 bước, ví dụ 2–3 cột, hỗ trợ bỏ hàng tiêu đề. S/N lặp cộng số Fan, không loại bỏ Fan. |
| 9 | Giảm padding/margin dưới danh sách và trước Thông tin khách hàng. |
| 10 | Giữ đúng đơn vị Thiết bị/Hồ sơ; nhóm lô không có model hiển thị Fan theo lô thay Fan chưa có model. Tooltip giải thích Fan thường1/lô1. Không đổi trọng số hoặc nhân số Fan. |
| 11 | Lớp trắng và spinner phủ toàn bộ panel danh sách đang tải, footer chưa cho tương tác. |
| 12 | Tên lỗi có danh sách gợi ý được khởi tạo từ Issue 1–4 của 2024/2025/2026 đã đọc trực tiếp; bổ sung từ Lỗi thiết bị. Chuẩn hóa cách viết tương đương ở gợi ý và nhóm Lỗi phổ biến. Nhóm Lỗi quạt và quy tắc nhiệt độ đi kèm được giữ. |
| 13 | PN gợi ý từ ledger Linh kiện sử dụng, chọn PN tự điền tên nếu tên đang trống. Lưu thành công bổ sung ngay cho biểu mẫu tiếp theo; phiên khác lấy theo revision khi tải danh mục. Không nhập lại tiêu hao cũ. |
| 14 | Menu con Quản lý/Nhập liệu mở khi hover, tự ẩn sau khi rời cả nút và menu; vẫn hỗ trợ click, bàn phím, Escape và menu trên màn hình nhỏ. |
| 15 | Header Báo cáo giữ đồng bộ/thông báo ở bên phải khi bộ lọc dashboard ẩn. |

## Dán Excel

Trong Excel chọn các dòng có cột **S/N inverter**, **Số Fan**, có thể thêm **Ghi chú**. Bấm Copy. Trong portal bấm Dán từ Excel, Ctrl+V vào vùng văn bản, bấm Thêm danh sách. Ví dụ hai dòng SN-A / 2 và SN-B / 1 sẽ tạo danh sách hai inverter, tổng ba Fan, một hồ sơ. Hệ thống nhận ký tự Tab từ Excel; không gõ dấu | thay Tab. Kiểm tra bảng trước khi tạo hồ sơ.

## Đối chiếu dữ liệu đã đọc ngày 18/10/2026

Nguồn: [Database Production](https://docs.google.com/spreadsheets/d/1EoYBTSAPPOne1VCUMTLQ7W_1jjDOQnQloDWdZyXM5xI/edit), Hồ sơ thiết bị A:O và AP:AS; dùng giá trị ngày thô để tránh nhầm dd/MM và MM/dd.

Trong kỳ 01–18/10/2026, tất cả center: 16 hồ sơ/thiết bị đang có hiệu lực tiếp nhận trong kỳ; Fan gồm **4 nhập thường + 2 lô = 6 Thiết bị/Hồ sơ**. Ba hồ sơ thường model Fan, một hồ sơ thường model SG125CX-P2-V11, hai lô không có model chung. Hai lô có **9 và 3 Fan**, S/N lần lượt 8 và 2. Các hàng nguồn đã nhập lô bị lưu mềm/Đã hủy nên không cộng lại. Số 6 trong ảnh không phải 6 quạt vật lý và không phải thiếu hai lô. Không dùng số lượng 3/5/2 của Fan nhập thường làm trọng số KPI.

Đọc I2:L1000 của ba tab lịch sử: 44 cách viết khác nhau sau trim, tạo 33 tên gợi ý chuẩn. Không gộp những lỗi khác nghĩa (External/Internal Fan, SPD AC/DC, IGBT/IGBT nhỏ). Ledger tại thời điểm đọc có 181 PN sau loại trống/gộp hoa thường. Đây là đối chiếu phạm vi tiếp nhận Fan trong ảnh và danh mục, không khẳng định toàn bộ KPI/SLA lịch sử đã được kiểm toán lại.

## Kiểm tra và hiệu năng

Validator chạy API ghi thật trong fixture qua readers hiện tại: hoàn tất/trả từng phần, KPI Fan thường1/lô1, linh kiện theo PN/ngày/center, quyền/CAS/receipt/retry/readback. Test mới đối chiếu alias không đếm lỗi hai lần trên cùng thiết bị, cache danh mục theo revision, PN mới xuất hiện sau revision và xác thực trước cache. Browser Edge chạy biểu mẫu thật: một bảng parts/một nút lưu, cột chọn nhỏ/canh giữa/vùng cuộn, ô xám, dán Excel, gợi ý PN/tên, menu hover, header Báo cáo, loading phủ panel và mobile.

Ảnh giao trả là ảnh chụp HTML/CSS/JS hiện hành trên Edge với dữ liệu minh họa trong môi trường kiểm thử; không tạo lần trả hoặc linh kiện giả vào production. Không phải hình vẽ lại bằng công cụ tạo ảnh.

Danh mục chỉ tải một lần khi mở form, cache server theo revision. Không tải lại khi chọn mỗi S/N hoặc gõ từng ký tự, không quét tab lịch sử ở API danh sách/dashboard. Các nguồn, tab/cột/ID, nhật ký Fan và ledger linh kiện hiện hành giữ nguyên.
