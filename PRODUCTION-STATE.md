# Trạng thái production và đồng bộ repository

## Trợ lý hỏi nhanh — 28/10/2026, backend 1.11.24 cần cập nhật thủ công

Portal liveJS167/entry148 thêm quick-assistant.js/css1, robot 48px có neon cam; không có chữ dưới icon/thẻ gợi ý. Mọi vai trò đăng nhập được sử dụng, dữ liệu tiếp tục theo quyền center/case. Cùng SN nhiều hồ sơ không tự gộp hoặc chọn một; mở hồ sơ/lịch sử theo caseId qua workspace hiện có. Trang entry độc lập có trợ lý; iframe dùng trợ lý của shell. Không lưu chat ở localStorage; xóa khi đăng xuất/đổi tài khoản, bỏ phản hồi trễ. Nhãn giữ một dòng và mã dài có vùng cuộn riêng.

RPC quickAssistantChat trong Code.gs + module QuickAssistant.gs chỉ đọc qua listCases/getCaseDetail. Gemini Free Tier chỉ nhận câu hỏi đã che mã/email/URL/số dài/khóa phổ biến và tối đa4câu hỏi trước đã che, cùng hướng dẫn chung. Không gửi hồ sơ, trạng thái, mốc ngày, khoảng SLA hay thông tin khách/ghi chú/Drive/token từ database sang Google; kết quả hồ sơ được ghép nội bộ sau phân quyền. AI chỉ bật khi ASSISTANT_AI_ENABLED=true, ASSISTANT_FREE_TIER_CONFIRMED=true và đã lưu ASSISTANT_GEMINI_KEY trong Script Properties. Mặc định model gemini-3.5-flash-lite, không tự chuyển dịch vụ/model trả phí; admin phải dùng project Free Tier không Cloud Billing. Hết quota/lỗi AI về hướng dẫn nội bộ; tra mã trực tiếp không gọi AI. Không ghi dữ liệu nghiệp vụ hoặc đổi schema. Hướng dẫn từng file, tạo key và deploy: DEPLOY-1.11.24-QUICK-ASSISTANT.md.

Mã Code.gs dựa trên main 1.11.21, không mang các bản Fan1.11.22/nhãn1.11.23 ở nhánh riêng. Người dùng tự cập nhật Code.gs và thêm QuickAssistant.gs rồi New version cùng deployment URL. Trạng thái này ghi nhận mã nguồn/bộ cập nhật, không xác nhận backend đã deploy hoặc đã gọi Gemini bằng key thật. Frontend GitHub được phát hành độc lập, backend cũ hiển thị thông báo cần kích hoạt thay vì dùng dữ liệu giả.


## Lỗi xác nhận chung cho nhiều Fan — 27/10/2026

Frontend liveJS165/entry146/sharedforms8/drafts6 gộp các lỗi đã lưu cùng mã, tên và ngày thành một dòng trên biểu mẫu lô Fan. Lỗi khác hoặc ngày xác nhận khác giữ riêng. Giữ nhóm ID gốc trong data-fan-issue-ids; khi gửi mở lại đúng các bản ghi cũ cùng ghi chú riêng để backend giữ liên kết từng inverter, không xóa/ghi lại lịch sử và không thay số Fan trong KPI. Lỗi mới nhập một lần áp dụng cho scope đã chọn; hàng lỗi mới trùng nhau trong cùng lần gửi được gộp trước RPC. Nháp giữ nhóm ID và khóa chỉnh sửa lịch sử khi khôi phục. Không thêm RPC đọc, không đổi schema/API/backend; không cần deploy Apps Script cho sửa này. Kiểm thử UI gồm gộp3lỗi giống, lỗi khác, lưu đủ ID/ghi chú, scope3inverter, thêm lỗi mới, retry cùngrequestId và khôi phục nháp.


## Trạng thái giao trả rõ ràng — 27/10/2026

