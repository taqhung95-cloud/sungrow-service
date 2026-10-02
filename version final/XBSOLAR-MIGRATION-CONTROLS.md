# Kiểm soát nhập XBSolar — 02/10/2026

Trạng thái: code và gói nhập đã chuẩn bị tại workspace; **chưa deploy, chưa ghi production**. Bản chuẩn là thư mục `production-auth-audit`, dựa trên HEAD mới nhất đã đối chiếu remote `84f77af505d3f03f589857ec46152b49c6b1955b`. Không triển khai `version final/Code.gs` cũ ở ngoài thư mục audit.

## Phạm vi phiên bản

Backend ứng viên `1.10.3-case-corrections`, frontend dashboard cache 71, trang nhập cache 66, form-drafts.js v1. Bổ sung quản lý toàn hệ thống sửa thông tin hồ sơ bằng `correctCase`, yêu cầu lý do và revision mới nhất. Mã hồ sơ và quan hệ con không đổi. Nhân viên center không có quyền này. Các chức năng dashboard, tiếp nhận, bảo hành, kỹ thuật, luân chuyển và tìm kiếm giữ luồng hiện hành. Guard nhập chỉ tạm ngừng ghi khi migration đang hoạt động.

Theo yêu cầu tiếp ngày 02/10, bổ sung nháp riêng theo account/thao tác/ID. Người dùng vẫn gõ form trong đợt nhập; submit gặp khóa không ghi database và giữ nháp. Nháp ở trình duyệt 7 ngày, không lưu token/nội dung file, chỉ xóa khi server xác nhận thành công. Sau reload, chỉ khôi phục nếu các giá trị nguồn ban đầu vẫn khớp; nếu khác phải đối chiếu, không tự ghi đè. Không có hàng đợi tự submit. Cache/index và ScriptLock hiện hành phục vụ nhiều người vẫn giữ. Manifest bổ sung userinfo.email để xác định đúng quản lý chạy migration.

Người dùng đã chấp thuận triển khai và nhập. Hiện execution bị chặn vì kênh trình duyệt không khởi tạo được, máy chưa có phiên clasp. Giữ thứ tự backend → frontend → nghiệm thu → preview/backup/nhập; chưa ghi production và không bỏ guard để nhập qua connector.

Gói JSON đã tải vào đúng thư mục riêng chứa database production, xác minh metadata owner/parent/size và không chia sẻ. File ID/hash cho operator được giữ ngoài Git trong `../../analysis/xbsolar/deployment-properties.txt`; checkpoint `deployment-checkpoint.json`. Khi resume không cần tải thêm một bản gói giống nhau. Archive backend sẵn ở `../../analysis/xbsolar/release-backend-1.10.3.zip`.

Triển khai đồng bộ Code.gs, Index.html, các file backend hiện hành và **XBSolarMigrationPlan.gs + XBSolarMigration.gs**. Các lệnh migration kết thúc bằng `_`, không được đưa vào API allowlist hay gọi từ giao diện web. Frontend dùng docs/entry.html và các cache key tương ứng.

## Quy tắc dữ liệu đã chốt

- 711 hồ sơ nguồn: 605 hồ sơ mới, 106 hồ sơ hợp nhất. Dùng mapping theo lượt bảo hành/provenance, không dùng riêng SN làm khóa.
- Luân chuyển center giữ ID hồ sơ; thêm công việc và liên kết gửi/nhận cùng hồ sơ. Các lượt bảo hành độc lập giữ ID riêng.
- A2011057375: lượt đầu Sungrow → XB giữ HS-OLD-2024-0526; hai lượt XB độc lập giữ HS-XB-OLD-00196 và HS-XB-OLD-00254.
- Ba cặp ID 2025/2026 giữ lượt 2025 độc lập và ghép lượt XB với ID 2026 đã xác nhận.
- A2542704238: XB → Sungrow → XB trả khách 04/02/2026; hoàn tất kỹ thuật 02/02. Chặng đổi máy và PN A0SG0179 thuộc công việc Sungrow. Việc máy gốc chuyển Mekong 10/02 không phải ngày trả khách.
- Hai linh kiện đã tồn tại của A2591712186/A2591609814 dùng lại ID, không thêm dòng/cộng thêm số lượng. Hai máy này do Sungrow xử lý cuối cùng.
- SN gốc giữ ở hồ sơ; SN đổi ghi chú, PN máy đổi theo bảng tra/xác nhận, số lượng 1. DTSD1352 giữ SN gốc 24020700030610; SN receive là hàng đổi.
- Thiết bị gộp tách thành hồ sơ từng SN; bốn mã MC4 tách riêng, mỗi mã số lượng 18 trên từng SN theo nguồn.
- Quy tắc ngày/thiếu dữ liệu đã được áp dụng trong converted v12: test cuối, test sau giao sửa bằng ngày giao, sự kiện trước nhận đảo lại theo xác nhận; có spare part dùng ngày repair làm hoàn tất. Thiếu receive dùng ngày giao theo xác nhận; không tự bịa ngày chuyển giữa center.
- Có PN thiếu lượng điền 1; có lượng thiếu PN giữ tên phần hỏng. Không có linh kiện để trống. Thiếu Drive bỏ qua. 19 hồ sơ đã hoàn tất kỹ thuật giữ ghi chú XB cần bổ sung thông tin kỹ thuật/linh kiện sau.

