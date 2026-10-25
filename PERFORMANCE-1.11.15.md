> **Tài liệu lịch sử theo phiên bản.** Đối chiếu [quy tắc hiện hành](CURRENT-IMPLEMENTATION.md) và PRODUCTION-STATE.md trước khi dùng; không tự ghi đè backend hoặc chạy lại migration/repair từ hướng dẫn cũ.

# Tối ưu lưu và tải lại — 1.11.15

Bản này hợp nhất trên Code.gs 1.11.14-system-case-delete (commit c79676f). Giữ quyền xóa mới, quyền sửa Sungrow, Fan, audit, projection/index/revision và các API hiện hành. Thay toàn bộ Code.gs, Save → New version trên deployment hiện tại → Deploy. Giữ URL. Không cần thay frontend hay chạy migration. Không dùng lại file 1.11.13 trước đó.

## Thay đổi

- Luồng cập nhật kỹ thuật, bảo hành, sửa hồ sơ, giao trả, luân chuyển đọc đúng khóa hồ sơ/công việc thay vì tải toàn bảng.
- Helper đọc chi tiết dùng TextFinder cho tối đa20khóa để tìm trực tiếp trong cột khóa Sheets; escape ký tự regex, khớp nguyên giá trị có trim, phân biệt hoa thường, đọc kết quả theo thứ tự dòng. Tập khóa lớn/khóa trống dùng scan một cột. Không cache giá trị nghiệp vụ qua các lần gọi. API tham khảo: [Google TextFinder](https://developers.google.com/apps-script/reference/spreadsheet/text-finder).
- Gộp các dòng liền nhau trong một lần đọc, không lấy các dòng ngoài phạm vi kết quả.
- Lưu lỗi, linh kiện và SLA bỏ các ô không đổi; nhiều dòng mới được ghi theo lô. Gộp các cụm xóa dòng theo thứ tự giảm dần, không xóa hàng tiêu đề.
- Gộp cập nhật GSP/MA và trạng thái hồ sơ; bỏ lượt quét điền ngày linh kiện khi mọi ngày đã có.
- Dashboard và index của các luồng thường dùng chung nguồn vừa đọc sau flush. Những module gọi sync riêng vẫn tương thích và được hưởng helper mới.
- Header chỉ nhớ trong một lần thao tác ghi, trả bản sao và hủy cache khi thêm cột; không cache quyền hoặc nội dung hồ sơ. Vẫn đọc dữ liệu mới sau ghi.
- Log portal-save-timing có tổngserverMs, projectionMs, indexMs và ok. Tổng bao gồm cả bước đọc nguồn dùng chung; hai sốprojection/index chỉ đo phần đồng bộ riêng. Không log token/khách hàng/payload.

## Kiểm chứng

Validator toàn hệ thống đạt. Test mới chạy actual updateWorkOrder/children/SLA/status trên fixture3.001dòng mỗi bảng, giữ khóa ghi, ID và ô không liên quan. So sánh hai kịch bản với1.11.14, toàn bộ dữ liệu kết quả giống nhau, bao gồm các ngày và linh kiện. Kịch bản20linh kiện mới: lượt ghi27→6. Kịch bản giữ nguyên lỗi/linh kiện/SLA: lượt ghi10→5. Đồng thời kiểm tra projection tương đương, TextFinder literal/trim/case, nhóm dòng, khóa thiếu, log và giải phóng lock khi lỗi.

Đây là mô phỏng chi phíI/O, không phải đo giây production. Nhóm thao tác lưu thường có nhiều truy vấn nhỏ hơn trước; giảm dữ liệu truyền không tự chứng minh độ trễ thấp hơn trên Google. Phần kết nối Apps Script, xác thực phiên, tải danh sách/dashboard lại và module thông báo vẫn phụ thuộc dữ liệu và cache thực tế. Chưa có phép đo trình duyệt/Executions production của bản này.

Các file xác minh: version final/tests/scoped-save-reads.mjs, version final/tests/save-pipeline-performance.mjs và analysis/speed-20261021/benchmark.json. Benchmark mô phỏng phần lưu nghiệp vụ, stub audit và projection/index; projection có test đối chiếu riêng. Không lấy sốô/lượtgọi của fixture làm tốc độ toànwebsite.

Sau triển khai, đo từ bấm Lưu đến báo thành công và đến khi chi tiết mới hiện xong. Xem portal-save-timing trong Apps Script Executions để tách chậm do ghi dữ liệu và do kết nối/tải lại. Không chạy mutation giả trên production để đo.