Frontend liveJS164/entry145/drafts5: hồ sơ có isClosed và returnedAt từ nguồn hiển thị Đã trả khách và ngày đã lưu. Mở lại biểu mẫu ở chế độ xem, chặn nháp cũ tự phục hồi; chỉ người có canReturn được bật Chỉnh sửa thông tin giao trả cho hồ sơ thường, sau đó nút Lưu điều chỉnh giao trả. Lô Fan trả một phần hiển thị Giao trả tiếp và số đã trả/còn lại, không nhận là đã trả toàn bộ và không cho sửa nhật ký Fan bằng xác nhận lại. Nút chỉ đổi trạng thái sau phản hồi ghi thành công và snapshot/readback getCaseDetail; lỗi lưu không đổi trạng thái, lỗi readback sau ghi chặn xác nhận lại và hướng dẫn Đồng bộ. Giữ quyền/API/backend, không tự nhập ngày hoặc xác nhận thay người dùng. Bộ UI headless kiểm tra đã trả, chỉnh sửa, gửi lặp, lỗi, fallback đọc lại và Fan một phần. Chỉ cần publish GitHub; không cần deploy lại Apps Script cho thay đổi UI này. Bản sửa dropdown Code1.11.21 vẫn cần người dùng xác nhận deploy riêng.


## Sửa danh sách lý do SLA — 27/10/2026, Code1.11.21 chưa deploy

Đã đọc metadata/rule thực tế: cột Lý do tạm dừng còn danh sách6giá trị strict, thiếu hai lựa chọn mới. Lưu lựa chọn mới có thể bị Sheets từ chối sau khi đã ghi một phần. Code1.11.21 chuẩn bị rule của đúng ô đích trước mọi ghi hồ sơ/công việc, chỉ thêm lựa chọn SLA chính thức, giữ strict và các giá trị cũ; không xóa validation, không sửa hàng loạt sheet hoặc dữ liệu lịch sử. Dùng chung cho luồng thường và Fan qua assertSlaHoldsForCase_. Kiểm thử lưu hồ sơ đóng với quản lý, từ chối nhân viên, lỗi rule trước ghi và đối soát dòng con ghi dở khi lưu lại thành công. Chỉ Code.gs cần thay và Newversion cùngURL; frontend163/entry144, WorkOrderRules và KPI giữ nguyên. Chưa deploy bản1.11.21 và chưa ghi/sửa dòng nghiệp vụ trên production trong phiên kiểm tra. Hướng dẫn DEPLOY-1.11.21-SLA-DROPDOWN.md.


## Sửa bố trí nút thêm khoảng SLA — 27/10/2026

Frontend liveJS163/entry144: nút thêm nằm bên phải nút Xóa trên cùng hàng, rộng138px như phần lỗi/linh kiện. Sửa addHoldRow tìm danh sách .holds từ nút đã được enhanceActionForm chuyển vào hàng; không chèn HTML vào nút Xóa. Giữ logic SLA, API, schema và dữ liệu. Bản Index.html tương ứng được sửa trong source; sửa portal GitHub không yêu cầu deploy lại Apps Script. Kiểm thử trình duyệt kiểm tra thêm nhiều dòng, không lồng control, giữ nút khi xóa hàng và bố trí cùng hàng.


## SLA theo giai đoạn — 27/10/2026, bản 1.11.20 đã xác nhận deploy backend

Đã chuẩn bị nhiều khoảng tạm dừng, nhóm lý do trước/sau sẵn sàng giao và ràng buộc ngày tại cập nhật công việc, sửa ngày hồ sơ, giao trả thường/Fan. Không tự trừ chờ giao. KPI dùng số ngày nhận–trả trừ hợp các khoảng hợp lệ để xét đạt≤7; khoảng nội bộ cũ bị giới hạn tại ngày sẵn sàng khi đọc, không ghi lại dữ liệu nguồn. Giữ ngày sẵn sàng đã chỉnh nếu không trước ngày hoàn tất mới. Fan theo lô vẫn dùng mốc sẵn sàng cấp hồ sơ, chưa có SLA riêng cho từng Fan/lần trả một phần. Chi tiết và thứ tự backend trước frontend: DEPLOY-1.11.20-SLA-HOLDS.md. Ngày27/10/2026 người dùng xác nhận đã deploy backend1.11.20 theo hướng dẫn; chưa có số deployment version mới hoặc kết quả thử hồ sơ thật. Frontend liveJS162/entry143 được phát hành qua main sau xác nhận này; kết quả kiểm tra/deploy Pages xem GitHub Actions. Giữ URL/Cloud/worker/Properties. Bộ cleanup1.11.19 đã dừng, không tái sử dụng.


