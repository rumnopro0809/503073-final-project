# Project quản lý ghi chú môn 503073

Ứng dụng quản lý ghi chú theo đề Final Project học kỳ I năm học 2026–2027. Mục tiêu là đáp ứng 32 tiêu chí của đề, bao gồm tài khoản, ghi chú, chia sẻ, cộng tác thời gian thực, AI, offline và responsive.

## Trạng thái

Ngày 29/10/2026: có tài khoản, xác minh email, database/API ghi chú riêng theo chủ sở hữu và kiểm tra xung đột phiên bản. Giao diện đã hiển thị danh sách thật, tải thêm và dùng chung một editor cho tạo/sửa. Nội dung đang nhập hiện là bản nháp chưa lưu; chờ ghép phần tự lưu của Thái. Local dùng PostgreSQL nhúng; server PostgreSQL riêng, SMTP thật và triển khai công khai vẫn cần cấu hình/kiểm chứng. Hạn nộp đã xác nhận là 23:59 ngày 03/11/2026.

Repository riêng tư: [rumnopro0809/503073-final-project](https://github.com/rumnopro0809/503073-final-project), được tạo theo tài khoản người dùng xác nhận ngày 16/10/2026.

## Tài liệu

- [Yêu cầu và 32 tiêu chí nghiệm thu](REQUIREMENTS.md)
- [Lịch triển khai và quy trình làm nhóm](TEAM_PLAN.md)
- [Chạy ứng dụng và học luồng tài khoản ngày đầu](DAY_01.md)
- [Database và API ghi chú ngày 27 tháng 10](DAY_02.md)
- [Giao diện và điểm ghép tự lưu cho Thái](FRONTEND_HANDOFF.md)
- [Sprint tới hạn nộp ngày 3 tháng 11](SPRINT.md)

## Chạy local

Yêu cầu Node.js 22.12 trở lên. Tại thư mục gốc:

```powershell
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run dev
```

Chỉ sao chép file cấu hình khi chưa có .env. Mở Local URL do Vite in ra; mặc định http://localhost:5173. Backend được gọi qua /api bằng proxy cùng nguồn. Chưa cần cài PostgreSQL hoặc Docker để chạy local: dữ liệu PostgreSQL nhúng lưu ở .data/postgres, thư xác minh thử nghiệm lưu thành .eml ở .data/mail. Các tệp thư local không được gửi tới inbox thật. Xem DAY_01.md để cấu hình SMTP và server PostgreSQL.

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

## Công nghệ đề xuất

- Giao diện: React, TypeScript, Vite.
- Máy chủ: Node.js, Express, TypeScript.
- Cơ sở dữ liệu: PostgreSQL.
- Cộng tác: WebSocket và Yjs để xử lý thay đổi đồng thời.
- Offline: service worker và IndexedDB; thiết kế cache và đồng bộ theo quyền truy cập.
- Email: SMTP; AI: gọi LLM từ backend, cấu hình thông tin dịch vụ qua biến môi trường.
- Môi trường chạy: Docker Compose; đồng thời chuẩn bị triển khai HTTPS online.

React, TypeScript, Vite, Express, bcrypt, cookie phiên, PostgreSQL/PGlite và Nodemailer đã được tích hợp ở bước tài khoản. Các phần cộng tác, offline, AI và Docker vẫn là kế hoạch tiếp theo. Dependency được khóa trong package.json và package-lock.json. Nhóm học JavaScript/TypeScript, HTTP và SQL thông qua từng chức năng của project.

## Luồng đầu tiên cần hoàn thành

Đăng ký → tự đăng nhập → hiện trạng thái chưa xác minh email → tạo ghi chú → tự lưu → tải lại vẫn còn → sửa → xác nhận xóa.

Các tình huống lỗi cần kiểm chứng: email trùng, mật khẩu xác nhận không khớp, người chưa đăng nhập, mất kết nối khi lưu và truy cập ghi chú của người khác.

## Tài liệu chính thức để học theo công việc

- [Vite](https://vite.dev/guide/)
- [Express](https://expressjs.com/)
- [PostgreSQL](https://www.postgresql.org/docs/current/tutorial.html)
- [Yjs và cộng tác](https://docs.yjs.dev/getting-started/a-collaborative-editor)
- [Mời cộng tác viên GitHub](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/inviting-collaborators-to-a-personal-repository)
- [Kiểm tra ghi nhận đóng góp GitHub](https://docs.github.com/en/account-and-profile/how-tos/contribution-settings/troubleshooting-missing-contributions)
