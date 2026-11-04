# 503073 — Ứng dụng quản lý ghi chú

Nguyễn Hải Triều — **524H0072**
Dương Phạm Thái — **524H0189**
Học kỳ I, năm học 2026–2027. Hạn nộp: **trước 23:59 ngày 02/11/2026**, giờ Việt Nam.

## Chấm bản online

Ứng dụng: https://notes-503073.onrender.com/
Repository: https://github.com/rumnopro0809/503073-final-project (private; cần cấp quyền đọc nếu giảng viên dùng).

| Tài khoản chấm riêng | Email | Mật khẩu |
| --- | --- | --- |
| A — chủ ghi chú | grader-a-503073-8d35d3bc@example.test | Grade-4226f46c-fea-2026! |
| B — người nhận chia sẻ | grader-b-503073-8d35d3bc@example.test | Grade-d6ecdf67-1c9-2026! |

Đây là tài khoản đánh giá, không phải tài khoản cá nhân. Đã kiểm tra đăng nhập và dữ liệu ngày 01/11/2026: A có 6 ghi chú, 3 nhãn, 2 tệp; B có 1 ghi chú riêng và 2 ghi chú được chia sẻ quyền đọc/sửa. Ghi chú **Ghi chú bảo mật** có mật khẩu riêng **Note@1234**.

Email example.test của tài khoản chấm không có inbox, nên các tài khoản này chưa xác minh email. Theo yêu cầu, tài khoản chưa xác minh vẫn dùng đầy đủ chức năng. Để kiểm tra gửi thư/xác minh/reset, đăng ký tài khoản mới bằng email thật mà người chấm kiểm soát. Online dùng Mailjet SMTP; người dùng đã xác nhận reset mật khẩu đầy đủ.

## Chạy từ source trên máy giảng viên

Yêu cầu Node.js **22.12 trở lên**, khuyến nghị bản **24.21.0** theo .node-version, và npm. Chạy npm ci cần Internet. Không cần cài PostgreSQL hoặc Docker để chạy local: PGlite lưu PostgreSQL nhúng tại .data/postgres; schema/migration trong apps/api/src/database.ts tự chạy khi khởi động.

Mở terminal trong **source/** (hoặc thư mục repository có package.json).

Windows PowerShell:

```powershell
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run dev
```

macOS/Linux:

```sh
npm ci
cp .env.example .env
npm run dev
```

Chỉ sao chép .env.example khi chưa có .env. Mở **http://localhost:5173**. API mặc định http://127.0.0.1:3001, trình duyệt dùng đường dẫn /api qua Vite proxy. Đổi API_PORT/WEB_PORT trong .env nếu bận cổng; nếu đổi WEB_PORT thì đổi APP_URL tương ứng.

Ở terminal thứ hai, vẫn trong source/:

```sh
npm run seed:demo
```

Seed tạo dữ liệu mẫu tái lập được, chạy lại không nhân đôi ghi chú. Tài khoản local A: **rumnopro0809@gmail.com / Rum@1234**; local B: **duongphamthai82@gmail.com / Thai@1234**. Đây là thông tin demo local, không phải mật khẩu tài khoản cá nhân online. Mật khẩu ghi chú bảo mật: **Note@1234**. Database local và Render độc lập.

## Email, AI và cấu hình

- Local mặc định MAIL_TRANSPORT=file: thư thử lưu trong .data/mail, không gửi ra inbox. Có thể mở link xác minh/reset trong file thư. Để gửi email thật, cấu hình MAIL_TRANSPORT=smtp cùng SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM theo .env.example. Không nộp key/mật khẩu SMTP.
- AI dùng **GEMINI_API_KEY** ở backend; GEMINI_MODEL mặc định gemini-3.1-flash-lite. Local không có key sẽ báo AI chưa cấu hình, các chức năng khác vẫn hoạt động. Online đã có cấu hình và đã kiểm tra Gemini thật. Không đặt key vào biến VITE_ hay mã frontend. Hướng dẫn: AI_SUMMARY.md, AI_QA.md.
- Production trên Render dùng PostgreSQL server, HTTPS, Mailjet và Gemini. Không nộp DATABASE_URL, cookie phiên hay .env production. Render free có thể khởi động chậm khi ngủ; cần duy trì web/database trong thời gian chấm và kiểm tra hạn database trong dashboard.

## Cách kiểm tra chức năng chính

1. Đăng nhập A, xem 6 ghi chú ở lưới/danh sách; tìm kiếm, ghim và nhãn. Tạo/sửa dùng chung editor, chờ **Đã lưu** trước khi rời trang; xóa có xác nhận.
2. Mở **Kế hoạch tuần này** để xem ảnh và TXT mẫu; thử tải thêm ảnh/video/tệp. Video MP4/WebM có triển khai nhưng chưa xác nhận thử tay và cần trình diễn.
3. Mở ghi chú bảo mật bằng Note@1234; thử sai mật khẩu, đổi/tắt bảo vệ, khóa lại.
4. Đăng nhập B ở cửa sổ riêng, vào **Được chia sẻ với tôi** để thử quyền đọc/sửa; A có thể đổi/thu hồi quyền.
5. Realtime: cả A và B mở **Tài liệu tham khảo** được chia sẻ quyền sửa, chọn **Cộng tác trực tiếp**, gõ đồng thời và chờ **Đã đồng bộ**. Xem REALTIME.md.
6. AI Summary: mở ghi chú đã lưu ở editor thường, bấm **Tóm tắt bằng AI**; kết quả riêng không ghi đè nội dung.
7. AI Q&A: chọn **Hỏi AI** ở thanh bên, hỏi “Ai phụ trách quay video?” dựa trên **Ghi chú họp nhóm**. Xem dẫn nguồn [1] và bấm nguồn mở ghi chú gốc. Hỏi đáp dùng truy xuất từ khóa kết hợp Gemini tổng hợp, có kiểm tra quyền/mở khóa và phiên bản nguồn.
8. Hồ sơ/avatar, đổi mật khẩu, màu ghi chú, cỡ chữ, sáng/tối. Responsive và luồng reset qua email thật đã được người dùng xác nhận ổn ngày 01/11/2026.

## Kiểm thử và build

```sh
npm test
npm run typecheck
npm run build
```

148/148 test đạt sau khi bắt buộc đăng nhập và gỡ chức năng ngoài đề, TypeScript và build đạt. Sau khi build có thể chạy **npm start** với cấu hình local mặc định để chạy API; lệnh dev ở trên là cách đơn giản để chạy cả giao diện/API. Production phục vụ build/web qua Express khi NODE_ENV=production và đã cấu hình PostgreSQL, HTTPS APP_URL cùng SMTP hoặc mail disabled rõ ràng.

## Thành phần gói đang chuẩn bị

source/ chứa frontend/backend, test, package-lock, schema/migration, script seed và hướng dẫn. Root có README.md, Readme.txt và Rubric.xlsx. Không kèm node_modules, build, .data, .env thật, log hay khóa dịch vụ. Dữ liệu mẫu được tạo bằng script thay vì nộp database chứa dữ liệu cá nhân. Đây là bộ **source + rubric + hướng dẫn**, cần đóng lại sau chỉnh sửa source và bổ sung video trước khi nộp toàn bộ.

## Phạm vi vừa điều chỉnh

Chưa đăng nhập phải vào /login. Đã bỏ ghi chú khách và nhắc việc/hằng ngày/hoàn thành; giữ dữ liệu cũ, không tiếp tục cung cấp các chức năng này. Xem BAT_BUOC_DANG_NHAP.md. Bản ZIP/rubric cũ chưa cập nhật thay đổi này.
