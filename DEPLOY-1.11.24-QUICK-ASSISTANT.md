# Cập nhật trợ lý hỏi nhanh — 28/10/2026

## Phạm vi và trạng thái

Frontend: portal GitHub Pages và trang `entry.html` mở riêng. Mọi tài khoản đăng nhập được cấp quyền đều thấy robot; iframe nhập liệu dùng robot của portal, không hiện hai robot. Giữ font Sungrow Montserrat, icon nhỏ có neon cam, không có chữ dưới icon hoặc hàng thẻ gợi ý. Tài khoản vẫn chỉ tra cứu được hồ sơ trong quyền hiện có.

Backend mới `1.11.24-quick-assistant` gồm **hai file cần cập nhật thủ công** bên dưới. Việc push GitHub không tự triển khai Apps Script. Không đổi URL, OAuth, database, Cloud, worker upload, schema hoặc chạy migration.

## 1. Thay Code.gs trong project Apps Script chính

Mở đúng project backend chính đang phục vụ portal, không phải project worker đính kèm.

Thay toàn bộ nội dung file **Code.gs** bằng file `version final/Code.gs` trong bộ cập nhật này. Bản này bổ sung RPC `quickAssistantChat` và khai báo version `1.11.24-quick-assistant`. Giữ nguyên các file `.gs` khác. Đây là bản tiếp nối GitHub main hiện tại (`1.11.21-sla-dropdown`); có giữ sửa strict dropdown SLA đã nằm trên main. Không bao gồm bản Fan đóng `1.11.22` hoặc gộp nhãn dashboard `1.11.23` ở nhánh riêng chưa có xác nhận triển khai. Nếu bạn đã tự áp dụng các bản riêng đó vào Code.gs sau mốc này, cần ghép phần dispatcher trợ lý vào bản đang dùng để tránh ghi đè thay đổi riêng.

## 2. Thêm QuickAssistant.gs

Trong cùng project: **+ → Script**, đặt tên **QuickAssistant**, dán toàn bộ nội dung `version final/QuickAssistant.gs`.

Không thêm `doGet`/`doPost` mới. Không thay `Index.html` hoặc `LegacyDashboardApi.gs` cho bản trợ lý này. Portal và trang nhập liệu do GitHub phục vụ.

Lưu hai file. Khi chưa cấu hình AI, nhập SN/mã hồ sơ vẫn tra cứu được và các câu hỏi phổ biến dùng hướng dẫn nội bộ. Đây là nhận diện theo từ khóa, hạn chế hơn AI hiểu ngôn ngữ tự nhiên.

## 3. Tạo Gemini API key ở Free Tier

