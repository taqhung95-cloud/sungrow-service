# Sungrow Service Center - Current Implementation Handbook

## Trạng thái đã xác nhận — 26/10/2026

Backend chính `1.11.18-attachment-storage` đã triển khai Version73 trên cùng URL và cùng tài khoản thực thi cũ; worker lưu trữ riêng đã triển khai Version1 bằng sungrowservicecenter@gmail.com. Probe có HMAC đã hoàn tất không lỗi; người dùng xác nhận file đính kèm mới được upload bằng email mới. Không đổi Cloud/OAuth/ClientID/database/schema hoặc quyền nghiệp vụ. Frontend vẫn liveJS161/entry142/CSS36; release upload không sửa `docs/*`.

Xem PRODUCTION-STATE.md để biết danh mục mã nguồn, module local được bổ sung vào Git và giới hạn đối chiếu. Những mục release bên dưới là lịch sử theo thời điểm; câu “chưa deploy/chưa chạy repair” ở một release cũ không chứng minh trạng thái hiện tại. Phần quy tắc tổng hợp từ mục1 trở đi đã được chỉnh theo bản1.11.18; không dùng hướng dẫn deploy cũ để ghi đè runtime.

## Upload riêng — 26/10/2026, Code1.11.18 đã triển khai

Chỉ file đính kèm mới dùng dịch vụ Apps Script riêng thực thi bởi sungrowservicecenter@gmail.com. Backend chính/URL/Cloud OAuth/Client ID/database/session/quyền/KPI giữ nguyên. AttachmentStorage.gs ký request/response HMAC server-to-server, nonce/expiry và không gửi token portal; worker riêng tại attachment-storage/ chỉ có Drive+userinfo scopes, root allowlist, owner check, idempotent upload theo ID/hash, prepare/supplement/remove/cleanup. Không chép worker doGet/doPost vào project chính.

Mode explicit ATTACHMENT_STORAGE_MODE=dedicated-v1, URL/secret nằm trong Script Properties, không nằm frontend/Git. Phiên tạm cũ giữ luồng cũ; phiên mới đóng dấu mode, lỗi worker không fallback. Drive I/O vẫn ngoài khóa database; không thêm request worker vào dashboard/login/list. Actor journal/audit là người thao tác, không đổi thành file owner. Worker staged tối đa32MB/file do transport, legacyZIP/RAR8MB. Existing CREATE_UPLOAD_ uncertain guard giữ nguyên, cần đối soát khi classic route mất phản hồi trước lưu link. Cleanup chính bảo vệ canonical trước gọi storage; supplemental committed chỉ dọn folder rỗng. Không chuyển owner file cũ, không đổi trigger nghiệp vụ.

Đã thay Code.gs/TemporaryUploads.gs/SupplementalAttachments.gs, thêm AttachmentStorage.gs và cập nhật Newversion cùngURL sau khi đối chiếu nội dung ba file cũ với baseline GitHub. Worker riêng đã được tạo bằng Gmail chuyên dụng, preflight quyền và probe kết nối có chữ ký đã đạt. Hướng dẫn DEPLOY-1.11.18-ATTACHMENT-STORAGE.md. Validator gồm signedprotocol/ownership/recovery/create/legacy/supplement/cleanup/oldsession/failure và setup owner-only. Agent không tạo case nghiệp vụ giả; người dùng tự thử và xác nhận owner mới. Không chuyển owner file cũ.

Project thực tế có hơn50ScriptProperties nên UI chỉ đọc. Trang ?attachment_storage_setup=1 trên /dev chỉ chủ backend (active/effective email cùng tài khoản cũ) được mở; nonce một lần10phút, secret chỉ nhập form HTTPS và lưu merge2property, không nhúng source/HTML/log/URL hoặc xóa session. configureAttachmentStorageForOwner không thuộc API portal và vẫn kiểm owner/nonce/URL/secret/không overwrite khác. batKhoDinhKemRieng chạy probe trước set mode sau khi deploy chính. Worker khoiTaoKhoaKhoDinhKem tạo khóa một lần bằng owner, không trả/log giá trị. Tests role denial,nonce replay, >50properties/session preservation và activate probe.

## Center cuối phụ trách giao trả & chống lượt nhận trùng — 22/10/2026, Code1.11.17 / liveJS161 / entry142

Center đang giữ hàng sau xác nhận nhận là center chịu trách nhiệm xử lý và giao trả. Giữ center tiếp nhận ban đầu làm lịch sử, không ghi đè. Hoàn tất kỹ thuật có kết quả/ngày chuyển hồ sơ sang Sẵn sàng trả khách dù đã chuyển center; Fan tính theo phần hoàn tất/chờ trả ở center hiện tại. publicCase canReturn và ngày nguồn cho center hiện tại, backend xác thực currentCenter, chặn đang vận chuyển/hủy và ngày trả trước ngày nhận/hoàn tất. Center cũ không được giao trả hoặc cập nhật công việc chặng cũ. Không suy số trả sang spare parts.

createTransfer kiểm pending trước ghi, cùng lượt chờ trả lại IDs cũ; lượt khác/closed/hủy/inTransit/sourceWork đã đóng bị chặn. UI gửi fromCenter/sourceWorkOrderId để chống form cũ. Tạo work+transfer+cập nhật source/case là một Sheets atomic batch qua FanLots helpers; xác nhận nhận cũng một batch. Nhận lại cùng lượt/cùng ngày trả ok replay không ghi lại, khác ngày phải sửa riêng; không reset tiến độ. Lượt pending cũ sau đổi center/đã xử lý bị chặn. UI khóa các click nhận lặp khi đang gọi API. Giữ đọc scoped/cache/tối ưu1.11.16.

TransferRepair.gs editor-only xử lý đúng hồ sơ HS-20261015-092607-7D323A đã đối chiếu: giữ work AF003F hoàn tất21/10, đóng work nhận trùng CA2136, đánh dấu hủy transfer trùng, giữ mọi row/ID/ngày/lịch sử. Kiểm tra lại case/center/canonical và dừng nếu bản trùng có lỗi, parts, holds hoặc chặng đi tiếp. Preview kiemTraLuanChuyen7D323A không ghi; suaLuanChuyen7D323A atomic/source audit/sync index/projection/revision và chạy lại không nhân bản. Không tạo ngày trả hoặc xác nhận đã giao. Cần người dùng deploy rồi chạy function sửa; chưa sửa nguồn production trong phiên này.

Thay Code.gs, FanLots.gs, FanWorkOrders.gs và thêm TransferRepair.gs; giữ FastCaseReads.gs nếu đã cài. DEPLOY-1.11.17-LAST-CENTER.md. Tests last-center-transfer (duplicate/failure/replay/role/date), transferred Fan full shared workflow/parts-KPI unchanged, repair atomic guard/replay và Edge date/double click. Không migration/schema/history delete.

## Đọc gộp và bỏ RPC thừa — 22/10/2026, Code1.11.16 / liveJS160 / entry141

FastCaseReads.gs dùng Sheets REST: schema, cộtkhóa, dòngnguồn/con theo nhóm; 3requestcold,1requestkhilocatorwarm,0khicachebundlewarm (không gồm auth/modulephụ). Cache rawbundle caseId+globalrevision, render/quyền theoactorfresh; Date/số/bool/error/SN0đầu và thứtựsource giữ, revisioncheck/rowmoveguard/fallbacklegacy. Manualsync bypasscache. Code trả caseDetail trong cùng phản hồi mutation theo yêu cầu; lỗi đọc sau ghi không đổi kếtquảmutation. UI dùng savedItem không đọc lại; backendcũ fallback1detailRPC. Bootstrap parent sameorigin+token dùng lại trong iframe, bỏ Bootstrapcatalog nối tiếp listmanualsync, dashboard2kỳ chạy song song. Giữ toànbộ nghiệpvụ/quyền1.11.14/1.11.15. Validation+Edgeworkspace với dữliệugiả đạt (savedSnapshot0reread/oldbackend1read/1bootstrap/nháp/role/realtime). Backend cần copy Code.gs và thêmFastCaseReads.gs rồi Newversion cùngURL; hướngdẫn DEPLOY-1.11.16-PERFORMANCE.md. Khôngmigration/ghiproductionnghiệpvụ. Mốc1.11.15 bên dưới đã xácminh production trước lượt này, khoảng list2.74–3.71s/detail6.35–8.86s; không dùng mock làm sốgiâyproduction.

## Tối ưu lưu và tải lại — 21/10/2026, Code1.11.15 local chưa deploy

Hợp nhất trên1.11.14 giữ toàn bộ quyền xóa mới. Scoped reads cho update/bảo hành/correction/luân chuyển/giao trả; TextFinder tối đa20khóa với escape/trim/case/display-value, tập lớn/trống fallbackcột; hydrate các cụm liền nhau. Bỏ ghi child không đổi, appendchild theo lô, delete cụm giảm dần, gộp case metadata/status, skipfillngàykhiđủ. syncCaseDerived_ dùng chung record/works/transfers sauflush cho projection/index của luồng thường. Header memo trong write scope, invalidation khi thêmcột, restorefinally; không cache quyền/content. Log portal-save-timing server/projection/index/ok. Validator và actualsave3001rows/table đối chiếu1.11.14 hai kịch bản giống hoàn toàn; 20partsnew27→6writes. Không suy thời gianproduction từ mô phỏng, chưa triển khai. Chỉ thay Code.gs, Save/Newversion giữURL; frontend không đổi so1.11.14. Chi tiết PERFORMANCE-1.11.15.md; file1.11.13 cũ bị thay thế bởi bản hợp nhất này.

## Quản lý hệ thống xóa hồ sơ mọi trạng thái — 21/10/2026, Code1.11.14 / liveJS159 / entry140

canDeleteAnyCase tạo từ vai trò gốc service_manager/Quản lý hệ thống/Quản lý dịch vụ trước khi nâng quản lý Sungrow thành service_manager. Không suy từ isGlobalManager hoặc roleCode đã chuẩn hóa. Auth/publicActor truyền capability và cache actor theo APP_VERSION. Quản lý Sungrow giữ quyền sửa của1.11.12; không tự nhận quyền xóa mở rộng. Quản lý center/nhân viên vẫn chỉ hủy tiếp nhận chưa xác nhận, chưa hoàn tất, chưa luân chuyển, còn tại center tiếp nhận; lô có nghiệp vụ không dùng quyền hủy tiếp nhận.

canDeleteCaseRecord_ dùng chung cho list/detail. cancelCase bỏ giới hạn bảo hành/hoàn tất/luân chuyển/lịch sử Fan chỉ cho capability thật. Mọi loại thiết bị được hỗ trợ. Vẫn chặn FAN_PENDING chưa đối soát, giữ khóa ghi và guard migration. Bắt buộc lý do, trạng thái Đã hủy và người/ngày/lý do/audit, xóa projection dẫn xuất, sync index/revision. Không xóa lịch sử công việc/linh kiện/luân chuyển/tài liệu hay sheet nguồn2024/25/26. Retry idempotent. Projection ưu tiên caseId; fallback SN/ngày chỉ trên dòng không có caseId, giữ hồ sơ khác cùng SN/ngày.

Frontend nút X theo canDelete backend; tooltip/xác nhận rõ xóa mềm, giữ lịch sử. Chỉ Code.gs cần thay trên bộ1.11.12, Save/New version giữ URL: DEPLOY-1.11.14-SYSTEM-DELETE.md. Tests actual cancel bao gồm quyền, mọi loại/closed/warranty/transfer/Fan history, pending/reason, retry/audit/index/revision và projection trùng SN; Edge renderer/dialog. Không xóa thử production. Checkout riêng bảo toàn thay đổi tốc độ1.11.13 đang local ở checkout khác.

## Quản lý Sungrow Center được sửa hồ sơ — 20/10/2026, Code1.11.12 / liveJS158 / entry139

Quyền sửa thông tin gốc gồm service_manager và center_manager có homeCenter chính xác Sungrow Service Center. Không suy từ centers chứa Sungrow hoặc riêng cờ isGlobalManager. resolveRole_ hiện đã quy đổi quản lý Sungrow thành service_manager; helper nay chấp nhận rõ cả dạng center_manager để tránh phụ thuộc cách biểu diễn. publicActor thêm canCorrectCaseSources; frontend áp dụng cùng quyền cho mở form và bảng sửa SN/SL/tiến độ Fan. Mọi loại thiết bị/mọi center/closed được sửa như 1.11.11, các center manager khác và toàn bộ center_staff (kể cả Sungrow) bị chặn. Không đổi quyền nghiệp vụ khác hoặc dữ liệu.

Backend chỉ Code.gs và FanLots.gs thay so với bộ1.11.11. LegacyDashboardApi.gs/FanLotRules.gs giữ nguyên1.11.11. Gói triển khai mới gồm đủ4file để người chưa cài bản trước có thể dùng; nếu đã cài1.11.11 chỉ thay2file, Save/New version giữ URL. Tests actual correction bởi quản lý Sungrow, raw/normalized role aliases, deny DAT/Sungrow staff và Edge form+payload. Tài liệu DEPLOY-1.11.12-SUNGROW-CORRECTIONS.md thay hướng dẫn quyền ở mục1.11.11 bên dưới.

## Quyền sửa thông tin gốc — 20/10/2026, backend1.11.11 / liveJS157 / entry138

Chỉ roleCode service_manager được correctCase, lấy correctionRevision và mở form; center_manager/center_staff bị chặn cả UI/API kể cả isGlobalManager=true của quản lý center Sungrow. Quyền cập nhật công việc thường ngày giữ nguyên. Sửa thông tin gốc mọi loại thiết bị, mọi center, kể cả hồ sơ đã hoàn tất; sửa SN/Model/SL/ngày và thông tin khách/giao nhận/GSP/MA/dự án. Không chặn do trùng SN hay có công việc/luân chuyển trước đó. Giữ caseId, lịch sử cũ và liên kết. Các ràng buộc định dạng, ngày hợp lệ, CAS/lý do/audit vẫn áp dụng. Hồ sơ hủy chỉ xem trực tiếp theo ID bởi hệ thống, vẫn ẩn khỏi danh sách thường.

Lô Fan giữ khung bo, mỗi inverter một hàng: sửa SN, Model inverter, Model Fan, số quạt lỗi, hoàn tất, đã trả; common SN/Model/SL là tổng dẫn xuất. Không thêm/xóa lineId hay đổi lô thành loại thiết bị khác làm mất tham chiếu. Cho phép giảm SL và sửa đồng thời bộ đếm, với 0≤đã trả≤hoàn tất≤SL. Đổi SN đặt bảo hành dòng về Chờ xác nhận, không tự duyệt. Lookup debounce/cache/batch chỉ trên form đang mở; không poll mới. Giữ form thường phẳng, không gom nhóm.

Case snapshot và journal correction có delta ký hiệu được ghi một atomic batch, pending guard/reconciliation giữ khi kết quả chưa rõ. Nhật ký nghiệp vụ và parts gốc không viết lại; audit trước/sau có lý do. Ledger/projection/index/revision đồng bộ, reader dashboard/report cộng delta kỹ thuật/giao trả theo ngày hiệu lực chỉnh sửa; tỷ trọng Model dùng SL mới, KPI hồ sơ và parts thực dùng giữ định nghĩa. Lô chuyển đổi giữ original source snapshots, receivedCorrection cân bằng tổng mới. Đóng/mở lại theo số trả có ngày trả/sẵn sàng tương ứng. Các ngày nguồn vẫn kiểm tra thứ tự.

Phải copy đủ Code.gs, LegacyDashboardApi.gs, FanLotRules.gs, FanLots.gs; Save/New version Web App hiện tại, giữ URL. Hướng dẫn DEPLOY-1.11.11-SYSTEM-CORRECTIONS.md, self-check kiemTraQuyenSuaHoSo không ghi DB. Cache rules6/shared6/CSS9. Tests validate và Edge kiểm tra role denial, mọi loại/closed, atomic failure, giảm SL/tiến độ, CAS/retry, reader KPI/parts và payload UI. Không migration, không schema/history writes. Frontend Pages phát hành độc lập; backend cần người dùng deploy thủ công.

## Khung bo ngoài bảng sửa Model — 20/10/2026, liveJS156 / entry137

Chỉ thêm khung ngoài fl-model-correction giống bảng tổng hợp phía trên: border1px#e3e7eb, radius8px, nền#f8fafc, padding10x12. Giữ nguyên ba cột S/N/Model inverter/Model Fan, toàn bộ nội dung và form bên dưới; không thêm cột hoặc đổi chức năng. Chỉ CSS, không thay Apps Script.

## Bảng sửa Model compact — 20/10/2026, liveJS155 / entry136

Chỉ bảng Model theo S/N inverter trong Sửa thông tin hồ sơ: colgroup30/35/35, header/giá trị/ô nhập canh giữa đồng trục, input30px/hàng38px, readonly inverter xám, scroll khi hẹp, khoảng cách dưới bảng12px. Giữ nguyên form và thứ tự trường bên dưới, không gom nhóm theo yêu cầu người dùng. Chỉ frontend CSS/markup, không đổi lookup/lưu/backend. fan-shared-forms JS5/CSS7; không cần thay Apps Script.

## Bộ lọc Kết quả gần nhất — 20/10/2026, Code1.11.10 / liveJS154 / entry135

Danh sách hồ sơ thêm dropdown Tất cả kết quả, options từ các dòng chỉ mục được phép xem và các bộ lọc khác. latestResult khớp đúng nội dung cột: kết quả xử lý ưu tiên, nếu trống dùng trạng thái công việc, không có công việc/không được xem chặng gần nhất → Chưa cập nhật. Không lộ kết quả chặng ngoài quyền, bỏ hồ sơ hủy. Lọc toàn chỉ mục trước sort/phân trang, serialize mỗi trang; vẫn một shared-index read, không đọc chi tiết/lịch sử. Cache seed có filters/revision/APP_VERSION nên tách giá trị lọc. Đổi lựa chọn về trang1, giữ kết hợp query/status/warranty/center/sort. Dropdown disabled khi backend cũ chưa có capability; tránh lọc giả20dòng.

