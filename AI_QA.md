# AI Q&A — mục 28

Kiểm tra local ngày 01/11/2026: **156/156 test đạt**, TypeScript và production build đạt. Gồm 9 test API/provider Q&A và 2 test giao diện; provider trong các test được giả lập, cần kiểm tra API thật sau deploy bằng script bên dưới.

Đăng nhập → **Hỏi AI** ở thanh bên → đặt câu hỏi có từ khóa cụ thể → **Hỏi AI**. Ví dụ ghi chú có “Thái phụ trách quay video”, hỏi “Ai phụ trách quay video?”. Kết quả có số nguồn `[1]`, tên ghi chú, phiên bản và đoạn trích; bấm tên nguồn để mở nội dung mới nhất. Nếu không đủ bằng chứng, ứng dụng báo chưa đủ thông tin.

## Cấu hình

Dùng chung `GEMINI_API_KEY` và `GEMINI_MODEL` với AI Summary. Render hiện tại đã cấu hình key; không cần tạo key mới. Key chỉ ở server. Mặc định model `gemini-3.1-flash-lite`; timeout 35 giây ở server, 40 giây ở trình duyệt. API: `POST /api/ai/ask` với JSON `{ "question": "Ai phụ trách quay video?" }` và phiên đăng nhập hiện tại.

## Dữ liệu và nguồn

- Lưu bản nháp/đợi cộng tác đồng bộ trước khi hỏi. Tìm từ khóa bằng PostgreSQL full-text cấu hình `simple`, lấy tối đa 6 ghi chú liên quan; mỗi đoạn trích tối đa 4.000 ký tự. Tìm trong tiêu đề và toàn bộ nội dung, kể cả cuối ghi chú dài.
- Chỉ lấy ghi chú thuộc tài khoản hoặc được chia sẻ quyền đọc/sửa. Ghi chú có mật khẩu cần đã mở khóa trong phiên và còn hạn. Dữ liệu không được phép hoặc chưa mở khóa không gửi đến Gemini.
- Model nhận câu hỏi và các đoạn trích, không nhận API key trong prompt, tệp đính kèm hay nội dung toàn bộ tài khoản. Khi bấm hỏi, dữ liệu này được gửi đến Google. Không có công cụ tìm web hay thực thi lệnh.
- Gemini trả JSON có câu trả lời, ID nguồn, trạng thái thiếu thông tin. Backend kiểm tra nguồn phải thuộc tập truy xuất, kiểm tra số trích dẫn và kiểm tra lại phiên, quyền, mật khẩu, version của tất cả nguồn sau khi AI trả lời. Nguồn thay đổi/thu hồi trong lúc chờ sẽ trả lỗi, yêu cầu hỏi lại.
- Mỗi tài khoản tối đa 6 câu hỏi/phút, 1 yêu cầu đồng thời; mỗi tiến trình tối đa 4. Lỗi quota/kết nối có thông báo, không tự gọi lặp.

## Giới hạn cần nói đúng trong video

Đây là truy xuất theo từ khóa, chưa dùng embedding hoặc tìm theo nghĩa. Có thể bỏ sót nếu câu hỏi dùng từ khác với ghi chú; thử từ khóa cụ thể, có dấu giống nội dung. Chưa hỏi đáp về nội dung tệp, chưa có lịch sử chat hay offline. Nguồn đính kèm giúp đối chiếu, không bảo đảm AI hiểu chính xác mọi chi tiết. Câu trả lời chỉ nằm trong phiên giao diện và không sửa ghi chú. Khi mở nguồn, server kiểm tra quyền lại; nội dung nguồn có thể đã đổi sau thời điểm trả lời.

## Kiểm thử/demo

`npm test` có test truy xuất, quyền chia sẻ/mở khóa, không đủ dữ liệu, chặn nguồn bịa, thu hồi/thay đổi nguồn khi chờ, giới hạn context, Gemini JSON và giao diện mở nguồn. Test dùng provider giả lập. Script `node scripts/check-qa-online.mjs https://notes-503073.onrender.com/` dùng tài khoản thử riêng đã tạo ở bước realtime, gửi một câu hỏi thật đến Gemini, kiểm tra nguồn và xóa ghi chú thử.

Quay mục 28: tạo ghi chú phân công → hỏi ai quay video → chỉ câu trả lời và `[1]` → mở nguồn → hỏi một thông tin không có để thấy thông báo thiếu dữ liệu.

Tài liệu: https://ai.google.dev/api/generate-content ; https://ai.google.dev/gemini-api/docs/structured-output .
