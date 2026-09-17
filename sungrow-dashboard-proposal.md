# Đề xuất Sungrow Service Center Dashboard

Ngày rà soát: 17/09/2026. Trạng thái: đề xuất để thống nhất trước triển khai.

## 1. Phương án đề xuất

Google Sheets là nơi nhóm cập nhật dữ liệu. Web dashboard chỉ đọc, có đăng nhập và giới hạn người xem. Một dịch vụ phía máy chủ đọc Sheet, chuẩn hóa dữ liệu, tính chỉ số và lưu bản dữ liệu gần nhất. Giao diện có thể dùng React/Next.js; chưa cần xây hệ thống quản lý sửa chữa hay cơ sở dữ liệu nghiệp vụ riêng cho phiên bản đầu.

Luồng: Google Sheets → đọc bằng quyền chỉ xem → chuẩn hóa/kiểm tra → dữ liệu báo cáo → dashboard.

Tách riêng linh kiện thay sửa và linh kiện xuất kho theo lựa chọn của người dùng. Không cộng hai nhóm thành một tổng tiêu hao. Một lần xuất kho chưa chứng minh linh kiện đã lắp; phần thay sửa có thể sử dụng linh kiện đã xuất từ kỳ trước.

Tần suất đề xuất: làm mới 15 phút và nút làm mới thủ công. Khi đọc nguồn lỗi, giữ bản thành công gần nhất, hiển thị thời điểm đồng bộ và tình trạng dữ liệu cũ. Thời điểm đọc nguồn khác thời điểm người dùng sửa dữ liệu.

## 2. Những gì đã kiểm tra ở Excel

Nguồn: Record Warranty & Extreme Error.xlsx. Đã đọc cấu trúc và dữ liệu lưu trong XML của XLSX; không sửa workbook, không chạy hay tính lại công thức Excel. Thư viện đọc thông thường gặp lỗi metadata font, nên dùng XML để kiểm tra dữ liệu.

- Có 9 tab, 5 tab ẩn. Ba tab Warranty_Tracking hiển thị không có merge: 2024 có 637 dòng nghiệp vụ ứng viên, 2025 có 691, 2026 có 184. Dòng có ít nhất một thông tin B/C/D/E được tính; bỏ dòng chỉ có STT. Đây chưa phải tổng số máy hay số phiếu duy nhất.
- Tab 2025 ẩn có khoảng trắng cuối tên, trùng nguyên nội dung 662 dòng với tab 2025 hiện, nhưng có nhiều trạng thái/ngày/linh kiện khác nhau. Không tự chọn bản hiện là bản mới nhất; cần xác nhận nguồn chính và đối chiếu khác biệt trước nhập.
- Ba dòng cuối có thông tin máy ở tab 2025 (690–692) trùng S/N và ngày nhận với ba dòng đầu tab 2026 (2–4). Cần xử lý như ứng viên cùng phiếu, không tự cộng và không tự xóa theo S/N.
- Năm tab không hoàn toàn khớp năm ngày nhận: tab 2025 có ngày 2026; tab 2026 có hai ngày nhận năm 2025. Cần xác minh thay vì ép ngày theo tên tab.
- Cột M Warranty confirmation chứa trong/ngoài bảo hành; N Warranty Status chứa kết quả/trạng thái sửa; Q Delivery Status chứa giao trả; R Status của 2025/2026 có Good/New/Failed và vài giá trị cần làm rõ. Không dùng R làm trạng thái xử lý.
- Năm 2024 có 28 cột chính, 2025/2026 có 29 cột chính; nhóm PN bị dịch cột. Hai cột cùng tên Qty 3; cần ánh xạ đúng từng cặp PN–Qty. Tab 2026 còn có dữ liệu mã RW ở cột AD không có tiêu đề.
- Một dòng có thể là lô Fan: tab 2025 dòng 3 ghi Fan (34), không có S/N. Cần phân biệt số phiếu và số thiết bị, không coi mỗi dòng là một máy. Có S/N lặp theo lượt sửa; S/N không phải khóa phiếu.
- 2026: 137 dòng có trạng thái Đã giao máy, 14 dòng thiếu Return date. Có 3 dòng ngày trả trước ngày nhận. 2025 có 5 dòng thiếu ngày nhận.
- 2026 có 169 dòng PN/số lượng sau tách bốn cặp; toàn bộ Receive spare part date trống. Có phiếu ghi PN nhưng note vẫn nói thiếu board. Chưa đủ cơ sở tính đã dùng theo tháng.
- CCVT_Tracking có 13 vùng merge, phần lớn ở ngày xuất/mã GSP; có #NAME? tại E523:F523. Có cả dòng vật tư riêng (830), vì vậy không lọc CCVT bằng điều kiện phải có máy/SN. Chỉ kế thừa giá trị trong đúng vùng merge được xác minh, không điền xuống mọi ô trống.