Chỉ backend Code.gs thay thành1.11.10-case-result-filter; Legacy/FanRules/FanLots giữ bản đang chạy1.11.9 và bản vá Model inverter. Pages cập nhật riêng; Save/New version deployment hiện tại sau copyCode. Tests case-result-filter kiểm tra >3trang, ưu tiên outcome, bộ lọc kết hợp, quyền/options, chỉ serialize trang; Edge kiểm tra gửi filter/giữ giá trị/reset trang. Không mutation/schema/KPI.

## Model inverter cho hồ sơ lô cũ — 20/10/2026, liveJS153 / entry134

Sửa thông tin hồ sơ lô thêm cột Model inverter tự tra và nút tra lại, dùng lookup cache/batch hiện có cho S/N thiếu Model. Không chép Model inverter vào Model Fan, không auto save/duyệt bảo hành. Lưu chỉnh sửa qua correctCase hiện có nhận inverterModel tùy chọn cùng fanModel theo lineId; giữ CAS/quyền/audit/index/revision, không đổi SN/số lượng/tiến độ. Kết quả tra lỗi/không thấy giữ Model cũ; không gửi blank xóa dữ liệu. Không tra khi chỉ mở tab hồ sơ.

FanLots.gs thêm capability inverterModelCorrection trong detail; frontend cũ tương thích, backend chưa có thì báo thay FanLots.gs và không gửi trường có nguy cơ bị bỏ qua. Code/Legacy/Rules vẫn1.11.9, chỉ cần thay FanLots.gs từ bản sửa này rồi Save/New version deployment hiện tại. Không migration/ghi history. Test correction lưu Model inverter/giữ Model cũ khi không gửi/chặn formula, Edge hồ sơ cũ tra đủ cột và payload lưu không đổi Model Fan.

## Fan nhiều Model theo S/N & hồ sơ gọn — 20/10/2026, backend1.11.9 / liveJS152 / entry133

Mỗi dòng gồm S/N kèm chip bảo hành, Model inverter tự tra chỉ đọc, Model/Mã Fan nhập riêng, số Fan, ghi chú, Xóa; header/cell luôn một hàng và cuộn ngang. Tổng Model/số inverter/tổng Fan tự tính tô xám. Excel3–4cột SN/ModelFan/SL/ghi chú. Gộp cùngSN cùngModel, chặn cùngSN khácModel. Không suy mã Fan từ inverter. Lookup giữ cache/batch, không thêm poll. Capability fanLotModels kiểm tra đủ bộ backend mới; thiếu thì báo và chặn lưu lô mới để tránh mất thuộc tính.

fanModel/inverterModel là thuộc tính tùy chọn trong JSON Chi tiết lô Fan hiện có, giữ schema1/hồ sơ cũ; không thêm tab/cột hoặc migration. createCase/correctCase gốc giữ atomic create, quyền quản lý/CAS/lý do/audit/index/projection/revision; sửa Model không đổi số lượng/SN/tiến độ. Chỉ mục tìm kiếm thêm Model dòng. ModelTypes cộng số Fan từng dòng theo kỳ/center/quyền, hồ sơ cũ fallback Model nguồn; KPI mỗi lô1, parts thực dùng giữ. Thông tin hồ sơ padding8x10/gap5px; linkDrive/Bổ sung đính kèm cùng hàng.

Validate/Edge kiểm tra actual create atomic/retry, correction, tiến độ, Model quantities/cache/parts, row1920/1366/768, inline attachment/draft/tab/revision. Cần thay4file theo DEPLOY-1.11.9-FAN-LINE-MODELS.md. Self-check kiemTraFanNhieuModel không ghi nguồn. Frontend Pages đã push không có nghĩa backend đã deploy; backend manual.

## Phân nhóm thông tin hồ sơ — 19/10/2026, liveJS151 / entry132

Renderer chi tiết chung chia thành Thiết bị & tiếp nhận, Bảo hành & tiến độ, Khách hàng, Giao nhận & vận chuyển; thông tin tạo hồ sơ và tài liệu ở cuối. Desktop hai nhóm mỗi hàng, drawer/màn hình hẹp một nhóm mỗi hàng; bên trong giữ các trường liên quan cạnh nhau, địa chỉ/ghi chú nguyên bề rộng nhóm, chữ11/12px. Giữ đủ dữ liệu và quyền/tài liệu/hành động, không thêm API hay đổi backend/KPI. Bảng S/N Fan vẫn tuân quy tắc mỗi inverter một hàng, cuộn ngang khi hẹp. Edge workspace-ui xác nhận trường thuộc đúng nhóm và các thao tác/cache/draft; validate đạt. Cache CSS4; không cần deploy Apps Script.

## Khôi phục thông tin đầy đủ trong tab hồ sơ — 19/10/2026, liveJS150 / entry131

Tab hồ sơ dùng cùng renderer thông tin đầy đủ với drawer: mã hồ sơ, loại/Model/SN/số lượng, GSP/MA, center, bảo hành/người và ngày xác nhận/ghi chú, khách hàng, giao nhận/vận chuyển, dự án, ngày tạo/sẵn sàng trả/trả hàng và tài liệu. Hiện lịch sử công việc có ngày nhận/chẩn đoán/hoàn tất, kết quả và ghi chú; giữ sáu nút thao tác. Render từ getCaseDetail đã tải, không thêm API/poll hoặc thay quyền. Danh sách kết quả tìm kiếm vẫn gọn. entry-workspace v3, fan-warranty CSS v3. Chỉ Pages, không cần Apps Script.

validate và Edge workspace-ui kiểm tra đầy đủ trường chi tiết, hành động và draft/cache/revision. Quy tắc hiển thị bảng S/N Fan: toàn bộ ô của mỗi inverter (S/N + chip bảo hành, Model inverter, Model Fan, số Fan, ghi chú, thao tác) và tiêu đề tương ứng phải trên một hàng; không wrap hoặc đẩy ô xuống dòng thứ hai. Khi hẹp giữ cấu trúc cột và cuộn ngang. Mô phỏng đã kiểm tra tại1920/1366/768px.

Mô phỏng Fan nhiều Model ở thư mục Mo-phong-Fan-2-model-20261019 là artifact riêng dùng dữ liệu giả, chưa triển khai schema, nhập liệu hay KPI theo Model từng S/N.

## Thông báo cập nhật theo nội dung hồ sơ và màu đồng bộ — 19/10/2026, liveJS149 / entry130

Không dùng caseDataRevision của danh sách làm bằng chứng hồ sơ đang xem thay đổi. Workspace ghi snapshot/revision khi đọc chi tiết, poll nhẹ; khi revision khác mới đọc một hồ sơ đang xem và đối chiếu nội dung (bỏ correctionRevision/dataRevision kỹ thuật). Nội dung giống thì xác nhận mốc mới, không hiện thông báo; có thay đổi thật và đang mở form/nháp thì giữ form và báo riêng hồ sơ đó, cache kết quả chờ để không gọi detail lại cùng revision. Hồ sơ sạch nhận nội dung mới tự động. Bỏ qua poll khi đang tải hồ sơ; abort đối soát khi rời, chặn phản hồi cũ, dọn notice lúc park/chuyển view/tải thành công. Không thêm interval, không đổi backend hoặc mutation.

Header nhận trạng thái entry: hoàn tất xanh ok, busy cam kèm Đang đồng bộ, lỗi đỏ; không hiển thị Đã đồng bộ cùng chấm cam. Test portal-header-status chạy cùng validate kiểm tra màu/label/nguồn message; Edge workspace-ui kiểm tra chuyển tab không cảnh báo giả, global revision đổi nhưng hồ sơ không đổi, không lặp đọc, dữ liệu thật không ghi đè nháp, thông báo không tràn sang tab khác, hồ sơ sạch tự cập nhật. Không cần deploy Apps Script.


## Chip bảo hành trong ô S/N Fan theo lô — 19/10/2026, liveJS148 / entry129

Dùng serial-lookup-control/warranty-chip chung như nhập thường: S/N bên trái, chip kết quả và ngày hết hạn bên phải cùng ô; giữ chiều cao42px, thu gọn bằng ellipsis/title khi cột hẹp. Chỉ frontend, không đổi lookup/cache/Model/KPI/parts hoặc backend; không cần deploy Apps Script.


## Tab toàn website và bảo hành Fan — 18/10/2026, backend1.11.8 / liveJS147 / entry128

Tab34px, chữ12px, menu12px/28px, SVG đồng bộ; bỏ footer, không cắt panel. Không giới hạn số tab logic. Dashboard/report/entry/case mọi loại thiết bị dùng chung router; case ID dedup, lịch sửyear-row có tab chỉ đọc từ ticket snapshot. Một iframe nhập liệu, không bootstrap/heartbeat mỗi tab; giữ DOM/form/file nháp, xác nhận đóng chưa lưu; ngữ cảnh sạch giới hạn4 trong bộ nhớ nhưng tab vẫn mở; ngữ cảnh dirty không bị loại. Read chi tiết khi rời bị abort, mutation không replay. Poll nhập liệu tắt khi iframe ẩn, report không chạy dashboard heartbeat. Tab chưa lưu đồng bộ thủ công báo đang sửa, không ghi đè. Đăng xuất clear tab/frame.

Fan thường dùng S/N inverter tra bảo hành nhưng không ghi Model inverter vào Model Fan. Fan theo lô có kết quả lookup dưới từng S/N, gộp trùng và giới hạn concurrency. Backend lookupWarrantyBatch tối đa20, auth trước shared cache5phút; một TextFinder cho tập S/N chưa cache; giữ helper tính ngày/gói/model và API lookupWarranty đơn tương thích. Backend cũ frontend fallback2 lượt đơn đồng thời, không lỗi vì thiếu API mới. Không tự duyệt bảo hành/đổi dữ liệu nguồn; không thay KPI/parts/schema. Cần thay duy nhất Code.gs khi đã1.11.7, Save/New version cùngURL; guide DEPLOY-1.11.8-WORKSPACE-FAN-WARRANTY.md. Backend manual, không coi đã deploy khi chỉ push Pages.

Validation backend toàn hệ thống và warranty-batch; Edge workspace-ui kiểm thử >20tab, Fan/Inverter bản nháp, mở lại cache không đọc, trùng S/N, Inverter tự điền model, Fan giữ mã, báo cáo, một iframe, hidden poll, menu12px và panel viewport. Không load-test nhiều tài khoản thật/không ghi database production.


## Tỷ trọng model Fan theo số Fan — 18/10/2026, backend1.11.7 / liveJS145 / entry126

Bổ sung regression nhánh Fan → Tất cả thiết bị: fixture9Fan+3Inverter=12 số lượng, Fan75%, KPI5Thiết bị/Hồ sơ giữ. Không có nhóm Fan theo lô hoặc đơn vị Thiết bị/Hồ sơ trong biểu đồ mới. Website kiểm tra trảliveJS145; ảnh cũ có16/Thiết bị-Hồ sơ/Fan theo lô cần tải lại frontend, backend cũ hiện thông báo cập nhật ngay tại card. Không đổi code runtime hoặc yêu cầu thêm file Apps Script trong lượt kiểm tra này.

Thay kết luận cũ dùng6hồ sơ Fan làm tổng biểu đồ model. KPI phía trên tiếp tục Thiết bị/Hồ sơ, Fan thường1/lô1. Riêng modelTypes của Tỷ trọng model cộng số Fan vật lý thực nhận theo Model/Mã Fan và kỳ/center/quyền: Fan thường lấy Số lượng nguồn, lô lấy snapshot totals.received. Nhãn Fan | mã model; trống/Fan → Fan | Chưa xác định model. Không suy mã từ inverter hoặc part tiêu hao, không gán ES000173 từ ví dụ. Trường Model cũ lưu model inverter cần quản lý sửa đúng, không auto rewrite. Dropdown tổng và tỷ trọng cùng số lượng vật lý, Fan dùng đơn vị Fan; all dùng Số lượng. Mẫu số giữ cả thiếu model. Models/modelDeviceStats của phân tích duy nhất khác không đổi; KPI/parts/report không đổi. Không thêm nguồn/schema/Sheet scan; modelQuantity là thuộc tính reader.

API marker modelDistributionUnit physical-items tách response mới khỏi backend cũ, card yêu cầu deploy khi backend cũ, tránh gắn nhãn sốquạt cho sốhồsơ. Entry Fan thường/lô cùng nhãn Model/Mã Fan. Test9FanES000173 từ2hồsơ,75%trong12Fan, KPI3Fan-case+2Inverter=5, canceled/date/center/role/parts/warmreads giữ; UI donutFan9 từ thường5+lô4. Apps Script thay Code/Legacy, Save/New version cùngURL, theo DEPLOY-1.11.7-FAN-MODEL-QUANTITY.md. Không sửa dữ liệu production.

## Fan compact tables và danh mục nhập liệu — 18/10/2026, backend1.11.6 / liveJS144 / entry125

Fan summary/work/warranty/return dùng bảng có cùng cột S/N, số quạt lỗi, bảo hành, trạng thái, đã trả/còn lại; scope thêm Chọn52px và Số Fan xử lý/Hoàn tất thêm/Giao lần này. Canh giữa header/cell, row36–43px, sticky header, vùng scroll210–240px; reset width/ẩn cột/mobile rules của case-table thường để không ảnh hưởng bảng Fan. Bỏ help riêng parts; giữ immutable/link receipt. Intake auto count/total tô xám cả khi glass theme bật, không nhập tay; Chưa thêm inverter thay0S/N, hướng dẫn Excel2–3cột và bỏ header, giảm khoảng trống. Chuyển center vẫn whole-case và chỉ Fan còn trong hồ sơ. Desktop hover menus auto-close, keyboard/click/mobile giữ, loading trắng phủ panel, report sync ở phải.

EntrySuggestions.gs chứa catalog thuần giống docs/issue-catalog.js, seed33 tên chuẩn từ44 cách viết Issue1–4 của2024/2025/2026 đọc trực tiếp18/10. API getEntrySuggestions có auth/capability, cache revision, đọc shared issues/parts một lần lazy ở form, không quét lịch sử runtime. PN lấy từ ledger, autofill tên nếu trống, nhớ PN mới sau save thành công; phiên mới lấy theo revision. Legacy group lỗi chuẩn alias cùng catalog, không rewrite nguồn; nhóm Fan/nhiệt độ và trọng số giữ. Lô thiếu model hiện Fan theo lô. Production read-only nguồn raw dates/cancelled/snapshot kiểm tra kỳ1–18/10: received16, Fan4 thường+2lô=6, hai lô9+3Fan/8+2inverter; không sửa KPI6 thành số Fan. Không claim audit toàn bộ SLA/waiting61.

Tests mới entry-suggestions cùng validator; Edge UI kiểm tra table/layout/mobile/return/Excel/readonly/autocomplete/menu/loading/report header, API chuẩn/ledger/KPI filters hiện có giữ. Apps Script manual chỉ thay Code.gs, LegacyDashboardApi.gs và thêm EntrySuggestions.gs sau1.11.5. Chạy kiemTraFanBieuMauChung và kiemTraGoiYNhapLieu trước New version cùngURL; hướng dẫn DEPLOY-1.11.6-FAN-UI-CATALOG.md. Không migration/ghi production. Backend chưa tự triển khai, frontend phải qua Pages CI và kiểm tra static sau push.

## Fan dùng thẻ chức năng và biểu mẫu hiện hành — 18/10/2026, backend1.11.5 / liveJS142 / entry123

Thay hướng nhập Fan riêng bằng extension trên chính openWork/saveWork/openWarranty/openReturn của entry. Fan thường giữ form chung; Fan theo lô thêm bảng chọn một/nhiều S/N, số Fan, cùng GSP/MA/trạng thái/ngày/kết quả/lỗi/parts/SLA và một Lưu cập nhật. Không thêm menu chọn loại thao tác hoặc cụm form bên dưới. Thông tin hồ sơ/tiến độ chỉ hiển thị một lần. Kiểm tra bảo hành chỉ xét linh kiện mới của phạm vi chọn; consumption bất biến từ S/N đã duyệt không chặn kiểm tra ban đầu S/N khác đang chờ duyệt. GSP/MA/chẩn đoán/ghi chú/SLA dùng chung công việc; trạng thái/kết quả/lỗi áp dụng S/N chọn. Parts là tổng thực dùng của lần lưu, ghi vào ledger hiện hành, không nhân S/N/Fan. Dòng parts/lỗi đã journal giữ nguyên để đối soát; chọn Liên kết cho consumption cũ, thêm dòng cho thực dùng mới. Sửa metadata Fan mở lại thẻ quản lý chuẩn nhưng khóa định danh/số Fan/mốc ngày nguồn. Bảo hành và giao trả thêm chọn nhiều S/N; luân chuyển/nhận hàng vẫn whole-case vì một current center.

Code route các API chuẩn sang FanWorkOrders.gs khi case là lot. WorkOrderRules bổ sung loại đổi Fan; khi cần mở rộng dropdown chỉ thêm Fan ở ô đích qua helper validation sẵn có, không xóa rule/đổi lookup chung. Bảo hành hỗn hợp lấy nhãn theo snapshot, không ghi nhãn tổng hợp ngoài enum vào cột nguồn. Một Sheets batch ghi toàn bộ mục/selected lines, technical/return journal con + một receipt root, giữ schema/tabs/IDs/legacyImport, CAS, quyền, ngày, pending/retry/readback. FanLots central sync guard kiểm tra pending receipt/state/work/parts trước khi bỏ chặn. Không gọi API từng S/N, không thêm scans tab lịch sử hoặc reader/KPI mới; index/projection/revision vẫn qua flFinishSync. KPI vẫn Fan thường1 / lô1, full completion/return mới tính1 hồ sơ; physical Fan giữ riêng. Các bộ lọc ngày/center/model/type/search và parts cùng readers hiện hành.

