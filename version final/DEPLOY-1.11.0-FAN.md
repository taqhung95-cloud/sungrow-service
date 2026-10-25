> **Tài liệu lịch sử theo phiên bản.** Đối chiếu [quy tắc hiện hành](../CURRENT-IMPLEMENTATION.md) và PRODUCTION-STATE.md trước khi dùng; không tự ghi đè backend hoặc chạy lại migration/repair từ hướng dẫn cũ.

# Phát hành 1.11.0 — Fan theo lô

Frontend chính: GitHub Pages, thư mục `docs/`. Giữ bố cục portal, form tiếp nhận, drawer chi tiết và màn hình cập nhật. Tên đơn vị trên bốn KPI: **Thiết bị/Hồ sơ**. Chưa thể tạo lô chỉ bằng cập nhật GitHub; backend phải được chuẩn bị và bật riêng.

## 1. Thay/thêm file trong Apps Script hiện tại

Thay toàn bộ nội dung bốn file đang có:

1. `Code.gs`
2. `LegacyDashboardApi.gs`
3. `ManagerDashboard.gs`
4. `ReportExport.gs` (thêm nếu project chưa có).

Thêm hai file **Script** mới, đúng tên, không phải HTML:

5. `FanLotRules.gs`
6. `FanLots.gs`

Thêm hoặc thay `PortalReadDiagnostics.gs`; các hàm Editor dùng file này để kiểm tra đúng tài khoản quản lý toàn hệ thống. Giữ nguyên các module khác đang chạy, nhất là TemporaryUploads, SupplementalAttachments, WorkOrderRules, Notifications, PortalSessions và CustomerDirectory. Không dán gộp nhiều module vào Code.gs. Không thay Spreadsheet ID hoặc deployment URL. Giao diện Apps Script trực tiếp không phải frontend của bản này; sử dụng portal GitHub Pages hiện hành.

## 2. Cho phép Google Sheets API

Trong Apps Script, **Services → + → Google Sheets API → Add**. Nếu dùng Google Cloud project riêng, bật Google Sheets API trong project đó. Các scope spreadsheets, Drive và external_request đã có trong manifest hiện hành. Lưu project và cấp quyền Google khi được yêu cầu.

## 3. Chuẩn bị và đối soát, chưa bật tạo lô

Thực hiện bằng tài khoản có vai trò quản lý toàn hệ thống trong database, khi ít người nhập liệu. Trong danh sách hàm Editor, chạy:

```text
chuanBiFanTheoLo
```

Hàm kiểm tra Sheets API và múi giờ UTC+7, tạo một bản sao đầy đủ của database trên Drive trước khi bổ sung schema. Execution log ghi `backupId`, `sourceUnchanged: true`, `enabled: false` và kết quả audit. Mở bản sao bằng ID trong log để kiểm tra tồn tại. Không xóa bản sao.

Chỉ bổ sung:

- Cuối `Hồ sơ thiết bị`: `Kiểu hồ sơ`, `Chi tiết lô Fan`.
- Cuối `Lỗi thiết bị`: `Mã dòng Fan`, `Số Fan xác nhận`.
- Cuối `Chỉ mục hồ sơ`: kiểu hồ sơ, S/N liên quan, tiến độ Fan.
- Hai tab mới: `Nhật ký lô Fan`, `Nhóm tiếp nhận Fan`.

Không đổi vị trí/tên cột đang có; không ghi tab 2024/2025/2026. `Chi tiết lô Fan` là snapshot JSON có schema, revision, mã dòng, số lượng, tiến độ và file ban đầu. Cột này do ứng dụng quản lý, không nhập tay. Giới hạn 120 dòng và 42.000 ký tự mỗi snapshot. Nhật ký từng thao tác nằm riêng, nên không làm snapshot tăng vô hạn.

Chạy tiếp:

```text
doiSoatFanTheoLo
diagnosePortalReadPath
diagnoseWebReadPaths
```

Audit phải có `ok: true`, `errors: []`, `pending: []`. Lưu kết quả đối soát và timing vào biên bản nội bộ. Hàm chẩn đoán chỉ trả số lượng/thời gian, không xuất thông tin khách hàng. Đây mới là thời gian trên production; kết quả kiểm thử local không thay thế bước này.

## 4. Bật backend và deploy trên URL cũ

Chạy `batFanTheoLo`; hàm tự đối soát lại và chỉ bật khi schema đã chuẩn bị, đã có backup và không có giao dịch chờ đồng bộ.

Sau đó **Deploy → Manage deployments → Edit → New version → Deploy** trên deployment hiện tại. Không tạo URL mới. Frontend sẽ nhận capability mới ở lần bootstrap tiếp theo. Đăng xuất/đăng nhập lại hoặc Ctrl+F5.

## 5. Đưa hồ sơ Fan đã có vào nhóm

