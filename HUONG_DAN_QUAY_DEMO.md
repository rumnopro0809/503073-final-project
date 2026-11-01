# Quay demo.mp4 — 503073

Nguyễn Hải Triều — 524H0072; Dương Phạm Thái — 524H0189. Cập nhật 01/11/2026 sau khi đã triển khai SMTP Mailjet, realtime, AI Summary và AI Q&A online.

Quay **1920×1080, 30 FPS**, tiếng nói rõ, cả hai thành viên tham gia. Thời lượng gợi ý **18–22 phút**, không phải độ dài bắt buộc của đề. Đi lần lượt ID 1–32; chỉ tính các chức năng thực sự được trình diễn. Mục 31 nói rõ chỉ một phần.

## 1. Cách quay

Dễ nhất là một bản quay màn hình bằng OBS, hai người thay nhau nói và thao tác. Đầu video nên có hình và tiếng của cả hai để dễ nhận diện; khi demo có thể chỉ quay màn hình. Phần yêu cầu đã cung cấp không bắt buộc giữ webcam suốt video.

Nếu ở xa, mỗi người quay phần giới thiệu và một số phần demo rồi ghép theo thứ tự dưới đây. Phân công là người thuyết minh, không phải tuyên bố ai đã viết phần code nào. Khi nói đóng góp phải đúng thực tế.

### Thiết lập OBS

1. Tải từ https://obsproject.com/download nếu chưa có. Không cần livestream/plugin.
2. **Tools → Auto-Configuration Wizard**, ưu tiên recording.
3. **Settings → Video**: Base (Canvas) và Output (Scaled) **1920×1080**, FPS **30**. Kiểm tra chữ thực sự rõ; phóng nguồn độ phân giải thấp lên 1080p không tự làm chữ rõ hơn.
4. **Sources → + → Display Capture** để chuyển được giữa web, email và code. Đóng tab riêng tư, Render Environment, .env và trang API key. Tắt thông báo desktop/Do Not Disturb.
5. Nếu dùng webcam: thêm **Video Capture Device**, đặt ở góc không che nút hoặc chỉ dùng ở mở đầu.
6. Kiểm tra **Mic/Aux** trong Audio Mixer, chọn đúng micro, nhìn thanh âm lượng khi nói. Dùng tai nghe, tránh hai micro cùng thu gây vọng. Không cần nhạc nền.
7. Trong **Settings → Output**, dùng High Quality/Medium File Size nếu máy đáp ứng. Có thể ghi **MKV**, sau đó **File → Remux Recordings** sang MP4. MKV giảm nguy cơ mất cả file nếu chương trình dừng bất thường. Remux chỉ đổi định dạng vỏ, không ghép clip và không tăng độ phân giải.
8. Quay thử **20–30 giây**, mở file nghe cả hai người và xem chữ. Nếu dùng remux, kiểm tra MP4 sau chuyển đổi.
9. Bấm **Start Recording**. Có thể dùng Pause nếu khả dụng lúc chuẩn bị, nhưng giữ đủ các bước chứng minh chức năng. Nếu quay nhiều file, đặt `01-mo-dau`, `02-tai-khoan`...; bản ghép cuối mới đặt **demo.mp4**.

Tài liệu chính thức: https://obsproject.com/kb/quick-start-guide ; https://obsproject.com/kb/standard-recording-output-guide .

## 2. Chuẩn bị

- Dùng **https://notes-503073.onrender.com/** cho cả email và Gemini thật. Mở trước vài phút để Render sẵn sàng. Không bấm AI liên tục khi đang chờ.
- Hai profile trình duyệt độc lập A/B; có thể dùng cửa sổ thường A và ẩn danh B. **Hai tab thường không tách phiên**; các cửa sổ ẩn danh cùng trình duyệt cũng thường dùng chung phiên với nhau.
- Tài khoản chấm A/B và dữ liệu mẫu có trong **README.md**. Không đổi mật khẩu/xóa hết dữ liệu của hai tài khoản này.
- Một **tài khoản C bằng email thật bạn kiểm soát** để quay đăng ký, xác minh, hồ sơ, đổi/reset mật khẩu. Tài khoản chấm example.test không có inbox, không dùng chúng để chứng minh gửi thư.
- Dùng mật khẩu ứng dụng thử, không dùng mật khẩu Gmail. Chỉ hiển thị thư ứng dụng cần dùng, đóng thư riêng tư; không quay cookie, token chưa sử dụng hay API key.
- Chuẩn bị PNG/JPEG, avatar nhỏ, TXT/PDF và **video MP4/WebM thật 5–10 giây dưới 10 MB**. Thử upload/phát video trước khi quay vì mục này còn thiếu kiểm chứng tay.
- Nội dung ghi chú thử `Demo 503073`: “Triều phụ trách kiểm thử. Thái phụ trách quay video 1080p. Hạn nộp trước 23:59 ngày 02/11/2026.” Tạo nó ở mục 11 và giữ cho các mục sau.
- Mở rubric ở màn hình phụ hoặc in checklist. Đọc “Mục N — tên chức năng” trước mỗi mục; giữ kết quả khoảng 2 giây để người chấm thấy.
- Không xóa toàn bộ localStorage/database để quay; chỉ dùng bản nháp riêng.