Validation mới theo dữ liệu đã ghi trong fixture qua API chuẩn → readers dashboard: đang sửa vẫn dùng parts, nhiều S/N, một batch, negative/stale/outside-center, đổi Fan liên kết ledger, lỗi ghi/unknown outcome/retry receipt/pending readback, hoàn tất và trả từng phần/toàn bộ; parts14 ở Sungrow /7 ở DAT, ngày16=10/ngày17=4, KPI Sungrow4 gồm lot1 + Fan thường1 + Inverter2. Đây là số kiểm thử, không phải số production. Browser chạy UI thật xác nhận một form/nút lưu/bảng parts, giữ Inverter/Fan thường, scope bảo hành/giao trả, model Fan2 và center filter, mobile. Auth/transport/polling hiện hành giữ nguyên.

Triển khai: năm Apps Script file Code.gs, WorkOrderRules.gs, FanLots.gs, LegacyDashboardApi.gs (đồng bộ version, không đổi reader) và module mới FanWorkOrders.gs; quy trình cụ thể DEPLOY-1.11.5-SHARED-FAN-FORMS.md. Backend capability fanSharedForms chỉ true khi đủ module/rules/FanLots receipt guard và dashboard release marker; thiếu rules vẫn trả capability false, không làm lỗi bootstrap; web giữ luồng đang chạy nếu backend chưa sẵn sàng. Sau New version cùng URL cần Ctrl+F5/login mới. Không migration hoặc ghi thử production. Chưa xác minh backend1.11.5 production cho đến khi người dùng deploy thủ công.

## Bỏ thao tác trùng ở tóm tắt lô Fan — 18/10/2026, liveJS140 / entry121

Khung tóm tắt lô chỉ hiển thị số Fan, S/N và tiến độ. Bỏ nút Tiến độ / Linh kiện / Tài liệu / Lịch sử vì mở trùng màn hình Cập nhật công việc. Hàng thao tác nghiệp vụ hiện hành và phân quyền giữ nguyên; lịch sử/tài liệu vẫn trong chi tiết và màn hình cập nhật. Không đổi dữ liệu, KPI, backend hoặc cách ghi linh kiện. Cache core5; phát hành Pages, không deploy Apps Script. Kiểm tra browser hiện có mở lô bằng nút Cập nhật công việc của hồ sơ có công việc được phép cập nhật, thay vì gọi trực tiếp hàm Fan.

## Biểu mẫu Fan gọn và một nơi nhập linh kiện — 18/10/2026, liveJS139 / entry120

Lựa chọn Một inverter / Theo lô nằm ngang cùng ô Loại thiết bị, không đẩy giãn cả hàng của grid tiếp nhận. Cập nhật lô dùng một editor chọn S/N, số Fan, kết quả, ngày, ghi chú; bỏ bảng cập nhật rộng và các panel spare part từng dòng, bỏ form part riêng. Linh kiện sử dụng dùng lại partRow và row-list.parts/column headers của thiết bị thường. Lưu cập nhật gửi technical cùng parts[]/partUsageIds bằng updateFanLot hiện hành; nút Chỉ lưu linh kiện giữ hành vi part cũ (một dòng mỗi lần), hỗ trợ S/N hoặc chung lô mà không tăng hoàn tất kỹ thuật. Không thêm API, không sửa backend/schema/ledger/KPI. Nháp tách theo S/N, giữ nháp chưa lưu của dòng khác sau khi lưu; snapshot fingerprint vẫn kiểm soát xung đột. Khóa tương tác lúc đang gửi và giữ requestId khi thử lại cùng nội dung. Thông tin chung/lỗi/SLA/bảo hành/tài liệu thu gọn; mở tài liệu trực tiếp thì mở đúng phần. Nhãn nguồn chuyển đổi nói rõ lô hiện tại tính1 hồ sơ, không hiển thị trọng số nguồn cũ như KPI hiện hành. Browser chạy web thật với fixture: intake cùng hàng, một parts editor, đổi S/N, nháp sau lưu, lỗi/thử lại cùng receipt, payload technical và part-only theo S/N/chung lô, backend gate, lazy reads và desktop/mobile. Chỉ phát hành GitHub Pages, không yêu cầu deploy Apps Script hoặc migration. Cache native4/core4/CSS3.

## Khôi phục khởi tạo bridge — 18/10/2026, liveJS138 / entry119 / transport2

Tái hiện trên production: cùng deployment hợp lệ có lần handshake quá20s dù wrapper Google trả200; lần tiếp theo ready3338ms và RPC1838ms. Client cũ hủy frame sau20s và cache lỗi5s, khiến các retry700/1800ms tiếp tục dùng lỗi cũ. Nay prewarm không credentials khi trang sẵn sàng; sau12s chưa ready mở thêm đúng một frame dự phòng và giữ frame đầu. Ready hợp lệ đầu tiên thắng, xóa frame còn lại, rồi mới gửi API. Tổng hạn32s; lần đăng nhập tiếp theo tạo kết nối mới ngay khi cả hai thất bại. Chỉ initializer quản lý retry; BRIDGE_UNAVAILABLE không bị dashboard retry thêm. Production vẫn bridge bắt buộc, không REST fallback, không replay save; không sửa backend/dữ liệu/KPI và không cần deploy Apps Script. info thêm attempts. Probe client mới trên tên miền thật: attempts2, ready14221ms, RPC1267ms, phản hồi từ dispatcher bằng phiên giả; không dùng credential thật hoặc ghi dữ liệu. Node kiểm tra cả frame đầu đến muộn, frame dự phòng thắng, hết hạn hai frame, reconnect ngay, auth/origin/concurrency/no-replay; browser fixture cho frame đầu treo và xác nhận dashboard/entry hoạt động qua frame thứ hai.

## Đồng hồ đồng bộ và danh sách đang xem — 17/10/2026, liveJS137

Ảnh người dùng cho thấy Đã đồng bộ21:20 trong khi đồng hồ21:31. Header trước đây lấy sourceUpdatedAt trong response cache; không phải thời gian browser vừa kiểm tra. loadLive còn báo xanh trước khi tải xong tickets.page. Sửa markDashboardSynced dùng thời gian hoàn tất nhận dữ liệu/kiểm tra revision thành công; không chạy đồng hồ giả theo từng giây. Chờ danh sách đang xem hoàn tất và giữ trang hiện tại; lỗi danh sách không xác nhận đồng bộ. Revision so với live.source.revision, chỉ acknowledge sau tải thành công để lỗi tải không làm bỏ lỡ revision. Poll không đổi phiên bản chỉ kiểm tra nhẹ và cập nhật mốc kiểm tra; không che lỗi danh sách đang hiện. Giữ polling60–75s và làm mới5phút khi tab hiển thị, không phải push realtime. Không đổi backend/cache/quy tắc dữ liệu. Apps Script vẫn1.11.4 và bridge bắt buộc, không cần deploy lại. Node regression tái hiện cache21:20 nhận21:31, chờ list/fail/preserve page/retry revision; CI chạy cùng validator.

Định nghĩa Fan đã được người dùng làm rõ: thiết bị là inverter. Một hồ sơ Fan nhập thường thuộc một inverter nên tính1 thiết bị, dù số Fan là2/3/5; mỗi lô nhiều inverter tính1 hồ sơ. Không dùng số Fan nhập thường làm số thiết bị KPI.

## Bridge production đã xác minh, tắt REST fallback — 17/10/2026

Người dùng xác nhận transport ready/version1.11.4, readyMs11062/lastRpcMs3408. Probe từ trình duyệt sạch trên tên miền production bằng phiên giả: 3 roundtrip tới dispatcher trả đúng lỗi phiên không hợp lệ (không dùng tài khoản hoặc ghi dữ liệu); tổng9563ms gồm handshake7780ms, sau đó1835ms/1779ms. Không có ContentService POST từ ứng dụng, không có CORS; active0/queued0/lastErrornull. Đây là bằng chứng transport/auth boundary hoạt động, không phải benchmark dashboard có đăng nhập.

config.js đặt appsScriptTransport: bridge; index/entry nạp config?v=2. Handshake lỗi sẽ báo lỗi có giới hạn thời gian và có thể kết nối lại ngay ở lần thử tiếp theo (cơ chế18/10 thay cooldown5s); không quay lại fetch ContentService. Node regression bắt buộc production config dùng bridge và kiểm tra strict mode không fallback. Giữ backend1.11.4, không deploy Apps Script lần nữa, không sửa dữ liệu. Phần yêu cầu deploy/xác minh của mục trước đã hoàn tất.

## Kết nối ổn định qua HTMLService — 17/10/2026, 1.11.4-stable-transport

Sự cố thực tế: ContentService redirect echo/exec gây CORS và request kéo dài dù Editor dashboard-build 878ms/cache181ms. Thêm PortalBridge.html, route GET portal_bridge trong Code.gs và portalBridgeCall trả chuỗi JSON từ dispatcher API hiện hành. Không đổi xác thực/whitelist/schema/nghiệp vụ. postMessage khóa origin chính xác, channel crypto48hex, Google sandbox origin và ancestry/source; credentials chỉ nằm trong payload, không ở URL/log. Dùng google.script.run để tránh cross-origin ContentService fetch. Dashboard/entry chia sẻ một kết nối, giới hạn4 call, hủy caller không giải phóng slot server đang chạy cho đến khi nhận phản hồi. Không retry/replay mutation sau dispatch; chỉ fallback REST nếu handshake chưa thành công, chưa gửi API, cho deployment cũ. Strict mode appsScriptTransport=bridge chặn fallback hoàn toàn sau rollout. Timeout vẫn cần thiết vì Google có thể gián đoạn; không cam kết uptime bên thứ ba.

Ẩn dữ liệu mẫu trước lần tải thành công; hiện lỗi đồng bộ thực tế, giữ lần dữ liệu thật gần nhất nếu lần làm mới lỗi. liveJS136/entry118/transport1, Code/Legacy1.11.4. Apps Script cập nhật thủ công Code.gs, LegacyDashboardApi.gs, thêm HTML PortalBridge; New version cùng URL theo DEPLOY-1.11.4-STABLE-TRANSPORT.md. Không migration/rebuild/index writes. Node regression bridge/auth/origins/queue/cancel/no-replay/large upload + browser actual portal nested Google iframe passed; CI chạy validator trước Pages deploy. Cần deploy Apps Script rồi xác nhận roundtrip production mới hoàn tất rollout; fixture browser không thay thế kiểm tra production.

## Đơn vị KPI Fan thống nhất — 17/10/2026, 1.11.3-fan-kpi

Fan thường tính 1 thiết bị/hồ sơ nguồn còn hiệu lực; mọi lô Fan, kể cả lô chuyển đổi, tính 1 hồ sơ. Thiết bị khác giữ số lượng hiện hành. Canonical/manager readers cùng quy tắc cho KPI, center/model, lũy kế, SLA và báo cáo. receivedCases đếm hồ sơ vận hành, không cộng các nguồn đã lưu mềm. Bỏ dòng Fan theo lô trên bốn thẻ KPI, giữ Thiết bị/Hồ sơ; số Fan thực tế chỉ dùng cho chi tiết/vận hành. legacyImport.kpiQuantity/sourceCaseCount cũ giữ nguyên làm chứng từ nguồn, không làm trọng số KPI. Không sửa dữ liệu nguồn, không chạy lại migration; spare part cùng ledger và số thực dùng. Migration tương lai báo rõ KPI trước số nguồn/sau số lô, không giả định bằng nhau. Code/Legacy1.11.3, liveJS135/entry117/rules4; tăng version cache, không thêm scan/read. Apps Script cập nhật thủ công 5 file theo DEPLOY-1.11.3-FAN-KPI.md. Phần quy tắc KPI 1.11.2 bên dưới là lịch sử và đã được thay thế bởi mục này.

## Kiểm tra khai báo chung Apps Script — 17/10/2026

LegacyDashboardApi dùng hằng nội bộ LEGACY_API_VERSION trong wrapper LEGACY_DASHBOARD_API; chỉ Code.gs khai báo APP_VERSION. Giữ phiên bản 1.11.2 và nguyên quy tắc dữ liệu. Validator biên dịch ghép toàn bộ module Script trong cùng phạm vi để phát hiện trùng khai báo trước khi giao. Khi gặp lỗi APP_VERSION already declared, thay toàn bộ LegacyDashboardApi.gs gồm dòng mở/đóng wrapper, không nối code vào cuối file cũ; Save và chạy lại trước khi tiếp tục deploy/chuyển Fan. Không có mutation dữ liệu trong bản sửa này.

## Chuyển nhóm Fan cũ thành lô thật — 17/10/2026, 1.11.2-fan-legacy

FanLegacyMigration.gs là module Editor, nhận rõ mã nhóm; preview khóa fingerprint/revision trong 30 phút, chỉ chuyển Fan Quy trình mới chưa xử lý/chưa giao và không có linh kiện/lỗi xác nhận/luân chuyển/tạm dừng. Một case nguồn làm lô, nguồn khác giữ hàng và lưu mềm với liên kết cha, không xóa vật lý. Giữ work ID/ghi chú/hiện tượng ban đầu và tài liệu ở folder gốc; model inverter và bảo hành từng nguồn nằm trong legacyImport. S/N lặp cộng lượng, không suy PN. Nguồn có hoạt động khác bị chặn để xử lý riêng.

legacyImport giữ kpiQuantity và sourceCaseCount theo nguồn; parse kiểm tra cân bằng. LegacyDashboardApi/ManagerDashboard dùng trọng số này cho lô chuyển đổi, trong khi lô tạo mới vẫn tính 1. Dashboard receivedCases giữ số nguồn; tổng physical Fan riêng. Không ghi thêm spare part khi chuyển. Nhóm có Hồ sơ lô Fan mở native lot; tra mã nguồn cũ về cha, index search có mã/model nguồn. liveJS134/entry116, Fan rules/core/native3 (CSS2).

Ghi nguồn/works/nhóm/nhật ký migration trong một Sheets batch sau backup toàn database và biên nhận snapshot riêng trên Drive. Pending/retry không ghi lặp, readback kiểm tra nguồn/works/KPI, sync projection/index tất cả case, bump revision, audit. Hàm áp dụng đòi đăng nhập quản lý trên backend mới trong 30 phút để tránh chạy chuyển đổi trước khi deploy quy tắc KPI mới. Wrapper theo nhóm thật và snapshot live nằm outputs local, không đưa dữ liệu nguồn vào Git. Tại lúc phát triển mới đọc/preview production, chưa thực thi chuyển đổi production; Apps Script do người dùng cập nhật và chạy thủ công.

## Fan và spare part dùng chung hệ thống — 17/10/2026, 1.11.1-fan-spare-parts

Kết quả kỹ thuật Fan có thể ghi nhiều PN/số lượng thực dùng/ngày sử dụng, hoặc liên kết mã sử dụng đã có của chính công việc. Đổi Fan bắt buộc có spare part mới hoặc đã ghi nhận; sửa bảo hành cũng ghi được linh kiện ngay cùng lần lưu. Ghi thẳng Linh kiện sử dụng với Mã công việc hiện hành trong cùng atomic batch với tiến độ/nhật ký; retry/CAS/pending giữ nguyên. Không thêm bảng tiêu hao, không tính tổng từ nhật ký Fan, không nhân lượng linh kiện theo Fan/SN/hồ sơ. Dashboard tiếp tục dùng groupPartsForPeriod_ trên canonical parts; Fan thường, Fan cũ, Inverter và lô mới cộng chung theo PN/ngày dùng/center. Đối soát nhật ký với nguồn linh kiện kiểm tra ID, work, PN, lượng và ngày; liên kết bản ghi cũ không append lần nữa.

Bỏ ô Loại đổi độc lập. Cột Spare part sử dụng mở phần nhập bằng cùng partRow như form kỹ thuật hiện hành; chọn linh kiện đã có để tránh nhập lại. 20 dòng cho mỗi lần lưu. Frontend capability fanLotPartsWithTechnical chặn lưu kỹ thuật khi backend cũ chưa hỗ trợ, tránh bỏ sót payload parts. liveJS133/entry115, Fan CSS/rules/core/native2. Apps Script cập nhật thủ công theo DEPLOY-1.11.1-FAN-SPARE-PARTS.md; schema vẫn fan-lots-1, không cần migration số liệu cũ.


## Fan theo lô — 17/10/2026, 1.11.0-fan-lots

Bảng cập nhật S/N đặt Kết quả và Loại đổi ở hai cột cùng hàng; Loại đổi chỉ hiện khi đổi thiết bị. Dấu phân cách thông tin trên toàn portal dùng |; giữ nguyên dấu thập phân và dữ liệu nguồn. MobileJS4, notificationsJS8, reportsJS3. Frontend liveJS132/entry114, Fan UI/rules/native CSS/JS1, uploadJS9, attachmentUI2, formDrafts4. Giữ tên đơn vị KPI Thiết bị/Hồ sơ và bố cục portal/drawer/update hiện tại. Fan tạo mới có nhập thường hoặc lô; S/N lặp cộng số Fan. Snapshot schema/revision trong hai cột bổ sung ở cuối nguồn, nhật ký thao tác và nhóm liên kết ở hai tab mới. Giới hạn120 dòng/42k ký tự. Không ghi tab lịch sử. Hồ sơ thường giữ số lượng; lô mới tính1, lượng Fan vật lý và các lần hoàn tất/giao theo ngày được thống kê riêng, cùng quy tắc Excel. Linh kiện thực dùng theo ngày/phạm vi, không nhân Fan.

Code/Legacy1.11.0, bổ sung FanLotRules/FanLots, giữ các module hiện hành. Tạo lô ghi case/work/hiện tượng ban đầu trong một batch; cập nhật snapshot/nhật ký/linh kiện theo transaction, idempotency + CAS + ScriptLock, chặn pending khi projection/index lỗi và tăng revision. Nhóm cũ chỉ thêm liên kết, bảo toàn nguồn/KPI, fingerprint trước áp dụng. Editor setup/enable/disable/audit kiểm tra quản lý qua PortalReadDiagnostics. Tìm S/N mở rộng chỉ mục, không quét lịch sử hoặc hydrate chi tiết trên danh sách; canonical cache theo revision; lịch sử chỉ hydrate30 dòng/trang. File ban đầu chung/theo S/N có phạm vi trước upload; các file thực tế vẫn ở folder case. Lưu nháp nhận/cập nhật có key actor/case/kind và fingerprint nguồn, không tự ghi lại mutation.