Ngày nhận gần nhất trong các tab tracking hiển thị là 14/09/2026; một số ngày sửa/trả đến 16/09/2026. Điều này không chứng minh nguồn đã đầy đủ tới ngày đó. Các kết luận chỉ áp dụng cho file đã cung cấp, chưa đối chiếu Google Sheets trực tiếp.

## 3. Mô hình dữ liệu đề xuất

Bản markdown nên đổi từ 2 tab thành 3 bảng nghiệp vụ cùng danh mục dùng chung:

| Bảng | Một dòng biểu thị | Trường chính |
|---|---|---|
| ServiceTickets | Một lượt tiếp nhận/sửa chữa, có thể là một lô | TicketID, DeviceType, SN, Model, DeviceQuantity, ReceivedDate, Distributor, Sender, ServiceCenter, WarrantyCoverage, RepairStatus, DeliveryStatus, DeviceCondition, CheckedDate, RepairCompletedDate, ReturnedDate, ServicePurpose, Note |
| RepairParts | Một linh kiện trong một phiếu sửa | PartLineID, TicketID, PN, Quantity, UsageStatus, UsedDate |
| WarehouseIssues | Một dòng linh kiện xuất kho | IssueLineID, GSPNo, PN, Quantity, ExportDate, Recipient, TicketID nếu đối chiếu được |
| Lookups | Danh mục chuẩn | PN–tên linh kiện–đơn vị, trạng thái, trung tâm, đối tác |

TicketID phải được tạo một lần và giữ nguyên, không phụ thuộc số dòng hay S/N. Mã RW/GSP giữ như mã tham chiếu vì một mã có thể bao gồm nhiều máy/dòng; chỉ dùng làm khóa sau kiểm tra tính duy nhất. Lưu sheet/dòng nguồn cho dữ liệu nhập lịch sử để truy vết.

Không suy Quantity thiết bị từ Quantity linh kiện. Nếu chỉ có lô và thiếu số thiết bị thì báo số phiếu; số thiết bị để chưa xác định.

Giữ nguyên Error Code và Issue 1–4 trong nguồn nếu thuận tiện nhập liệu; hệ thống tách thành danh sách lỗi cho báo cáo. Đếm mỗi loại lỗi tối đa một lần trên mỗi TicketID. Error Code và chẩn đoán Issue là hai góc nhìn riêng.

## 4. Cách tính chỉ số

| Chỉ số | Quy tắc đề xuất |
|---|---|
| Phiếu tiếp nhận trong kỳ | TicketID duy nhất, lọc ReceivedDate; tách lượt tiếp nhận và số thiết bị |
| Đang xử lý hiện tại | Nhóm trạng thái quy định rõ: tiếp nhận, kiểm tra, chờ linh kiện, đang sửa, chờ test; thiếu trạng thái vào nhóm chưa xác định |
| Hoàn tất kỹ thuật/chờ giao | Tách khỏi đang sửa; chưa coi là đã trả |
| Đã trả trong kỳ | Trạng thái giao trả đã xác nhận và ReturnedDate trong kỳ; thiếu ngày báo riêng, không tự gán tháng |
| Tăng/giảm tiếp nhận | So tháng đầy đủ với tháng đầy đủ; tháng đang chạy so cùng số ngày kỳ trước. Mẫu số 0 hiển thị chưa tính được phần trăm |
| Linh kiện đã thay sửa | SUM Quantity với UsageStatus = đã sử dụng và UsedDate trong kỳ; dòng thiếu ngày/trạng thái được báo riêng |
| Linh kiện xuất kho | SUM Quantity theo ExportDate hợp lệ; phiếu chưa xuất không được tính |
| Lỗi phổ biến | Số TicketID duy nhất theo lỗi/chẩn đoán, có nhóm chưa ghi nhận |
| Tuổi phiếu | Ngày báo cáo trừ ngày nhận cho phiếu mở có ngày hợp lệ; ngưỡng cảnh báo phải được thống nhất |

Không dùng công thức Status khác hoàn tất để suy mọi phiếu còn mở. Đổi máy, không sửa, trả không sửa và sửa nhập kho Good cần quy tắc kết thúc khác nhau. Bảo hành là điều kiện dịch vụ, không phải giai đoạn sửa chữa.

