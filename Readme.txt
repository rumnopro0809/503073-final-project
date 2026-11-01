======================================================================
ỨNG DỤNG QUẢN LÝ GHI CHÚ
Môn: 503073 - Web Programming & Applications
Học kỳ I, năm học 2026-2027
======================================================================

Họ tên thành viên 1: Nguyễn Hải Triều
MSSV thành viên 1:   524H0072
Họ tên thành viên 2: Dương Phạm Thái
MSSV thành viên 2:   524H0189

Repository GitHub: https://github.com/rumnopro0809/503073-final-project
URL ứng dụng online: https://notes-503073.onrender.com/
Hạn nộp: trước 23:59 ngày 02/11/2026
Ngày hoàn thành tài liệu: 01/11/2026


----------------------------------------------------------------------
1. YÊU CẦU HỆ THỐNG
----------------------------------------------------------------------

- Node.js 22.12 trở lên (khuyến nghị Node.js 22 LTS).
- npm đi kèm Node.js.
- Không cần cài PostgreSQL hoặc Docker khi chạy local, vì project dùng
  PostgreSQL nhúng PGlite và lưu dữ liệu trong thư mục .data/postgres.
- Trình duyệt hiện đại: Chrome, Edge, Firefox hoặc Safari.
- Hệ điều hành: Windows, macOS hoặc Linux.


----------------------------------------------------------------------
2. CHẠY LOCAL (CÁCH KHUYẾN NGHỊ ĐỂ CHẤM BÀI)
----------------------------------------------------------------------

Trong gói nộp, mở terminal tại thư mục source (nơi có package.json).
Nếu chạy từ repository GitHub, mở tại thư mục gốc của project.

Windows PowerShell:

    npm.cmd ci
    Copy-Item .env.example .env
    npm.cmd run dev

macOS / Linux:

    npm ci
    cp .env.example .env
    npm run dev

Sau khi chạy, mở:

    http://localhost:5173

Lưu ý:
- Chỉ sao chép .env.example khi chưa có .env. Không ghi đè .env đang dùng.
- npm.cmd ci cần mạng để tải dependency. Nếu máy đã có node_modules,
  có thể chạy thẳng npm.cmd run dev.
- Lệnh dev chạy đồng thời API tại http://127.0.0.1:3001 và giao diện
  Vite tại http://localhost:5173. Trình duyệt gọi API qua đường dẫn
  tương đối /api, Vite chuyển tiếp sang backend.
- Nếu cổng 3001 hoặc 5173 đang bận, đổi API_PORT/WEB_PORT trong .env.
- Dữ liệu local nằm trong .data/postgres. Xóa thư mục này sẽ xóa toàn
  bộ tài khoản và ghi chú local.
- Thư xác minh và thư đặt lại mật khẩu được lưu thành tệp .txt/.eml
  trong .data/mail, không gửi tới inbox thật khi MAIL_TRANSPORT=file.


----------------------------------------------------------------------
3. TÀI KHOẢN DÙNG ĐỂ CHẤM BÀI (BẢN LOCAL)
----------------------------------------------------------------------

Các tài khoản dưới đây được tạo bằng seed:demo trên bản local.
Database Render riêng: chưa tạo các tài khoản chấm này trên online.
Online hiện chưa cấu hình gửi email thật.

Tài khoản A (chủ ghi chú, có dữ liệu mẫu):
    Email:    rumnopro0809@gmail.com
    Mật khẩu: Rum@1234

Tài khoản B (dùng để thử chia sẻ và quyền):
    Email:    duongphamthai82@gmail.com
    Mật khẩu: Thai@1234

Ghi chú "Ghi chú bảo mật" của tài khoản A dùng mật khẩu riêng:
    Note@1234

Sau khi chạy npm run seed:demo, database local có 6 ghi chú, 3 nhãn
(Học tập, Công việc, Cá nhân), 2 tệp đính kèm, 1 ghi chú được bảo vệ
và 2 ghi chú chia sẻ cho tài khoản B (một chỉ đọc, một được sửa).