## 3. Mở đầu — 0:00–1:30

**Triều:** “Em chào thầy. Em là Nguyễn Hải Triều, mã số sinh viên 524H0072. Nhóm em giới thiệu ứng dụng quản lý ghi chú môn Web Programming and Applications.”

**Thái:** “Em là Dương Phạm Thái, mã số sinh viên 524H0189. Sau phần công nghệ và kiến trúc, nhóm em sẽ trình diễn lần lượt các chức năng theo bảng 32 tiêu chí.”

**Triều**, chỉ cấu trúc source sạch:

“Giao diện dùng React, TypeScript và Vite. Backend dùng Node.js và Express; PostgreSQL lưu tài khoản, ghi chú, nhãn, chia sẻ và tệp. Khi chạy local nhóm dùng PostgreSQL nhúng PGlite. Trình duyệt gọi API qua /api. Mật khẩu băm bằng bcrypt, phiên đăng nhập dùng cookie HttpOnly. Realtime dùng WebSocket và Yjs. Mailjet gửi email; backend gọi Gemini cho tóm tắt và hỏi đáp, không đưa API key xuống trình duyệt. Ứng dụng triển khai trên Render với HTTPS.”

Chỉ `apps/web`, `apps/api`, `database.ts`, `scripts/seed-demo.mjs`; không mở .env. Không cần đọc từng dòng code hay chờ npm install/build trong video. Chỉ giới thiệu kiến trúc tổng quan và đường dẫn chạy trong README.

## 4. Quay tuần tự 32 mục

Thời gian bên dưới có thể xê dịch. Quan trọng là thao tác và kết quả thật.

### 1:30–6:30 — Triều: tài khoản C, mục 1–8

| ID | Thao tác | Kết quả/lời nói |
| --- | --- | --- |
| 1 | Đăng ký bằng email thật C; nhập lại mật khẩu sai rồi sửa đúng | Thấy kiểm tra lỗi, đăng ký thành công, tự đăng nhập. |
| 2 | Chỉ banner chưa xác minh, mở email nhận thật, bấm liên kết | Banner biến mất. Không dùng thư local thay email thật khi quay online. |
| 3 | Đăng xuất; đăng nhập sai một lần, sau đó đúng, tải lại | Thấy lỗi và phiên đăng nhập giữ sau tải lại. |
| 4 | Quên mật khẩu → email C → mở thư → đặt mật khẩu mới → đăng nhập | Nói “Sau reset phải đăng nhập thủ công”. Giữ đủ bước gửi yêu cầu, nhận thư và hoàn tất reset. |
| 5 | Mở hồ sơ C | Thấy tên/email/avatar mặc định. |
| 6 | Đổi tên, tải avatar hợp lệ, tải lại | Thấy thay đổi được lưu. |
| 7 | Đổi mật khẩu: sai mật khẩu hiện tại rồi đúng; đăng nhập lại nếu cần | Chứng minh kiểm tra mật khẩu hiện tại. Không đổi mật khẩu hai tài khoản chấm. |
| 8 | Đổi cỡ chữ, màu ghi chú, sáng/tối; tải lại | Tùy chọn được nhớ theo tài khoản. |

Chuyển sang A để dùng dữ liệu mẫu. Nếu email chậm, quay riêng đoạn này rồi ghép, giữ đầy đủ thao tác; không dựng thư giả.

### 6:30–10:30 — Thái: ghi chú, mục 9–18

