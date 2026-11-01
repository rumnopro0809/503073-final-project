# Cộng tác trực tiếp (mục 26)

1. Đăng nhập tài khoản A, tạo ghi chú có tiêu đề và nội dung, chờ Đã lưu.
2. Trong Chia sẻ, thêm email tài khoản B đã đăng ký, chọn Được sửa.
3. A chọn **Cộng tác trực tiếp**. B mở cửa sổ riêng, đăng nhập, vào Được chia sẻ với tôi, mở ghi chú và chọn **Cộng tác trực tiếp**.
4. Gõ đồng thời ở hai cửa sổ. Tiêu đề và nội dung cập nhật qua WebSocket/Yjs; chờ **Đã đồng bộ** rồi đóng cộng tác, mở lại để kiểm tra lưu bền vững.
5. Thử quyền Chỉ đọc: B vẫn xem trực tiếp, không thể sửa. Thu hồi quyền sẽ ngắt phiên của B. Ghi chú bảo vệ cần mở khóa riêng trong từng phiên trước khi vào cộng tác.
6. Ngắt mạng tạm thời ở B trong khi giữ trang mở, sửa tiếp ở cả hai, bật mạng B trở lại: tự kết nối và ghép các thay đổi.

## Chạy và kiểm tra

Không cần thêm biến môi trường. Production dùng cùng origin với APP_URL / RENDER_EXTERNAL_URL, endpoint `wss://<host>/api/live/<noteId>`. Vite chuyển tiếp WebSocket trong chế độ dev. `npm test` gồm test HTTP, WebSocket thật với hai tài khoản, client ACK/reconnect và giao diện; `npm run build` kiểm tra TypeScript và build production.

Kiểm tra local ngày 01/11/2026: **136/136 test đạt**, TypeScript và production build đạt. Script `node scripts/check-realtime-online.mjs https://notes-503073.onrender.com/` kiểm tra bản HTTPS/WSS với hai tài khoản example.test riêng; xóa ghi chú thử và đăng xuất sau kiểm tra. Tài khoản thử được giữ để dùng lại, thông tin đăng nhập nằm trong `.data/` bị Git bỏ qua. Không dùng tài khoản cá nhân trong script này.

Database tự thêm `notes.live_state` (BYTEA) và `notes.live_epoch` khi khởi động. Mỗi cập nhật khóa hàng, kiểm tra phiên đăng nhập/quyền/mở khóa, ghép Yjs rồi commit cả nội dung và snapshot; chỉ gửi ACK sau commit. Snapshot được giữ qua restart. Giữ cơ chế version để trình sửa thường phát hiện thay đổi.

## Phạm vi

- Cả hai người cần bật **Cộng tác trực tiếp**. Trình sửa thường vẫn tự lưu HTTP; nếu nó sửa nội dung, phiên cộng tác cũ sẽ dừng thay vì ghi đè. Sao chép bản nháp chưa đồng bộ trước khi đóng và mở lại.
- Bản nháp mất mạng chỉ giữ trong phiên trang đang mở, chưa có service worker hay offline đầy đủ. Đóng/tải lại trước ACK có thể mất phần chưa đồng bộ; ứng dụng cảnh báo khi rời trang có bản nháp.
- Phát trực tiếp trong một tiến trình server (phù hợp một instance Render hiện tại). Chưa có pub/sub để phát giữa nhiều instance, con trỏ cộng tác, danh sách người đang online hay rich text.
- Công cụ trình duyệt của phiên làm việc hiện tại không khởi động được; cần quay demo thực tế với hai cửa sổ. Không dùng test tự động thay cho yêu cầu video 1080p.