Không thể tái dựng chính xác tồn phiếu của mọi tuần quá khứ chỉ từ trạng thái hiện tại. Nếu cần báo cáo lịch sử này, bổ sung nhật ký thay đổi trạng thái hoặc bản chụp định kỳ sau khi triển khai. Thời gian sửa trung bình cũng cần ngày hoàn tất sửa rõ ràng; Check / Repair date hiện tại đang gộp hai nghĩa.

## 5. Giao diện và phạm vi phiên bản đầu

Giữ bảng màu cam/navy của bản mô tả. Dùng logo chính thức do doanh nghiệp cung cấp. Desktop là màn hình chính; bảng chi tiết hỗ trợ tìm SN/phiếu, lọc và mở chi tiết.

- Tổng quan: tiếp nhận theo tuần/tháng; đang xử lý hiện tại; chờ giao; đã trả trong kỳ; lỗi phổ biến; độ đầy đủ dữ liệu.
- Phiếu sửa chữa: tìm kiếm, lọc trung tâm/đối tác/loại máy, xem lỗi và linh kiện liên quan, sắp xếp tuổi phiếu.
- Linh kiện: hai tab Thay sửa và Xuất kho, mỗi tab có ngày ghi nhận và tổng riêng; có phân biệt linh kiện với đổi nguyên máy khi danh mục xác định được.
- Dữ liệu cần bổ sung: thiếu ngày, PN thiếu lượng, trạng thái chưa nhận diện, phiếu nghi trùng.

Bộ lọc thời gian áp dụng đúng ngày của từng chỉ số và được ghi rõ. Thẻ đang xử lý hiện tại không mất các phiếu cũ chỉ vì người xem chọn tháng này. Chưa đưa quản lý tồn kho, giá vốn, đặt mua hoặc nhập trực tiếp trên dashboard vào phiên bản đầu.

## 6. Kết nối và quyền truy cập

Đề xuất backend dùng Google Sheets API quyền chỉ đọc; OAuth hoặc tài khoản dịch vụ tùy chính sách tài khoản của nhóm. Khóa/token đặt phía máy chủ. Người xem phải đăng nhập và nằm trong danh sách cho phép, API báo cáo kiểm tra cùng quyền đó.

Không dùng nguyên mẫu Apps Script công khai trả toàn bộ dữ liệu trong bản markdown cho vận hành nội bộ. Google quy định quyền người truy cập và danh tính thực thi của web app riêng biệt; chạy dưới chủ sở hữu không có nghĩa chỉ chủ sở hữu xem được dữ liệu. Apps Script vẫn là lựa chọn nếu được cấu hình quyền phù hợp, nhưng không cần nó nếu backend đã đọc Sheets API.

Tài liệu kỹ thuật đã đối chiếu:
- https://developers.google.com/workspace/sheets/api/scopes
- https://developers.google.com/apps-script/guides/web

## 7. Lộ trình và điều kiện bắt đầu

1. Thống nhất bản 2025 nào là nguồn chính, cách xử lý bản còn lại; định nghĩa lô Fan, ngày giao trả, trạng thái kết thúc và ý nghĩa Status/Good/New/Failed.
2. Lập Google Sheets chuẩn trên bản sao, chuyển dữ liệu lịch sử và đối chiếu số phiếu/PN theo từng nguồn. Những dòng chưa rõ giữ nguyên và gắn cờ, không suy diễn để lấp dữ liệu.
3. Dựng dashboard đọc dữ liệu thật, cho nhóm đối chiếu các phiếu mẫu và tổng tuần/tháng; sau đó mới nối tự động và phân quyền.

Điều kiện nghiệm thu: không đếm trùng phiếu xuyên tab; không cộng xuất kho với thay sửa; mỗi KPI truy được danh sách phiếu/dòng tạo nên con số; thiếu dữ liệu không thành số 0; bộ lọc dùng đúng loại ngày; lỗi đồng bộ vẫn hiển thị trạng thái và dữ liệu gần nhất; quyền truy cập áp dụng cả giao diện và API.

Chưa triển khai ứng dụng, chưa sửa file nguồn, chưa tạo/chỉnh Google Sheets hoặc công khai dữ liệu. Notebook kiểm tra nằm ở analysis/source_audit.ipynb.

## 8. Kiến trúc triển khai đã thống nhất

Mỗi service center nhập liệu trên một Google Sheet được tạo từ cùng template Excel. Dashboard là website tĩnh deploy bằng GitHub Pages và gọi Google Apps Script Web App để lấy dữ liệu JSON.

Luồng triển khai: Google Sheets của từng center → Apps Script tổng hợp/chuẩn hóa → JSON báo cáo → GitHub Pages dashboard.