Nếu database chưa có dữ liệu mẫu (máy mới hoặc đã xóa .data), mở
terminal thứ hai khi ứng dụng đang chạy và chạy:

    npm.cmd run seed:demo

Script này đăng nhập hoặc tạo hai tài khoản trên, xác minh email qua
thư local, rồi tạo nhãn, ghi chú, tệp đính kèm, ghi chú bảo vệ và
chia sẻ. Có thể chạy lại nhiều lần mà không nhân đôi dữ liệu.

Nếu muốn tự tạo tài khoản khác, làm trực tiếp trên giao diện:

1. Mở http://localhost:5173/register.
2. Nhập tên hiển thị, email và mật khẩu từ 8 ký tự, nhập lại mật khẩu.
3. Đăng ký xong hệ thống tự đăng nhập và tạo liên kết xác minh trong
   .data/mail (mở tệp .txt mới nhất để lấy liên kết).
4. Tạo một vài ghi chú, nhãn, ghim, nhắc việc và tệp đính kèm để có
   dữ liệu demo.
5. Tạo tài khoản thứ hai và dùng chức năng "Chia sẻ ghi chú" để thử
   quyền Chỉ đọc và Được sửa.

Không đưa mật khẩu cá nhân thật vào Readme.txt hoặc repository.
Hai mật khẩu trên chỉ dùng cho tài khoản demo của môn học.


----------------------------------------------------------------------
4. EMAIL XÁC MINH VÀ ĐẶT LẠI MẬT KHẨU
----------------------------------------------------------------------

Cấu hình mặc định trong .env.example:

    MAIL_TRANSPORT=file

Cách lấy liên kết:
1. Đăng ký tài khoản hoặc bấm gửi lại xác minh.
2. Mở thư mục .data/mail.
3. Mở tệp .txt mới nhất; liên kết xác minh bắt đầu bằng http.
4. Mở liên kết khi ứng dụng đang chạy.

Muốn gửi email thật, sửa .env:

    MAIL_TRANSPORT=smtp
    MAIL_FROM=Ghi chu <no-reply@ten-mien-cua-ban>
    SMTP_HOST=...
    SMTP_PORT=587
    SMTP_SECURE=false
    SMTP_USER=...
    SMTP_PASS=...

Sau đó khởi động lại server. Không commit .env hoặc thông tin SMTP.


----------------------------------------------------------------------
5. CHỨC NĂNG ĐÃ CÓ
----------------------------------------------------------------------

Tài khoản:
- Đăng ký, tự đăng nhập, chống email trùng, băm mật khẩu bằng bcrypt.
- Đăng nhập, đăng xuất, cookie phiên HttpOnly, hết hạn phiên.
- Xác minh email, gửi lại liên kết xác minh.
- Quên mật khẩu và đặt lại mật khẩu bằng liên kết email dùng một lần.
- Xem và cập nhật hồ sơ, tải/xóa avatar PNG/JPEG/WebP tối đa 2 MB.
- Đổi mật khẩu, đăng xuất các phiên cũ.
- Tùy chọn cỡ chữ, mật độ hiển thị, giao diện sáng/tối, màu ghi chú;
  lưu theo tài khoản và áp dụng lại khi đăng nhập.

Ghi chú:
- Tạo, sửa, xóa có xác nhận; dùng chung một editor.
- Tự lưu khi ngừng gõ, không có nút Save; xử lý thử lại, mất phản hồi,
  xung đột phiên bản và giữ bản nháp khi hết phiên.
- Mặc định dạng lưới, chuyển sang danh sách; phân trang.
- Tìm kiếm tự động trong tiêu đề và nội dung.
- Ghim lên đầu; ghim mới nhất trước; ghim luôn đứng trước các mục khác.
- Nhãn màu: thêm, sửa, xóa nhãn; gắn nhiều nhãn; lọc theo nhãn.
- Nhắc việc: thời gian, quan trọng, hoàn thành, việc hằng ngày; màu
  trạng thái quá hạn/sắp hạn/hoàn thành.
