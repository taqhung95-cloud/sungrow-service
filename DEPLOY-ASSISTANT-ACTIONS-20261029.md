# Trợ lý đọc dữ liệu thực tế và giảm lượt gọi AI — 29/10/2026

## Cập nhật 3 file trong Apps Script chính

1. Thay **QuickAssistant.gs** bằng bản 1.3.0.
2. Thay **QuickAssistantKnowledge.gs** bằng bản ngày 29/10.
3. Thêm file script **QuickAssistantActions** và dán **QuickAssistantActions.gs**. Nếu đã có thì thay nội dung.
4. Save → Deploy → Manage deployments → Web App hiện tại → bút chì → New version → Deploy. Giữ URL.
5. Website: Ctrl+F5 → hội thoại mới.

Không nhập lại key; giữ Code.gs, Setup.gs, LegacyDashboardApi.gs và các module nghiệp vụ hiện có. Bản này chỉ cập nhật backend, không cần frontend mới. Nếu một API/module nghiệp vụ chưa có trong deployment, trợ lý báo rõ thay vì giả lập kết quả.

## Thay đổi cách trả lời

Câu hỏi cách dùng/ý nghĩa/quy tắc dùng kho hướng dẫn. Câu hỏi dữ liệu chọn một trong các công cụ đọc được cho phép. Gemini chỉ chọn công cụ và tham số từ câu hỏi đã che mã; backend xác thực, kiểm tra tham số rồi gọi API và dựng câu trả lời nội bộ. Không gửi kết quả công cụ trở lại Gemini.

| Nhóm | API thực tế | Giới hạn |
|---|---|---|
| Tra/lọc hồ sơ | listCases | Theo quyền; 5 kết quả hiển thị; không có lọc ngày tạo |
| Chi tiết, lịch sử công việc, khoảng dừng, quyền sửa, số Fan | getCaseDetail | Phải xác định duy nhất một hồ sơ; không coi SN là khóa |
| Bảo hành, Model theo S/N | lookupWarranty | Cùng API nguồn của màn hình tiếp nhận; không đồng nghĩa duyệt bảo hành hồ sơ |
| Nhật ký Fan | getFanLotHistory | Giữ kiểm tra quyền riêng của API, hiển thị tối đa15 sự kiện |
| Thông báo | listNotifications | Không đánh dấu đã đọc, không duyệt thay người dùng |
| Danh mục lỗi/linh kiện | getEntrySuggestions | Quyền updateWorkOrder của API; tối đa8 mục mỗi loại |
| KPI center theo kỳ | readReportPage | Chỉ quản lý có quyền; cần kỳ rõ, trả tối đa50 dòng center |

Các thao tác ghi dữ liệu (tạo/lưu/duyệt/hủy/luân chuyển/giao trả), xuất file đầy đủ, tìm danh bạ khách và các thao tác bảo trì vẫn được hướng dẫn về màn hình tương ứng; không tuyên bố trợ lý đã thực hiện. Đây là danh sách công cụ đọc được nối, không có quyền gọi mọi hàm tùy ý. Không hứa hỗ trợ mọi câu hỏi nếu API hiện tại chưa có dữ liệu/chức năng tương ứng.

Tra bảo hành theo SN có phạm vi của API tra bảo hành hiện hữu (tài khoản đăng nhập); quyền xem hồ sơ sửa chữa vẫn theo center. Không tự thêm quyền truy cập hồ sơ ngoài center từ kết quả bảo hành.

## Tốc độ và trạng thái

- Bỏ lượt Gemini phân loại riêng: tối đa một lượt Gemini cho câu hỏi tự nhiên, sau đó công cụ đọc nếu cần.
- Lời chào/giới thiệu/cảm ơn và tra bảo hành có SN rõ có thể trả nội bộ, không gọi Gemini. Tra mã hồ sơ trực tiếp vẫn không gọi Gemini.
- Câu hỏi có chủ đề rõ chỉ gửi tài liệu liên quan cộng quy tắc nền. Chủ đề chưa rõ vẫn giữ toàn bộ thư viện trong quyền để tránh chọn sai.
- Phản hồi dữ liệu công cụ có nhãn Tra cứu hệ thống; giải thích do AI có nhãn Gemini. Lời chào nội bộ không phải lỗi kết nối AI.
- Kết quả thêm elapsedMs để đo toàn bộ xử lý backend. Chưa đo được độ trễ thực tế trên deployment người dùng; không cam kết số giây. Apps Script, nguồn dữ liệu và Gemini vẫn có thể chậm.

## Kiểm thử

Full validate; kiểm thử zero-call lời chào/bảo hành, one-call câu hỏi, chủ đề rõ/mơ hồ, câu vừa chào vừa hỏi, giữ xác thực/phân quyền, nguồn không có module, query bịa, thiếu kỳ, ngăn action ghi, tất cả nhóm API và không gửi kết quả thật sang Gemini. API/provider dùng fixture trong kiểm thử; người dùng cần xác nhận sau deploy bằng dữ liệu thật.
