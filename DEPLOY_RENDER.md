# Triển khai bản hiện có lên Render

Blueprint: render.yaml. Chạy Express và giao diện build trên cùng một HTTPS origin; dữ liệu tài khoản, ghi chú và tệp đính kèm nằm trong PostgreSQL riêng. Không đưa .env, .data hay dữ liệu cá nhân local lên hosting.

1. Đăng nhập https://dashboard.render.com bằng tài khoản của bạn.
2. Kết nối GitHub và chỉ cấp quyền repository `rumnopro0809/503073-final-project` theo giao diện Render.
3. Chọn New → Blueprint → repository trên → branch chứa render.yaml.
4. Kiểm tra cả web service và database đều là Free, cùng Singapore. Không chọn gói trả phí nếu chưa quyết định chi phí.
5. Deploy và chờ database sẵn sàng, build thành công, web service Live. Render tự cung cấp RENDER_EXTERNAL_URL và PORT; không cần đoán hostname hoặc hardcode URL.
6. Mở URL HTTPS thực tế từ dashboard. Kiểm tra `/api/health`, `/welcome`, `/register`, `/login`; đăng ký tài khoản thử, tạo/sửa ghi chú, tải lại, thử ảnh/tệp và hai tài khoản chia sẻ.
7. Tạo hai tài khoản chấm và dữ liệu mẫu riêng trên online. Không sao chép database cá nhân. Script seed hiện tại dành cho local và đọc thư local; không chạy nguyên trạng lên online.
8. Chỉ sau khi test online đạt, điền URL thực tế và tài khoản chấm vào Readme.txt/rubric, rồi cập nhật gói source nộp.

## Giới hạn phải ghi rõ

- MAIL_TRANSPORT=disabled được đặt rõ ràng vì hiện chưa có dịch vụ gửi thư. Đăng ký vẫn được dùng tài khoản chưa xác minh; banner báo lỗi gửi thư. Gửi lại xác minh không thành công, quên mật khẩu không gửi email. Không tính các luồng này là đã hoạt động online.
- Không dùng MAIL_TRANSPORT=file trong production vì thư không đến inbox, tệp runtime có thể mất khi khởi động lại.
- Render Free web service có thể ngủ sau 15 phút không hoạt động; lần truy cập tiếp theo có thể chậm.
- PostgreSQL miễn phí của Render hết hạn sau 30 ngày. Ghi lại ngày hết hạn thực tế từ dashboard và đảm bảo dịch vụ còn hoạt động trong thời gian thầy chấm; chọn phương án database khác/nâng cấp nếu cần, không tự phát sinh chi phí.
- Gói web miễn phí chặn SMTP port 25/465/587. Muốn email thật cần giải pháp gửi thư phù hợp và kiểm thử riêng.
- Không coi cấu hình và build local là bằng chứng đã deploy. Chỉ ghi hoàn tất sau khi có URL HTTPS và test API/database thật.

Tài liệu chính thức: https://render.com/docs/free ; https://render.com/docs/blueprint-spec ; https://render.com/docs/environment-variables