Frontend có capability gate: chưa deploy/bật backend thì không cho tạo lô. Apps Script do người dùng cập nhật theo version final/DEPLOY-1.11.0-FAN.md: copy module, enable Sheets API, chuanBiFanTheoLo tạo backup/schema và kiểm tra nguồn, audit/perf, batFanTheoLo, New version cùng URL. Chưa chạy setup, nhập nhóm hoặc mutation production trong quá trình phát triển. Không rollback backend cũ sau khi đã có dữ liệu lô.



## Mã hồ sơ chỉ trong Chi tiết thiết bị — 14/10/2026

Frontend liveJS129/entry111/exact-case-search JS2: bỏ mã hồ sơ khỏi bảng danh sách, tiêu đề kết quả cập nhật và lựa chọn lần tiếp nhận khi S/N trùng. Giữ trường Mã hồ sơ trong detail-grid; caseId tiếp tục là khóa nội bộ và có thể tìm chính xác. Không đổi backend/database; phát hành cùng sửa hiển thị SĐT.

## Hiển thị số điện thoại mất số 0 — 14/10/2026

Frontend liveJS129/entry111: displayPhone thêm0 cho giá trị thuần9chữ số bắt đầu3/5/7/8/9 trong detail khách/giao nhận, customer picker/list suggestions, prefill sửa hồ sơ và giao trả. Giữ số đã có0, +84/84, số quốc tế/định dạng khác và trống. Input tel/FormData giữ chuỗi đã nhập. Chỉ format frontend, không đổi API/Apps Script/cột/dữ liệu Sheet; không khẳng định sửa nguồn lưu trữ hoặc phục hồi mọi số điện thoại có độ dài khác. VM kiểm tra helper/render/prefill và validate đạt; chỉ deploy web.


## Đồng bộ phiên bản backend tìm hồ sơ — 14/10/2026

APP_VERSION trong Code.gs và LegacyDashboardApi.gs là 1.10.25-exact-case-search. Cập nhật hai kiểm tra version và hướng dẫn DEPLOY-EXACT-CASE-SEARCH.md: thay cả hai file, Save/New version trên cùng URL. Không đổi frontend/database hoặc logic nghiệp vụ trong lần sửa nhãn này. Backend vẫn cần deploy thủ công.


## Tìm chính xác S/N/mã hồ sơ và hiển thị mã — 14/10/2026

Frontend liveJS128/entry110/exact-case-search JS1: tìm update/transfer bằng S/N hoặc mã hồ sơ đầy đủ, exact/case-insensitive/trim; một kết quả render đầy đủ, nhiều lần tiếp nhận chọn ngày/center/trạng thái rồi hydrate một hồ sơ. Backend Code.gs searchCases optional exactKey dùng chỉ mục một lần để lọc, authenticate một lần, chỉ hydrate nếu total=1; caller cũ giữ array. Frontend fallback backend cũ kiểm tra mọi trang chỉ mục, tránh cap20 làm mất exact hit. Guard duplicate/account/stale response, lỗi retry. Mã hồ sơ thêm vào bảng danh sách, detail-grid và kết quả cập nhật; drawer chuyển sang update/transfer bằng caseId để tránh tìm lại S/N trùng. Không schema/migration/mutation. Backend phải copy Code.gs, Save/New version cùng URL theo DEPLOY-EXACT-CASE-SEARCH.md; chưa tự deploy Apps Script. Regression exact/duplicates/permissions/canceled/unique one-call/paging/race/retry và validate; chưa đo latency production.


## Chi tiết thiết bị giữ layout cũ, bỏ thông tin trùng — 13/10/2026

Frontend liveJS127/entry109: khôi phục detail-grid phẳng hai cột như layout cũ, bỏ nhóm/accordion mới. Ngày nhận từ khách/Người tạo hồ sơ dùng nhãn rõ; giao nhận dùng Công ty/Người liên hệ/Địa chỉ giao nhận, không lấy tên khách hàng điền thay người liên hệ. Nơi gửi hàng chỉ hiển thị khi không trống và khác tên khách/người liên hệ sau chuẩn hóa NFC, khoảng trắng và hoa thường; giữ giá trị khác của dữ liệu cũ. Giá trị thiếu vẫn --. Chỉ render frontend, không đổi database/API/form tạo/logic lưu. Kiểm tra render trùng/khác/thiếu và layout desktop/mobile; validate đạt. Không Apps Script.

## Giá trị chưa nhập trong Chi tiết thiết bị — 13/10/2026

Frontend liveJS126/entry108: giá trị thiếu/null/chuỗi trống trong drawer hiển thị --, gồm thông tin giao nhận, email, người/ngày xác nhận bảo hành, ngày/kết quả kỹ thuật và tài liệu Drive. Giữ các trạng thái nghiệp vụ thực tế Mới tiếp nhận/Chờ xác nhận/Đã nhận hàng; summary giao nhận không thêm chữ Chưa nhập. Chỉ cách hiển thị, không ghi -- xuống database, không thay đổi API hay nhập liệu. Render kiểm tra hồ sơ mới và validate đạt; không Apps Script.

## Làm rõ Chi tiết thiết bị, giữ cách lưu hiện tại — 13/10/2026

Frontend liveJS125/entry107: drawer chia Thiết bị và tiếp nhận / Thông tin khách hàng / Thông tin giao nhận / Bảo hành và thông tin hồ sơ. Nhãn Ngày nhận từ khách, Center tiếp nhận ban đầu, Center đang giữ thiết bị, Người tạo hồ sơ. Giao nhận dùng nhãn trung tính Công ty/Người liên hệ/Địa chỉ giao nhận, có chú thích được cập nhật khi giao trả; không tự suy đoán gửi/nhận cho dữ liệu cũ. Không lấy item.sender thay người liên hệ; Nơi gửi hàng hiển thị riêng cùng thông tin khách. Giao nhận trống mặc định thu gọn và báo Chưa nhập, có dữ liệu mở sẵn. Không đổi API/cột/database/form tạo/lưu/luân chuyển/Drive; chỉ frontend. Kiểm tra render thiếu/có dữ liệu, desktop/mobile và validate đạt; không Apps Script.

## Sửa dashboard mobile với bộ lọc hiện hành — 13/10/2026

Frontend liveJS124/entry106/mobile-ui CSS4 JS3: CSS mobile tải sau period/glass/compact để không bị desktop override. Toolbar chia dòng segments/picker/center/compare, controls16px và nút44px; summary lấy range hiện hành và comparison. Chi tiết center hai cột với nhãn SLA/TAT đúng, ghi chú wrap, KPI hai cột cả360px. Annual SVG có stroke/fill rõ và legend màu; donut112px với hole thật, model buttons/legend styles đầy đủ trên mobile. Giữ preview5/Xem thêm nhưng selector hidden đủ mạnh, list scroll320px/center380px, footer nền sáng. Kiểm thử dùng actual CSS/JS + dữ liệu giả (khác test mobile cũ đã strip scripts): tái hiện toolbar155px chứa picker260px và8cột trước sửa; sau sửa360/390/430, range/calendar, mở center, preview, glass và desktop đạt; mobile-layout và validate đạt. Chỉ frontend, không Apps Script hay dữ liệu.

## Mở rộng tên lỗi xác nhận — 13/10/2026

Frontend liveJS123/entry105: ô Tên lỗi chiếm cả cột trống phía số lượng linh kiện, giữ nguyên vị trí cột mã/ngày/Xóa/Thêm. Mobile reset span về auto. Chỉ CSS/cache, không đổi nghiệp vụ hoặc Apps Script. Cập nhật kiểm thử bố cục theo yêu cầu tên lỗi rộng hơn; validate và kiểm tra trình duyệt đạt.

## Ngày sử dụng linh kiện hiển thị và canh cột — 13/10/2026

Frontend liveJS122/entry104/work-order-rules JS2/work-order-locks JS2/form-drafts JS3: mỗi linh kiện có ô Ngày sử dụng để xem/sửa ngày cũ; gửi đúng ngày từng dòng, bỏ data-used-at ẩn. Để trống dùng ngày hoàn tất kỹ thuật khi lưu theo cơ chế hiện hành. Lỗi ngày ghi rõ Part Number. Shared grid canh mã/tên/ngày/Xóa/Thêm giữa lỗi và linh kiện, ô số lượng riêng; responsive hai cột. Nháp capture/restore ngày mới, nháp cũ dùng fallback dataset. Không bỏ kiểm tra ngày tương lai hoặc tự sửa ngày lịch sử. Edge regression kiểm tra sửa ngày kế thừa, payload, nháp, độ rộng/vị trí cột và mobile; rules/validate đạt. Backend local Code/Legacy1.10.24 + WorkOrderRules có nhãn lỗi chi tiết; copy ba file theo DEPLOY-1.10.24.md, không migration. Frontend phát hành độc lập; backend1.10.23 vẫn nhận trường usedAt hiện hữu.

## Khóa chéo cập nhật công việc — 13/10/2026

Frontend liveJS121/entry103/work-order-rules JS1/work-order-locks JS1 dùng hợp đồng chung với WorkOrderRules.gs: active workflow khóa outcome/completion/replacement, technical_done bắt buộc outcome+date, exchange bắt buộc type; pending warranty khóa parts/final, controlled transfer/closed không chọn mới, closed case khóa status. Ngày thực tế không future/VN, chronology received→diagnosis→technical, parts/holds/issues preflight. Giữ dữ liệu cũ mâu thuẫn, chặn gửi và cung cấp reset có xác nhận; nháp restore re-lock, không silent clear. Backend local Code/Legacy1.10.23 gọi rules trước write/ensure columns, state-ready chỉ từ technical terminal+outcome+date; regress active bỏ readyDate cũ, delivered giữ closed. Unit zero-write/matrix và UI actual form đạt, validate đạt. Frontend publish; backend cần copy Code/Legacy/thêm WorkOrderRules theo DEPLOY-1.10.23.md, giữ các module trước, không migration/auto repair data cũ.

## So sánh năm đúng kỳ và đóng flyout khi mở noti — 13/10/2026

Frontend liveJS120/dashboard-period JS5: mode Năm chọn/khóa comparison year, dịch cả hai mốc lùi12 tháng (YTD so với cùng ngày năm trước, không dịch1 tháng); rời Năm trả month, render labels/titles và không cho legacy control đổi nhãn option. Không sửa KPI/backend/data. openEntryView trên compact rail đóng subnav thay vì tự mở; notification vẫn mở đúng drawer, mobile giữ accordion. Regression UI kiểm tra khoảng và API comparison request, menu không hiện khi click noti; validate đạt. Chỉ frontend.

## Icon xoay cho cả kiểm tra tự động — 13/10/2026

Frontend liveJS119/entry102: đếm in-flight getBootstrap/getPortalSyncState/listCases, publish busy qua aria-busy iframe và giữ icon disabled/animation cả khi polling revision không đổi text; finally giảm đếm, manual sync giữ busy đến cuối. Dashboard polling cũng xoay icon. Không tăng polling/request, không xoay khi idle; lỗi/cancel trả trạng thái dừng. Regression sync routing/transport và validate đạt; chỉ frontend.

## Icon đồng bộ xoay trong phần nhập liệu — 13/10/2026

Frontend liveJS118/entry101: parent khóa icon ngay khi gửi sync và giữ disabled khi trạng thái iframe bắt đầu Đang (dùng animation Dashboard hiện có); child báo loading từ đầu bước refreshCatalog đến loadCases, chặn manual sync trùng, finally/error/đang mở editor trả trạng thái dừng. Không đổi API/cache/dữ liệu hoặc tạo thêm request. Kiểm thử sync routing và validate đạt; chỉ frontend, không Apps Script.

## Bổ sung đính kèm và vùng kéo-thả theo nhóm — 13/10/2026

Frontend liveJS117/entry100/case-uploads JS8 CSS5/attachment-ui JS1/supplement-attachments JS1: năm vùng nhóm chọn/kéo-thả/paste file; danh sách cuộn220px/group, icon xem/tải/Xóa, tên wrap đủ. Tái dùng cho tiếp nhận và Bổ sung đính kèm dưới Tài liệu thiết bị trong drawer; capability gate bootstrap/canSupplement. Tải staging rồi Lưu vào hồ sơ, giữ localsession trước request, restore+retry, busy chặn đổi/đóng/rời trang, commit lỗi giữ files. Backend local Code/Legacy1.10.22 + TemporaryUploads + SupplementalAttachments.gs: canonical folder scoped/ancestry, quyền updateWorkOrder/current center/editable work/closed global only; session ràng buộc case/owner/center/folder, file move idempotent, journal lease/receipt, không overwrite, validate lại dưới lock và từng file, Drive ngoài lock. Audit Bổ sung đính kèm dùng existing case_updated recipients, targeted audit id chặn duplicate, sync projection/index/revision. Unit/UI/validate đạt local; backend chưa deploy tự động, cần copy bốn file theo DEPLOY-1.10.22.md; giữ PortalSessions/Notifications và module hiện hành, không migration/schema/source test writes.

## Chọn center không kiểm tra phiên trống, một spinner — 12/10/2026

Frontend liveJS116/entry99/case-uploads JS7: chỉ persist phiên với uploadStarted=true ngay trước beginCaseUpload để giữ retry khi mất ack; chọn/đổi center chưa upload không lưu phiên hoặc gọi API. Legacy chưa có flag vẫn kiểm tra một lần; getCaseUploadSession đọc metadata trước, getCreationStatus chỉ khi missing/CLAIMED để bảo vệ hồ sơ đã tạo. OPEN không scan bảng hồ sơ. Phiên empty xác nhận xong xóa local, lỗi mạng giữ nguyên. Loading decorator chỉ xử lý node status/loading phù hợp, bỏ spinner ancestor có status con; regression no-read/legacy/network/race và DOM một spinner đạt. Chỉ frontend, không cần deploy Apps Script.

## Nhóm Hình ảnh tại center — 12/10/2026

Frontend liveJS115/entry98/case-uploads JS6 thêm centerPhotos: Hình ảnh tại center ở toolbar và dropdown file đã tải. Backend TemporaryUploads.gs chấp nhận nhóm mới, prefix 05_Hinh anh tai center khi gắn hồ sơ; giữ các prefix cũ. Cần thay TemporaryUploads.gs và Save/New version cùng URL để dùng nhóm mới; frontend publish riêng.

## Đính kèm gọn, TXT/CSV và bỏ mức 8 MB/10 file — 12/10/2026

Frontend liveJS114/entry97/case-uploads JS5 CSS4 dùng một toolbar chọn nhóm/Thêm file; hàng file gồm tên/trạng thái, dropdown nhóm và Xóa cùng cao; list max280px desktop/320px mobile cuộn riêng, progress chỉ lúc chưa xong. Không giới hạn số file, size hoặc một mẫu sự cố ở frontend. Backend TemporaryUploads.gs bỏ cùng giới hạn, thêm TXT/CSV; journal lớn chia Script Properties với publish pointer sau cùng/rollback và đọc tương thích journal cũ. Không bỏ quyền/center/idempotency/expiry/cleanup. Giới hạn thực tế Apps Script/Drive/browser/transport120s vẫn có, chưa resumable upload. Backend chưa deploy tự động: chỉ thay TemporaryUploads.gs, Save/New version cùng URL theo DEPLOY-UPLOAD-FLEXIBLE.md; không migration/Sheet writes. Kiểm thử backend9MB/12file/150metadata/rollback và UI14file desktop/mobile, Xóa/category/scroll/alignment.

## Khôi phục đính kèm khi đổi trung tâm — 12/10/2026

Frontend liveJS113/entry96/case-uploads JS4: mã phiên lưu local nhưng chưa upload không còn khóa picker khi getCaseUploadSession báo không tìm thấy; giữ cùng sessionId/requestId để beginCaseUpload kiểm tra quyền/center và khôi phục khi chọn file. Không tạo phiên/Drive lúc chỉ chọn center. Lỗi mạng giữ khóa và hiển thị lỗi/nút kiểm tra lại ngay cạnh file; trạng thái đang kiểm tra có thông báo, chặn submit/chọn file trong lúc restore. Guard epoch giữ phản hồi center cũ không đè center mới. Regression upload-restore kiểm tra missing/network/OPEN/CLAIMED/race. Chỉ frontend, không cần deploy Apps Script.

## Phiên đăng nhập cố định 8 giờ — 12/10/2026

Frontend liveJS112/entry95/session-client JS1 trao đổi Google credential còn hạn qua createPortalSession khi bootstrap.portalSessions=true; token CSPRNG256-bit, sessionStorage của tab, reload/iframe dùng chung, không tự gia hạn/không lưu URL/localStorage. Backend local Code/Legacy1.10.21-eight-hour-session + PortalSessions.gs lưu hash/bản ghi expiry8h trong Script Properties, xác thực mỗi request bằng record+quyền Người dùng hiện tại, tombstone logout chặn retry hồi sinh, cleanup prefix riêng/cap1000; không source/schema/KPI/projection writes. Sửa Google actor cache không vượt exp; bind GoogleSub chỉ trong login Google, không bằng session. Logout ẩn/clear local ngay, thu hồi server, mạng lỗi báo chưa xác nhận; standalone có logout. Unit/client/browser/validate đạt: after1h/boundary8h/revoke/crossidentity/role/disabled/tab/iframe/reload/legacy fallback. Frontend publish; backend chưa deploy từ Codex, cần thay Code.gs/LegacyDashboardApi.gs và thêm PortalSessions.gs, Save/New version cùngURL theo DEPLOY-1.10.21.md. Portal cũ vẫn~1h đến khi backend sẵn sàng; Apps Script HTML trực tiếp cũ chưa đổi UI.

## Popup thông báo icon và cuộn riêng — 12/10/2026

