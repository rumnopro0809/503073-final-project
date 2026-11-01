# AI Summary — mục 27

Mở ghi chú tài khoản đã lưu → **Tóm tắt bằng AI**. Ứng dụng lưu bản nháp trước, gửi tiêu đề/nội dung từ database đến Gemini, hiển thị kết quả riêng, không ghi đè ghi chú. Có thể dùng với ghi chú được chia sẻ chỉ đọc; ghi chú bảo vệ cần mở khóa. Trong chế độ cộng tác, đóng cộng tác rồi mở ghi chú để dùng tóm tắt.

## Cấu hình Render

1. Tạo Gemini API key tại https://aistudio.google.com/apikey bằng tài khoản Google của bạn. Dùng project có free tier nếu khả dụng; không cần bật thanh toán để thử chức năng này.
2. Render → notes-503073 → Environment → Add Environment Variable:
   - `GEMINI_API_KEY`: key vừa tạo (không gửi vào chat, không commit Git).
   - `GEMINI_MODEL`: `gemini-3.1-flash-lite` (mặc định trong source, có thể đổi theo model tài khoản được cấp).
3. Save, rebuild/redeploy và chờ Live. Không dùng tên `VITE_GEMINI_API_KEY`; key chỉ ở backend.
4. Đăng nhập https://notes-503073.onrender.com/, tạo ghi chú nhiều ý, bấm tóm tắt. Kiểm tra tên, số liệu, ngày; sửa nội dung và tạo lại.

Local: thêm cùng hai biến vào `.env`, khởi động lại API. Bỏ trống key thì báo chưa cấu hình (HTTP 503), không tạo kết quả giả. Free tier có giới hạn theo tài khoản/model; lỗi 429 được hiển thị để thử lại, không tự gọi lặp và không tự đổi sang dịch vụ trả phí.

## Kiểm thử và giới hạn

- `npm test`: mock Gemini để kiểm tra prompt/dữ liệu, xử lý lỗi/quota, quyền đọc, mở khóa, nguồn phiên bản, thay đổi/thu hồi quyền trong lúc chờ, giới hạn đồng thời, lưu trước khi tóm tắt và hiển thị văn bản an toàn.
- Những test này không chứng minh key thật hoặc quota đang hoạt động. Chỉ ghi mục 27 đã chạy online khi bấm nút và nhận phản hồi từ Gemini thật; quay thao tác này trong video.
- Tối đa 6 yêu cầu/phút/tài khoản, 1 yêu cầu đồng thời/tài khoản và 4 trên mỗi tiến trình. Timeout gọi Gemini 12 giây. Không có công cụ duyệt web hay truy cập các ghi chú khác trong prompt.
- Kết quả chỉ hiện trong phiên, không lưu database; chỉnh sửa sẽ bỏ kết quả cũ. AI có thể nhầm, phải kiểm tra lại. Không tóm tắt đính kèm và chưa làm AI Q&A (mục 28).
- Tiêu đề/nội dung được gửi tới Google khi người dùng bấm nút. Chính sách free tier về sử dụng dữ liệu khác paid tier; xem tài liệu giá trước khi dùng dữ liệu nhạy cảm.

Tài liệu chính thức: https://ai.google.dev/api/generate-content ; https://ai.google.dev/gemini-api/docs/models ; https://ai.google.dev/gemini-api/docs/pricing .
