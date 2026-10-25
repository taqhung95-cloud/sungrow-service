# Trạng thái production và đồng bộ repository

Cập nhật: **26/10/2026**, múi giờ Asia/Saigon. Phân biệt rõ mã nguồn đã push, main, Apps Script đã deploy và dữ liệu vận hành; không dùng trạng thái của một bước để suy ra tất cả các bước khác.

## Mốc đã có bằng chứng

| Thành phần | Trạng thái / bằng chứng |
|---|---|
| Backend chính | APP_VERSION `1.11.18-attachment-storage`, deployment Version73; giao diện Google báo cập nhật thành công ngày26/10/2026 lúc01:14 |
| URL/tài khoản backend chính | Giữ đúng deployment/URL trước đây trong docs/config.js; thực thi bằng tài khoản cũ, không chuyển sang Gmail lưu trữ |
| Worker đính kèm | Project riêng, Version1; thực thi bằng sungrowservicecenter@gmail.com; endpoint nhận POST, lệnh/response bắt buộc HMAC |
| Quyền storage và kết nối | Preflight worker hoàn tất không lỗi; probe ký từ backend chính hoàn tất không lỗi |
| Upload thực tế | Người dùng xác nhận file đính kèm mới đã được upload bằng email mới |
| Website | docs/ trên GitHub Pages; live-data161, entry142, visual-polish36; release upload không sửa các asset frontend |
| Cloud/OAuth/database | Giữ cấu hình chính, Client ID và database/schema/quyền nghiệp vụ; worker dùng project/scopes riêng |

Không ghi URL worker, khóa HMAC, token, danh sách user hoặc Script Properties dump vào tài liệu này. Người kiểm tra ownership phải xem file mới, không chỉ xem owner của folder.

## Đã phát hiện trước lần đồng bộ này

- origin/main còn ở df18a45 (bản1.11.17); ba commit upload mới chỉ có trên nhánh codex/attachment-storage-20261025 đến b8e80a1.
- CURRENT-IMPLEMENTATION và hướng dẫn upload vẫn ghi chưa deploy dù runtime đã Version73 và người dùng đã thử thành công.
- README/SYNC_SETUP/security/README backend còn nhắc nguồn apps-script, registry/role/API/KPI cũ; phần tổng hợp handbook còn quy tắc giao trả về center đầu và quyền xóa cũ.
- Bốn module xuất hiện trong danh mục Apps Script thực tế nhưng chưa được track ở thư mục canonical của GitHub: CustomerDirectory.gs, Notifications.gs, PortalSessions.gs, ReplacementDeliveryRepair.gs.

Lần đồng bộ này cập nhật trạng thái, sửa tài liệu hiện hành, gắn nhãn tài liệu theo release cũ, bổ sung bốn module cùng test local tương ứng và đưa nhánh đã kiểm tra vào main. Không thay hoặc deploy lại Apps Script chỉ vì đồng bộ tài liệu/mã nguồn đã có.

## Danh mục source

| Nhóm | Vị trí |
|---|---|
| Frontend production | docs/index.html, live-data.js, entry.html và các module JS/CSS/asset hiện có trong docs |
| Core nghiệp vụ | version final/Code.gs, WorkOrderRules.gs |
| Dashboard/read | LegacyDashboardApi.gs, ManagerDashboard.gs, FastCaseReads.gs, PortalReadDiagnostics.gs |
| Auth/danh bạ/thông báo/báo cáo | PortalSessions.gs, CustomerDirectory.gs, Notifications.gs, EntrySuggestions.gs, ReportExport.gs |
| Fan | FanLotRules.gs, FanLots.gs, FanWorkOrders.gs |
| Upload phía backend | AttachmentStorage.gs, TemporaryUploads.gs, SupplementalAttachments.gs |
| Worker riêng | attachment-storage/StorageWorker.gs và appsscript.json riêng |
| UI Apps Script | version final/Index.html, PortalBridge.html |
| Công cụ maintenance | FanLegacyMigration.gs, TransferRepair.gs, ReplacementDeliveryRepair.gs, XBSolarMigrationPlan.gs, XBSolarMigration.gs; chỉ chạy theo phạm vi audit/repair đã được giao |

Bộ kiểm tra mặc định chạy từ root: node "version final/tests/validate.mjs". Bao gồm test upload/owner-only setup, auth8giờ, danh bạ, thông báo, repair, phân quyền, Fan/KPI, luân chuyển, cache và bridge. Đây là test local bằng dữ liệu giả; không tự ghi database hoặc upload case production.

## Giới hạn đối chiếu — không được bỏ qua

1. Trong phiên triển khai upload, toàn bộ Code.gs/TemporaryUploads.gs/SupplementalAttachments.gs cũ đã được so với baseline GitHub, khác biệt chỉ xuống dòng. Sau đó cài đúng file upload và adapter, chạy probe và deploy Version73. Không suy điều này thành đã so toàn bộ module khác từng byte với runtime.
2. Bốn module bổ sung lần này lấy từ bản local production-auth-audit/version final đã có, đã rà code và chạy test. Đã ghi nhận tên module tương ứng trên Apps Script; chưa có bản export Version73 để chứng nhận toàn bộ byte của bốn file khớp runtime. Không triển khai đè bốn file lên Apps Script chỉ để làm cho hai phía giống nhau.
3. Chuyen12CaseFan.gs từng xuất hiện trên runtime như helper migration một lần. Chưa có bản nguồn đối chiếu/sạch tham số ở repository này. Logic migration tổng quát ở FanLegacyMigration.gs đã có; không lấy dữ liệu/biên nhận migration cá nhân để đưa lên Git. Muốn lưu trọn helper phải xuất/rá/sanitise riêng, không cần chạy lại migration.
4. Các checkout cũ ở root, production-auth-audit và fan-lots-release-20261017 có file sửa/chưa track, gồm bản cũ, bản thử và công cụ maintenance. Chúng được giữ nguyên; không gom toàn bộ vào main vì không phải bằng chứng là mã đang chạy mới nhất. Dữ liệu/analysis/ZIP/Excel và file đính kèm không thuộc source cần publish.
5. Người dùng đã xác nhận happy-path upload mới. Chưa có bằng chứng thử lại mọi center/role/quota/kịch bản mất mạng trên Google thật. Không ghi PASS production cho các kịch bản chỉ có test local.
6. Các file local ScriptMaintenance.gs, tests/runtime-cleanup.mjs và tools/build-clean-runtime.mjs chuẩn bị cho 1.11.19-runtime-cleanup được giữ ngoài lần đồng bộ này. Chưa có bằng chứng duyệt/deploy; không coi chúng là nguồn production Version73 và không tự chạy cleanup.

## Các tài liệu đang có hiệu lực

AGENTS.md, CURRENT-IMPLEMENTATION.md, README.md, SYNC_SETUP.md, security-architecture.md, hướng dẫn upload1.11.18, version final/README.md, REALTIME-SYNC.md, PRODUCTION_ACCESS_CHECKLIST.md và CONCURRENCY.md. Các DEPLOY cũ, LOGIN-DESIGN và proposal là lịch sử/tham khảo có nhãn; phần cũ được giữ để đối soát, không dùng một mình làm hướng dẫn production hiện tại.

Mỗi lần deploy tiếp theo phải cập nhật version, deployment status, bằng chứng kiểm tra và giới hạn ở đây cùng CURRENT-IMPLEMENTATION.md. Không đánh dấu “đồng bộ toàn bộ runtime” khi còn các mục chưa đối chiếu nêu trên.