Frontend liveJS111/entry94/notifications JS7/CSS6: một hàng icon unread/history/filter/read-all/reload cạnh title/close, SVG nội bộ có title/aria/focus/pressed; filter mặc định ẩn, mở theo nhu cầu, chấm cam khi có lọc. Giữ menu lọc có label và toàn bộ hành vi cũ. Popup max440px/viewport, vùng items cuộn riêng max320px/flex-shrink, header/actions không cuộn; footer giới hạn lịch sử rút gọn. Ít noti co theo nội dung, nhiều không kéo dài trang; kiểm thử desktop/mobile và50 noti, không đổi backend/phân quyền.

## Thông báo chưa đọc và lịch sử phân loại — 12/10/2026

Frontend liveJS110/entry93/notifications JS6/CSS5: mặc định chỉ hiện unread, receipt thành công tự ẩn (lỗi vẫn giữ). Lịch sử xem cả read/unread theo quyền, lọc loại request/confirmed/created/updated/transferred/returned/deleted và trạng thái đọc; không xóa audit hoặc tạo read state mới. API hiện hữu limit50, Xem thêm phân trang, bộ lọc trên các trang đã tải có thông báo rõ khi còn trang cũ; giữ phạm vi1000 dòng audit của backend và footer minh bạch, không tuyên bố lịch sử vô hạn. Click nhanh/receipt nền/guard account giữ nguyên. Chỉ frontend, không deploy Apps Script.

## Đồng nhất vị trí icon header — 12/10/2026

Compact-sidebar CSS2 sửa header desktop >1500 về ba cột hiển thị, bỏ track rỗng sau cụm trạng thái/sync/chuông (trước lệch14px giữa Tổng quan và portal). 761–1100 dùng cùng header52px/padding dọc8px cho hai mode, không đổi mobile. Nút34px/SVG19px, cache index tăng; kiểm thử geometry cùng viewport1920/1600/1440/1024, không đổi nghiệp vụ/backend.

## Thông báo gọn và không cắt chữ — 12/10/2026

Frontend liveJS109/entry92/notifications JS5/CSS4: Model | SN | kết quả (warranty_confirmed chỉ hiện tình trạng khi có), email | thời gian, bỏ Bởi và cụm xác nhận lặp. Popup desktop tối đa520px, nội dung12px/model12px, email10.5px, Montserrat; bỏ ellipsis/chiều cao cố định, tự wrap nội dung dài/mobile để không mất chữ. Vẫn hai khối thông tin, thường hai dòng trên desktop; ưu tiên đủ nội dung thay vì ép hai dòng khi không đủ chỗ. Giữ màu urgent, escaping, click nhanh/read receipt nền/phân quyền. Chỉ frontend, không deploy Apps Script.

## Mở hồ sơ từ thông báo không chờ read receipt — 12/10/2026

Frontend liveJS108/entry91/notifications JS4: click mở hồ sơ ngay, lưu đã đọc chạy nền theo hàng đợi, không gọi listNotifications sau mark; badge giảm theo xác nhận thành công, lỗi giữ chưa đọc và cho thử lại. Không khóa click khi tải thông báo/lưu receipt; hủy response cũ và queue khi đổi account/logout. Notification routing không ép refresh danh sách khi đang ở cases, giữ getCaseDetail kiểm tra quyền. Không đổi backend/data; local UI mô phỏng receipt chậm/lỗi, validate đạt. Chỉ frontend, không deploy Apps Script.

## Dấu phân cách thông báo — 12/10/2026

Frontend liveJS107/entry90/notifications JS3 dùng dấu | giữa Model, SN, thay đổi và giữa người thao tác, thời gian; giữ hai dòng, tooltip đầy đủ, font, quyền và click mở hồ sơ. Chỉ frontend, không cần deploy Apps Script.

## Người nhận noti và bố cục hai hàng — 12/10/2026

Frontend liveJS106/entry89/notifications JS2/CSS3: noti đúng2 dòng đơn (Model - SN - thay đổi; Bởi - thời gian), ellipsis/tooltip/aria đầy đủ, Montserrat/màu urgent/click giữ nguyên. Người gửi request chỉ toast2,5s, không banner lớn; nút Đã gửi khóa chống trùng. Backend local Notifications.gs recipients-v2 (trên Code/Legacy1.10.20): request chỉ approver, loại sender; approval sender+actor+global; thao tác khác actor+center_manager liên quan+global, không broadcast staff cùngcenter. Scope guard trước audience; list/unread/mark-read đồng nhất. Ghi requester ở metadata approval và nối metadata cũ theo thứ tự audit trong cửa sổ; không tab/header/audit rewrite. Unit/UI/validate đạt. Chỉ frontend/guide/note publish; để đổi routing production chỉ thay Notifications.gs và New version cùngURL theo DEPLOY-NOTIFICATION-RECIPIENTS.md, không cần thay Code/Legacy nếu đã1.10.20.

## Font Montserrat cho thông báo — 12/10/2026

Notifications CSS2 dùng "Sungrow Montserrat",Montserrat,Arial,sans-serif cho popup, nội dung/nút kế thừa và badge. Tái sử dụng font Montserrat có sẵn trên trang, không thêm tải font ngoài; giữ kích thước/màu và nghiệp vụ. LiveJS105/entry88 cập nhật cache CSS2 cho dashboard và entry standalone. Chỉ frontend, không cần deploy Apps Script.

## Yêu cầu duyệt bảo hành và thông báo theo quyền — 12/10/2026

Frontend liveJS104/entry87, notifications CSS+JS1/entry-notifications JS1, reports JS2/CSS2 thêm chuông cạnh Đồng bộ, số chưa đọc, popup phân trang, nhãn/màu cam riêng yêu cầu pending; một chuông parent khi entry embedded, deep link chỉ caseId và server rechecks. Actor không có approveWarranty dùng Yêu cầu duyệt (kể cả hồ sơ hoàn tất còn Chờ xác nhận); gửi không đổi trạng thái/khóa kỹ thuật, retry không tạo yêu cầu trùng. Backend local Code/Legacy1.10.20-warranty-notifications + Notifications.gs dùng metadata audit hiện có, không tab/header mới; kiểm tra viewCases/scope/approve ở server, global xem toàn phạm vi, center chỉ sự kiện liên quan, xóa chỉ xem sự kiện. Read state compact theo danh tính+phạm vi ở Script Properties, không token/PII/KPI writes. API đọc1000 dòng audit gần nhất, shared gzip/chunk cache/revision/lastRow, poll60–75s visible và refresh sau mutation, không history scan; chỉ sự kiện từ release mới, không hồi tố audit. Pending detail đọc targeted caseId, mutation request sync projection/index/revision. Sửa specificity sidebar để role-hidden không bị rail desktop ghi đè. Local notifications/notifications-ui/reports/validate đạt; chỉ publish frontend/guide/note, backend cần thay Code/Legacy/thêm Notifications và Save/New version cùngURL theo DEPLOY-1.10.20.md, giữ ReportExport nếu đã cài. Không deploy Apps Script tự động hoặc ghi test production.

## Báo cáo Excel quản lý toàn bộ trung tâm — 12/10/2026

Frontend JS103, compact-sidebar JS2, reports JS/CSS1 và report-xlsx JS1 thêm mục Báo cáo chỉ cho isGlobalManager===true: Chi tiết hồ sơ/Tổng hợp trung tâm, lọc kỳ/center và trường chi tiết, chọn cột, preview20, export toàn bộ kết quả thành XLSX hai sheet ngay trong browser. Liên hệ/ghi chú mặc định tắt; số/ngày/% có kiểu, text không thành công thức. Có loading/progress/Hủy; chốt revision/asOf/fingerprint qua các trang200, kiểm tra lại trước download, lỗi dữ liệu đổi không xuất file thiếu. Backend local Code/Legacy1.10.19-manager-reports + ReportExport.gs kiểm tra global quyền ở server, whitelist cột, shared canonical cache/no history scan/no Sheet writes, giới hạn20.000 dòng/32MB. Stock/flow/SLA giữ quy tắc dashboard, thông tin hiện tại không tái dựng lịch sử center/status. Trước deploy backend, frontend báo cần cập nhật và không gọi export. Kiểm thử local reports/reports-ui/reports-xlsx/validate đạt:404 dòng đầy đủ, quyền center chặn, VN boundaries, privacy, cancel/revision, desktop/mobile, Excel mở đúng. Release GitHub chỉ frontend và ghi chú/guide riêng; backend hiện hành còn local, cần thay Code.gs/LegacyDashboardApi.gs/thêm ReportExport.gs rồi Save/New version cùngURL theo DEPLOY-1.10.19.md. Không migration/schema/data/Drive writes.

## Chiều cao bộ lọc thiết bị 42px — 11/10/2026

Frontend visual-polish CSS35 đặt input tìm kiếm, select trạng thái và nút Ngày nhận của toolbar Danh sách thiết bị về42px trên desktop >760; không đổi chiều rộng/font, header kỳ hoặc phân trang. Mobile giữ touch targets cũ. Glass-layout đo cùng viewport1440 xác nhận cả ba42px; validate đạt. Chỉ CSS/cache index, không backend/dữ liệu.

## Sidebar icon gọn và bộ lọc tiếng Việt — 11/10/2026

Frontend JS102/dashboard-period JSv4/compact-sidebar CSS+JSv1: rail94px desktop >760, logo icon gốc, Quản lý/Nhập liệu icon+chữ, giữ các button/handler và role guards; submenu chuyển vào root thành flyout210px để không chiếm bề ngang, chọn/outside/Esc đóng, ArrowDown/keyboard mở, mobile trả nodes về drawer cũ. Account avatar+tooltip/aria giữ identity, Transparency còn ở chân sidebar. Sync chỉ SVG icon+title/aria Đồng bộ dữ liệu, disabled quay tròn (reduced-motion tắt animation); routing sync iframe giữ nguyên. Ngày/Tuần/Tháng/Năm/Tùy chọn và Tháng10/2026, dd/mm/yyyy, giá trị API và gate backend không đổi. Runtime fixture local1024/1280/1440/1920 kiểm tra header/table/no overflow, flyout vị trí94/width210, logo, đóng menu/mobile/Transparency; validate đạt. Chỉ frontend, không Apps Script/KPI/schema/data.

## Transparency gọn và màu ảnh gốc — 11/10/2026

Frontend JS101/entry86/glass-theme CSSv3/controller+controls v2: nhãn Transparency, bỏ chữ trạng thái Bật/Tắt và border-bottom của slot công tắc; giữ checkbox role switch/aria-checked, vị trí trên account, lưu preference và đồng bộ iframe. Theo yêu cầu mới, khôi phục gradient22–32% và màu ảnh gốc trước saturate/contrast/brightness; chưa đổi ảnh khi người dùng chưa chọn ảnh mới. Test glass-layout desktop/mobile/reload/iframe/nháp/nhãn/border/filter-none và validate đạt. Chỉ frontend, không thay dữ liệu/backend.

## Nền giảm màu và công tắc Bóng mờ — 11/10/2026

Frontend JS100/entry85/glass-theme CSSv2/controller+controls v1: nền ESS saturate20%, contrast82%, brightness104% và phủ trắng42–54%, chỉ filter pseudo nền, không đổi chữ/biểu đồ/status. Switch Bóng mờ trên khối tài khoản sidebar dashboard/entry, nhớ browser-local sungrow-glass-enabled-v1; tắt bằng media not all trả nguyên CSS cũ, giữ control. Storage event đồng bộ iframe/các tab cùng origin; lỗi storage không chặn web, không API/auth/data writes. Test local glass-layout desktop/mobile, reload preference, iframe storage sync, giữ model đang nhập, runtime dashboard placement/click và validate đạt. Chỉ publish frontend/test glass và ghi chú riêng; không deploy Apps Script.

## Nền ESS và bề mặt trắng mờ — 11/10/2026

Frontend JS99/entry84/glass-theme v1 dùng lại ảnh ESS Sungrow login-ess-background.jpg355KB, nền fixed và surface trắng86% desktop/95% mobile; chrome82%/96%, controls96%. Không opacity chữ hoặc filter nội dung; chữ phụ đậm hơn, blur10px chỉ sidebar/header desktop, mobile/forced-colors/reduced-transparency có fallback. Entry embedded trong suốt dùng ảnh parent, giữ form/draft/auth/KPI/API/role. Login hiện hành giữ bố cục. Test local Edge1440/390 với markup thật và fixture, no overflow, iframe/no double backdrop, text opacity1, controls, forced colors, contrast chữ phụ tối thiểu4.59:1 trong mô hình nền đen; dashboard runtime1024/1280/1440/1920 và validate đạt. Chỉ publish frontend và test glass-layout, không deploy Apps Script hoặc ghi Sheet.

## Tồn cuối: so sánh cùng dòng đầu kỳ — 10/10/2026

Frontend visual-polish CSS34 giữ số tăng/giảm trong cột Tồn cuối ngay cạnh Đầu kỳ trên một dòng, áp dụng desktop/mobile với selector riêng cột4. Không đổi delta, màu, KPI, backend hoặc dữ liệu. Chỉ publish CSS và cache key index cùng ghi chú này.

## Frontend danh mục loại thiết bị — 10/10/2026

Frontend JS98/entry83 lấy deviceTypes từ bootstrap của backend1.10.18; Đồng bộ refreshCatalog và giữ nháp/loại cũ, dùng cùng dropdown cho tiếp nhận/sửa hồ sơ. GET backend production đã trả1.10.18-sheet-device-catalog; trước release GitHub Pages cònJS97/entry82. Test device-catalog và portal-realtime đạt. Release frontend chỉ ba file docs và ghi chú này, không đưa các thay đổi backend/migration local khác lên GitHub. Không đổi Sheet/config/phân quyền.

## Ô kỳ theo chế độ và mũi tên — 09/10/2026

Dashboard-period JSv3/CSSv6: Day hiện một ngày, Week khoảng7ngày như mẫu, Month tháng/năm, Year năm; hai mũi tên chuyển kỳ, khóa kỳ tương lai. Custom giữ hai ngày+00:00/23:59 và lịch hiện hành, ẩn mũi tên. Ô thời gian desktop tối thiểu290px (tablet270px), không cắt chữ, giữ filter một hàng; thu gọn phần header phụ để đủ chỗ. Kỳ tháng/năm hiện tại chốt hôm nay, kỳ quá khứ đủ kỳ. Regression và actual frontend kiểm tra1024/1280/1440/1920, chuyển tới/lui từng chế độ, textfit và calendar/cancel/fallback đạt. Chỉ frontend, không Apps Script.


## Thông báo lỗi gọn — 09/10/2026

Frontend JS97 chỉ hiển thị message lỗi từ API, bỏ tiền tố mã kỹ thuật như INTERNAL_ERROR trên đăng nhập/dashboard. error.code vẫn giữ cho logic retry và phân loại lỗi. Regression đạt; chỉ GitHub frontend.


## SLA thu hẹp và canh chân chữ — 09/10/2026

Dashboard-period CSSv5 cân lại hàng KPI1.55/.95/.95/.95/1.15 để giảm độ rộng thẻ SLA; chú thích số đạt/TB dùng align-items:baseline với phần trăm, giữ nguyên font. Chỉ frontend; không thay backend, quy tắc KPI hoặc dữ liệu. Regression và layout desktop đạt.


## Header bỏ tên tài khoản — 09/10/2026

Dashboard-period CSSv4 chỉ ẩn #sg-login-slot trong .sg-top để bộ lọc có thêm không gian; thông tin tài khoản sidebar và đăng nhập/phân quyền giữ nguyên. Chỉ frontend, không Apps Script. Regression đạt.


## Thẻ SLA và lịch gọn hơn — 09/10/2026

Frontend JS96/dashboard-period CSSv3/range-calendar JSv2: ô center desktop170px giữ đủ Tất cả trung tâm; KPI chia1.45/.9/.9/.9/1.45, mở rộng SLA, số đạt/TB ngang phần trăm bằng wrapper flex, giữ font hiện hành, giảm hàng xuống khoảng128px. Lịch rộng650px, ô ngày28px, nút Hủy/Áp dụng12px/32px, giảm khoảng cách. Header một hàng giữ nguyên; màn hình hẹp bỏ ghi chú thừa để tránh tràn. Actual frontend fixture1920/1440/1280/1024 kiểm tra textfit, percent/note alignment, KPIheight, width, calendar/cancel/API và regression đạt. Chỉ GitHub frontend; không đổi backend/KPI/dữ liệu, không cần cập nhật Apps Script thêm.


## Lịch chọn khoảng ngày hai tháng — 09/10/2026

Frontend dashboard-period v2 + range-calendar v1: ô ngày mở bảng lịch neo dưới header, hai tháng cạnh nhau, nhanh2/7/30ngày, chọn hai đầu khoảng/tô vùng và Áp dụng/Hủy. Ngày VN dd/mm/yyyy, thời gian cố định00:00–23:59; ngày tương lai/ngoài phạm vi khóa. Mobile hiển thị một tháng trong popup để vừa màn hình. Chỉ frontend, giữ gate backend1.10.15 và toàn bộ layout/KPI; không cập nhật Apps Script thêm cho riêng lịch này. Actual frontend local kiểm tra click/navigate/quick/cancel/header/table/fallback; không ghi dữ liệu nguồn.

## Khoảng ngày và SLA thực tế — 09/10/2026

Frontend JS95 + dashboard-period v1 giữ header, năm KPI và bố cục panel; filter một hàng Day/Week/Month/Year/Custom, lịch native trong hộp chọn ngày, center và cùng kỳ tháng/năm. Cột SLA duy nhất có hai thời gian ngày TB; tỷ lệ đạt7ngày chỉ xét thực tế. Backend local1.10.15-dashboard-range đọc thêm bảng Tạm dừng SLA trong snapshot theo revision, gộp khoảng chồng nhau/cắt vòng đời, trung bình theo số lượng; range qua năm và tồn đầu/cuối kỳ giữ hồ sơ trước kỳ. Bootstrap dashboardRanges gate giữ Month/Year cho backend cũ. Regression và actual frontend fixture desktop1920/1440/1280/1024 đạt; ảnh analysis/dashboard-preview chỉ dữ liệu tổng hợp. Apps Script do người dùng thay Code/Legacy rồi Save/New version cùngURL theo DEPLOY-1.10.15.md; không migration/rebuild. Chưa xác minh backend production1.10.15.