| ID | Thao tác | Kết quả |
| --- | --- | --- |
| 9 | A bấm dạng danh sách | Ghi chú hiển thị danh sách, mở được editor. |
| 10 | Bấm dạng lưới, tải lại | Mặc định lưới; đọc rõ ID dù đã thấy lưới trước đó. |
| 11 | Tạo `Demo 503073` với nội dung ở phần chuẩn bị | Chỉ tiêu đề/nội dung bắt buộc; tạo được và mở lại. |
| 12 | Sửa một dòng, đóng rồi mở lại | Bản sửa được giữ, tạo/sửa dùng chung editor. |
| 13 | Tạo `Demo xóa`; Xóa → Hủy, rồi Xóa → xác nhận | Hủy thì còn, xác nhận mới mất. Giữ `Demo 503073`. |
| 14 | Gõ liên tục, ngừng, chờ Đã lưu, tải lại | Không có nút Save; nội dung vẫn còn. Đọc rõ mục 14. |
| 15 | Upload PNG và **video thật**, phát video | Có ảnh xem trước, video thực sự chạy; không dùng ảnh chụp video thay thế. Có thể tắt tiếng video để không lẫn lời. |
| 16 | Upload TXT/PDF, tải xuống, mở tệp | Nội dung tải về đúng. Có thể xóa một tệp thử. |
| 17 | Ghim hai ghi chú thử | Ghim đứng trên, mới ghim đứng trước. |
| 18 | Chỉ badge ghim/khóa/chia sẻ ở lưới và danh sách | Dùng dữ liệu mẫu có trạng thái sẵn; đọc rõ mục 18. |

### 10:30–13:30 — Thái: tìm kiếm, nhãn, bảo vệ, mục 19–24

| ID | Thao tác | Kết quả |
| --- | --- | --- |
| 19 | Gõ `1080p` vào tìm kiếm, xóa từ khóa | Tìm được từ trong nội dung; tự tìm khi gõ, không bấm Search. |
| 20 | Tạo nhãn `Demo video`, đổi tên/màu | Nhãn cập nhật; sau mục 21–22 quay lại xóa nhãn này và chỉ ghi chú vẫn còn, nhắc lại ID 20. |
| 21 | Gắn hai nhãn cho `Demo 503073`, bỏ một, mở lại | Các nhãn thực sự gắn trên ghi chú. |
| 22 | Lọc nhãn, kết hợp từ khóa rồi bỏ lọc | Kết quả đúng; hoàn tất xóa nhãn ở mục 20 sau đó. |
| 23 | Đặt mật khẩu ghi chú thử, khóa, mở lại | Chưa nhập đúng không thấy nội dung; sau mục 24 tắt bảo vệ bằng mật khẩu hiện tại để tiếp tục. |
| 24 | Sai/đúng mật khẩu; đổi mật khẩu; khóa; thử cũ rồi mới | Cũ không mở được, mới mở được. Không đổi Note@1234 của ghi chú mẫu. |

### 13:30–16:30 — Cả hai: chia sẻ/realtime, mục 25–26

Triều điều khiển A, Thái điều khiển B nếu có hai máy; hoặc đặt hai cửa sổ độc lập cạnh nhau trên một máy và thay nhau nói.

| ID | Thao tác | Kết quả |
| --- | --- | --- |
| 25 | A chia sẻ `Demo 503073` cho B quyền đọc; B mở Được chia sẻ với tôi; A đổi sang quyền sửa; B mở lại và sửa | Có người chia sẻ/thời điểm/quyền/thông báo. Chỉ đọc không sửa, quyền sửa có hiệu lực. |
| 26 | Chờ bản thường lưu xong; **cả A và B bấm Cộng tác trực tiếp**; A gõ “Triều kiểm thử”, B thêm “Thái quay video” | Giữ hai cửa sổ trên hình, thấy nội dung sang bên kia **không tải lại**. Chờ Đã đồng bộ; đóng cộng tác/mở lại để kiểm tra lưu. |
| 25 tiếp | A thu hồi quyền, B mở/tải lại | B không truy cập được. Chỉ thu hồi sau khi quay realtime; nếu lỡ thu hồi thì cấp lại. |

Lời gợi ý của Thái: “Đây là thay đổi trực tiếp qua WebSocket và Yjs, không chỉ cảnh báo xung đột.” Không mở Network chứa cookie để chứng minh.

### 16:30–18:30 — Triều: AI thật, mục 27–28