**Bảo vệ chỉnh sửa quản lý:** HS-OLD-2025-0459 / A2010216461 có sửa tay trên production. Giữ các giá trị hồ sơ và công việc đã sửa; chỉ nối ghi chú, thêm lịch sử từ nguồn và chặng XB. Production đang ghi nhận ngày nhận 04/09/2025, đang xử lý, bảo hành chờ xác nhận, chưa có ngày trả; nguồn XB nhận 24/09, trả 16/10 và trong bảo hành. Đây là khác biệt cần quản lý xem lại bằng chức năng sửa hồ sơ, không cho migration tự ghi đè. Gói Markdown liệt kê giá trị hai phía.

Hai bất thường ngày có sẵn trên production được giữ và báo trong preview/báo cáo: HS-OLD-2024-0015 / A2009280803 và HS-OLD-2024-0017 / A2010252623 có công việc nhận 19/01/2024 nhưng ngày chuyển 02/01/2024. Migration không tự thay ngày nguồn Sungrow cũ. Guard chặn mọi lỗi thứ tự ngày mới hoặc do thay đổi ngày gây ra; các bất thường cũ chỉ được giữ khi cả hai giá trị không đổi, để quản lý đối chiếu nguồn trước khi sửa.

## Gói và kiểm tra trước ghi

File riêng tư (Git ignore): `../../analysis/xbsolar/migration-package.json` và `.md`; snapshot 6 bảng là migration-baseline-full.json. Gói có SHA-256, mapping, before/after từng dòng và số lượng kỳ vọng. Không commit dữ liệu khách hàng vào Git.

```powershell
node 'production-auth-audit/version final/tools/build-xbsolar-migration.mjs' 'analysis/xbsolar/output-v12/converted.json' 'analysis/xbsolar/migration-baseline-full.json' 'analysis/xbsolar/production-merge-audit.json' 'analysis/xbsolar/migration-package.json'
```

Sau khi deploy bản ứng viên, đưa JSON vào Drive riêng tư của tài khoản quản lý, cấu hình Script Properties:

| Property | Giá trị |
|---|---|
| XBSOLAR_MIGRATION_BUNDLE_FILE_ID | ID file JSON đã review |
| XBSOLAR_COMMIT_PLAN_HASH | SHA-256 chính xác trong báo cáo, chỉ đặt sau khi chấp thuận gói |
| XBSOLAR_CASES_PER_RUN | 1–10; mặc định 5 |

Chạy `xbsolarMigrationPreview_()` từ Apps Script Editor bằng quản lý toàn hệ thống đang active. Preview không ghi, không tự cấp quyền commit. Sai version, DB, hash, header, ID, khóa ngoại, hồ sơ con khác case, before snapshot hoặc công thức tại ô cần đổi đều chặn trước ghi. Baseline phải khớp **toàn bộ 6 bảng live**; nếu website đã cập nhật từ khi lấy snapshot, đọc lại và lập gói mới, không ép bỏ qua kiểm tra.

Tài khoản thực thi phải có quyền Sheets/Drive/UrlFetch và Google Sheets API hoạt động. Lỗi OAuth/API phải xử lý trước khi nhập. Review preview và hồ sơ được bảo vệ, chốt hash rồi mới prepare.

## Nhập có kiểm soát

1. `xbsolarMigrationPrepare_()`: dưới ScriptLock, xác minh baseline, sao lưu toàn bộ spreadsheet vào Drive riêng tư, tạo manifest/journal, khóa ghi web và bảo vệ 6 bảng nghiệp vụ. Không xóa protection có sẵn.
2. `xbsolarMigrationContinue_()`: cùng tài khoản đã prepare, cùng gói/hash/journal. Mỗi lượt tối đa 1–10 hồ sơ, giới hạn thời gian. Lặp lệnh cho đến trạng thái COMMITTED.
3. `xbsolarMigrationStatus_()`: kiểm tra cursor, lỗi, backup và revision. Không có trigger tự động được tạo.
4. Mỗi hồ sơ: ghi journal trước; đối chiếu before/after live; ghi các thay đổi nguồn trong một batch; đọc lại; ghi audit đúng một lần; đồng bộ projection/index và revision; lưu checkpoint.
5. Hậu kiểm toàn bộ dữ liệu đúng gói dự kiến mới bỏ protection do migration tạo và mở lại thao tác ghi web.

