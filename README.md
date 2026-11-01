# Project quản lý ghi chú môn 503073

Ứng dụng quản lý ghi chú theo đề Final Project học kỳ I năm học 2026–2027. Mục tiêu là đáp ứng 32 tiêu chí của đề, bao gồm tài khoản, ghi chú, chia sẻ, cộng tác thời gian thực, AI, offline và responsive.

## Trạng thái

Cập nhật ngày 01/11/2026. Phần lõi đã chạy được: đăng ký, đăng nhập/đăng xuất, xác minh email, quên/đặt lại mật khẩu, hồ sơ và avatar, đổi mật khẩu, tùy chọn hiển thị (cỡ chữ, mật độ, sáng/tối, màu ghi chú). Ghi chú có tạo/sửa/xóa, tự lưu, lưới/danh sách, tìm kiếm, ghim, nhãn, lọc, nhắc việc và chế độ khách lưu cục bộ. Đã có đính kèm ảnh/video/tệp, bảo vệ từng ghi chú bằng mật khẩu, chia sẻ chỉ đọc/được sửa, thu hồi quyền, khu vực “Được chia sẻ với tôi” và thông báo chia sẻ trong ứng dụng.
Giao diện dùng GSAP, tôn trọng giảm chuyển động và có breakpoint mobile/tablet/desktop. Font `Be Vietnam Pro` và `Literata` được self-host qua `@fontsource`, không phụ thuộc Google Fonts. **145 bài test đạt**, TypeScript và build đạt. Lighthouse trước khi thêm realtime ngày 01/11: Accessibility 100, Best Practices 100, SEO 100.

Đã kiểm chứng thủ công trên trình duyệt: đăng ký, xác minh email, quên/đặt lại mật khẩu, đăng nhập/đăng xuất, lưới/danh sách, tìm kiếm, chia sẻ A→B (đọc và sửa), mở khóa ghi chú bảo vệ, tải PNG/TXT, sáng/tối và ghi chú khách sau khi tải lại.

Đã ghép cộng tác trực tiếp bằng WebSocket/Yjs, lưu snapshot trong PostgreSQL và kiểm tra quyền từng cập nhật. Cách dùng và giới hạn: [REALTIME.md](REALTIME.md). Bản online: https://notes-503073.onrender.com/; SMTP Mailjet đã được người dùng xác nhận nhận thư. Local dùng PGlite và thư lưu ở `.data/mail` khi cấu hình file transport.

AI Summary đã có API và nút **Tóm tắt bằng AI** cho ghi chú đã lưu. Backend gọi Google Gemini, kiểm tra quyền/mở khóa và phiên bản; kết quả riêng không ghi đè nội dung. Cần cấu hình `GEMINI_API_KEY` ở server để chạy thật; xem [AI_SUMMARY.md](AI_SUMMARY.md). Test dùng provider giả lập; kiểm thử thật dùng script `scripts/check-summary-online.mjs` sau deploy.

Chưa hoàn thành: AI Q&A và offline đầy đủ (service worker/cache tài khoản/đồng bộ). Hạn nộp là **trước 23:59 ngày 02/11/2026**. Các chức năng đã làm vẫn cần xuất hiện trong video demo.

Repository riêng tư: [rumnopro0809/503073-final-project](https://github.com/rumnopro0809/503073-final-project), được tạo theo tài khoản người dùng xác nhận ngày 16/10/2026.

## Tài liệu

- [Yêu cầu và 32 tiêu chí nghiệm thu](REQUIREMENTS.md)
- [Rà soát tiến độ ngày 31/10/2026](STATUS_2026-10-31.md)
- [Tự đánh giá 32 tiêu chí và kịch bản demo](RUBRIC_SELF_ASSESSMENT.md)
- [Bảng tự đánh giá dạng CSV để mở bằng Excel](RUBRIC_SELF_ASSESSMENT.csv)
- [Kịch bản quay demo ngày 02/11](DEMO_02_11.md)
- [Checklist đóng gói và nộp bài](SUBMISSION_CHECKLIST.md)
- [Hướng dẫn chạy và thông tin chấm bài](Readme.txt)
- [Lịch triển khai và quy trình làm nhóm](TEAM_PLAN.md)
- [Chạy ứng dụng và học luồng tài khoản ngày đầu](DAY_01.md)
- [Database và API ghi chú ngày 27 tháng 10](DAY_02.md)
- [Giao diện và điểm ghép tự lưu cho Thái](FRONTEND_HANDOFF.md)
- [Sprint tới hạn nộp ngày 2 tháng 11](SPRINT.md)
- [Kịch bản demo thử ngày 31 tháng 10](DEMO_31_10.md)

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

## Tài khoản và dữ liệu mẫu

Sau khi `npm.cmd run dev` đang chạy, mở terminal thứ hai và chạy:

```powershell
npm.cmd run seed:demo
```

Script tạo hai tài khoản demo và dữ liệu mẫu (nhãn, ghi chú, đính kèm, ghi chú bảo vệ, chia sẻ), có thể chạy lại mà không nhân đôi dữ liệu:

- Tài khoản A: `rumnopro0809@gmail.com` / `Rum@1234`
- Tài khoản B: `duongphamthai82@gmail.com` / `Thai@1234`
- Mật khẩu ghi chú "Ghi chú bảo mật": `Note@1234`

Chi tiết cách chấm và cấu hình email nằm trong [Readme.txt](Readme.txt).

## Hồ sơ nộp

- `Readme.txt` là bản hướng dẫn chạy và thông tin chấm bài; còn thiếu MSSV thành viên 2 và URL online.
- `RUBRIC_SELF_ASSESSMENT.md` là bản nháp tự đánh giá 32 tiêu chí; điểm chính thức vẫn phải điền vào `Rubric.xlsx` theo mẫu của thầy và chỉ tính khi chức năng đã được demo trong video.
- `DEMO_02_11.md` là kịch bản quay video theo từng mục rubric; `SUBMISSION_CHECKLIST.md` là danh sách đóng gói và kiểm tra trước khi nộp.
- `demo.mp4`, `Rubric.xlsx` và ảnh GitHub Insights chưa có trong project; xem `SUBMISSION_CHECKLIST.md` để biết các việc còn lại.

## Công nghệ sử dụng

Đã tích hợp và đang chạy:

- Giao diện: React, TypeScript, Vite, GSAP, `@fontsource` (self-host font).
- Máy chủ: Node.js, Express, TypeScript.
- Cơ sở dữ liệu: PostgreSQL; local dùng PGlite nhúng tại `.data/postgres`.
- Tài khoản: bcrypt, cookie phiên HttpOnly, Nodemailer.
- Email: Nodemailer; local ghi tệp tại `.data/mail`, SMTP thật chưa cấu hình.

`ws`/Yjs đã ghép cho tiêu đề và nội dung khi bật **Cộng tác trực tiếp** ở cả hai cửa sổ. Hỗ trợ ghép thay đổi đồng thời, tự kết nối lại và xác nhận lưu sau commit; xem [REALTIME.md](REALTIME.md).

Chưa tích hợp: AI/LLM, service worker/IndexedDB cho offline đầy đủ, Docker Compose và triển khai HTTPS online. Dependency được khóa trong package.json và package-lock.json. Nhóm học JavaScript/TypeScript, HTTP và SQL thông qua từng chức năng của project.

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