## Nền ESS và slogan Clean Power For All — 09/10/2026

JS94/entry82/login-theme v5: login tổng dùng ảnh ESS Sungrow làm nền ngoài (docs/login-ess-background.jpg354977bytes, JPEG78 từ nguồn2560×1440), hero trong khung giữ login-solar.jpg để hai ảnh khác nhau. Nguồn https://www.sungrowpower.com/vt/vi/ess-utility-scale, banner page-assets/8356cc88-2f29-414e-8751-1d2d035a7b93.jpg; bản gốc giữ analysis/login-ess-source.jpg, không hotlink khi tải web. Slogan đúng Clean Power For All, center-top/nowrap; welcome logo+h1 một hàng giữ nguyên. Entry/popup classic, auth/backend/data không đổi. Test ảnh CSS khác nhau+slogan nowrap/fits+mobile/desktop; validate đạt. Chỉ publish GitHub.

## Slogan English và welcome một hàng — 09/10/2026

JS93/entry82/login-theme v4, chỉ login tổng: slogan Powering a sustainable future. center-top trên ảnh; header form là img logo gốc bên trái+h1 Chào mừng đến với Service Center bên phải, bỏ br, nowrap, cùng hàng/cùng tâm. Grid .9:1.1 và font20 desktop/mobile clamp12–14 để vừa; vẫn khung860×420. Không sửa entry/popup/auth/backend/dữ liệu. Test geometry logo/welcome/no-overflow/hero center và classic secondary; validate đạt. Chỉ GitHub.

## Cân bố cục login tổng, giữ login phụ cũ — 09/10/2026

JS92/entry82/login-theme v3: chỉ login dashboard tổng dùng khung860×420, tỷ lệ1.08:1, h1/Google căn trái, bỏ viền bọc nút dư, điểm nhấn icon PNG gốc nhúngSVG44px và nền ấm nhẹ; không thêm lại ghi chú đã bỏ. Entry login và data-entry-login popup trở về visual classic trước91ae00a, không nạp login-theme/hero/header/footer mới; giữ session/auto-restore/callback/origin và các nghiệp vụ hiện hành. Theme chỉ index, không đổi backend/API/data. Tests main geometry/mobile và classic secondary không leak theme; regression đạt. Chỉ publish GitHub, không Apps Script.

## Đăng nhập gọn và email liên hệ — 09/10/2026

Frontend JS91/entry81/login-theme v2: bỏ eyebrow thương hiệu, nhãn Google gạch chân, đoạn mô tả/quyền truy cập, hero footer/slogan phụ và trạng thái idle dư; giữ h1, nút Google, loading/error auth. Header Cổng dịch vụ/Việt Nam và footer SUNGROW/Service Center dùng vạch đứng CSS mảnh thay dấu chấm. Privacy contact text+mailto là QuocHung@sungrow-apac.com; không sửa tài khoản, OAuth hay quyền. Cùng áp dụng dashboard/entry/popup, success popup hiển thị trong message. Không cần Apps Script. Regression/layout local desktop+mobile kiểm chứng.

## Thiết kế đăng nhập hai phần — 08/10/2026

Frontend JS90/entry80/login-theme v1: header logo, khung ảnh solar/form Google hai cột theo mẫu; mobile<=760px một cột với hero160px. Theme scoped cho dashboard, entry standalone và popup; giữ Google slot IDs/callbacks/auth/role/origin guards, không thêm password/register/guest/server selector giả. Ảnh built-in image_gen đóng gói docs/login-solar.jpg162780bytes dùng chung hero/nền mờ, không tải ảnh ngoài. Popup success selector đổi sang sg-auth-copy để tránh sửa hero paragraph. Test actual frontend localGSIstub tại1440/1024/390/360 đạt columns/button/no-overflow/no-JS-errors; validate đạt, không kiểm thử OAuth production. Chỉ publish GitHub, không Apps Script/backend/data/KPI/Drive thay đổi. Chi tiết+prompt: version final/LOGIN-DESIGN.md.

## Favicon khung sát logo — 08/10/2026

docs/favicon-tight.svg nhúng nguyên PNG người dùng (không đổi bytes) và viewBox109 108 296 296 bao quanh alpha bounds115 123..398 388; logo chiếm96% chiều ngang thay55% khung cũ. Bốn trang dùng SVG favicon v1 ưu tiên, giữ PNG v3 fallback. Chỉ thay viewport favicon, không vẽ lại logo, không API/backend/data thay đổi. Test favicon-tight kiểm tra bytes PNG nguyên vẹn, SVG self-contained và render favicon16px trong Edge với nền trong suốt; validate đạt. Không cần Apps Script.

## Favicon PNG trong suốt mới — 08/10/2026

Thay docs/favicon.png bằng nguyên PNG512x512 người dùng gửi (SHA256 AC1C99DE290608686473595E8C4A709D2D30CDA7015D2EBD4993FA9912721010; alpha góc0), không chỉnh sửa ảnh. index/entry/data-entry-login/privacy dùng favicon.png?v=3 để bỏ cache ảnh cũ. Chỉ biểu tượng tab trình duyệt, không đổi wordmark SUNGROW trong sidebar, backend, API hay dữ liệu; không cần deploy Apps Script.

## Nhóm đính kèm và trạng thái mutation — 08/10/2026

Code/Legacy local 1.10.14-upload-categories + TemporaryUploads.gs: incident max1, sitePhotos/deviceLog/waveform dùng chung tổng10×8MiB; overall >=1, không bắt buộc từng nhóm. Bootstrap uploadCategories gate giữ fallback backend cũ. Recategorization READY metadata-only, owner/center/capability/state guard; tên file khi finalize có tiền tố nhóm trong cùng folder case, không schema/ACL/subfolder thay đổi, legacy files vẫn tương thích. Frontend JS89/entry79/case-uploads v3; mutation API hiện thông báo spinner, chặn gửi mutation thứ hai nhưng không khóa đọc; finally dọn trạng thái cả thành công/lỗi/timeout. Regression/helper/actual-entry fakeAPI đạt, chưa tác động production dữ liệu hay test15session live. Triển khai theo version final/DEPLOY-1.10.14.md: thay Code, Legacy, TemporaryUploads, Save/New version cùng URL, không migration/rebuild/init lại nếu đã bật upload tạm.

## Upload UI và nháp trống — 08/10/2026

Frontend JS88/entry78/case-uploads CSS+JSv2/form-drafts JSv2: progress explicit white track/orange fill WebKit+Firefox, notes gọn sau nhãn đính kèm, bỏ notes dài dưới bar. Draft giữ storage namespace v1 để bảo toàn nháp thật, không lưu/khôi phục snapshot chưa có thay đổi (bỏ hidden-only changes); upload-only metadata do staged module quản lý, không báo nháp text trống. Nháp có nội dung, isolation theo account, conflict guard và giữ khi gửi lỗi vẫn nguyên. Index.html direct được mirror helper local cho tương thích; GHPages chỉ cần publish, không thay backend/AppScript cho hotfix. Tests form-drafts + actual entry fakeAPI + regression đạt, không upload dữ liệu production.

## Upload tạm 1.10.13 — 08/10/2026

Code/Legacy local1.10.13-staged-uploads; runtime mới TemporaryUploads.gs. Folder tạm181f6qWxeV3N9Sv8ua7aqWjT-V7Ak4trY đã readback Google Drive là File upload temporary (owner Sungrow, editor quản lý), không sửa ACL. Tài khoản có createCase+center upload qua Execute as Me, không cần share folder cho staff; journal owner+center+session/upload/request IDs, max10 files×8MiB, Office/PDF/ZIP/RAR/JPG/PNG. Client tuần tự, progress theo file Drive xác nhận; backend pool4, short-lock metadata, Drive outside lock, không bump revision từngfile; case tạo bằng references/move folder, xóa journal sau canonical commit. TTL24h, triggerhourly bounded10sessions đối chiếu canonicallinks, active leases, exact parents và contents, trash không permanent delete/case evidence. Frontend JS87/entry77/case-uploads v1 có fallback ZIP/RAR cũ khi backend chưa enable, metadata localStorage không filecontents/tokens mới. Tests helper/actual frontend fakeAPI và regression đạt; chưa deploy/init/upload/cleanup production hoặc test15session live. Guide version final/DEPLOY-1.10.13.md; không migration/rebuild. Không sửa luồng gia hạn xác thực.

## Chữ và header thẻ mobile — 08/10/2026

JS86/entry76/mobile CSSv3 (mobile JSv2): title17px, body14px, helper12px, input/select16px. Ba thẻ model/errors/parts dùng header riêng một cột, bỏ eyebrow trùng, bộ lọc model fullwidth dưới title, link chi tiết hàng riêng; donut trên legend. Header và rows model/error/parts dùng cùng grid và căn số phải, tên được wrap không cắt mất. Mobile <=760px; không thay desktop/API/KPI/schema. Kiểm thử headless fixtures có rows thật cấu trúc tại360/390/430px, font/column alignment và regressions; không phải Safari live. Chỉ GitHub Pages, không cần Apps Script.

## Tổng quan mobile gọn — 08/10/2026

JS85/entry75/mobile-ui v2: sửa mobile v1 đã mở toàn bộ card-list-body thành trang quá dài. Trên Tổng quan <=760px, attention/model/error/parts hiển thị5 mục, Xem thêm tăng5 và Thu gọn về5; count chỉ số mục trong preview đang có, không giả là toàn database. Center comparison mặc định summary tồn cuối/quá hạn và mở chi tiết theo nút. Dùng cùng DOM/dữ liệu, không thêm API hoặc sửa KPI/role/cache; desktop giữ mọi hàng. Fixture250 attention kiểm chứng5→10→5 trên phone/250 trên desktop, center toggle và giới hạn chiều dài trang; chưa smoke Safari/Zalo thật. Chỉ deploy GitHub Pages.

## Favicon Sungrow — 08/10/2026

Dùng nguyên ảnh PNG logo người dùng cung cấp (32x32) tại docs/favicon.png, không vẽ lại/chỉnh sửa. Bốn trang index, entry, data-entry-login và privacy dùng favicon.png?v=2 thay biểu tượng chữ S SVG đã chọn nhầm trước đó. Chỉ thay biểu tượng tab; không đổi OAuth/DNS/backend. Publish GitHub Pages; không cần cập nhật Apps Script.

## Giao diện mobile — 08/10/2026

Frontend JS84/entry74, mobile-ui.css/js v1: responsive <=760px; menu drawer có backdrop/Escape/focus trap, bộ lọc dashboard thu gọn với tóm tắt kỳ/center, Đồng bộ vẫn trên header. KPI không chồng legend; center comparison có nhãn theo flow/stock hiện hành. Bảng thiết bị/hồ sơ dùng chính các rows/actions phân trang cũ dưới dạng thẻ (data-label theo header); form một cột và ô16px/nút44px. Không thêm API, không đổi KPI/quyền/schema/cache/backend. Desktop >760px giữ bố cục hiện hành; không tạo dữ liệu giả trên production. Test local headless Edge360/390/430/768/1440, no horizontal page overflow trên phone, menu/Escape/filter/sort proxy/forms và regression validate đạt. Kiểm thử layout fixtures không phải Safari/Zalo/live authenticated smoke. Chỉ push GitHub Pages; không cập nhật Apps Script, không migration/rebuild. File bổ sung docs/mobile-ui.css và docs/mobile-ui.js.

## Đồng bộ kiểu nút sắp xếp — 08/10/2026

Frontend JS83/CSS33: nút Ngày nhận trên danh sách thiết bị dùng chung class sg-control với tìm kiếm/trạng thái, bỏ inline font/viền/padding riêng; giữ toggle cũ/mới, phân trang và API hiện hành. Chỉ GitHub Pages, không cần deploy Apps Script. Giao diện mobile tổng thể chưa thay đổi.

## Tối ưu đường đọc web — 08/10/2026

Frontend JS82/entry73: deadline bao gồm response.json và không retry các request đã timeout, vẫn hủy phản hồi đọc cũ. Backend local cần Code/Legacy cùng1.10.12-web-read-performance, ManagerDashboard và PortalReadDiagnostics: formatter ngày VN và thống kê hashSN tính JS (giữ output SHA256), workbook handle request-scope, cache response lớn dùng gzip, Manager đọc sharedtables strict revision. Không đổi KPI/schema/role/nguồn; diagnoseWebReadPaths đo build/cache/device/manager trước deploy. Regression local đạt, chưa đo1.10.12 production; hướng dẫn local version final/DEPLOY-1.10.12.md. Commit frontend không deploy backend tự động.

## Hotfix khởi tạo iframe — 08/10/2026

Frontend JS81/entry73: relay Đồng bộ được khởi tạo sau const$/state/helpers; sửa ReferenceError do gọi$trước khởi tạo khiến iframe đứng ở đăng nhập. Test entry-startup.mjs chạy toàn script ứng dụng trong DOM mock embedded/standalone, kiểm tra bước khôi phục phiên và tái hiện lỗi cũ. Không thay backend/schema/dữ liệu, không cần deploy Apps Script cho hotfix. Chưa smoke test browser live.

## Góc Đồng bộ và tải 15 tài khoản — frontend 08/10/2026

Frontend JS80/entry72: nút Đồng bộ ở góc phải thanh tiêu đề như dashboard; parent relay lệnh/trạng thái iframe với origin/source guard, ẩn syncbar giữa bộ lọc/bảng. Không gửi list trùng do ready handshake; ngừng chờ dashboard khi vào nhập liệu, không để phản hồi nền ghi đè trạng thái. Backend cần Code/Legacy cùng1.10.10-fast-reads: nén shared cache, follower chờ ngắn thay vì15s, giữ freshness/quyền/revision và thêm timing. Kiểm thử fixture15 scoped page requests/cold followers đạt, không phải15 session production. Hướng dẫn local version final/DEPLOY-1.10.10.md; không migration/seed, backend chưa deploy từ commit này.

## Đồng bộ nhập liệu và chuyển trang — frontend 07/10/2026

Frontend JS79/entry71: nút Đồng bộ/thời điểm đồng bộ trong danh sách; request đọc mới hủy request client cũ, sequence guard giữ trang vừa chọn. Deadline gồm đọc JSON, list30s/backoff giới hạn, không retry transport lồng. Revision poll so với danh sách tải thành công, invalidation cache trước tải lại; form/chi tiết mở giữ nguyên và hiện thông báo. Focus/online kiểm tra cập nhật. Không đổi backend/KPI/schema hoặc chạy migration; backend vẫn 1.10.9. Regression giả lập race, timeout body, lỗi tải, revision và bảo vệ editor đạt; chưa kiểm thử live hai tài khoản.

## Sắp xếp ngày nhận — frontend 07/10/2026

Frontend JS78/entry70 bổ sung nút Ngày nhận ↓/↑ cho danh sách hồ sơ và thiết bị dashboard; đổi chiều về trang 1, giữ bộ lọc. Backend cần Code.gs và LegacyDashboardApi.gs cùng 1.10.9-received-sort để sắp xếp toàn bộ kết quả trước phân trang, ngày trống luôn cuối. Không migration/seed, không đổi KPI/schema. Backend chưa deploy từ commit frontend; cần Save và New version trên deployment hiện tại. Hướng dẫn local version final/DEPLOY-1.10.9.md.

## Danh bạ khách hàng — frontend 06/10/2026

Frontend JS77/entry69 bổ sung gợi ý trong Tên khách hàng, tự điền bốn ô và chọn lưu/cập nhật profile riêng; guard chống phản hồi cũ và đổi center, loading/error, nhập tay khi backend chưa hỗ trợ. Backend cần Code.gs/LegacyDashboardApi.gs bản 1.10.8-customer-directory và CustomerDirectory.gs; initializeCustomerDirectory tạo tab Khách hàng/cột Mã khách hàng, audit/seed theo đợt nếu lấy khách từ hồ sơ cũ. Hồ sơ giữ snapshot, profile update không sửa case cũ. Chưa deploy backend hoặc seed production từ commit frontend.

## Tự điền Model theo SN — 06/10/2026

Frontend live-data76/entry68 dùng thêm Model từ response lookupWarranty, readOnly khi tìm thấy, nhập tay khi thiếu hoặc lookup lỗi; sequence chặn phản hồi cũ, không thêm request tra cứu. Backend local cần deploy 1.10.7-sn-model (Code.gs/LegacyDashboardApi.gs/Index.html) để trả Model từ All SN list. Backend cũ vẫn nhập Model thủ công. Không thay dữ liệu nguồn hoặc chạy migration để bật tính năng này.

## Sửa hồ sơ — frontend 05/10/2026

Frontend JS cache 75, entry 67 bổ sung chọn Loại thiết bị và vòng xoay khi mở form/lưu, chặn nhấp lặp và dọn loading khi lỗi. Backend cần cập nhật Code.gs bản 1.10.6-device-type-repair để chấp nhận thay đổi loại; GitHub Pages không tự deploy Apps Script. Nhóm sửa dữ liệu máy đổi vẫn cần audit/repair trong Apps Script; chưa có thay đổi production từ commit frontend này.

Frontend layout 05/10/2026: cache JS `74`, CSS `32`. Rút gọn nhãn KPI/cột, giữ định nghĩa trong tooltip; phân bổ lại độ rộng bảng, giữ chú thích và so sánh một dòng. Không thay công thức hay dữ liệu backend.

## Frontend GitHub Pages — 05/10/2026

Frontend cache `live-data.js?v=73` phân biệt phát sinh trong kỳ với tồn tại ngày chốt, bổ sung tồn đầu kỳ và số hồ sơ. Hoàn tất kỹ thuật lấy `summary.technicalCompleted`; khi backend chưa hỗ trợ, hiển thị `—`, không suy từ chờ giao cộng đã trả. Backend Apps Script 1.10.5 cần triển khai riêng để có đủ trường và cách tính mới; publish frontend không tự cập nhật Apps Script hoặc dữ liệu Sheets. Commit frontend chỉ gồm hai file docs và ghi chú triển khai này; các thay đổi backend/migration local chưa được publish trong commit đó.