Cập nhật: **27/10/2026**, múi giờ Asia/Saigon. Phân biệt rõ mã nguồn đã push, main, Apps Script đã deploy và dữ liệu vận hành; không dùng trạng thái của một bước để suy ra tất cả các bước khác.

## Mốc đã có bằng chứng

Người dùng đã yêu cầu dừng phương án thay/gỡ source Apps Script 1.11.19 ngày 26/10/2026. Backend giữ 1.11.18/Version73 theo bằng chứng hiện có; chưa deploy bộ dọn gọn. Mã đề xuất, test/công cụ và hướng dẫn đã chuyển vào `Khong-su-dung/AppsScript-cleanup-1.11.19-20261026` ở workspace cha, hai import test đã bỏ khỏi validator chính. Không tiếp tục triển khai từ các file lưu trữ.

Phần đã thực hiện: người dùng gửi log dọn thành công 985 marker CCS/SRS DONE, có bản lưu Drive được xác minh và receipt; audit sau dọn còn 69 Properties, không ghi database nghiệp vụ. Giữ SCRIPT_MAINTENANCE_CCS_SRS_ARCHIVE cùng backup/journal/hash, không tự phục hồi marker hoặc dọn thêm. ScriptMaintenance.gs có thể vẫn còn trong Editor Google; chat này không xóa hay thay thêm source trên Google.

| Thành phần | Trạng thái / bằng chứng |
|---|---|
| Backend chính | APP_VERSION `1.11.20-sla-holds`; người dùng xác nhận đã deploy ngày27/10/2026, chưa cung cấp số deployment version mới. Mốc quan sát trước là1.11.18/Version73 |
| URL/tài khoản backend chính | Giữ đúng deployment/URL trước đây trong docs/config.js; thực thi bằng tài khoản cũ, không chuyển sang Gmail lưu trữ |
| Worker đính kèm | Project riêng, Version1; thực thi bằng sungrowservicecenter@gmail.com; endpoint nhận POST, lệnh/response bắt buộc HMAC |
| Quyền storage và kết nối | Preflight worker hoàn tất không lỗi; probe ký từ backend chính hoàn tất không lỗi |
| Upload thực tế | Người dùng xác nhận file đính kèm mới đã được upload bằng email mới |
| Website | docs/ trên GitHub Pages; live-data162, entry143, rules4, locks5, visual-polish36; phát hành SLA qua main sau xác nhận backend |
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
6. Phương án local 1.11.19 đã dừng theo yêu cầu người dùng và được đưa vào Khong-su-dung ở workspace cha; không coi là source production hoặc tiếp tục triển khai từ đó. Phần dọn 985 marker đã thực thi được ghi riêng ở trên.

## Các tài liệu đang có hiệu lực

AGENTS.md, CURRENT-IMPLEMENTATION.md, README.md, SYNC_SETUP.md, security-architecture.md, hướng dẫn upload1.11.18, version final/README.md, REALTIME-SYNC.md, PRODUCTION_ACCESS_CHECKLIST.md và CONCURRENCY.md. Các DEPLOY cũ, LOGIN-DESIGN và proposal là lịch sử/tham khảo có nhãn; phần cũ được giữ để đối soát, không dùng một mình làm hướng dẫn production hiện tại.

Mỗi lần deploy tiếp theo phải cập nhật version, deployment status, bằng chứng kiểm tra và giới hạn ở đây cùng CURRENT-IMPLEMENTATION.md. Không đánh dấu “đồng bộ toàn bộ runtime” khi còn các mục chưa đối chiếu nêu trên.