S/N lặp nghĩa là nhiều Fan của cùng inverter. Cộng số lượng của các hồ sơ nguồn; không khử trùng S/N và không xóa hồ sơ.

Cách chọn chính xác trên portal: **Danh sách hồ sơ → Nhóm tiếp nhận Fan → Tìm khách hàng/S/N → chọn hồ sơ → Đối soát → Lưu nhóm**. Chỉ nhóm cùng khách hàng, center tiếp nhận và ngày nhận. Kết quả xem trước cho biết hồ sơ nguồn, S/N và tổng Fan; nguồn thay đổi sau xem trước sẽ bị chặn.

Cách xử lý một đợt bằng Editor, sau khi kiểm tra danh sách đề xuất:

```text
xemTruocNhomFanCu
apDungNhomFanCu
```

Hàm xem trước chỉ đề xuất nhóm hồ sơ **Quy trình mới**, loại Fan, còn hiệu lực, cùng khách hàng/ngày/center, chưa thuộc nhóm. Không xử lý lịch sử 2024–2026, không tự suy số lượng từ ghi chú. Đọc toàn bộ danh sách trong log; chỉ chạy hàm áp dụng nếu các nhóm đúng lần tiếp nhận thực tế. Preview có hiệu lực 30 phút và fingerprint nguồn phải còn khớp.

Áp dụng chỉ thêm liên kết nhóm; kiểm tra hash nguồn trước/sau và trả `sourceUnchanged: true`, `kpiUnchanged: true`. Hồ sơ nguồn, model inverter, bảo hành từng Fan, file và lịch sử giữ nguyên. Nhóm không cộng thêm KPI. Chạy lại không tạo thêm nhóm cho những hồ sơ đã liên kết.

## 6. Nghiệm thu sau deploy

- Inverter/Meter và Fan nhập thường vẫn tạo, tìm, duyệt bảo hành, cập nhật, luân chuyển và giao trả theo luồng hiện hành.
- Tạo lô dữ liệu nghiệp vụ thật: S/N lặp cộng Fan; Model là mã Fan; tổng Fan tự cộng; file chung/riêng đúng phạm vi.
- Tìm một S/N nằm trong lô: ra một hồ sơ lô; không tạo hồ sơ sửa inverter hoặc đổi trạng thái inverter.
- Hoàn tất và giao trả một phần: hồ sơ vẫn mở; giao hết mới đóng. Không trả vượt phần đã hoàn tất. Lần lưu lại cùng mã thao tác không cộng thêm số lượng/file/linh kiện.
- Linh kiện 4 + 2 = 6, không nhân theo số Fan hoặc S/N. Kiểm tra ngày dùng, PN, phạm vi và tab Linh kiện.
- Đối chiếu dashboard và Excel: thiết bị thường giữ cách tính hiện hành, lô mới tính 1 Thiết bị/Hồ sơ; số Fan ở cột/dòng phụ. Số giao từng phần thuộc ngày thực tế, kể cả khi lô chưa đóng. Không so lô mới với hồ sơ cũ như khối lượng công việc tương đương.
- Kiểm tra tài khoản center không xem/sửa ngoài quyền; thử hai người cập nhật cùng lô, bản cũ phải bị chặn và yêu cầu tải lại.
- Chạy lại `doiSoatFanTheoLo`, chẩn đoán cold/warm và một lượt trang kế tiếp. So timing với bước 3; chưa khẳng định tốc độ 10 tài khoản thực tế trước khi đo.

## 7. Khi cần dừng hoặc có lỗi

Chạy `tatFanTheoLo` để tắt ghi Fan mới; giữ backend có khả năng đọc dữ liệu lô và nguyên các tab/cột. Không rollback sang backend cũ sau khi có lô, vì backend cũ có thể hiểu số Fan là số Thiết bị/Hồ sơ và đóng toàn bộ lô.

Thao tác lô ghi nguồn, tiến độ và nhật ký trong một Sheets batch. Nếu đã ghi nhưng projection/index chưa xong, lô được đánh dấu chờ đồng bộ và chặn thao tác mới. Mở lại lô → **Đối soát đồng bộ**; retry giữ mã thao tác để không cộng hai lần. Nếu snapshot lệch nhật ký hoặc số lượng, hệ thống dừng; cần quản lý đối chiếu log và backup, không tự sửa tổng hay ghi đè database bằng backup.

Giới hạn đợt này: luân chuyển toàn bộ phần còn lại theo hồ sơ; chưa chia một lô cho nhiều center đồng thời. Mỗi lần ghi nhận giao trả chọn một S/N; có thể giao nhiều lần cho cùng S/N. File bổ sung tiếp tục tải bằng cơ chế upload hiện hành, sau đó gắn phạm vi trong phần tài liệu của lô.
