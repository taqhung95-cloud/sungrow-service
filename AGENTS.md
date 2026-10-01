# Sungrow Service Center - quy tắc làm việc nhanh

Đọc `CURRENT-IMPLEMENTATION.md` trước khi sửa. Tài liệu này là nguồn chuẩn của phiên bản đang chạy; không cần đọc lại toàn bộ các file `DEPLOY-*.md` cũ trừ khi đang điều tra lịch sử.

## Nguồn code hiện hành

- Backend Apps Script: `version final/Code.gs` và `version final/LegacyDashboardApi.gs`.
- Frontend production GitHub Pages: `docs/index.html`, `docs/live-data.js`, `docs/entry.html`, `docs/visual-polish.css`, `docs/config.js`.
- `version final/Index.html` là bản giao diện Apps Script tương ứng, không phải frontend chính mà người dùng đang mở.
- `apps-script/` và các tài liệu deploy cũ là tham khảo lịch sử, không tự động đồng bộ với production.

## Guard bắt buộc

- Không đổi Spreadsheet ID, tên tab, tên cột hoặc xóa/ghi đè tab lịch sử `2024`, `2025`, `2026` nếu chưa có yêu cầu rõ ràng.
- `Hồ sơ thiết bị` và các bảng nghiệp vụ là nguồn chính. `Dữ liệu dashboard` và `Chỉ mục hồ sơ` là projection/index dẫn xuất.
- Mọi mutation phải đồng bộ projection, đồng bộ case index và tăng `PORTAL_DATA_REVISION`.
- Không quét toàn bộ các tab lịch sử trong API danh sách hồ sơ. Dùng `Chỉ mục hồ sơ`, cache theo revision và phân trang server-side.
- Không dùng S/N đơn lẻ làm khóa. Dữ liệu lịch sử ưu tiên provenance `year!row`; một S/N có thể xuất hiện nhiều lần.
- Xóa hồ sơ là soft delete `Đã hủy`, không xóa vật lý.
- “Đang xử lý” là trạng thái nghiệp vụ, không phải trạng thái loading UI.
- Không lưu token, client secret, mật khẩu hoặc dữ liệu nguồn vào Git.

## Kiểm thử tối thiểu

Chạy từ repository root:

```powershell
node "version final/tests/validate.mjs"
git diff --check
```

## Chọn cách triển khai

- Chỉ sửa `docs/*`: push GitHub `main`; không deploy Apps Script. Tăng cache key khi sửa `live-data.js` hoặc `entry.html`.
- Sửa `Code.gs`/`LegacyDashboardApi.gs`: thay đúng các file đó trong Apps Script, Save, tạo **New version** trên deployment Web App hiện tại; không đổi URL.
- Sửa `version final/Index.html`: chỉ cần deploy Apps Script nếu muốn cập nhật giao diện Web App trực tiếp; GitHub portal vẫn dùng `docs/*`.
- Migration lịch sử chỉ chạy khi release yêu cầu. Luôn chạy audit trước repair.

Sau khi hoàn tất một thay đổi có ảnh hưởng quy tắc hoặc deploy, cập nhật `CURRENT-IMPLEMENTATION.md` trong cùng commit.
