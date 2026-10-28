# Trợ lý kéo thả, nền kính và trả lời có cấu trúc — 28/10/2026

## Giao diện GitHub

Frontend `quick-assistant.js/css?v=2`, `live-data.js?v=168`, iframe `entry.html?v=149`:

- Kéo robot bằng chuột hoặc chạm để đặt ở bất kỳ vị trí trong màn hình. Kéo không bị nhận nhầm là click. Tọa độ tương đối được lưu trên trình duyệt; không lưu câu hỏi/chat/token vào localStorage.
- Khi focus robot, dùng phím mũi tên để di chuyển; giữ Shift để tăng bước.
- Ô chat mở/thu từ tâm icon với hiệu ứng co giãn, tự chọn hướng và kích thước để nằm trong màn hình, thích ứng khi resize/bàn phím di động.
- Nền kính trong suốt với blur; chữ giữ độ tương phản. Tôn trọng chế độ giảm chuyển động/giảm trong suốt của thiết bị.
- Trả lời có tiêu đề ngắn, chữ đậm, danh sách và bước đánh số. Nội dung được dựng bằng text nodes, không chạy HTML từ AI. Khi có câu trả lời mới, cuộn đến đầu câu trả lời để đọc kết luận trước.

## Hai file Apps Script cần thay

1. **QuickAssistant.gs** (`QUICK_ASSISTANT_VERSION_ = 1.1.0`): tra cứu bỏ qua cache danh sách cũ và yêu cầu đọc lại chi tiết, dùng hướng dẫn có cấu trúc, lấy ngưỡng/danh mục/ví dụ từ module quy tắc đang nạp. Cache hội thoại/receipt phân biệt version trợ lý và fingerprint quy tắc.
2. **LegacyDashboardApi.gs**: thêm getter nội bộ `assistantRules()`, trả ngưỡng SLA từ chính `SLA_DAYS`, danh sách lý do sau sẵn sàng dùng chung với hàm tính và ví dụ được tính bằng `slaDays_`. Không thay công thức KPI, trọng số hoặc dữ liệu nghiệp vụ.

Giữ **Code.gs**, **QuickAssistantSetup.gs**, các Script Properties và Gemini key đã cấu hình. Không chạy migration hoặc function ghi dữ liệu. Nếu chưa cài bản trợ lý/setup trước, vẫn cần hoàn tất các bước trước đó.

Sau khi thay hai file trong project Apps Script chính: **Save → Deploy → Manage deployments → Web App hiện tại → Edit → New version → Deploy**. Giữ URL/tài khoản thực thi. Sau đó Ctrl+F5 website.

Nếu LegacyDashboardApi.gs của bạn có thay đổi riêng mới hơn main, cần ghép getter `assistantRules` và danh sách lý do dùng chung vào bản đó, không ghi đè bản riêng. Bộ cập nhật này dựa trên main hiện hành, chưa bao gồm bản nhãn lỗi 1.11.23 ở nhánh riêng trước đó.

## Nguồn câu trả lời và giới hạn

- Dữ liệu hồ sơ: `listCases(...,refresh:true)` và `getCaseDetail(...,{refresh:true})`, tiếp tục giữ quyền actor/center. Nếu index còn stale, trả thông báo rõ và mở hồ sơ để đối chiếu.
- Quy tắc SLA: getter của module dashboard thực sự đang nạp; danh mục và trạng thái từ `SungrowWorkOrderRules`. Không lấy phiên bản chuẩn bị ở nhánh GitHub làm bằng chứng đã chạy. Nếu thiếu getter mới, không dùng AI để đoán ngưỡng SLA.
- Câu hỏi tự nhiên: Gemini chỉ nhận câu hỏi đã che mã và hướng dẫn chung theo phạm vi đã được người dùng chấp thuận; không gửi dữ liệu hồ sơ sang Google.
- Không suy KPI toàn hệ thống từ vài kết quả tìm kiếm. Giải thích công thức/ví dụ phải tách với kết quả hồ sơ; thiếu dữ liệu thì hỏi bổ sung.
- Những quy tắc nghiệp vụ mới ngoài hợp đồng runtime này cần được cập nhật cùng hướng dẫn và kiểm thử trong lần thay đổi nghiệp vụ đó; không có cơ chế tự đọc hội thoại hoặc mã nguồn GitHub để coi là quy tắc production.

Kiểm thử gồm toàn bộ validate.mjs, UI các vai trò, kéo ở góc/giữa, lưu/khôi phục tọa độ, bàn phím, viewport hẹp, mở/đóng nhanh, reduced-motion, an toàn HTML, định dạng câu trả lời, đọc fresh và chứng minh hướng dẫn đổi theo giá trị quy tắc runtime.
