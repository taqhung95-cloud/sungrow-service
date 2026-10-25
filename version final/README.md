# Backend nghiệp vụ — Version Final

Cập nhật: 26/10/2026. Backend `1.11.18-attachment-storage`, deployment chính Version73. Xem [PRODUCTION-STATE.md](../PRODUCTION-STATE.md) để biết bằng chứng triển khai và phạm vi đối chiếu.

## Nguồn chuẩn

- [AGENTS.md](../AGENTS.md): guard khi sửa repository.
- [CURRENT-IMPLEMENTATION.md](../CURRENT-IMPLEMENTATION.md): quy tắc hiện hành và lịch sử release.
- [Hướng dẫn upload1.11.18](../DEPLOY-1.11.18-ATTACHMENT-STORAGE.md): đúng file và đúng project cần cập nhật.

`Code.gs` chứa nghiệp vụ và kiểm quyền; `LegacyDashboardApi.gs` đọc dashboard hybrid; `ManagerDashboard.gs` giữ tương thích. Không dùng `apps-script/` hoặc một ZIP triển khai cũ để ghi đè thư mục này.

## Danh mục module

| Nhóm | Module |
|---|---|
| Nghiệp vụ/API | Code.gs, WorkOrderRules.gs |
| Dashboard/list/read | LegacyDashboardApi.gs, ManagerDashboard.gs, FastCaseReads.gs, PortalReadDiagnostics.gs |
| Phiên đăng nhập | PortalSessions.gs |
| Danh bạ/gợi ý | CustomerDirectory.gs, EntrySuggestions.gs |
| Thông báo/báo cáo | Notifications.gs, ReportExport.gs |
| Fan/lô/nhiều Model | FanLotRules.gs, FanLots.gs, FanWorkOrders.gs |
| Đính kèm | TemporaryUploads.gs, SupplementalAttachments.gs, AttachmentStorage.gs |
| Migration/repair theo yêu cầu riêng | FanLegacyMigration.gs, TransferRepair.gs, ReplacementDeliveryRepair.gs, XBSolarMigrationPlan.gs, XBSolarMigration.gs |
| UI Apps Script trực tiếp | Index.html, PortalBridge.html; frontend production nằm tại ../docs |

Bốn module PortalSessions/CustomerDirectory/Notifications/ReplacementDeliveryRepair được bổ sung vào repository từ bản local tương ứng đã có, không phải thay mới trên Apps Script trong lần đồng bộ này. Việc chúng có mặt trên runtime đã được ghi nhận trước; không coi đó là bằng chứng đối chiếu toàn bộ byte của bốn file với Version73. Xem giới hạn và helper một lần trong PRODUCTION-STATE.md.

## Quy tắc chính

- Tab Người dùng cấp role/center/capability; không commit danh sách account thật hoặc token.
- Quản lý hệ thống và quản lý Sungrow có quyền sửa nguồn theo capability; chỉ vai trò hệ thống gốc có quyền xóa mềm mở rộng.
- Center cuối đang giữ hàng xử lý/giao trả; không ghi đè center tiếp nhận gốc.
- KPI Fan tính hồ sơ/lượt nghiệp vụ; tỷ trọng Model Fan tính đủ số quạt vật lý theo Model. Linh kiện chỉ lấy bản ghi dùng thực tế.
- Case/work/provenance là khóa; không dùng riêng S/N. Giữ nguyên lịch sử và soft-delete.
- Mutation đồng bộ projection/index/revision; upload Drive ngoài khóa ghi database dài.

## Hai project Apps Script

Project chính giữ URL, Google Cloud/OAuth, Client ID, database và tài khoản thực thi hiện tại. Project riêng tại `../attachment-storage/` chạy bằng Gmail chuyên dụng chỉ lưu file mới. Không chép StorageWorker.gs vào đây vì có doGet/doPost riêng.

URL/secret worker và mode nằm trong Script Properties. Phiên8giờ, journal upload và receipt vẫn ở backend chính; không reset chúng khi cập nhật code. Upload thực tế với owner mới đã được người dùng xác nhận ngày26/10/2026.

## Triển khai và kiểm tra

```powershell
node "version final/tests/validate.mjs"
git diff --check
```

Chạy từ repository root. Thay đúng module theo release rồi Save/Newversion trên deployment hiện hữu; không thay toàn bộ project hay chạy migration/repair mặc định. Push GitHub không tự deploy Apps Script. Không cần deploy lại chỉ vì tài liệu được cập nhật.
