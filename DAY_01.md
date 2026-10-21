# Ngày đầu tiên Cấu trúc ứng dụng và tài khoản

Phạm vi buổi đầu là tạo nền ứng dụng, giao diện đăng ký/đăng nhập và xác thực thật ở backend. Trang ghi chú hiện chỉ có trạng thái rỗng; các chức năng tạo/sửa ghi chú sẽ được làm ở buổi tiếp theo.

Đã kiểm chứng ngày 21/10/2026: TypeScript và build frontend/backend đạt; 17 bài test tài khoản đạt. HTTP local trả được trang /login, /register và /api/health; /api/auth/me trả 401 khi chưa đăng nhập. Công cụ điều khiển trình duyệt gặp lỗi khởi tạo nên chưa xác nhận trực quan bố cục và thao tác trong trình duyệt; phần kiểm tra thủ công bên dưới vẫn cần thực hiện. SMTP thật và PostgreSQL server riêng chưa được kiểm chứng.

## Chạy trên máy

Yêu cầu Node.js 22.12 trở lên. Tại thư mục gốc repository:

```powershell
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run dev
```

Chỉ sao chép .env.example khi chưa có .env; không ghi đè cấu hình riêng đang dùng. Trên máy đã cài thư viện, buổi tiếp theo chỉ cần npm.cmd run dev. Trên macOS/Linux dùng npm thay cho npm.cmd.

Mở Local URL do Vite in ra. Mặc định là http://localhost:5173; cổng và APP_URL có thể đổi trong .env. Trình duyệt gọi API bằng đường dẫn tương đối /api; Vite chuyển tiếp đến backend khi phát triển.

Local không yêu cầu cài thêm PostgreSQL: PGlite chạy PostgreSQL nhúng và lưu xuống .data/postgres. Khi dùng server PostgreSQL, đặt DATABASE_URL. Dữ liệu local và dữ liệu trên server là hai nơi riêng biệt; cấu hình URL không tự chuyển dữ liệu.

MAIL_TRANSPORT=file lưu email thành tệp .eml và bản văn bản .txt dễ đọc trong .data/mail. Đây là hộp thư thử nghiệm trên máy, không gửi thư đến inbox thật. Mở tệp .txt bằng trình soạn thảo, lấy liên kết bắt đầu bằng http trong phần nội dung và mở ở trình duyệt đang chạy ứng dụng. Liên kết xác minh hết hạn sau 24 giờ và chỉ dùng được một lần; gửi lại thư sẽ thay liên kết cũ.

Muốn gửi thư thật: chọn MAIL_TRANSPORT=smtp rồi cấu hình SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS và MAIL_FROM. Không commit .env hoặc các tệp .data. Chưa có dịch vụ SMTP thật thì chưa coi việc gửi email công khai là đã được kiểm chứng.

## Các thư mục và file cần hiểu

```text
apps/
  web/
    src/
      main.tsx          Khởi động React và router
      App.tsx           Đăng ký, đăng nhập, trang cá nhân, bảo vệ route
      api.ts            Gọi API bằng đường dẫn tương đối và xử lý lỗi
      styles.css        Giao diện responsive
    vite.config.ts      Cổng frontend và proxy /api khi phát triển
  api/
    src/
      index.ts          Khởi động database và HTTP server
      app.ts            Middleware, kiểm tra nguồn request, gắn router
      auth.ts           Validate dữ liệu, bcrypt, phiên và xác minh email
      database.ts       Adapter PostgreSQL/PGlite và schema buổi đầu
      mail.ts           Email SMTP hoặc tệp .eml local
      config.ts         Đọc biến môi trường và kiểm tra cấu hình
    test/
      auth.test.ts      Kiểm tra luồng tài khoản bằng HTTP và PostgreSQL nhúng
.env.example            Mẫu cấu hình không chứa bí mật
package.json            Lệnh chạy và dependency đã khóa phiên bản
package-lock.json       Khóa toàn bộ cây dependency để npm ci tái lập
```

## Luồng đăng ký

1. Người dùng nhập email, tên hiển thị, mật khẩu và nhập lại mật khẩu. Không thêm các trường bắt buộc ngoài đề.
2. React kiểm tra nhanh để phản hồi; backend kiểm tra lại vì người dùng có thể bỏ qua frontend.
3. Backend chuẩn hóa email, băm mật khẩu bằng bcrypt cost 12. Mật khẩu giữ nguyên nội dung, không trim.
4. Trong một transaction, tạo user, phiên đăng nhập và token xác minh. Ràng buộc UNIQUE ở database chống email trùng, kể cả khi hai request đăng ký đến gần nhau.
5. Backend gửi email hoặc lưu tệp thư ở local; trả cookie phiên và thông tin user công khai.
6. React chuyển vào trang cá nhân. Tài khoản chưa xác minh vẫn được đăng nhập và hiển thị lời nhắc xác minh.

Phiên có hiệu lực bảy ngày. Trình duyệt giữ token ngẫu nhiên trong cookie HttpOnly, SameSite=Lax; database chỉ lưu SHA-256 của token. JavaScript không đọc token và không lưu token trong localStorage. Mật khẩu bcrypt và token phiên là hai dữ liệu khác nhau, không thay thế cho nhau.

