# Nguồn hướng dẫn website cho trợ lý — 28/10/2026

## Cập nhật Apps Script

1. Thay toàn bộ **QuickAssistant.gs** bằng bản 1.2.0 trong bộ cập nhật.
2. Tạo file script mới tên **QuickAssistantKnowledge**, dán toàn bộ **QuickAssistantKnowledge.gs**. Nếu đã có file đó thì thay nội dung.
3. Lưu. Deploy → Manage deployments → chọn Web App hiện tại → bút chì → New version → Deploy. Giữ URL hiện tại.
4. Website: Ctrl+F5, mở hội thoại mới.

Giữ Code.gs, QuickAssistantSetup.gs, LegacyDashboardApi.gs và các module nghiệp vụ hiện có. Không nhập lại key đã lưu. Hướng dẫn SLA runtime tiếp tục cần getter assistantRules đã gửi trong bản LegacyDashboardApi.gs trước. Nếu thiếu, trợ lý không chốt ngưỡng SLA.

## Phạm vi kiến thức

25 nhóm chức năng đối chiếu 39 file nguồn: danh bạ khách hàng; điều hướng; tạo hồ sơ; tìm kiếm/bộ lọc/ngày tạo; ý nghĩa hoàn tất kỹ thuật; khóa ô nhập; ngày/tạm dừng SLA; bảo hành; lỗi/linh kiện; luân chuyển; giao trả; Fan theo lô; đính kèm; nháp; thông báo; sửa/hủy; phân quyền; thẻ KPI; tỷ lệ SLA; đơn vị Fan; kỳ/so sánh; biểu đồ; báo cáo Excel; chất lượng dữ liệu; giao diện.

Mỗi nhóm trong QuickAssistantKnowledge.gs có sourceFiles chỉ tới mã đã đối chiếu. Kiểm thử assistant-knowledge.mjs kiểm tra hash của các nguồn: nếu nguồn đổi phải rà lại hướng dẫn, sau đó cập nhật manifest bằng `node "version final/tests/assistant-knowledge.mjs" --write`. Lệnh này chỉ ghi nhận nguồn đã rà soát, không tự viết lại nội dung hay chứng minh hướng dẫn mới đúng.

Đây là kiến thức chức năng được rà soát từ source hiện hành, không có cơ chế tự đọc tất cả hội thoại/GitHub hay tự chứng minh mọi chi tiết của deployment thực tế. Quy tắc ngày/danh mục và ngưỡng SLA tiếp tục lấy từ module đang nạp. Quy tắc mới cần được cập nhật cùng bộ kiến thức và kiểm thử. Các chi tiết chưa có bằng chứng phải hỏi rõ, không suy đoán.

## Hành vi

- Gemini nhận toàn bộ hướng dẫn chung trong quyền tài khoản và câu hỏi/lịch sử ngắn đã che mã; không nhận dữ liệu hồ sơ.
- Center chỉ nhận hướng dẫn nhập liệu, quyền sửa và tra cứu hồ sơ được phép. Tài liệu KPI/dashboard/báo cáo bị loại ở backend. Quyền quản lý yêu cầu isGlobalManager và capability viewDashboard.
- Phân biệt câu hỏi ý nghĩa, thao tác và lỗi; không hỏi mã hồ sơ/thông báo lỗi khi chỉ hỏi ý nghĩa. Khi AI không hoạt động, chọn chủ đề hướng dẫn liên quan; chưa xác định thì hỏi tên mục/màn hình.
- Ví dụ quan trọng: danh sách nhập liệu chưa có bộ lọc ngày tạo; cột Ngày nhận không phải Ngày tạo. Không bịa nút lọc hoặc số KPI thực tế.
- Phản hồi frontend có nhãn Gemini / Hướng dẫn nội bộ / Tra cứu hệ thống. Đã lưu key không chứng minh Gemini gọi thành công; xem nhãn của từng câu.
- Lịch sử chủ đề chỉ ở cache theo tài khoản/quyền; đổi quyền không dùng lại cache cũ. Mọi hồ sơ vẫn đọc qua API đã phân quyền.

## Kiểm tra sau deploy

Thử hỏi định nghĩa Hoàn tất kỹ thuật; cách lọc hồ sơ mới tạo trong ngày; vì sao ô kết quả bị khóa; nhập tạm dừng SLA; xuất Excel. Account center không được trả hướng dẫn quản lý; quản lý có tài liệu báo cáo/KPI. Không yêu cầu hay gửi key trong chat.

Backend do người dùng tự triển khai. Kiểm thử local/provider giả lập không thay thế kiểm tra Gemini và dữ liệu thật trên deployment.
