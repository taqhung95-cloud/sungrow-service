# Cấu hình trợ lý khi Script Properties có hơn 50 mục

Ảnh người dùng ngày 28/10/2026 cho thấy Apps Script chỉ hiển thị 50 property đầu và khóa chỉnh sửa trên giao diện. Không cần xóa bớt property để cấu hình Gemini. Các marker `RDR_DONE_*`, bản lưu `SCRIPT_MAINTENANCE_CCS_SRS_ARCHIVE`, session và cấu hình upload phải được giữ.

Bản bổ sung `1.11.24.1-assistant-setup` tạo trang cấu hình riêng dành cho chủ backend. Không đổi frontend và không tự triển khai Apps Script.

## Cập nhật hai file

1. Trong project Apps Script chính, thay **Code.gs** bằng file Code.gs của bộ `1.11.24.1` này.
2. Thêm Script mới tên **QuickAssistantSetup**, dán nội dung **QuickAssistantSetup.gs**.

Giữ **QuickAssistant.gs** đã thêm ở bản 1.11.24 và các module khác. Trang cấu hình sử dụng kiểm tra chủ backend đã có trong **AttachmentStorage.gs** của project chính, không chép file của worker upload vào đây.

Nếu Code.gs trên Apps Script có các thay đổi riêng mới hơn, thay vì ghi đè cả file, thêm duy nhất dòng sau ở đầu hàm `doGet(e)` hiện có:

```javascript
if(e&&e.parameter&&e.parameter.assistant_setup==='1')return qaSetupPage_();
```

Không tạo thêm hàm doGet hoặc doPost. Full Code.gs trong bộ này dựa trên main của bản trợ lý 1.11.24; lưu ý các bản 1.11.22/1.11.23 ở nhánh riêng như hướng dẫn trước.

## Deploy và mở trang thiết lập

3. Save → **Deploy → Manage deployments → Web App chính → Edit → New version → Deploy**. Giữ nguyên URL và tài khoản thực thi cũ.
4. Sao chép **Web App URL** của deployment đó. Mở URL trong tab mới và thêm `?assistant_setup=1` ở cuối. Ví dụ:

```text
https://script.google.com/macros/s/DEPLOYMENT_ID/exec?assistant_setup=1
```

Đây là URL Apps Script, không phải địa chỉ website dashboard. Không đặt API key trong URL.

5. Đăng nhập đúng tài khoản chủ backend hiện tại, là tài khoản đang thực thi Web App cũ. Nếu đang mở nhiều tài khoản Google, chọn đúng tài khoản khi mở URL.
6. Trong trang **Cấu hình trợ lý Sungrow**:
   - Dán Gemini API key vào ô mật khẩu.
   - Giữ model `gemini-3.5-flash-lite` và hạn mức mặc định 100 lượt/ngày, 30 lượt/giờ/tài khoản nếu chưa cần điều chỉnh.
   - Xác nhận key thuộc **project Gemini Free Tier không liên kết Cloud Billing**.
   - Chọn **Bật Gemini để hiểu câu hỏi tự nhiên**.
   - Bấm **Lưu cấu hình trợ lý**.

Trang tự tạo/cập nhật đúng các property trợ lý với `setProperties(updates,false)`, giữ toàn bộ property khác. Key hiện có không được hiển thị; để trống ô key sẽ giữ key cũ. Nhập key mới là chủ động thay key trợ lý. Không reset quota ngày hoặc thay thuộc tính upload/database/session.

Phiên cấu hình hết hạn sau 10 phút và chỉ lưu thành công một lần. Tải lại trang để mở phiên mới khi cần. Key được xóa khỏi ô nhập sau phản hồi; không đưa vào mã nguồn, URL, HTML trả về hay thông báo log của ứng dụng.

7. Quay lại website, nhấn **Ctrl+F5** rồi hỏi “KPI SLA tính thế nào?”. Lưu property có hiệu lực ngay, không cần deploy lại chỉ vì đổi key hoặc hạn mức.

Nếu chưa cài bộ trợ lý 1.11.24, cần thêm QuickAssistant.gs trước theo hướng dẫn cũ. Nếu chưa có key, để tắt Gemini và lưu; tra cứu/hướng dẫn nội bộ vẫn hoạt động.

## Lỗi thường gặp

- **Chỉ chủ backend...**: chọn lại tài khoản Google chủ backend, không đổi account thực thi deployment chỉ để vượt kiểm tra này.
- **Trang vẫn hiện giao diện nhập liệu cũ**: kiểm tra đã thêm nhánh `assistant_setup` vào doGet và đã deploy New version trên đúng URL chưa.
- **Chưa lưu được**: kiểm tra key, số nguyên trong hạn mức, xác nhận Free Tier. Tải lại nếu trang đã mở quá 10 phút. Nếu Apps Script báo lỗi dung lượng Properties trong execution log, đó là lỗi khác với giới hạn hiển thị 50 mục; giữ dữ liệu và xử lý theo thông báo cụ thể, không xóa hàng loạt.

Kiểm thử local đã xác nhận giữ hơn 65 property cũ, khóa chủ backend, nonce/replay, không xuất key cũ vào HTML/phản hồi và không ghi khi dữ liệu nhập sai. Chưa xác nhận người dùng đã deploy hoặc đã lưu key thật.