Apps Script duy trì một danh mục center gồm `CenterID`, `CenterName`, `SpreadsheetID`, `Active`, múi giờ và ngày bắt đầu báo cáo. Khi thêm center mới, tạo Sheet từ template và thêm một dòng cấu hình; frontend đọc danh sách center từ API, không sửa mã giao diện.

Mỗi phản hồi API cần có `schemaVersion`, `generatedAt`, `reportingPeriod`, danh sách center, `sourceUpdatedAt`, trạng thái đọc nguồn, độ đầy đủ dữ liệu và các bảng đã chuẩn hóa. Spreadsheet ID và cấu hình nguồn chỉ nằm trong Apps Script, không gửi xuống trình duyệt.

Apps Script nên kiểm tra tên cột/schema, chuẩn hóa trạng thái và cache kết quả trong 5–15 phút. Nếu một Sheet lỗi, API trả dữ liệu của các center còn lại cùng cảnh báo riêng cho center lỗi; dashboard hiển thị lần cập nhật thành công gần nhất.

GitHub Pages không có lớp đăng nhập ứng dụng mặc định. Endpoint Apps Script có thể để chế độ cho phép nhận request từ Internet, nhưng mọi request phải qua lớp xác thực và phân quyền của ứng dụng; URL endpoint không được xem là bí mật.

### 8.1. Phương án bảo mật được chọn

Frontend dùng Google Identity Services để đăng nhập. Trình duyệt nhận Google ID token ngắn hạn và gửi token trong từng request tới Apps Script. Apps Script xác minh chữ ký/token và bắt buộc kiểm tra `aud`, `iss`, `exp`, `email_verified`; sau đó tra tài khoản trong danh mục `Users` phía máy chủ. Request thiếu token, token hết hạn hoặc tài khoản không còn hoạt động chỉ nhận phản hồi lỗi chung, không nhận dữ liệu.

Danh mục quyền có cấu trúc `GoogleSub`, `Email`, `CenterID`, `Role`, `Active`. Dùng `GoogleSub` làm định danh chính; email dùng để hiển thị và quản trị. Ba vai trò đầu tiên:

| Role | Phạm vi |
|---|---|
| `center_editor` | Xem và nhập/sửa phiếu của center được gán |
| `center_manager` | Xem dữ liệu và chất lượng dữ liệu của center được gán |
| `service_manager` | Xem/tổng hợp tất cả center, quản lý danh mục center và người dùng |

Apps Script tự suy ra `CenterID` từ người dùng đã xác thực. Client không được chỉ định Spreadsheet ID; `CenterID` do client gửi chỉ là ngữ cảnh giao diện và luôn bị đối chiếu với quyền máy chủ. Ánh xạ `CenterID → SpreadsheetID` và OAuth Client ID được lưu trong Script Properties hoặc bảng cấu hình chỉ chủ hệ thống được truy cập.

API chỉ trả trường đã phê duyệt cho đúng vai trò. Dashboard tổng hợp không trả ghi chú nội bộ, thông tin khách hàng, token, Spreadsheet ID hoặc dữ liệu thô không cần thiết. Cache phải tách khóa theo phạm vi quyền/center để không làm rò dữ liệu giữa người dùng.

Khi ghi dữ liệu, Apps Script kiểm tra whitelist trường, kiểu dữ liệu, độ dài, trạng thái và ngày; tạo TicketID phía máy chủ; dùng `LockService` để tránh hai người ghi đè cùng lúc; dùng `rowVersion` hoặc `updatedAt` để từ chối bản sửa đã cũ; ghi `AuditLog` gồm thời gian, GoogleSub/email, hành động, TicketID và trường đã thay đổi. Request ghi có `idempotencyKey` để gửi lại không tạo dòng trùng. Xóa phiếu là soft-delete và chỉ role được phép mới thực hiện.

Google OAuth Client ID và URL Apps Script có thể nhìn thấy trong mã GitHub Pages; đây là thông tin định tuyến, không phải bí mật. Không lưu client secret, khóa dịch vụ hoặc token dài hạn trong repository hay trình duyệt. ID token chỉ giữ trong bộ nhớ phiên và không ghi vào URL/log.

Phương án này phù hợp cho nhóm người dùng nhỏ có Google Account và dữ liệu vận hành đã được tối giản. Apps Script vẫn có giới hạn quota và chống lạm dụng chưa mạnh; nếu sau này chứa dữ liệu khách hàng nhạy cảm, có nhiều người dùng ngoài Google Workspace hoặc tần suất ghi cao, chuyển lớp API sang Cloud Run/Cloud Functions với Firebase Authentication, còn dữ liệu vẫn có thể nằm trong Google Sheets.

Tài liệu kỹ thuật đối chiếu:
- https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
- https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/reference/lock
- https://developers.google.com/apps-script/reference/properties
