# SLA theo khoảng dừng và ngày sẵn sàng giao — 27/10/2026

Trạng thái27/10/2026: người dùng xác nhận **đã deploy Apps Script** theo hướng dẫn1.11.20; chưa cung cấp số deployment version mới. Frontend liveJS162/entry143 được phát hành qua GitHub main sau xác nhận backend. Test local đã đạt; trạng thái kiểm tra/deploy Pages xem GitHub Actions. Chưa có xác nhận thử hồ sơ thật sau release. Không dùng bộ cleanup1.11.19 đã dừng.

## Quy tắc

- Không tự loại trừ toàn bộ thời gian từ sẵn sàng giao đến trả thực tế. Phải lưu từng khoảng dừng với lý do cụ thể.
- Trước sẵn sàng giao: Chờ linh kiện, Chờ phê duyệt bảo hành, Chờ khách hàng xác nhận, Yếu tố khách quan khác. Khoảng phải kết thúc không muộn hơn ngày sẵn sàng giao.
- Sau sẵn sàng giao: Khách hàng yêu cầu giữ hàng, Chờ vận chuyển, Chờ khách nhận hàng, Yếu tố khách quan sau sẵn sàng giao. Bắt đầu không trước ngày sẵn sàng giao, kết thúc không sau ngày trả thực tế.
- Ngày bắt đầu không trước ngày nhận; kết thúc không trước bắt đầu; không nhập ngày tương lai. Trong giai đoạn đang chờ được để trống ngày kết thúc, nhưng phải kết thúc trước khi xác nhận trả khách. Khoảng nội bộ phải được kết thúc khi chuyển sang sẵn sàng giao.
- Dùng “Cập nhật công việc” → “Tạm dừng SLA” → “Thêm khoảng tạm dừng”; lưu trước khi giao trả. Mỗi hàng lưu riêng lý do, ngày và ID; giữ cách lưu theo công việc hiện có. Chưa thêm màn hình/tab riêng hoặc tự suy nguyên nhân từ ngày giao.
- Kiểm tra cả khoảng đã lưu ở các chặng của hồ sơ khi đổi ngày nguồn, hoàn tất kỹ thuật và giao trả. Áp dụng thiết bị thường và Fan theo lô, giữ phân quyền hiện có. Fan theo lô dùng mốc sẵn sàng cấp hồ sơ hiện có; chưa phân bổ riêng thời gian dừng theo từng chiếc Fan/lần giao một phần.
- SLA = số ngày lịch nhận–trả trừ hợp các khoảng hợp lệ, không trừ trùng. Đạt khi thời gian sau trừ ≤7 ngày. Cùng công thức cho thẻ tổng quan, bảng center và dashboard quản lý; giữ trọng số thiết bị/hồ sơ.
- Khoảng nội bộ cũ vượt ngày sẵn sàng được giới hạn tại mốc sẵn sàng khi đọc KPI; không sửa dòng dữ liệu gốc. Muốn tính tiếp chờ giao phải nhập lý do sau sẵn sàng riêng. Khi sửa/giao trả, dữ liệu cũ sai ràng buộc bị chặn để người có quyền chỉnh rõ ràng. Lý do cũ ngoài danh mục vẫn giữ khi hiển thị và xử lý như khoảng trước sẵn sàng.

Ví dụ ngày nhận15/10, sẵn sàng21/10, trả26/10: thực tế11ngày. Chờ linh kiện17–21/10 trừ4ngày → SLA7ngày. Nếu thêm khách giữ21–24/10 và vận chuyển24–26/10 thì tổng trừ9ngày → SLA2ngày. Các giá trị trên dashboard là trung bình có trọng số của toàn bộ tập đủ điều kiện trong kỳ, không phải giá trị riêng hồ sơ.

## Triển khai thủ công

1. Trong **project Apps Script chính**, thay đủ: `version final/Code.gs`, `WorkOrderRules.gs`, `LegacyDashboardApi.gs`, `FanWorkOrders.gs`, `ManagerDashboard.gs`. Cập nhật `Index.html` nếu vẫn dùng giao diện Apps Script trực tiếp. Giữ nguyên tất cả module khác, worker, Properties, URL, OAuth, Cloud và database.
2. Save; Deploy → Manage deployments → chọn deployment chính → Edit → New version → Deploy. Giữ cùng URL. Không chạy migration/repair/cleanup. Không sửa project worker upload.
3. Sau khi backend đã lên 1.11.20, mới publish frontend: `docs/entry.html`, `work-order-rules.js`, `work-order-locks.js`, `live-data.js`, `index.html`. Cache mới: liveJS162/entry143/rules4/locks5. Không publish frontend trước backend vì bản cũ chưa hiểu ràng buộc và cách tính mới.
4. Kiểm tra hồ sơ thật bằng đọc trước; để người dùng chủ động lưu. Khoảng chờ linh kiện17–24/10 khi sẵn sàng21/10 cần sửa thành17–21/10 rồi thêm khoảng sau sẵn sàng có lý do thực tế, không tự nhận rằng khách/vận chuyển chịu trách nhiệm.

Không có thay đổi schema/cột hoặc chuyển dữ liệu. Thay công thức sẽ làm thay đổi kết quả KPI của các hồ sơ đã có tạm dừng; đây không phải thao tác ghi lại lịch sử.

## Kiểm thử

Chạy `node "version final/tests/validate.mjs"` và `git diff --check`. Test `sla-holds.mjs` bao gồm ranh giới ngày, khoảng mở/đã trả, nhiều lý do, gộp khoảng chồng nhau, giới hạn khoảng cũ, ngưỡng7ngày và kiểm tra khoảng lưu ở nhiều công việc. Bộ hồi quy kiểm tra Fan, luân chuyển, phân quyền, cache, upload và đồng bộ. Test local không phải bằng chứng đã deploy hoặc đã ghi thành công trên dữ liệu thật.