| ID | Thao tác | Kết quả/lời nói |
| --- | --- | --- |
| 27 | A mở `Demo 503073` ở editor thường, bấm Tóm tắt bằng AI, đợi kết quả, tạo lại | “Backend gọi Gemini để tóm tắt.” Kết quả riêng không ghi đè nội dung gốc. |
| 28 | Hỏi AI: “Ai phụ trách quay video và video cần đạt độ phân giải nào?” | Có câu trả lời và [1]; xem đoạn trích, bấm tên nguồn mở ghi chú gốc. |
| 28 tiếp | Hỏi “Thiên thạch XYZ98765 ở đâu?” hoặc thông tin chắc chắn không có | Thấy chưa đủ thông tin, không bịa nguồn. Nói “Truy xuất đoạn theo từ khóa rồi dùng Gemini tổng hợp, không dùng dữ liệu ngoài”. |

Giữ cả trạng thái chờ và kết quả. Nếu quota/timeout, quay lại khi hoạt động; không nhập tay câu trả lời hoặc dùng ảnh thay kết quả thật. Không lộ API key.

### 18:30–21:00 — Thái: giao diện, phạm vi offline, online, mục 29–32

| ID | Thao tác | Kết quả/lời nói |
| --- | --- | --- |
| 29 | Dùng Tab để thấy focus, tìm từ không có kết quả, chỉ phản hồi Đã lưu/một lỗi | Có trạng thái rỗng, lỗi, phản hồi và thao tác bàn phím. Nhắc nhanh các điểm đã thấy ở phần trước. |
| 30 | DevTools Device Toolbar đổi lần lượt 375, 768, 1440 px; mở editor/menu mỗi cỡ | Không tràn ngang hoặc che nút. File quay vẫn 1920×1080, chỉ viewport web thay đổi. |
| 31 | Nói rõ chức năng offline chưa triển khai; không mở `/guest` | Tự chấm 0 cho offline. Bản hiện tại bắt buộc đăng nhập, đã bỏ ghi chú khách. |
| 32 | Hiện thanh địa chỉ HTTPS `notes-503073.onrender.com`, đăng nhập/mở dữ liệu mẫu | “Ứng dụng công khai trên Render, dữ liệu PostgreSQL”. Localhost không thay bằng chứng online. |

## 5. Kết thúc — khoảng 30 giây

**Triều:** “Nhóm em đã trình diễn các chức năng đã triển khai theo bảng tiêu chí. Phần offline tài khoản chưa hoàn thành và được ghi rõ trong rubric.”

**Thái:** “Source code, hướng dẫn chạy, URL và tài khoản chấm có dữ liệu mẫu nằm trong hồ sơ nộp. Nhóm em cảm ơn thầy.”

Không đọc điểm tự đánh giá như điểm đã được giảng viên chấm. Nói đúng phần đóng góp thực tế và quy định môn về hỗ trợ AI.

## 6. Kiểm tra bản cuối

- [ ] Cả hai giới thiệu tên/MSSV, nghe rõ tiếng từng người.
- [ ] File cuối **demo.mp4**, Properties/Details xác nhận **1920×1080 trở lên**; kiểm tra file MP4 sau ghép/remux, không chỉ cài đặt OBS.
- [ ] Có thao tác/kết quả theo ID 1–32; phần offline ghi rõ chưa triển khai.
- [ ] Đủ email thật, video đính kèm chạy được, hai cửa sổ realtime, AI có kết quả và nguồn mở được.
- [ ] Không lộ .env/key/cookie, thư riêng tư; không chữ quá nhỏ, màn hình đen, mất/lệch tiếng.
- [ ] Xem lại các đoạn chuyển, đầu/giữa/cuối; không cắt mất bước quan trọng hoặc dùng kết quả giả.
- [ ] Nếu video lớn, theo đề có thể đưa lên YouTube và ghi link trong Readme.txt; kiểm tra link mở được khi chưa đăng nhập, không để chỉ chủ tài khoản xem được.
- [ ] Thêm video/link vào bộ hồ sơ rồi nén/nộp bản cuối. Kịch bản Markdown không thay video thật.

Giữ bản MKV/clip gốc để sửa. Sau khi quay, có thể đưa đường dẫn file trong máy để mình hỗ trợ kiểm tra độ phân giải, thời lượng, điểm cắt và ghép các đoạn.