Tài liệu này mô tả quy tắc dữ liệu và cách triển khai của phiên bản production hiện tại. Đây là điểm bắt đầu cho các task mới, thay cho việc đọc lại toàn bộ lịch sử thay đổi.

Cập nhật lần cuối: `2026-10-03`.

## Release ứng viên 1.10.4-canonical-sync — chưa xác minh backend deploy

Dashboard production chuyển sang nguồn hồ sơ nghiệp vụ canonical đã migration, không ghép lại các năm lịch sử khi đọc. Snapshot compact/cache bảng cùng revision và không stale; không giữ ScriptLock ngoài shared reader. Danh sách server-side giữ mọi case hoạt động, kể cả thiếu ngày hoặc trước 2024. KPI kỳ vẫn lọc ngày có căn cứ; cumulative records khác cumulative received. Phân quyền dashboard theo center xử lý gần nhất vẫn khác phạm vi center liên quan của platform; không sửa quyền để ép tổng bằng nhau.

Frontend cache mới `live-data.js?v=72`, bỏ fallback sai dùng preview 250 dòng làm toàn bộ danh sách. Backend Code và Legacy đều `1.10.4-canonical-sync`. Test 10.000 case/regression đạt; replay snapshot sau DAT đạt 2.767 case hoạt động ở cả dashboard và danh sách, 6 thiếu ngày, 4 lượt đọc bảng cho toàn bộ các trang khi cache warm. Không chạy lại migration/repair cho release này. Hướng dẫn `version final/DEPLOY-1.10.4.md`; backend chưa deploy/xác minh live vì công cụ trình duyệt gặp lỗi khởi động. Giữ nguyên dữ liệu và các launcher private; không deploy launcher Editor public tạm.

## Thay đổi local chờ triển khai ngày 02/10/2026

Production đang ghi nhận phiên bản 1.10.2 và cache 69/64 như phần bên dưới. Bản local chuẩn bị: backend `1.10.3-case-corrections`, cache frontend `71/66`, form-drafts.js v1; chưa push, deploy hay nhập XBSolar. Người dùng đã cho phép triển khai và nhập ngày 02/10; hiện bị chặn bởi lỗi khởi tạo kênh trình duyệt (“windows sandbox … setup refresh had errors”) và chưa có phiên clasp. Không push frontend trước backend, không ghi Sheet trực tiếp để vượt kiểm soát.

Gói JSON đã được tải và đọc lại metadata tại đúng thư mục Drive riêng đang chứa database production; không chia sẻ file. Checkpoint và Script Properties nằm ngoài Git trong `../analysis/xbsolar/deployment-checkpoint.json` và `deployment-properties.txt`. Ba bảng live hồ sơ/công việc/linh kiện vừa được đối chiếu chỉ đọc vẫn khớp fingerprint snapshot. Đây chưa phải commit preflight: Preview phải đọc lại đủ 6 bảng khi thực thi.

- Quản lý toàn hệ thống có nút **Sửa thông tin hồ sơ** trong màn hình cập nhật: SN, model, số lượng, ngày nhận/sẵn sàng/trả, khách hàng, đơn vị gửi, ghi chú và Drive.
- API `correctCase` bắt buộc lý do và revision mới nhất; xác thực quyền trong ScriptLock; chỉ sửa các cột cho phép. Giữ nguyên ID hồ sơ, provenance, công việc và quan hệ luân chuyển. Chặn SN/ngày nhận trùng khi đổi định danh, ngày sai thứ tự và ghi đè từ trang cũ.
- Ghi nhật ký trước/sau, đồng bộ projection/index và tăng revision. Nếu đồng bộ không hoàn tất, trả thông báo dữ liệu đã lưu để người dùng kiểm tra trước khi tiếp tục. Hồ sơ lịch sử còn thiếu ngày vẫn được sửa thông tin khác.
- Linh kiện và lỗi tiếp tục sửa qua **Cập nhật công việc**, sử dụng ID dòng hiện hữu. Linh kiện có tên nhưng chưa có PN vẫn được giữ/sửa; không loại bỏ khi lưu. Không tạo case mới để sửa dữ liệu.
- Kiểm thử bổ sung: `node "version final/tests/case-corrections.mjs"`; kiểm thử regression hiện hành vẫn bắt buộc.
- Bổ sung nháp trình duyệt theo email đã xác thực + thao tác + ID hồ sơ/công việc: giữ khi submit thất bại, khôi phục khi nguồn còn khớp, không tự gửi database; nguồn đã đổi chỉ cho đối chiếu/xóa nháp cũ. Nháp hết hạn sau 7 ngày, không lưu token hoặc nội dung file; file đính kèm phải chọn lại sau tải trang. Cache/index cho nhiều người và chống tạo trùng hiện hành vẫn giữ nguyên. Kiểm thử `form-drafts.mjs` kiểm tra account, reload, nguồn đổi, linh kiện có tên thiếu PN, quota và xóa sau thành công.
- Audit XBSolar đọc lại live ngày 02/10 phát hiện SN A2011057375 có ba lượt XB đang trỏ cùng HS-OLD-2024-0526. Người dùng đã xác nhận ba lần xử lý riêng; lượt đầu Sungrow → XB giữ ID production, hai lượt sau riêng. Mapping mới: 605 append, 106 merge, 0 hold; không dùng kết quả 603/108 cũ để ghi. Hai dòng linh kiện trùng dùng lại ID production, không append mù. Writer migration đã hoàn thiện và kiểm thử local, chưa deploy/chạy production; helper append cũ đang khóa.
- Người dùng chốt 19 case chỉ có Test là **Hoàn tất kỹ thuật**, XB bổ sung linh kiện và chi tiết/kết quả xử lý sau. Giữ ngày hiện hữu và linh kiện trống; không tự gán Đã sửa chữa/Không sửa chữa. Output migration mới nhất nằm ở `analysis/xbsolar/output-v12/converted.json` ngoài thư mục production-auth-audit; Google Sheet kết quả đã có ghi chú và 19 dòng follow-up.

## 1. Phiên bản và kiến trúc hiện tại

- Backend version: `1.11.18-attachment-storage`, deployment chính Version73; worker lưu trữ riêng Version1.
- Frontend cache keys hiện tại: `live-data.js?v=161`, embedded entry `v=142`, `visual-polish.css?v=36`.
- Frontend production: `https://sungrow-service.sungrowvietnam.com.vn`, được phục vụ bởi GitHub Pages; origin GitHub Pages hiện có được giữ.
- Backend production: Google Apps Script Web App; URL `/exec` nằm trong `docs/config.js`.
- Database production: Google Spreadsheet ID `1EoYBTSAPPOne1VCUMTLQ7W_1jjDOQnQloDWdZyXM5xI`.
- Dữ liệu bảo hành tham chiếu: Google Spreadsheet ID `1CPQkL-FJVxaXwuPKJUO-PnK9ML3s2KYXg8ZvmnfPev8` hoặc Script Property `WARRANTY_LOOKUP_SHEET_ID` nếu được cấu hình.
- Năm lịch sử bắt đầu từ `2024`; dashboard đọc đến năm hiện tại.
- SLA nhận-trả: tối đa `7` ngày.

Luồng tổng quát:

```text
Trình duyệt/GitHub Pages
  -> Google Sign-In lấy ID token
  -> Apps Script API qua bridge/dispatcher allowlist hiện hành
  -> xác thực Google hoặc phiên portal8giờ + user/role/center
  -> đọc/ghi Google Sheets
  -> cache/index/projection theo database revision
  -> khi đính kèm: lệnh có HMAC tới worker riêng, file owner Gmail chuyên dụng
```

## 2. File nào là nguồn chuẩn

| Thành phần | File chuẩn | Ghi chú |
|---|---|---|
| Nghiệp vụ platform | `version final/Code.gs` | Hồ sơ, công việc, bảo hành, luân chuyển, Drive, phân quyền, cache/index |
| API dashboard | `version final/LegacyDashboardApi.gs` | `dashboard.read`, `tickets.page`, `tickets.search`, `portal.call` |
| Portal GitHub | `docs/index.html` | Khung dashboard |
| Logic frontend | `docs/live-data.js` | Auth, API, render dashboard, iframe platform |
| Platform nhập liệu | `docs/entry.html` | Danh sách, tiếp nhận, cập nhật, luân chuyển |
| Giao diện bổ sung | `docs/visual-polish.css` | CSS production |
| Cấu hình công khai | `docs/config.js` | Apps Script URL, OAuth client ID, entry page |
| UI Apps Script | `version final/Index.html` | Bản tương ứng khi mở Web App trực tiếp |
| Regression guard | `version final/tests/validate.mjs` | Phải chạy trước deploy |
| Các module auth/phụ trợ | PortalSessions.gs, CustomerDirectory.gs, Notifications.gs, ReportExport.gs | Xem đầy đủ ở PRODUCTION-STATE.md, không chỉ copy hai file core |
| Adapter upload | `version final/AttachmentStorage.gs` | Backend chính, cấu hình riêng trong Script Properties |
| Worker upload | `attachment-storage/StorageWorker.gs` | Project khác, không copy vào backend chính |

Không mặc định dùng `apps-script/Code.gs`, `ManagerDashboard.gs` hoặc README/deploy cũ làm nguồn code mới nhất.

## 3. Mô hình dữ liệu

### 3.1 Tab nghiệp vụ

| Tab | Vai trò |
|---|---|
| `Hồ sơ thiết bị` | Một dòng cho một hồ sơ/case; nguồn chính của thông tin tiếp nhận và trạng thái tổng |
| `Công việc trung tâm` | Một hồ sơ có thể có nhiều công việc, mỗi center một hoặc nhiều chặng xử lý |
| `Luân chuyển thiết bị` | Quan hệ gửi/nhận giữa hai center |
| `Lỗi thiết bị` | Lỗi/hiện tượng gắn với `Mã công việc` |
| `Linh kiện sử dụng` | Linh kiện gắn với `Mã công việc` |
| `Tạm dừng SLA` | Khoảng thời gian tạm dừng gắn với `Mã công việc` |
| `Người dùng` | Nguồn phân quyền duy nhất |
| `Nhật ký thay đổi` | Audit thao tác |
| `Dữ liệu dashboard` | Projection tương thích dashboard, không phải nguồn nghiệp vụ chính |
| `Chỉ mục hồ sơ` | Index nhẹ phục vụ danh sách/phân trang/tìm kiếm platform |
| `2024`, `2025`, `2026`, ... | Dữ liệu lịch sử theo năm; giữ nguyên làm nguồn đối soát |

### 3.2 Khóa và provenance

- Hồ sơ mới dùng `Mã hồ sơ` dạng `HS-*`; công việc `CV-*`; luân chuyển `LC-*`.
- Request tạo hồ sơ có `requestId` riêng để chống tạo trùng khi mạng timeout hoặc frontend nhận 404 sau khi backend đã ghi.
- Dữ liệu lịch sử dùng `Mã dòng dữ liệu cũ` dạng `year!row`, ví dụ `2025!342`.
- Không ghép dữ liệu chỉ bằng S/N. Cùng một S/N có thể là nhiều lượt sửa chữa khác nhau.
- Khi merge lịch sử và nghiệp vụ, ưu tiên theo thứ tự:
  1. provenance `year!row` chính xác;
  2. `Mã hồ sơ`/case ID;
  3. khóa mạnh S/N + ngày nhận khi chỉ có đúng một kết quả;
  4. nếu mơ hồ thì bỏ qua và báo data-quality, không tự ghép.
- Repair lịch sử bỏ qua hồ sơ đã được người dùng chỉnh sửa sau import.

### 3.3 Center chuẩn

- `Sungrow Service Center` — alias lịch sử: `WSHCM`.
- `XBSolar Center` — alias: `XB`, `XB Solar`, `XBSOLAR`.
- `DAT Center` — alias: `DAT`.
- `BKE Center` — alias: `BKE`.
- `JGP Center` — alias: `JGP`.

Quản lý dịch vụ xem được dữ liệu center chưa chuẩn hóa khi lọc “Tất cả trung tâm”; dữ liệu này phải được báo là chưa xác định thay vì âm thầm loại bỏ.

## 4. Quy tắc tiếp nhận và bảo hành

### 4.1 Tạo hồ sơ

- Bắt buộc: ngày nhận, center, loại thiết bị, model, số lượng, tên/địa chỉ/SĐT khách hàng, hiện tượng ban đầu và file hồ sơ theo form hiện hành.
- S/N bắt buộc, ngoại trừ loại thiết bị `Fan`.
- Email là tùy chọn nhưng nếu có phải đúng định dạng.
- Số lượng tối thiểu là `1`.
- GSP và MA không nhập ở form tiếp nhận; cập nhật tại công việc kỹ thuật, tối đa 100 ký tự.
- Hồ sơ mới luôn được ghi:
  - `Trạng thái hồ sơ = Mới tiếp nhận`;
  - `Tình trạng bảo hành = Chờ xác nhận`;
  - công việc đầu tiên `Trạng thái xử lý = Đã nhận hàng`;
  - `Nguồn dữ liệu = Quy trình mới`.
- Kết quả tra cứu S/N trên form chỉ là thông tin tham chiếu hiển thị. Kết quả nghiệp vụ vẫn phải được quản lý xác nhận sau khi tạo hồ sơ.

### 4.2 Tra cứu bảo hành

- Bảng tra cứu cần các cột `SN`, `Start date`, `Warranty package`.
- Badge frontend:
  - còn hạn: xanh lá;
  - hết hạn: đỏ;
  - không có/không đủ thông tin: xám.
- Ngày hiện tại phải được so sánh với ngày hết hạn; không được coi một thiết bị là hết bảo hành khi chưa tới hạn.
- Trạng thái xác nhận hợp lệ trong nghiệp vụ:
  - `Trong bảo hành`;
  - `Ngoài bảo hành`;
  - `Sửa làm hàng good`.
- Chỉ `service_manager` hoặc Quản lý Sungrow có capability `approveWarranty` được xác nhận.
- Nếu đổi từ một trạng thái đã xác nhận sang trạng thái khác, bắt buộc có ghi chú.

### 4.3 Giới hạn trước xác nhận bảo hành

Khi vẫn `Chờ xác nhận`, công việc chỉ được ở giai đoạn trước sửa chữa (`Đã nhận hàng`, `Đang kiểm tra`). Không được:

- hoàn tất kỹ thuật;
- nhập kết quả xử lý;
- sử dụng linh kiện;
- giao trả khách.

## 5. Trạng thái và luồng xử lý

Luồng chính:

```text
Mới tiếp nhận
  -> Đang xử lý
  -> Đang luân chuyển (nếu chuyển center)
  -> Đang xử lý (center nhận xác nhận nhận hàng)
  -> Sẵn sàng trả khách
  -> Đã hoàn tất
```

Quy tắc quan trọng:

- `Hoàn tất kỹ thuật` bắt buộc có `Ngày hoàn tất kỹ thuật` và `Kết quả xử lý`.
- Nếu kết quả là `Đổi thiết bị`, bắt buộc có loại thiết bị đổi.
- Công việc `Đã chuyển hàng đi` hoặc `Đã đóng công việc` không được center thường cập nhật tiếp.
- Center hiện tại sau xác nhận nhận luân chuyển chịu trách nhiệm xử lý và giao trả; giữ center tiếp nhận gốc cho lịch sử.
- Hoàn tất kỹ thuật đủ kết quả/ngày chuyển sang Sẵn sàng trả khách kể cả đã chuyển center. Center cũ không cập nhật chặng đã đóng hoặc giao trả thay center đang giữ.
- Ngày nhận luân chuyển không được trước ngày gửi; ngày trả không được trước ngày tiếp nhận hoặc ngày sẵn sàng trả.
- Center ngoài Sungrow chỉ được chuyển về Sungrow.
- Sungrow được chuyển đến mọi center khác.
- `center_staff` được xác nhận nhận luân chuyển nhưng không được chủ động tạo luân chuyển.

## 6. Quy tắc xóa hồ sơ

Xóa là **soft delete**, không xóa dòng vật lý.

Điều kiện theo capability:

- Vai trò quản lý hệ thống gốc có `canDeleteAnyCase`: được xóa mềm mọi loại thiết bị, kể cả đã hoàn tất/duyệt bảo hành/luân chuyển; vẫn phải qua guard pending và ràng buộc dữ liệu hiện hành.
- Không có capability đó: chỉ hủy tiếp nhận đủ điều kiện trước xác nhận/chưa hoàn tất/chưa luân chuyển, tại center tiếp nhận và đúng quyền. Lô đã phát sinh nghiệp vụ không dùng đường hủy tiếp nhận thông thường.
- Quản lý Sungrow có quyền sửa nguồn nhưng không tự nhận quyền xóa mở rộng. Không suy capability này từ `isGlobalManager` hoặc role sau chuẩn hóa.
- Mọi trường hợp bắt buộc lý do theo giới hạn API; giữ audit, lịch sử công việc/parts/luân chuyển/file.

Khi xóa:

- đặt `Trạng thái hồ sơ = Đã hủy`;
- ghi người/ngày/lý do hủy và audit;
- loại khỏi `Dữ liệu dashboard`;
- cập nhật `Chỉ mục hồ sơ`;
- tăng database revision.

Hồ sơ `Đã hủy` phải bị loại khỏi danh sách platform, dashboard, tìm kiếm thiết bị và KPI. Bộ lọc dashboard còn dùng case ID, provenance và S/N + ngày nhận để chặn bản lịch sử tương ứng xuất hiện trở lại.

## 7. Phân quyền

| Role chuẩn | Dashboard | Tạo hồ sơ | Cập nhật | Chuyển center | Nhận chuyển | Trả khách | Xác nhận BH |
|---|---:|---:|---:|---:|---:|---:|---:|
| `service_manager` | Có | Có | Có | Có | Có | Có | Có |
| `center_manager` | Không | Có | Có | Có | Có | Có | Không |
| `center_staff` | Không | Có | Có | Không | Có | Có | Không |

