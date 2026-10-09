# Trang đăng nhập theo bố cục tham khảo

09/10/2026 — JS94/theme v5: slogan “Clean Power For All” một hàng. Nền ngoài dùng ảnh ESS từ [trang Sungrow](https://www.sungrowpower.com/vt/vi/ess-utility-scale); [ảnh gốc](https://official-oversears-file.sungrowpower.com/page-assets/8356cc88-2f29-414e-8751-1d2d035a7b93.jpg) 2560×1440, 1711082 bytes giữ tại analysis/login-ess-source.jpg. Runtime docs/login-ess-background.jpg JPEG78/354977bytes, không sửa nội dung ảnh, không hotlink. Hero bên trái vẫn dùng login-solar.jpg, khác ảnh nền ngoài. Welcome logo+h1 và entry/popup classic giữ nguyên.

09/10/2026 — JS93/theme v4: slogan English “Powering a sustainable future.” center-top trên ảnh; logo trái và welcome Vietnamese phải trên một hàng (không br/wrap). Entry82 và popup classic không thay đổi.

09/10/2026 — bản JS92/entry82/theme v3: chỉ trang login tổng dùng thiết kế mới; khung860×420 với icon cam, căn trái và bỏ viền bọc nút thừa. Entry và popup giữ giao diện classic trước91ae00a, không dùng ảnh/theme mới. Các mô tả áp dụng cả3 login bên dưới là lịch sử của v1, không còn là phạm vi v3.

09/10/2026: JS91/entry81/theme v2 rút gọn chữ, giữ lời chào/nút Google/loading+error; bỏ eyebrow, nhãn Google gạch chân, ghi chú quyền, slogan phụ và hero footer. Header/footer dùng vạch đứng mảnh thay dấu chấm; email privacy đổi thành QuocHung@sungrow-apac.com. Popup success dùng message, không dùng sg-auth-copy đã bỏ.

Frontend JS90/entry80/login-theme v1. Chỉ GitHub Pages, không cập nhật Apps Script.

- Header wordmark SUNGROW hiện hành; khung trung tâm hai cột với ảnh solar bên trái, đăng nhập Google bên phải; nền cùng ảnh làm mờ, link chính sách bảo mật thật.
- Mobile <=760px: hero gọn trên, form dưới; không thêm server/language selector, tải app, đăng ký, khách hoặc mật khẩu vì hệ thống không có các luồng này.
- Giữ callback Google, slot IDs, token handling, role/center/auth checks và popup postMessage origin guards. Popup thành công cập nhật đúng sg-auth-copy thay vì paragraph đầu tiên sau khi thêm hero.
- Không thay backend, database, KPI hay Drive permissions. CSS scoped sg-auth-layout; trang đã đăng nhập giữ giao diện cũ.
- Dùng cùng theme cho dashboard login, entry standalone login và popup data-entry-login. Backend Apps Script direct Index.html không sửa ở release này.
- Ảnh runtime: docs/login-solar.jpg (162780 bytes), JPEG quality82 từ ảnh generated PNG, không chỉnh nội dung; original generated PNG giữ trong thư mục generated_images. Nền và hero dùng chung một asset, không gọi nguồn ảnh ngoài khi tải trang.
- Test login-layout.mjs thực thi frontend với Google UI stub/API local tại1440×900,1024×768,390×844,360×640; kiểm tra columns/overflow/button/no-password/JS errors. Ảnh preview analysis/login-preview/login-1440.png và login-390.png. validate.mjs đạt. Đây không phải kiểm thử đăng nhập Google production.

## Ảnh minh họa

Tạo bằng built-in image_gen, không dùng CLI. Prompt cuối:

Use case: photorealistic-natural. Asset type: decorative photograph for left panel of Sungrow Service Center login page. Primary request: modern photovoltaic solar panels extending diagonally across the lower half of a vertical composition, clear soft blue sky in the upper half with usable quiet space for white HTML headline overlay. Low viewpoint, crisp realistic dark blue solar cells and silver panel frames, subtle daylight, calm professional clean-energy mood. Composition: portrait, panel intended around 440 by 540 pixels; sky upper 50%, panels lower 50%. Constraints: photograph only, no text, no letters, no logos, no watermarks, no people, no login UI, no borders. Opaque image.
