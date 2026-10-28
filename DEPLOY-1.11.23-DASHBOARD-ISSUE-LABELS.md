# Sửa tên lỗi lặp trên dashboard — 1.11.23

1. Trong project Apps Script backend chính, mở LegacyDashboardApi.gs.
2. Thay toàn bộ nội dung bằng file version final/LegacyDashboardApi.gs trong bản này, rồi Save.
3. Deploy → Manage deployments → chọn Web App hiện tại → Edit → Version: New version → Deploy. Giữ URL và tài khoản thực thi hiện tại.
4. Trên website bấm Đồng bộ rồi tải lại trang. Cùng một lỗi trong một hồ sơ chỉ hiện một lần; các lỗi khác vẫn đầy đủ. Không cần chạy migration hoặc chỉnh Sheet.

Chỉ thay **LegacyDashboardApi.gs** cho sửa này. Không cần thay Code.gs, frontend hoặc worker đính kèm. Bộ 1.11.22 sửa quyền lô đóng là yêu cầu riêng đang chờ xác nhận triển khai; không lấy toàn bộ nhánh frontend vào main chỉ vì sửa tên lỗi này.

Kiểm thử tự động: node "version final/tests/validate.mjs". Kiểm tra lỗi trùng khác hoa/thường/khoảng trắng, lỗi khác nhau, tên có dấu phẩy, fallback mã lỗi, giữ nguyên dữ liệu nguồn và 5 Fan lỗi trên hai inverter dù chỉ hiển thị một tên.