- Đính kèm ảnh, video MP4/WebM và tệp; xem trước ảnh/video; tải xuống.
- Chế độ khách lưu ghi chú trong localStorage, tách khỏi tài khoản.

Nâng cao:
- Bật/tắt mật khẩu cho từng ghi chú; mở khóa theo phiên 15 phút.
- Đổi mật khẩu ghi chú; tắt bảo vệ cần mật khẩu hiện tại.
- Chia sẻ ghi chú cho tài khoản đã đăng ký bằng email, quyền Chỉ đọc
  hoặc Được sửa; đổi quyền và thu hồi.
- Khu vực "Được chia sẻ với tôi", hiển thị người chia sẻ, thời điểm,
  quyền và thông báo chia sẻ mới trong ứng dụng.
- Cộng tác trực tiếp (mục 26): A chia sẻ cho B quyền Được sửa; cả hai
  mở cùng ghi chú và bấm "Cộng tác trực tiếp". Gõ ở hai cửa sổ để xem
  thay đổi tức thời. Chờ "Đã đồng bộ" rồi đóng và mở lại kiểm tra lưu.
  Người chỉ đọc xem trực tiếp nhưng không sửa. Mất mạng tạm thời sẽ
  thử kết nối lại khi giữ trang mở. Hướng dẫn đầy đủ: source/REALTIME.md.

Giao diện:
- Responsive cho điện thoại, máy tính bảng và desktop.
- Trạng thái đang tải, rỗng, lỗi; thông báo thao tác.
- GSAP cho chuyển động; tôn trọng prefers-reduced-motion.
- Font Be Vietnam Pro và Literata được self-host, không phụ thuộc CDN.


----------------------------------------------------------------------
6. CHỨC NĂNG CHƯA HOÀN THÀNH
----------------------------------------------------------------------

Các mục sau chưa có hoặc mới một phần, không tính là đã hoàn thành:

- AI Summary (mục 27) và AI Q&A có dẫn nguồn (mục 28).
- Offline đầy đủ (mục 31): chưa có service worker, cache ghi chú tài
  khoản và đồng bộ khi có mạng lại. Chế độ khách dùng localStorage chỉ
  là một phần.
- Đã triển khai online tại https://notes-503073.onrender.com/.
  Đã thử HTTPS, đăng ký/phiên, tạo/sửa/đọc ghi chú và tệp trên database Render.
  Cần quay video mục 32; email thật và dữ liệu mẫu online còn chưa có.
- SMTP thật và PostgreSQL server riêng chưa được kiểm chứng trong bộ
  test tự động; local dùng file mail và PGlite.
- Chưa chụp thủ công đủ ba cỡ màn hình 375px, 768px, 1440px và chưa
  thử tải video MP4/WebM. Các luồng đăng ký, xác minh email, quên mật
  khẩu, chia sẻ A→B, mở khóa ghi chú, tải PNG/TXT và sáng/tối đã thử
  ngày 01/11 trên trình duyệt.

Các mục đã có code nhưng cần demo trong video mới được tính điểm:
xác minh email, quên/đặt lại mật khẩu, hồ sơ/avatar, đính kèm, bảo vệ
ghi chú, chia sẻ, responsive, UI/UX.


----------------------------------------------------------------------
7. KIỂM THỬ VÀ BUILD
----------------------------------------------------------------------

Chạy kiểm thử tự động:

    npm.cmd test

Chạy kiểm tra kiểu TypeScript:

    npm.cmd run typecheck

Build frontend và backend:

    npm.cmd run build

Kết quả gần nhất ngày 01/11/2026:
- 125/125 bài test đạt.
- TypeScript và build đạt; build tạo build/web và build/api.
- Lighthouse trên workspace đã đăng nhập: Accessibility 100,
  Best Practices 100, SEO 100.

Chạy bản build chỉ sau khi đã cấu hình đủ môi trường production:

    $env:NODE_ENV="production"
    npm.cmd start

