# Project quản lý ghi chú môn 503073

Ứng dụng quản lý ghi chú theo đề Final Project học kỳ I năm học 2026–2027. Mục tiêu là đáp ứng 32 tiêu chí của đề, bao gồm tài khoản, ghi chú, chia sẻ, cộng tác thời gian thực, AI, offline và responsive.

## Trạng thái

Đã chuẩn bị tài liệu yêu cầu và kế hoạch cho nhóm hai người. Ứng dụng chưa được triển khai; chưa có lệnh chạy ứng dụng. Không đánh dấu tính năng hoàn thành khi chưa kiểm chứng.

Repository riêng tư: [rumnopro0809/503073-final-project](https://github.com/rumnopro0809/503073-final-project), được tạo theo tài khoản người dùng xác nhận ngày 16/10/2026.

## Tài liệu

- [Yêu cầu và 32 tiêu chí nghiệm thu](REQUIREMENTS.md)
- [Lịch triển khai và quy trình làm nhóm](TEAM_PLAN.md)

## Công nghệ đề xuất

- Giao diện: React, TypeScript, Vite.
- Máy chủ: Node.js, Express, TypeScript.
- Cơ sở dữ liệu: PostgreSQL.
- Cộng tác: WebSocket và Yjs để xử lý thay đổi đồng thời.
- Offline: service worker và IndexedDB; thiết kế cache và đồng bộ theo quyền truy cập.
- Email: SMTP; AI: gọi LLM từ backend, cấu hình thông tin dịch vụ qua biến môi trường.
- Môi trường chạy: Docker Compose; đồng thời chuẩn bị triển khai HTTPS online.

Đây là phương án kỹ thuật đề xuất, chưa phải các dependency đã được cài đặt. Phiên bản và thư viện hỗ trợ sẽ được ghi nhận khi dựng ứng dụng. Nhóm học JavaScript/TypeScript, HTTP và SQL thông qua từng chức năng của project.

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
