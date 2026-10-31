# Gửi email thật trên Render

Nodemailer đã tích hợp cho xác minh email và đặt lại mật khẩu. Bản online hiện dùng MAIL_TRANSPORT=disabled; chưa gửi được thư thật.

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

render.yaml hiện còn khai MAIL_TRANSPORT=disabled cho khởi tạo an toàn. Sau khi chốt SMTP, cần đổi khai báo Blueprint này sang sync:false để lần sync sau không ghi đè thiết lập smtp; không đưa SMTP key vào YAML.

## Nghiệm thu

1. Trên https://notes-503073.onrender.com đăng ký bằng địa chỉ inbox do bạn quản lý. Kiểm tra Inbox/Spam; mở link HTTPS và thấy banner chưa xác minh biến mất.
2. Thử dùng lại link xác minh để kiểm tra chỉ dùng một lần.
3. Dùng Quên mật khẩu với tài khoản thử, nhận mail và đặt lại bằng link. Sau đó đăng nhập thủ công bằng mật khẩu mới, mật khẩu cũ không còn dùng được.
4. Chỉ ghi đã hoàn tất email thật khi hai luồng trên được kiểm chứng từ bản Render và xuất hiện trong video.

Nguồn: https://render.com/docs/free ; https://developers.brevo.com/docs/smtp-integration ; https://help.brevo.com/hc/en-us/articles/115000188150-Troubleshooting-Issues-with-Brevo-SMTP ; https://nodemailer.com/smtp