Lưu ý: chế độ production bắt buộc có DATABASE_URL, MAIL_TRANSPORT=smtp
và APP_URL dùng HTTPS; nếu thiếu, server sẽ dừng ngay khi khởi động.
Vì vậy để chấm local, dùng npm.cmd run dev ở mục 2 là cách đơn giản nhất.


----------------------------------------------------------------------
8. TRIỂN KHAI ONLINE (NẾU ĐÃ CẤU HÌNH)
----------------------------------------------------------------------

Các biến môi trường bắt buộc khi production:

    NODE_ENV=production
    HOST=0.0.0.0
    API_PORT=...
    APP_URL=https://ten-mien-cua-ban
    DATABASE_URL=postgresql://...
    MAIL_TRANSPORT=smtp
    MAIL_FROM=...
    SMTP_HOST=...
    SMTP_PORT=587
    SMTP_SECURE=false
    SMTP_USER=...
    SMTP_PASS=...
    TRUST_PROXY=true   (chỉ bật sau reverse proxy tin cậy)

Quy trình:
1. npm.cmd ci
2. npm.cmd run build
3. npm.cmd start
4. Kiểm tra GET /api/health trả {"status":"ok"}.
5. Đăng ký thử, xác minh email, tạo ghi chú và tải lại trang.

Nếu chưa triển khai online, phần này ghi rõ "chưa có URL" và dùng cách
chạy local ở mục 2 để chấm.


----------------------------------------------------------------------
9. CẤU TRÚC CHÍNH
----------------------------------------------------------------------

apps/web/                 Giao diện React + TypeScript + Vite
  src/App.tsx             Router, đăng nhập, hồ sơ, landing
  src/components/         Workspace, editor, nhãn, nhắc việc, chia sẻ...
  src/autosave/           Bộ máy tự lưu và xử lý xung đột
  src/localNotes.ts       Chế độ khách dùng localStorage
  src/styles.css          Giao diện responsive và dark mode
  test/                   Kiểm thử giao diện và tự lưu

apps/api/                 API Express + TypeScript
  src/index.ts            Khởi động database và HTTP server
  src/app.ts              Middleware, bảo vệ request, gắn router
  src/auth.ts             Tài khoản, phiên, email, hồ sơ, mật khẩu
  src/notes.ts            Ghi chú, tìm kiếm, ghim, chia sẻ, bảo vệ
  src/labels.ts           Nhãn
  src/attachments.ts      Tệp đính kèm
  src/noteAccess.ts       Kiểm tra quyền và mở khóa ghi chú
  src/database.ts         Adapter PostgreSQL/PGlite và migration
  src/mail.ts             Gửi SMTP hoặc ghi tệp local
  test/                   Kiểm thử API và database

.data/postgres            Database PGlite local (không commit)
.data/mail                Thư local (không commit)
build/                    Kết quả build (không commit)
.env                      Cấu hình local (không commit)


----------------------------------------------------------------------
10. LƯU Ý KHI CHẤM VÀ NỘP BÀI
----------------------------------------------------------------------

- Nộp kèm .git và lịch sử commit nếu khai đạt điều kiện đóng góp GitHub.
- Repo private phải cấp quyền đọc cho giảng viên đến hết thời gian chấm.
- Rubric.xlsx phải điền theo mẫu của thầy; file RUBRIC_SELF_ASSESSMENT.md
  chỉ là bản nháp tự đánh giá, không thay thế Rubric.xlsx.
- Video demo.mp4 phải có cả hai thành viên, tối thiểu 1080p, âm thanh rõ
  và demo đủ các chức năng khai đã làm.
- Không đưa .env, mật khẩu thật, cookie hoặc API key vào source/ZIP.
- Đặt tên thư mục/ZIP theo mẫu mã số và họ tên thành viên.
- Nộp trước 23:59 ngày 02/11/2026; nộp trễ bị trừ 1 điểm mỗi ngày.

======================================================================
HẾT
======================================================================