Giữ định dạng ô khác và công thức không bị sửa; chỉ cập nhật ô có khác biệt. Ngày là kiểu ngày, số lượng là số, SN/PN/liên hệ là text. Chỉ mở rộng grid khi cần, không chèn dòng làm đổi vị trí bản ghi cũ. Không sửa tab lịch sử 2024/2025/2026. Projection/index là dữ liệu dẫn xuất, dựng lại từ nguồn mới.

Số dòng dự kiến: hồ sơ 2.122; công việc 2.230; linh kiện 2.709; lỗi 3.058; luân chuyển 106; tạm dừng SLA 1.

## Khi lỗi và khôi phục

Không gửi lại batch mù khi mất phản hồi: chạy continue dùng journal; dữ liệu đã đúng after sẽ được bỏ qua. Lỗi audit/đồng bộ/checkpoint giữ khóa và cursor để tiếp tục đúng bước. Không xóa journal, active flag, thay gói hoặc tự sửa nguồn để vượt lỗi.

Để khôi phục, đặt `XBSOLAR_MIGRATION_ROLLBACK_REASON` (bắt buộc, tối đa 500 ký tự), chạy `xbsolarMigrationRollback_()` cùng tài khoản theo từng lượt đến ROLLED_BACK. Hồ sơ hợp nhất được phục hồi before; dòng con mới của chúng được làm trống. 605 hồ sơ mới được đánh dấu Đã hủy và giữ lịch sử/provenance, không xóa vật lý. Nếu dữ liệu đã có chỉnh sửa sau nhập, rollback dừng khi phát hiện khác biệt để tránh ghi đè; cần đối soát, không tự ép khôi phục. Backup và audit vẫn được giữ.

Các request trong một Sheets batch được Google áp dụng nguyên tử; projection/index/audit là bước riêng, được journal bảo vệ và có thể tiếp tục. [Tài liệu Google Sheets batchUpdate](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate). ScriptLock và protection ngăn các thao tác ghi của web và editor khác; chủ sở hữu vẫn có thể sửa trực tiếp Sheet, nên phải giữ cửa sổ nhập không chỉnh nguồn. Đối chiếu live và hậu kiểm giúp phát hiện thay đổi ngoài luồng, không thể bảo đảm tuyệt đối với chỉnh sửa đồng thời của chủ sở hữu.

## Xác minh và nghiệm thu

Các test riêng kiểm tra quyền quản lý, reason/revision, ngày/va chạm, UI sửa hồ sơ; migration kiểm tra hash/consent, mapping, ID độc lập, tái sử dụng linh kiện, bảo vệ sửa tay, sao lưu/protection, mất phản hồi, lỗi đồng bộ, nhập lại và rollback. Test toàn bộ gói mô phỏng 711 hồ sơ, so sánh tất cả dòng dự kiến, rồi đảo ngược để kiểm tra toàn bộ dữ liệu gốc được phục hồi và hồ sơ mới được hủy mềm.

```powershell
node 'production-auth-audit/version final/tests/validate.mjs'
node 'production-auth-audit/version final/tests/case-corrections.mjs'
node 'production-auth-audit/version final/tests/correction-ui.mjs'
node 'production-auth-audit/version final/tests/xbsolar-migration.mjs'
node 'production-auth-audit/version final/tests/xbsolar-migration-full.mjs' 'analysis/xbsolar/migration-package.json'
```

Kết quả kiểm thử local ngày 02/10/2026: tất cả lệnh trên đã qua; hai bộ chuyển đổi/merge ở thư mục ngoài audit cũng qua; git diff --check qua. Mô phỏng toàn bộ thực hiện 10.208 request nguồn cho 711 hồ sơ, kiểm tra nhập lại không ghi thêm, đạt đủ số dòng dự kiến. Rollback phục hồi tất cả dòng gốc, giữ 605 hồ sơ mới ở trạng thái Đã hủy và loại quan hệ luân chuyển do merge tạo. Guard bổ sung về thứ tự ngày cũng đã được kiểm thử: chặn lỗi mới, chỉ báo lỗi nguồn cũ có giá trị không đổi.

Đây là kiểm thử local/mô phỏng, chưa thay thế nghiệm thu OAuth, quyền tài khoản và thao tác thật sau deploy. Khi release cần kiểm tra quản lý/nhân viên center, cold load/refresh, tiếp nhận/upload, cập nhật kỹ thuật, luân chuyển, tìm kiếm và dashboard trên đúng deployment mới nhất trước nhập.
