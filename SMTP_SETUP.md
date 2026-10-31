# Gửi email thật trên Render

## Cấu hình hiện hành: Mailjet

Đã chuyển phương án từ Brevo sang Mailjet vì người dùng không nhận được OTP Brevo. Nhập trực tiếp trên Render, không đưa key vào Git/chat:

```dotenv
MAIL_TRANSPORT=smtp
MAIL_FROM=Ghi chu <email đã xác minh trong Mailjet>
SMTP_HOST=in-v3.mailjet.com
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=<Mailjet API Key>
SMTP_PASS=<Mailjet Secret Key>
```

Trên Mailjet: Account settings → SMTP and SEND API settings để lấy credentials; xác minh địa chỉ gửi trong Domains and Senders. Chỉ kết luận email thật hoạt động sau khi nhận thư trong inbox và mở link thành công trên bản online. Health 200 không chứng minh SMTP thành công.

render.yaml dùng MAIL_TRANSPORT sync:false để không ghi đè giá trị đã thiết lập trong dashboard khi đồng bộ Blueprint. Hướng dẫn Brevo bên dưới chỉ giữ làm tham khảo, không dùng lẫn host hoặc key hai dịch vụ.

Nguồn Mailjet: https://documentation.mailjet.com/hc/en-us/articles/360043229473-How-can-I-configure-my-SMTP-parameters ; https://dev.mailjet.com/docs/smtp-relay/configuration

Nodemailer đã tích hợp cho xác minh email và đặt lại mật khẩu. Cấu hình Mailjet đang được nghiệm thu; chưa ghi nhận gửi thư thật thành công.

## Chuẩn bị tài khoản

1. Tạo tài khoản Brevo tại https://www.brevo.com/ và xác minh email đăng ký.
2. Trong phần Senders, thêm địa chỉ gửi do bạn sở hữu, tên Ghi chú; hoàn tất xác minh sender và các yêu cầu kích hoạt transactional email mà Brevo hiển thị. Không khai email/domain không thuộc quyền kiểm soát của bạn.
3. Mở SMTP & API → SMTP. Dùng SMTP login và SMTP key, không dùng mật khẩu tài khoản Brevo hoặc API key.
4. Nhập thông tin trực tiếp vào Render → notes-503073 → Environment. Không gửi SMTP key trong chat, không commit key vào GitHub.

## Biến môi trường Render

```dotenv
MAIL_TRANSPORT=smtp
MAIL_FROM=Ghi chu <dia-chi-sender-da-xac-minh>
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=<SMTP login tu Brevo>
SMTP_PASS=<SMTP key tu Brevo>
```

Giữ nguyên DATABASE_URL, TRUST_PROXY, NODE_ENV, HOST và URL hiện có. Save/redeploy sau khi đã nhập đủ. SMTP_SECURE=false trên cổng 2525 dùng STARTTLS; code production bắt buộc nâng cấp TLS và không bỏ kiểm tra chứng chỉ.

Render Free chặn cổng 25/465/587; Brevo hỗ trợ 2525. Đây là cấu hình cần thử từ Render thực tế, chưa khẳng định kết nối thành công trước khi test gửi thư. Nếu Brevo chưa kích hoạt tài khoản/sender, hoàn tất phần đó trước.

render.yaml hiện dùng sync:false cho MAIL_TRANSPORT. Chọn smtp trên dashboard khi đã có đủ thông tin dịch vụ; không đưa key vào YAML.

## Nghiệm thu

1. Trên https://notes-503073.onrender.com đăng ký bằng địa chỉ inbox do bạn quản lý. Kiểm tra Inbox/Spam; mở link HTTPS và thấy banner chưa xác minh biến mất.
2. Thử dùng lại link xác minh để kiểm tra chỉ dùng một lần.
3. Dùng Quên mật khẩu với tài khoản thử, nhận mail và đặt lại bằng link. Sau đó đăng nhập thủ công bằng mật khẩu mới, mật khẩu cũ không còn dùng được.
4. Chỉ ghi đã hoàn tất email thật khi hai luồng trên được kiểm chứng từ bản Render và xuất hiện trong video.

Nguồn: https://render.com/docs/free ; https://developers.brevo.com/docs/smtp-integration ; https://help.brevo.com/hc/en-us/articles/115000188150-Troubleshooting-Issues-with-Brevo-SMTP ; https://nodemailer.com/smtp
