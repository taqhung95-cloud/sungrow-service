# Thiết lập đồng bộ Google Sheets

Nguồn đã xác minh: [Record Warranty & Extreme Error](https://docs.google.com/spreadsheets/d/16lh3d4nDmmnGx6vBdKTrdWCLHFYMhf-g3cZjuupSv0s/edit), gồm các tab `2024`, `2025`, `2026`. Dashboard đọc tab theo năm của kỳ báo cáo.

## Thành phần

- `apps-script/Code.gs`: API đọc Sheet, chuẩn hóa KPI, xác thực Google ID token và phân quyền.
- `apps-script/appsscript.json`: manifest/scopes tối thiểu.
- `docs/index.html`: dashboard dành cho GitHub Pages.
- `docs/live-data.js`: đăng nhập Google, gọi API và render dữ liệu live.
- `docs/config.example.js`: mẫu cấu hình frontend; sao chép thành `docs/config.js` khi có URL triển khai và OAuth Client ID.

## Script Properties

| Key | Giá trị |
|---|---|
| `SOURCE_SPREADSHEET_ID` | `16lh3d4nDmmnGx6vBdKTrdWCLHFYMhf-g3cZjuupSv0s` |
| `GOOGLE_WEB_CLIENT_ID` | OAuth 2.0 Web Client ID của dashboard |
| `USERS_JSON` | Danh sách user, role và center |
| `CENTERS_JSON` | Tùy chọn; bỏ trống để dùng bốn center mặc định |

Ví dụ `USERS_JSON`:

```json
[
  {"email":"service.manager@example.com","role":"service_manager","centers":[],"active":true},
  {"email":"dat.user@example.com","role":"center_manager","centers":["dat"],"active":true}
]
```

Sau lần đăng nhập đầu tiên, nên bổ sung `sub` của Google Account cho từng user và dùng nó làm định danh ổn định.

## Triển khai

1. Tạo Apps Script project, chép `Code.gs` và `appsscript.json`.
2. Thêm Script Properties ở trên.
3. Deploy Web app, execute as project owner. Endpoint có thể nhận request từ Internet nhưng API từ chối mọi request thiếu token hoặc sai quyền.
4. Tạo OAuth Web Client ID và thêm origin GitHub Pages/custom domain vào Authorized JavaScript origins.
5. Chép `docs/config.example.js` thành `docs/config.js`, điền Apps Script `/exec` URL và Client ID.
6. Publish thư mục `docs` bằng GitHub Pages.

## Quy tắc dữ liệu hiện tại

- `WSHCM` ánh xạ thành `Sungrow Service Center`.
- `XB`, `XB Solar`, `XBSOLAR` ánh xạ thành `XBSolar Center`.
- `DAT` và `BKE` ánh xạ thành center tương ứng khi xuất hiện trong cột Service Center.
- Hoàn tất trong kỳ dùng `Return date`.
- Linh kiện theo tháng tạm dùng `Check / Repair date` vì nguồn chưa có `UsedDate` riêng.
- Ghi chú nội bộ, Spreadsheet ID và hai cột chưa có tiêu đề không được trả về frontend.

## Vấn đề nguồn cần sửa sau khi dashboard đọc ổn định

- Cột `AD` chưa có tiêu đề nhưng có dữ liệu ở 46 dòng; có vẻ là mã RW/GSP.
- Cột `AE` chưa có tiêu đề và có dữ liệu rải rác.
- Cột `AA` ghi `Qty 3` trùng với cột `Y`; API hiểu `AA` là số lượng của PN thứ tư theo vị trí.
- `No.` bị trùng và không phải khóa ổn định. Cần thêm `TicketID` trước khi website ghi dữ liệu.
- Nhiều dòng đã giao máy nhưng thiếu `Return date`; KPI hoàn tất theo tháng không tính các dòng này.
