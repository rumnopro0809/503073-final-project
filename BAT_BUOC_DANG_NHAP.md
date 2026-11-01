# Điều chỉnh phạm vi theo đề gốc

Cập nhật 01/11/2026 sau khi đọc lại 503073-FinalProject-V1.docx và đoạn tô đỏ về đăng nhập/chức năng ngoài mô tả.

- Chưa có phiên hợp lệ: / và mọi route cũ /guest, /welcome chuyển đến /login sau khi kiểm tra phiên. Không có liên kết “Dùng không cần tài khoản” hoặc fallback ghi chú khách khi API lỗi.
- Đăng ký, xác minh và quên/reset mật khẩu vẫn giữ đường truy cập cần thiết. Đăng nhập thành công mở ghi chú tài khoản; đăng xuất trở lại login. Hết phiên vẫn yêu cầu đăng nhập lại, không cho dùng ghi chú như khách.
- Bỏ chế độ khách/localStorage, trang giới thiệu riêng và phần nhắc việc/quan trọng/quá hạn/hằng ngày/hoàn thành khỏi mã giao diện và các route API liên quan. Không xóa dữ liệu trong database hoặc localStorage cũ của người dùng. Những cột metadata cũ trong database được giữ để không mất dữ liệu, nhưng không còn tác động đến giao diện/sắp xếp và không có API nhắc việc để cập nhật.
- Thứ tự mặc định: ghim trước theo thời điểm ghim; các ghi chú chưa ghim theo updated_at mới nhất trước. Không ưu tiên legacy important/dueAt. Sửa đồng thời ở SQL backend và merge danh sách frontend.
- Giữ các chức năng đúng đề: tài khoản, ghi chú, nhãn, đính kèm, bảo vệ, chia sẻ, realtime, AI Summary, AI Q&A và tùy chọn hiển thị.

Kiểm tra: **148/148 test đạt**, TypeScript và production build đạt. Đã bỏ test của chức năng đã gỡ, đồng thời thêm test chuyển login, đăng nhập/đăng xuất, API lỗi không có guest fallback, không còn reminder API/control và thứ tự mặc định bỏ qua metadata cũ.

Offline (mục 31) hiện **chưa triển khai, không khai điểm hoàn thành hoặc điểm guest một phần**. Bản rubric/ZIP đã đóng trước thay đổi này là snapshot cũ, cần cập nhật và đóng lại trước khi nộp. Chưa xử lý trong đợt này: badge chia sẻ phía chủ, tên folder/ZIP cuối và video demo.