- Tab `Người dùng` là nguồn quyền duy nhất.
- Quản lý Sungrow được nâng quyền quản lý toàn hệ thống theo quy tắc hiện hành.
- Quyền sửa nguồn không giới hạn theo loại thiết bị dành cho quản lý hệ thống và quản lý Sungrow. Các quản lý center khác và nhân viên không có quyền này. Quyền xóa mở rộng giữ theo vai trò gốc, không theo sự nâng role của quản lý Sungrow.
- Token Google được kiểm tra `aud`, `iss`, `exp`, `email_verified`, `sub`.
- Lần đăng nhập đầu tiên khóa `GoogleSub` vào user; các lần sau ưu tiên `GoogleSub` hơn email.
- Trùng email, trùng GoogleSub, user inactive hoặc GoogleSub sai đều phải bị từ chối.
- PortalSessions.gs quản lý phiên tuyệt đối8giờ, token hash phía server, không kéo dài phiên khi retry; đọc lại quyền hiện hành và hỗ trợ thu hồi khi đăng xuất.
- Ẩn menu frontend không phải bảo mật; mọi quyền ghi/đọc đều phải kiểm lại ở backend.

## 8. File hồ sơ và Google Drive

- Luồng staged nhận các loại cho phép trong TU_TYPES (DOC/DOCX, PDF, XLS/XLSX, ZIP/RAR, JPG/JPEG, PNG, TXT, CSV), kiểm tra nội dung/định dạng. Worker riêng tối đa32MB/file do transport; đường ZIP/RAR cũ vẫn8MB.
- Mỗi center có một Drive folder riêng được khai báo trong `CASE_EVIDENCE_FOLDERS`.
- Folder con đặt theo ngày nhận, S/N, model và khách hàng.
- Link Drive được ghi vào `Liên kết hồ sơ Drive` và chỉ trả ra frontend nếu là URL `drive.google.com` hoặc `docs.google.com` hợp lệ.
- Không tự cấp quyền public.
- Worker thực thi bởi sungrowservicecenter@gmail.com tạo file mới; backend chính giữ executor hiện tại. Quyền thư mục phải đủ cho hai luồng nhưng không mở public/domain và không cấp thêm quyền nghiệp vụ cho account lưu trữ.
- ATTACHMENT_STORAGE_MODE=dedicated-v1 áp dụng cho phiên upload mới; URL/secret ở Script Properties. Phiên cũ tiếp tục cơ chế cũ, lỗi worker không fallback âm thầm. File cũ không tự chuyển owner.
- HMAC/nonce/thời hạn bảo vệ lệnh và phản hồi. Backend chính giữ actor/quyền/journal/canonical receipt; worker chỉ lưu trữ. Cleanup bảo vệ folder canonical; folder bổ sung đã commit chỉ dọn khi trống.
- Upload chạy ngoài database lock. Receipt `CREATE_UPLOAD_<requestId>` ngăn upload lặp khi kết quả request không chắc chắn.
- Nếu frontend timeout nhưng case đã tạo, phải gọi `getCreationStatus(requestId)`; không tự gửi lại file/case mù quáng.

## 9. Quy tắc dashboard và số liệu

### 9.1 Nguồn hybrid

Dashboard ghép:

- tab lịch sử theo năm;
- dữ liệu nghiệp vụ hiện hành;
- projection `Dữ liệu dashboard` để tương thích;
- các bảng lỗi, linh kiện và công việc để lấy thông tin chi tiết mới nhất.

Một record nghiệp vụ mới không được nhân đôi với dòng lịch sử đã map. Một provenance không khớp không được fallback sang S/N để tránh ghép sai lượt sửa chữa.

### 9.2 Phạm vi các con số

- **Danh sách hồ sơ**: hồ sơ nghiệp vụ không hủy, theo quyền người dùng, phân trang từ `Chỉ mục hồ sơ`.
- **Danh sách thiết bị dashboard**: toàn bộ năm từ 2024 đến năm hiện tại, nguồn hybrid, phân trang/tìm kiếm server-side.
- **Thiết bị tiếp nhận trong kỳ**: record có ngày nhận hợp lệ và nằm trong tháng/năm đang chọn.
- **Tích lũy**: tổng có thể phân bổ theo ngày nhận hợp lệ; nhãn UI giữ ngắn là `Tích lũy`, thông tin độ phủ ngày nằm trong tooltip/note.
- **Đã trả**: dựa trên ngày trả khách.
- **SLA**: chỉ tính record có ngày nhận và ngày trả hợp lệ, ngày trả không trước ngày nhận; đạt khi không quá 7 ngày.
- **Linh kiện theo kỳ**: từ bản ghi sử dụng thực tế theo ngày dùng/chuẩn hóa tùy nguồn; không suy linh kiện từ số Fan đã trả, không trả hoặc số Fan nhận.
- **KPI thiết bị/hồ sơ**: Fan theo lô được tính là hồ sơ vận hành, không nhân theo số quạt vật lý. Giữ định nghĩa thiết bị/hồ sơ của từng nguồn như code hiện hành.
- **Tỷ trọng Model Fan**: cộng đủ số quạt vật lý theo Model/Mã Fan trên từng dòng, áp dụng cả nhập đơn/lô và chọn Tất cả thiết bị. Không dùng Model inverter thay Model Fan hoặc lấy số hồ sơ làm số quạt; ví dụ2hồ sơ tổng9Fan cùng Model có SL9 ở tỷ trọng và2hồ sơ ở KPI.

Tổng Danh sách hồ sơ, Danh sách thiết bị và Tích lũy không được ép bằng nhau một cách cơ học. Khi lệch, đối soát theo: hồ sơ hủy, quyền center, provenance, ngày nhận thiếu/sai, center chưa chuẩn hóa, bản ghi trùng/mơ hồ và số lượng.

## 10. Cache, tốc độ và truy cập đồng thời

### 10.1 Database revision

- Script Property `PORTAL_DATA_REVISION` là khóa invalidation chung.
- Mỗi mutation thành công phải gọi theo thứ tự phù hợp:
  1. ghi bảng nghiệp vụ;
  2. `syncDashboardProjectionCase_(caseId)` hoặc remove projection nếu hủy;
  3. `syncPortalCaseIndexCase_(caseId)`;
  4. `bumpPortalDatabaseRevision_()`.
- Frontend poll revision khoảng 60 giây và tự đồng bộ định kỳ khoảng 5 phút; user vẫn có nút đồng bộ thủ công.

### 10.2 Cache đọc

- Danh sách hồ sơ đọc `Chỉ mục hồ sơ`, không join lại toàn database mỗi lần.
- Cache list theo user + filter + revision, tối đa khoảng 5 phút và chỉ lưu response nhỏ hơn giới hạn CacheService.
- Shared table cache dùng revision và lease; chỉ một request dựng snapshot, request đồng thời có thể dùng stale-while-refresh thay vì cùng đọc Sheet.
- Lease hết hạn khoảng 45 giây để tránh builder chết làm khóa vĩnh viễn.
- Dashboard và ticket index cache theo version + revision + role + scope + kỳ; ticket index toàn năm được tái sử dụng cho phân trang/tìm kiếm.
- Response lớn được chia chunk để không vượt giới hạn 100 KB của CacheService.

### 10.3 Ghi đồng thời

- Google Sheets không có row transaction; mutation trên record hiện hữu dùng `ScriptLock`.
- Nếu một nhân viên khác đang ghi, request sau bị từ chối sớm và phải tải lại record mới nhất, không chờ rồi ghi đè dữ liệu cũ.
- Tạo hồ sơ dùng request ID idempotent, tách upload Drive khỏi lock và khóa lúc commit database.
- Không đặt thao tác Drive hoặc full-sheet scan bên trong lock dài.

### 10.4 Quy tắc hiệu năng khi thêm chức năng

- Không gọi `getDataRange()` nhiều lần cho cùng tab trong một request.
- Không rebuild toàn bộ projection/index sau mỗi mutation; chỉ cập nhật case bị tác động.
- Không tải toàn bộ 1.500+ hồ sơ về browser rồi mới phân trang.
- Không cache dữ liệu thiếu revision hoặc cache response stale vào cache user/filter.
- Khi thêm một bảng vào response dashboard, cân nhắc kích thước serialization và chunk cache.

## 11. Quy tắc giao diện

- Nút mũi tên thao tác luôn hiển thị.
- Nút `X` nằm kế bên mũi tên; đỏ khi được xóa, xám/disabled khi không được xóa.
- GSP và MA nằm trước cột Thiết bị/SN trên danh sách thiết bị; dữ liệu được nhập trong cập nhật công việc.
- Link hồ sơ Drive phải click được sau khi upload thành công.
- Trạng thái đồng bộ hiển thị `Đã đồng bộ` hoặc `Chưa đồng bộ` kèm thời gian, có khoảng cách rõ ràng.
- Linh kiện sử dụng ưu tiên bố trí ngang/compact.
- Pagination danh sách thiết bị và danh sách hồ sơ dùng cùng ngôn ngữ/kích thước.
- Vòng xoay chỉ dành cho trạng thái tải/gửi thực tế: loading row, tìm kiếm, tải chi tiết, đồng bộ hoặc nút đang gửi.
- `Đang xử lý` trong cột trạng thái là dữ liệu nghiệp vụ, tuyệt đối không gắn spinner.
- Loading phải có `role=status`/`aria-live` phù hợp; hỗ trợ `prefers-reduced-motion`.

## 12. Quy trình sửa code

1. Kiểm tra `git status` và bảo toàn thay đổi không liên quan.
2. Đọc `AGENTS.md` và đúng phần liên quan trong tài liệu này.
3. Tìm code bằng `rg`; không đọc toàn bộ repo nếu không cần.
4. Nếu sửa backend, kiểm tra cả `Code.gs` và `LegacyDashboardApi.gs` vì version/cache/merge liên kết nhau.
5. Nếu sửa mutation, xác nhận projection, case index, revision và audit đều được cập nhật.
6. Nếu sửa frontend embedded:
   - sửa `docs/entry.html`;
   - giữ `version final/Index.html` tương ứng nếu cùng component;
   - tăng query `v=` của iframe trong `docs/live-data.js`.
7. Nếu sửa `docs/live-data.js`, tăng query `live-data.js?v=` trong `docs/index.html`.
8. Bổ sung regression assertion vào `version final/tests/validate.mjs`.
9. Chạy:

```powershell
node "version final/tests/validate.mjs"
git diff --check
```

10. Commit với thông điệp mô tả outcome; chỉ push/deploy khi được yêu cầu hoặc nằm trong workflow người dùng đã giao.

## 13. Ma trận triển khai

### A. Chỉ thay đổi GitHub frontend (`docs/*`)

Áp dụng cho CSS, spinner, bố cục, text, render, filter phía trình duyệt.

1. Chạy validation.
2. Bump cache key:
   - `entry.html` đổi -> tăng `v=` iframe trong `docs/live-data.js`;
   - `live-data.js` đổi -> tăng `live-data.js?v=` trong `docs/index.html`;
   - CSS đổi -> tăng `visual-polish.css?v=` trong `docs/index.html`.
3. Commit và push `origin/main`.
4. Chờ GitHub Pages 1–3 phút.
5. `Ctrl + Shift + R`.

Không cần cập nhật Apps Script cho trường hợp này.

### B. Thay đổi backend Apps Script

Áp dụng cho dữ liệu, quyền, API, cache backend, workflow, KPI/merge.

1. Thay đúng module mà release yêu cầu, giữ các module khác đang dùng; không mặc định chỉ hai file Code/Legacy là đủ hoặc thay cả project bằng một ZIP cũ. Kiểm tra danh mục trong PRODUCTION-STATE.md.
2. Nếu release có thay UI trực tiếp Apps Script, thay thêm `version final/Index.html`.
3. Save.
4. Chạy audit/migration được ghi rõ cho release; không chạy repair tùy tiện.
5. **Deploy -> Manage deployments -> Edit -> New version -> Deploy** trên deployment hiện tại.
6. Không tạo deployment URL mới.
7. Kiểm tra `getBootstrap`/endpoint trả đúng `APP_VERSION`.
8. Reload GitHub portal.

Riêng upload1.11.18: adapter/TemporaryUploads/SupplementalAttachments thuộc backend chính; StorageWorker.gs và manifest riêng thuộc project Gmail lưu trữ. Không thay OAuth/Cloud/ClientID hoặc URL chính. Nếu hơn50ScriptProperties, dùng form owner-only trên /dev, không reset property/session.

Push GitHub không tự deploy Apps Script; Save Apps Script cũng không cập nhật deployment đang chạy nếu chưa tạo New version.

### C. Thay đổi cả frontend và backend

1. Deploy backend Apps Script trước, giữ nguyên URL.
2. Push frontend có cache key mới.
3. Kiểm tra bằng account quản lý và ít nhất một account center.
4. Test cold load, refresh, hai user thao tác đồng thời, upload, tìm kiếm và phân trang.

## 14. Audit/repair lịch sử

Chỉ chạy khi cần đối soát hoặc release yêu cầu, theo đúng thứ tự:

1. `auditHistoricalWarrantyData` — chỉ đọc.
2. `repairHistoricalWarrantyData` — sửa bảo hành lịch sử an toàn.
3. `auditHistoricalDashboardProjection` — chỉ đọc.
4. `repairHistoricalDashboardProjection` — sửa projection theo provenance.
5. `rebuildPortalCaseIndex` — dựng lại index hồ sơ.
6. Tùy chọn `warmPortalReadCache` — làm nóng index nhẹ.

Mỗi hàm phải `Execution completed` trước khi chạy hàm kế tiếp. Nếu audit/repair lỗi data validation, sửa code để mở rộng validation hợp lệ; không xóa validation toàn cột và không sửa dữ liệu nguồn bằng tay để ép hàm chạy.

Repair phải:

- khớp `year!row`;
- không ghi đè hồ sơ đã user chỉnh sửa;
- báo `skipped` khi thiếu nguồn, mơ hồ hoặc identity thay đổi;
- đồng bộ cả hồ sơ và projection liên quan.

## 15. Checklist nghiệm thu nhanh

- Login: manager, center manager, center staff, user không hợp lệ.
- Danh sách hồ sơ: cold load, cache load, refresh, search, filter, pagination, chi tiết.
- Tiếp nhận: S/N có/không có bảo hành, Fan không S/N, upload, request timeout/idempotency.
- Bảo hành: pending, xác nhận, đổi kết quả có ghi chú.
- Kỹ thuật: GSP/MA, lỗi, linh kiện, hoàn tất bắt buộc ngày/kết quả.
- Luân chuyển: routing ngoài center -> Sungrow; Sungrow -> center; nhận hàng.
- Xóa: case pending được xóa; case đã xác nhận/đã chuyển không được xóa; không xuất hiện lại ở dashboard.
- Dashboard: tháng/năm, tất cả center, ticket toàn năm, số trang, cumulative/date coverage, SLA.
- Concurrency: hai người sửa cùng record; request sau phải được yêu cầu reload thay vì ghi đè.
- UI loading: có spinner khi tải thật; không có spinner cạnh nhãn nghiệp vụ `Đang xử lý`.

## 16. Khi nào cập nhật tài liệu này

### Chuẩn bị migration XBSolar — 02/10/2026

Bản local dựa trên remote HEAD mới nhất 84f77af505d3f03f589857ec46152b49c6b1955b. 711 hồ sơ XB được lập gói: **605 thêm mới, 106 hợp nhất, 0 tạm giữ**. A2011057375 có lượt đầu Sungrow → XB và hai lượt XB độc lập; không gộp ba lần thành một. Ba cặp ID giữ lượt 2025 độc lập, ghép XB vào ID 2026 theo xác nhận. A2542704238 là XB → Sungrow → XB trả khách; không dùng ngày máy gốc chuyển Mekong làm ngày trả khách. Hai linh kiện đã tồn tại giữ ID và số lượng, không nhập trùng. 19 hồ sơ hoàn tất kỹ thuật có ghi chú XB bổ sung chi tiết sau.

Đã xây writer local trên backend ứng viên 1.10.3-case-corrections: XBSolarMigrationPlan.gs và XBSolarMigration.gs, chỉ lệnh Editor riêng tư; preflight toàn bộ nguồn live/hash/schema, backup Drive, journal theo hồ sơ, ScriptLock và khóa ghi tạm thời, batch nguồn nguyên tử, đọc lại, audit, projection/index/revision, resume chống lặp và rollback có kiểm tra xung đột. Giữ các ID cũ và provenance; rollback hồ sơ mới bằng hủy mềm. Các tab lịch sử không bị ghi.

HS-OLD-2025-0459 / A2010216461 có quản lý chỉnh sửa: giữ toàn bộ giá trị hồ sơ/công việc đã sửa, chỉ nối ghi chú và thêm lịch sử nguồn. Khác biệt về ngày, trạng thái và bảo hành được ghi trong báo cáo để quản lý đối soát. Hai công việc cũ HS-OLD-2024-0015/0017 có ngày chuyển 02/01/2024 trước ngày nhận 19/01/2024; preview báo riêng, giữ nguyên hai giá trị nguồn, không tự sửa lịch sử Sungrow. Migration chặn lỗi thứ tự ngày mới.

**Chưa deploy hoặc nhập production.** Preview phải khớp live mới nhất; gói cũ sẽ bị chặn nếu nguồn đã thay đổi. Backend/frontend phải deploy đồng bộ bản mới nhất. Các chức năng khác giữ nguyên ngoài quyền quản lý sửa thông tin hồ sơ và khóa ghi tạm thời khi nhập. Helper applyXBSolarImport() cũ vẫn khóa, không đưa vào deployment/API allowlist.

Hướng dẫn: [XBSOLAR-MIGRATION-CONTROLS.md](version%20final/XBSOLAR-MIGRATION-CONTROLS.md). Gói/snapshot/báo cáo riêng tư ở ../analysis/xbsolar/ (Git ignore). Khi triển khai phải hoàn tất smoke test account quản lý và center trước khi chạy nhập.

Cập nhật cùng commit khi thay đổi một trong các mục sau:

- version hoặc file canonical;
- schema/tab/header;
- quyền hoặc capability;
- trạng thái/transition;
- cách merge/count KPI;
- cache/revision/concurrency;
- các bước deploy/migration;
- cache key frontend hoặc kiến trúc hosting.