1. Vào [Google AI Studio](https://aistudio.google.com/api-keys), tạo API key trong **project riêng cho trợ lý**, kiểm tra project đang ở **Free Tier**.
2. Giữ project này **không liên kết Cloud Billing**, không bật paid tier và không đổi billing của project backend/upload hiện tại. API key của project trả phí có thể bị tính phí dù dùng cùng model; phần mềm không thể tự xác minh tier từ chuỗi API key.
3. Xem hạn mức thực tế của project tại AI Studio. Free Tier có giới hạn theo model, khu vực và project; không phải miễn phí vô hạn.
4. Không gửi API key trong chat, không đặt vào GitHub, `config.js` hoặc mã frontend.

Nếu Apps Script báo **hơn 50 Properties và read-only**, dùng [trang cấu hình riêng ở bản 1.11.24.1](DEPLOY-1.11.24.1-ASSISTANT-SETUP.md). Không xóa các property cũ để mở khóa giao diện.

Nếu giao diện còn cho chỉnh sửa, trong Apps Script chính → **Project Settings → Script Properties**, thêm các mục dưới đây. Bảng cũng là tài liệu tham chiếu cho trang cấu hình riêng:

| Property | Value |
|---|---|
| `ASSISTANT_GEMINI_KEY` | API key vừa tạo, chỉ lưu ở đây |
| `ASSISTANT_GEMINI_MODEL` | `gemini-3.5-flash-lite` |
| `ASSISTANT_FREE_TIER_CONFIRMED` | `true` sau khi đã kiểm tra project Free Tier, không billing |
| `ASSISTANT_AI_ENABLED` | `true` để bật Gemini |
| `ASSISTANT_AI_DAILY_LIMIT` | `100` lượt gọi AI/ngày cho toàn hệ thống |
| `ASSISTANT_AI_USER_HOURLY_LIMIT` | `30` lượt gọi AI/giờ/tài khoản |

Một câu hỏi tự nhiên dùng tối đa hai lượt: nhận diện và diễn giải. Tra trực tiếp SN/mã hồ sơ không gọi Gemini. Hạn mức tại ứng dụng chỉ giới hạn lượt gọi, không phải lời bảo đảm về tier hay chi phí ở Google. Giới hạn theo tài khoản dùng cache; giới hạn ngày toàn hệ thống được lưu trong Script Properties dưới khóa `ASSISTANT_AI_DAILY_USAGE`, chỉ chứa ngày/số lượt.

Hết hạn mức, lỗi provider hoặc chưa bật Gemini: chuyển về tra cứu/hướng dẫn nội bộ, không tự chuyển model hay nhà cung cấp trả phí. Có thể tắt AI ngay bằng `ASSISTANT_AI_ENABLED=false`; tắt cả trợ lý phía máy chủ bằng `ASSISTANT_ENABLED=false`.

## 4. Dữ liệu được gửi sang Google

Theo lựa chọn của người dùng: **chỉ câu hỏi đã che mã và hướng dẫn chung**. Backend tạo payload mới từ danh sách trường cho phép, không serialize hồ sơ.

- Che mã có cả chữ/số (SN, mã hồ sơ, GSP/MA/model), số điện thoại/số dài, email, URL và các dạng khóa truy cập phổ biến trong câu hỏi trước khi gọi Gemini.
- Lịch sử gửi AI chỉ gồm tối đa bốn câu hỏi trước đã che mã; không gửi câu trả lời chứa dữ liệu hồ sơ.
- Không gửi các dòng Google Sheets, thông tin hồ sơ truy xuất, trạng thái, lỗi thực tế, mốc ngày, khoảng SLA, thông tin khách, ghi chú, token đăng nhập hoặc Drive link từ database sang Google.
- Kết quả tra cứu được backend đọc qua API phân quyền hiện có, rồi ghép vào trả lời sau. Gemini chỉ diễn giải quy tắc; không chẩn đoán nguyên nhân riêng hoặc chốt số KPI hồ sơ từ dữ liệu mà nó không nhận.
- Không nhập nội dung cá nhân/bí mật tự do vào câu hỏi. Bộ che dùng các mẫu xác định, không thể bảo đảm nhận ra mọi tên riêng, địa chỉ hoặc bí mật trong văn bản tự do. Câu chứa nhãn liên hệ/khóa nhạy cảm được giữ ở hướng dẫn nội bộ.

Google nêu Free Tier có thể dùng prompt/response để cải thiện sản phẩm. Nguồn: [điều khoản Gemini](https://ai.google.dev/gemini-api/terms), [bảng giá](https://ai.google.dev/gemini-api/docs/pricing), [hạn mức](https://ai.google.dev/gemini-api/docs/rate-limits). Model đã đối chiếu có Free Tier tại ngày 28/10/2026; Google có thể thay đổi danh sách/hạn mức.

## 5. Deploy Apps Script

**Deploy → Manage deployments → deployment Web App chính → Edit → New version → Deploy.** Giữ nguyên URL và quyền thực thi hiện tại. Không chạy function dọn dữ liệu hoặc migration.

Sau khi deploy, mở portal và nhấn **Ctrl+F5**. Nếu thấy “Trợ lý chưa được kích hoạt trên máy chủ”, kiểm tra đã thêm QuickAssistant.gs, đã thay Code.gs và đã chọn New version trên đúng deployment chưa.

## 6. Thử sử dụng

1. Đăng nhập từng vai trò: quản lý toàn bộ center, quản lý center, nhân viên. Robot xuất hiện ở cả ba.
2. Nhập một SN/mã hồ sơ trong quyền. Cùng SN có nhiều lần tiếp nhận phải hiện từng mã, không tự chọn một hồ sơ.
3. Bấm **Mở hồ sơ** và **Lịch sử xử lý**. Thử khi đang có biểu mẫu chưa lưu để chắc chắn không tự bỏ dữ liệu.
4. Hỏi tự nhiên: “KPI SLA tính thế nào?”, “Vì sao bấm lưu không được?”, “Xem máy chưa giao ở DAT ở đâu?”. Gemini giải thích quy tắc hoặc hỏi bổ sung khi thiếu lỗi cụ thể.
5. Tắt AI hoặc để hạn mức bằng `0`: tra cứu nội bộ vẫn hoạt động, câu hỏi chuyển về hướng dẫn nội bộ.
6. Đăng xuất rồi đăng nhập tài khoản khác: chat cũ không được xuất hiện trên tài khoản mới.

Đã có kiểm thử local cho RPC, phân quyền qua các hàm đọc hiện có, che mã, payload chỉ gồm câu hỏi/hướng dẫn, giới hạn, fallback, replay và UI. Chưa có kiểm tra gọi Gemini thật bằng key của bạn hoặc xác nhận deploy Apps Script; chỉ bạn thực hiện hai bước đó. Không ghi/sửa hồ sơ production trong quá trình kiểm thử.