## Luồng đăng nhập và đăng xuất

Đăng nhập dùng email và mật khẩu. Backend kiểm tra bcrypt, tạo token mới, thay phiên cũ của trình duyệt hiện tại nếu có rồi trả user. Khi mở lại trang, frontend gọi /api/auth/me để biết phiên còn hợp lệ hay không. Frontend không tự coi một biến trên trình duyệt là bằng chứng đăng nhập.

Đăng xuất xóa phiên trong database và cookie. Token cũ không dùng lại được. Các phiên ở thiết bị khác vẫn độc lập; chức năng đăng xuất tất cả thiết bị không nằm trong phạm vi buổi này.

Cookie Secure chỉ được bật ở production có HTTPS; local chạy HTTP. Backend yêu cầu JSON, header X-Requested-With và kiểm tra Origin cho các request thay đổi dữ liệu, đồng thời không bật CORS tùy tiện. Các câu SQL nhận dữ liệu người dùng đều dùng tham số $1, $2 thay vì nối chuỗi.

## Các endpoint đã triển khai

| Method | Endpoint | Kết quả |
| --- | --- | --- |
| GET | /api/health | Kiểm tra HTTP server đang trả lời |
| POST | /api/auth/register | Tạo tài khoản, tự đăng nhập, gửi thư xác minh |
| POST | /api/auth/login | Đăng nhập bằng email/mật khẩu |
| GET | /api/auth/me | User công khai của phiên hiện tại; 401 nếu chưa đăng nhập |
| POST | /api/auth/logout | Xóa phiên hiện tại và cookie |
| POST | /api/auth/resend-verification | Gửi lại xác minh cho tài khoản đang đăng nhập |
| GET | /api/auth/verify?token=... | Kích hoạt tài khoản rồi chuyển về giao diện |

## Kiểm tra thủ công cùng nhau

1. Mở / khi chưa đăng nhập: ứng dụng chuyển sang /login sau khi kiểm tra phiên.
2. Qua /register; thử email không hợp lệ hoặc nhập lại mật khẩu sai. Form phải báo ngay ở trường liên quan.
3. Đăng ký tài khoản mới: vào trang cá nhân ngay, có lời nhắc chưa xác minh.
4. Tải lại trang: vẫn giữ đăng nhập. Mở lại /login: chuyển về trang cá nhân.
5. Đăng xuất: trở lại /login. Đăng nhập sai: có lỗi chung, không lộ mật khẩu.
6. Đăng nhập đúng: vào trang cá nhân. Đăng xuất rồi thử đăng ký cùng email: không tạo user thứ hai.
7. Mở liên kết trong email local: lời nhắc biến mất. Dùng lại liên kết: báo không hợp lệ.
8. Thử chiều rộng điện thoại, tablet và desktop; kiểm tra label, hiện/ẩn mật khẩu và tab bằng bàn phím.
9. Dừng backend rồi gửi form: thấy lỗi kết nối và có thể thử lại; không treo nút vô hạn.

## Lệnh kiểm chứng

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Bộ test kiểm tra đăng ký, bcrypt, phiên đăng nhập, đăng xuất, email trùng, token xác minh, lỗi gửi thư, chống request khác nguồn, giới hạn thử và dữ liệu tồn tại sau khi khởi động lại database local. Adapter đến PostgreSQL server riêng cần kiểm chứng thêm khi có server thật.

Build tạo build/web và build/api. Để chạy production, cấu hình NODE_ENV=production, DATABASE_URL, SMTP và HTTPS APP_URL rồi dùng npm.cmd start. Đây chưa phải xác nhận đã triển khai công khai hoặc đã thử Docker Compose.

## Phần bạn nên tự làm trong buổi học

Trong khoảng 1–2 giờ, dành 15 phút chạy app và thử form; 25 phút đọc App.tsx và api.ts; 25 phút lần theo register trong auth.ts đến database.ts; thời gian còn lại tự thử các trường hợp lỗi và giải thích cho bạn cùng nhóm.

Bạn cần trả lời được: tại sao backend vẫn phải validate; bcrypt khác mã hóa như thế nào; cookie HttpOnly dùng làm gì; tại sao không khóa tài khoản chưa kích hoạt; điều gì xảy ra khi đăng xuất; frontend và backend trao đổi qua đâu.

Nguồn được tạo với hỗ trợ AI và cần được cả nhóm đọc, kiểm chứng, điều chỉnh trong phạm vi quy định môn học. Không tự ghi nhận phần trợ lý thực hiện là đóng góp cá nhân của người khác. Khi tạo commit học tập, phản ánh đúng công việc bạn thật sự hiểu và thực hiện; không chia nhỏ giả tạo để đủ số lượng. Các mốc commit theo tuần trong TEAM_PLAN.md vẫn cần theo dõi.

## Chưa thuộc phạm vi hôm nay

Tạo/sửa/tự lưu ghi chú, đổi/quên mật khẩu, hồ sơ/avatar, nhãn, chia sẻ, cộng tác, AI và offline chưa được triển khai ở bước này. Không đánh dấu các mục đó đã xong trong rubric.
