# Cập nhật ngữ cảnh và tra bảo hành 1.3.1

1. Trong Apps Script chính, thay toàn bộ nội dung 3 file: Code.gs, QuickAssistant.gs, QuickAssistantActions.gs bằng các file trong thư mục này.
2. Giữ QuickAssistantKnowledge.gs, QuickAssistantSetup.gs và các module nghiệp vụ đã có; không nhập lại key.
3. Save → Deploy → Manage deployments → Web App hiện tại → bút chì → New version → Deploy. Giữ URL.
4. Website Ctrl+F5 → Hội thoại mới. Hỏi bảo hành một SN, rồi gửi SN khác kèm “cái này thì sao?”.

Part Number và Company Name lấy từ hai cột cùng tên trong nguồn bảo hành hiện có. Không có dữ liệu thì hiển thị Chưa có thông tin; không tự tạo cột. Kết quả không tìm thấy SN vẫn là không tìm thấy, không tự bịa thời hạn.

Đây là sửa trí nhớ tác vụ trong hội thoại, không tự huấn luyện AI. Dữ liệu kết quả giữ nội bộ. Đã kiểm thử với fixture và full validate; cần kiểm tra dữ liệu thật sau deploy.
