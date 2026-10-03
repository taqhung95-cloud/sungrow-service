# Deploy 1.10.4-canonical-sync

## Thứ tự thực hiện

1. Trong Apps Script project đang phục vụ URL production, thay toàn bộ nội dung `Code.gs` bằng `version final/Code.gs`, và `LegacyDashboardApi.gs` bằng `version final/LegacyDashboardApi.gs`. Lưu cả hai file. Không dùng `apps-script/` cũ.
2. Xóa các launcher migration/repair public tạm đã dùng trong Editor trước khi deploy. Không xóa các helper private đang được bộ migration tham chiếu. Không chạy lại nhập XB/BKE/DAT hoặc các repair lịch sử chỉ để cập nhật web.
3. Deploy → Manage deployments → chọn Web App hiện tại → Edit → Version: **New version** → Deploy. Giữ nguyên URL và cấu hình quyền hiện tại.
4. Đăng nhập portal; phản hồi API `getBootstrap` phải có `version: 1.10.4-canonical-sync` (có thể kiểm tra trong Network của trình duyệt). URL `/exec` trực tiếp có thể trả giao diện HTML, không phải JSON version. Save trong Editor hoặc chạy hàm Editor không thay phiên bản deployment.
5. Reload GitHub portal. Nếu trình duyệt giữ bản cũ, Ctrl+Shift+R. Frontend mới phải tải `live-data.js?v=72`.
6. Kiểm tra quản lý toàn hệ thống: Danh sách thiết bị không bị lọc theo năm; đổi tháng/năm chỉ đổi KPI. Đối chiếu cùng scope, bỏ lọc tìm kiếm/trạng thái/center, không so số row thô có case hủy với case đang hoạt động.
7. Kiểm tra riêng mỗi role/center và một lượt nhận đã migration. Case có nhiều center vẫn giữ nguyên ID; không ghép theo S/N đơn lẻ. Quyền dashboard theo center xử lý gần nhất, quyền danh sách hồ sơ theo các center liên quan; hai tổng theo center không nhất thiết giống nhau.
8. Tạo/cập nhật/xóa chỉ trên hồ sơ kiểm thử được cho phép, rồi kiểm tra lại danh sách sau khi revision đổi. Không thử xóa hồ sơ nghiệp vụ thật để kiểm chứng.

## Không cần chạy hàm sửa dữ liệu cho release này

Index production sau migration đã khớp nguồn. Release chỉ đổi luồng đọc; không sửa ngày, số lượng, bảo hành hoặc các tab 2024/2025/2026. Không phải chạy lại `repairHistoricalWarrantyData`, `repairHistoricalDashboardProjection` hoặc `rebuildPortalCaseIndex` để kích hoạt release. Nếu index thực tế sai trong một lần nhập tương lai, audit trước rồi mới quyết định rebuild ngoài giờ cao điểm.

## Kiến trúc và kiểm chứng

- Nguồn đọc dashboard: hồ sơ + công việc + lỗi + linh kiện nghiệp vụ canonical. Không ghép lại năm cũ trên đường đọc production; migration là bước riêng có kiểm chứng.
- Một snapshot cache compact theo spreadsheet/version/revision; mọi shared table phải cùng revision, không dùng cache stale. Revision đổi giữa lúc xây snapshot thì không công bố/cache kết quả trộn.
- Không giữ ScriptLock ngoài shared table reader. Writer và cơ chế lease/cache bảng hiện hành giữ nguyên. Danh sách server-side 20/50/100; frontend không lấy preview 250 dòng làm tổng sau lỗi API.
- Mọi case hoạt động được giữ trong danh sách kể cả thiếu ngày và ngày trước 2024. KPI ngày nhận chỉ đếm ngày có căn cứ. Cumulative records và received có định nghĩa riêng; nhãn UI vẫn là “Tích lũy”.
- Snapshot production 03/10: 2.768 nguồn/index, 2.767 hoạt động, 1 hủy, 6 thiếu ngày. Replay API mới: 2.767 ID duy nhất ở danh sách và dashboard; tổng có ngày nhận 2.761. Đây là snapshot, không phải tổng cố định để hardcode.
- Regression `validate.mjs`, `canonical-sync.mjs`: 10.000 hồ sơ, role isolation, cache warm, cancel/revision, migration labels, ngày cũ/thiếu, linh kiện thiếu PN. Không phải load test production/đo latency nhiều người thật. CacheService/Apps Script vẫn có quota; khi quy mô vượt các giới hạn cache/runtime cần persistent index hoặc database giao dịch, không thể đảm bảo vô hạn bằng Sheets.

## Trạng thái bàn giao

Backend đã sửa và kiểm thử cục bộ; chưa xác minh deploy Apps Script trực tiếp vì phiên trình duyệt automation không khởi động. Không coi code đã lưu local là đã chạy production. Chỉ đánh dấu backend deploy xong sau bước 4 và đối chiếu bước 6–7.
