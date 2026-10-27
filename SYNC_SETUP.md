# Kết nối và đồng bộ đang dùng

Cập nhật: **27/10/2026**. Backend `1.11.20-sla-holds` đã được người dùng xác nhận deploy; số deployment version mới chưa được cung cấp. Frontend liveJS162/entry143 phát hành qua main sau backend. Xem [PRODUCTION-STATE.md](PRODUCTION-STATE.md) để phân biệt xác nhận triển khai, kiểm thử local và thử dữ liệu thật.

## Thành phần

| Thành phần | Nguồn và vai trò |
|---|---|
| Website | `docs/`, domain sungrow-service.sungrowvietnam.com.vn |
| Backend nghiệp vụ | Các module `version final/`, xem danh mục ở PRODUCTION-STATE.md |
| Upload riêng | `attachment-storage/StorageWorker.gs`, project Apps Script khác |
| Dữ liệu | Một spreadsheet production, các bảng nghiệp vụ và lịch sử |
| Người dùng/quyền | Tab `Người dùng`, xác thực Google và phiên portal |
| Cấu hình công khai | `docs/config.js`, giữ URL API chính và Client ID |
| Cấu hình riêng | Script Properties, không export lên Git |

Database production: `1EoYBTSAPPOne1VCUMTLQ7W_1jjDOQnQloDWdZyXM5xI`. Nguồn tra bảo hành mặc định: `1CPQkL-FJVxaXwuPKJUO-PnK9ML3s2KYXg8ZvmnfPev8`, có thể dùng override `WARRANTY_LOOKUP_SHEET_ID` theo cấu hình đã kiểm tra. Đây là ID tài nguyên, không phải credential và không cấp quyền truy cập.

## Đồng bộ nghiệp vụ

- Bảng hồ sơ/công việc/luân chuyển/lỗi/linh kiện/SLA là nguồn chính.
- Mutation cập nhật nguồn, projection, case index và revision; không dựng lại toàn bộ dữ liệu khi chỉ lưu một hồ sơ.
- Danh sách phân trang và lọc toàn bộ chỉ mục trên server; không quét lại lịch sử mỗi lần mở thẻ.
- Hồ sơ được định danh bằng case ID; lịch sử theo provenance, không dùng S/N làm khóa duy nhất.
- Center hiện tại sau nhận luân chuyển phụ trách xử lý và giao trả; center tiếp nhận giữ để đối soát.
- KPI hồ sơ và tỷ trọng Model Fan dùng hai đơn vị khác nhau; xem CURRENT-IMPLEMENTATION.md.
- Linh kiện được tính từ bản ghi sử dụng thực tế, không suy từ số Fan đã trả/không trả.

## Đồng bộ file đính kèm

Backend chính giữ actor/quyền/biên nhận và gọi worker bằng request có HMAC, nonce và thời hạn. Worker giữ file mới bằng `sungrowservicecenter@gmail.com`; không thực hiện nghiệp vụ database.

| Script Property | Project |
|---|---|
| `ATTACHMENT_STORAGE_SECRET` | Cùng một giá trị bí mật ở backend chính và worker |
| `ATTACHMENT_STORAGE_URL` | Chỉ backend chính; URL worker `/exec` |
| `ATTACHMENT_STORAGE_MODE=dedicated-v1` | Backend chính; bật định tuyến phiên mới |
| `TEMP_UPLOAD_ENABLED` và journal upload | Backend chính; giữ cấu hình đang có |

Không ghi giá trị khóa, token hoặc journal vào tài liệu. Không đổi email actor/audit thành email lưu trữ. Không đổi Cloud IAM, Google Client ID, database hoặc URL API chính để xử lý ownership file.

Phiên upload cũ giữ cách xử lý cũ; phiên mới dùng worker sau lúc bật. File cũ không tự chuyển owner. File/folder vẫn Hạn chế; endpoint Internet không đồng nghĩa chia sẻ file công khai.

## Khi cần cập nhật cấu hình

Theo đúng DEPLOY-1.11.18-ATTACHMENT-STORAGE.md. Nếu hơn50ScriptProperties, dùng form owner-only qua bản thử `/dev`; form merge đúng hai khóa URL/secret, không xóa session hay thuộc tính khác. Chạy preflight rồi cập nhật New version cùng deployment chính trước khi bật mode.

## Kiểm chứng

- Bộ kiểm tra local: `node "version final/tests/validate.mjs"`.
- Backend chính đã được quan sát triển khai Version73, cùng URL và tài khoản cũ.
- Probe có chữ ký giữa hai project đã hoàn tất không lỗi; người dùng xác nhận upload thực tế có owner mới.
- Không suy rằng mọi case lịch sử, mọi kịch bản lỗi hay mọi module ngoài Git đã được kiểm tra production chỉ từ lần thử này.
