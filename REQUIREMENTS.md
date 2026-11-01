# Kế hoạch project ứng dụng quản lý ghi chú

Nguồn: `D:/downloads/503073-FinalProject-V1.docx`, môn 503073 Web Programming & Applications, học kỳ I năm học 2026–2027.

Tài liệu này chuyển yêu cầu của thầy thành checklist triển khai. Phần lộ trình và mô hình dữ liệu là đề xuất ban đầu để cùng thảo luận, không phải yêu cầu bổ sung của đề. Cập nhật ngày 31/10/2026: nhóm có hai người; chủ tài khoản GitHub được người dùng xác nhận là rumnopro0809. Repository 503073-final-project đã được tạo ở chế độ riêng tư. Hạn nộp đã xác nhận lại là **trước 23:59 ngày 02/11/2026, giờ Việt Nam**. Lịch sử commit local hiện chỉ thấy một tác giả, chưa thấy đóng góp của thành viên thứ hai; quy định AI chi tiết của môn vẫn chưa được cung cấp. Xem `STATUS_2026-10-31.md` và `RUBRIC_SELF_ASSESSMENT.md` để biết tình trạng thực tế trước khi đánh dấu checklist.

Cập nhật 01/11/2026: 148/148 test và build đạt sau điều chỉnh bắt buộc đăng nhập. Đã gỡ chế độ khách và nhắc việc ngoài phạm vi đề, sửa thứ tự mặc định. Mục 31 hiện chưa triển khai. Realtime/AI/online giữ nguyên; rubric và ZIP cũ cần đóng lại. Xem BAT_BUOC_DANG_NHAP.md.

## Mục tiêu và phạm vi

Xây dựng ứng dụng web quản lý ghi chú theo tài khoản. Người dùng quản lý ghi chú và tệp đính kèm, tìm kiếm và phân loại bằng nhãn, bảo vệ từng ghi chú bằng mật khẩu, chia sẻ theo quyền, cộng tác thời gian thực, tóm tắt và hỏi đáp bằng LLM. Ứng dụng còn cần giao diện responsive, khả năng offline và phương án chạy để thầy chấm.

Không bổ sung chức năng ngoài đề. Framework và thư viện được phép; lựa chọn cụ thể cần phù hợp khả năng của nhóm và phương án chạy bài.

## Checklist 32 tiêu chí

Mỗi ô chỉ được đánh dấu hoàn thành khi chạy đúng, có xử lý lỗi và đã chuẩn bị tình huống demo. Đây là checklist làm việc, không thay thế file Rubric.xlsx do thầy cung cấp. Bảng tự đánh giá chi tiết, bằng chứng code và kịch bản demo nằm trong `RUBRIC_SELF_ASSESSMENT.md`; không đánh dấu mục 31 hoàn chỉnh và chỉ tính các mục đã trình diễn trong video.

| Xong | ID | Tiêu chí | Điểm |
| --- | --- | --- | --- |
| [ ] | 1 | Đăng ký tài khoản | 0.25 |
| [ ] | 2 | Kích hoạt tài khoản qua email | 0.25 |
| [ ] | 3 | Đăng nhập và đăng xuất | 0.25 |
| [ ] | 4 | Khôi phục mật khẩu qua email | 0.25 |
| [ ] | 5 | Xem hồ sơ và avatar | 0.25 |
| [ ] | 6 | Cập nhật hồ sơ và avatar | 0.25 |
| [ ] | 7 | Đổi mật khẩu tài khoản | 0.25 |
| [ ] | 8 | Tùy chọn người dùng | 0.25 |
| [ ] | 9 | Xem ghi chú dạng danh sách | 0.25 |
| [ ] | 10 | Xem ghi chú dạng lưới | 0.25 |
| [ ] | 11 | Tạo ghi chú | 0.25 |
| [ ] | 12 | Sửa ghi chú | 0.25 |
| [ ] | 13 | Xóa ghi chú | 0.25 |
| [ ] | 14 | Tự động lưu ghi chú | 0.25 |
| [ ] | 15 | Đính kèm ảnh/video | 0.25 |
| [ ] | 16 | Đính kèm tệp | 0.25 |
| [ ] | 17 | Ghim ghi chú lên đầu | 0.25 |
| [ ] | 18 | Biểu tượng trạng thái ghi chú đặc biệt | 0.25 |
| [ ] | 19 | Tìm kiếm ghi chú | 0.25 |
| [ ] | 20 | Xem, thêm, sửa, xóa nhãn | 0.25 |
| [ ] | 21 | Gắn nhãn vào ghi chú | 0.25 |
| [ ] | 22 | Lọc ghi chú theo nhãn | 0.25 |
| [ ] | 23 | Bật/tắt mật khẩu từng ghi chú | 0.50 |
| [ ] | 24 | Kiểm tra và đổi mật khẩu ghi chú | 0.50 |
| [ ] | 25 | Chia sẻ và nhận ghi chú | 0.50 |
| [ ] | 26 | Cộng tác và cập nhật thời gian thực | 0.50 |
| [ ] | 27 | AI Summary | 0.25 |
| [ ] | 28 | AI Question & Answer | 0.25 |
| [ ] | 29 | UI/UX | 0.50 |
| [ ] | 30 | Responsive | 0.50 |
| [ ] | 31 | Khả năng offline | 0.50 |
| [ ] | 32 | Triển khai online | 0.50 |

Tổng: tài khoản 2.0; ghi chú cơ bản 3.5; ghi chú nâng cao 2.5; yêu cầu khác 2.0; toàn bài 10.0 điểm.

## Ràng buộc cần đưa vào tiêu chí nghiệm thu

### Tài khoản

- Người chưa đăng nhập truy cập phần cần tài khoản phải được chuyển ngay về trang đăng nhập.
- Đăng ký chỉ yêu cầu email, tên hiển thị và mật khẩu nhập hai lần. Không thêm thông tin đăng ký ngoài đề.
- Lưu mật khẩu tài khoản bằng bcrypt, không lưu trực tiếp.
- Đăng ký thành công phải tự đăng nhập và gửi email chứa liên kết kích hoạt.
- Tài khoản chưa kích hoạt vẫn được dùng đầy đủ chức năng; hiển thị thông báo nổi bật cho đến khi kích hoạt.
- Hồ sơ cho phép xem/sửa tên hiển thị, avatar; kiểm tra tệp tải lên và có avatar mặc định.
- Đổi mật khẩu cần mật khẩu hiện tại và mật khẩu mới nhập hai lần; xử lý phiên đăng nhập an toàn sau khi đổi.
- Khôi phục mật khẩu phải xác minh bằng liên kết hoặc OTP qua email. Sau reset phải đăng nhập thủ công.
- Tùy chọn người dùng gồm các thiết lập được đề nêu như cỡ chữ ghi chú, màu ghi chú, giao diện sáng/tối.

### Ghi chú cơ bản

- Mặc định hiển thị dạng lưới; cho đổi sang danh sách.
- Trên giao diện tạo ban đầu, chỉ tiêu đề và nội dung là các trường nhập bắt buộc. Metadata hệ thống và thao tác bổ sung được đề cho phép.
- Tạo và sửa dùng chung giao diện.
- Tự lưu, không yêu cầu bấm nút Save.
- Luôn xác nhận trước khi xóa ghi chú.
- Hỗ trợ ảnh/video/tệp; cách thiết kế đính kèm do nhóm chọn theo đề.
- Mặc định sắp xếp mới nhất trước theo thời điểm tạo hoặc sửa. Ghi chú được ghim luôn ở trên; nhiều ghi chú ghim được sắp theo thời điểm ghim. Đề không nói rõ chiều sắp xếp giữa các ghi chú ghim.
- Tìm trong cả tiêu đề và nội dung, tự chạy khi gõ, không có nút Search; độ trễ khoảng 300 ms chỉ là ví dụ được phép.
- Mỗi ghi chú có thể không có nhãn hoặc có nhiều nhãn; cho phép lọc theo nhãn.
- Xóa nhãn không xóa ghi chú. Đổi tên nhãn phải phản ánh trên các ghi chú liên quan.

### Bảo vệ, chia sẻ, cộng tác và AI

- Mỗi ghi chú có mật khẩu riêng, độc lập với ghi chú khác. Phải hỏi mật khẩu trước khi cho thao tác như xem, sửa, xóa.
- Cho đổi mật khẩu ghi chú và tắt bảo vệ.
- Phần ví dụ triển khai tốt yêu cầu nhập mật khẩu hai lần khi đặt/đổi; kiểm tra mật khẩu hiện tại khi đổi và trước khi tắt bảo vệ.
- Chia sẻ cho một hoặc nhiều tài khoản đã đăng ký bằng email, với quyền chỉ đọc hoặc được sửa.
- Chủ sở hữu xem danh sách người nhận và quyền; có thể đổi quyền hoặc thu hồi.
- Có khu vực ghi chú được chia sẻ với tôi, hiển thị người chia sẻ, thời điểm và quyền.
- Kiểm tra email người nhận; phần ví dụ triển khai tốt yêu cầu thông báo chia sẻ bằng email hoặc tối thiểu một thông báo nổi bật trong tài khoản ở lần đăng nhập tiếp theo.
- Ghi chú chia sẻ có quyền sửa phải hỗ trợ nhiều người sửa đồng thời qua WebSocket và thấy thay đổi trực tiếp.
- Biểu tượng ghim, chia sẻ, bảo vệ phải nhận ra được ở cả lưới và danh sách.
- AI Summary dùng LLM để tóm tắt một ghi chú, giữ ý chính và cho tạo lại.
- AI Q&A nhận câu hỏi tự nhiên, truy xuất ghi chú liên quan rồi tổng hợp câu trả lời; phải có dẫn chiếu tới ghi chú nguồn và mở trực tiếp được. Chỉ dò từ khóa là chưa đủ.

### Trải nghiệm và khả năng chạy

- UI/UX mức trung bình không có điểm ở mục này; cần giao diện nhất quán, phản hồi thao tác, trạng thái rỗng/đang tải/lỗi và khả năng tiếp cận tốt.
- Responsive phải hoạt động tốt ở điện thoại, máy tính bảng và desktop.
- Offline cần xem được nội dung khi mất mạng, cơ chế dữ liệu cục bộ bằng JavaScript và đồng bộ khi có mạng lại.
- Để đạt điểm triển khai online, cần ứng dụng và dịch vụ liên quan hoạt động công khai, ổn định trong thời gian chấm; rubric mức đầy đủ nêu HTTPS.
- Docker Compose là phương án để thầy tái lập môi trường khi không triển khai online; không mặc nhiên thay cho điểm online.
- Phần III còn cho phép nộp cách chạy local có Readme.txt chi tiết nếu không dùng cả online và Docker Compose.
- Không hardcode hostname/port; dùng URL tương đối theo hướng dẫn, chạy tại đường dẫn gốc thay vì thư mục con.

## Làm nhóm và kiểm chứng đóng góp

- Repository GitHub chung cần có ít nhất bốn tuần lịch hoạt động liên tiếp trong thời gian project chính thức. Một tuần tính từ thứ Hai đến Chủ nhật.
- Mỗi thành viên cần ít nhất hai commit có ý nghĩa trong từng tuần. Không bù giữa tuần hoặc giữa thành viên.
- Commit phải phản ánh đóng góp thật, dùng danh tính GitHub của chính người làm, thông điệp rõ ràng, đã push và nằm trong lịch sử nộp.
- Không tạo commit rỗng, chia nhỏ giả tạo, chỉ sửa khoảng trắng, build/dependency files hoặc dùng công việc chủ yếu do người khác làm để đủ số lượng.
- Thiếu điều kiện của bất kỳ thành viên/tuần nào thì cả nhóm bị trừ 0.5, không có điểm một phần.
- Nếu chứng minh đã đủ điều kiện: source phải clone từ GitHub, giữ .git và lịch sử liên quan khi nén; ảnh GitHub Insights thể hiện repo, các thành viên và thời gian; ghi URL repo trong Rubric.xlsx hoặc Readme.txt. Repo private phải cho thầy quyền đọc đến hết chấm.
- Nếu không đạt điều kiện, đề cho phép không nộp bằng chứng GitHub tương ứng và chịu trừ 0.5.
- Mỗi thành viên phải vấn đáp, giải thích kiến trúc, yêu cầu, code, công nghệ và quyết định triển khai; thầy có thể yêu cầu sửa code.
- Đề nêu việc sử dụng AI tạo code hoặc sản phẩm được chấm trái quy định môn có thể bị trừ điểm cá nhân. File này chưa cung cấp quy định AI chi tiết, nên không thể kết luận mọi hình thức hỗ trợ AI đều bị cấm hoặc đều được phép.

## Hồ sơ nộp bài

- [ ] Rubric.xlsx theo mẫu thầy cấp, tự đánh giá đủ 32 tiêu chí, có URL và tài khoản cần cho chấm. Một dòng của đề ghi nhầm đuôi xlxs; các đoạn khác ghi xlsx.
- [ ] source chứa toàn bộ code, dữ liệu/schema/migrations cần chạy, dịch vụ và cấu hình liên quan; giữ .git khi nộp bằng chứng đóng góp.
- [ ] Nếu dùng Docker Compose: có file cấu hình, hướng dẫn rõ ràng và đã thử chạy trên môi trường sạch.
- [ ] demo.mp4 có tất cả thành viên tham gia, giới thiệu công nghệ và kiến trúc, demo tuần tự theo 32 tiêu chí đã thực hiện; tối thiểu 1080p và âm thanh rõ. Nếu quá lớn, có thể dùng link YouTube theo đề.
- [ ] Mỗi chức năng khai đã làm đều xuất hiện trong video. Không demo thì bị xem là chưa thực hiện.
- [ ] Readme.txt ghi cách build/chạy, URL, thông tin đăng nhập phục vụ chấm và tài khoản có dữ liệu mẫu.
- [ ] Screenshot.png hoặc các ảnh GitHub Insights cần thiết nếu khai đạt điều kiện đóng góp.
- [ ] Dọn tệp không cần thiết, nhưng không bỏ bằng chứng Git được yêu cầu.
- [ ] Đặt tên thư mục/ZIP theo mẫu mã số và họ tên thành viên; nộp ZIP trên elearning.

Thiếu source, video hoặc rubric khiến cả nhóm nhận 0. Project sai chủ đề, vi phạm sao chép/chia sẻ code giữa nhóm hoặc code lấy trên mạng có thể bị 0 theo đề. Nộp trễ tính mỗi ngày trừ 1 điểm, kể cả trễ từ 1 giây; cấu hình phức tạp thiếu hướng dẫn trừ 2; chưa dọn project trừ 0.5; thiếu thông tin chấm/đặt tên sai/thiếu nội dung bắt buộc có mức trừ 1.0 như đề quy định.

## Lộ trình đề xuất

1. Xác nhận hạn nộp, thành viên, kỹ năng và code hiện có. Chốt phạm vi, stack, phương án chạy và phân công dựa trên thông tin này.
2. Thiết kế dữ liệu và luồng quyền truy cập. Phác giao diện responsive dùng chung để tạo/sửa. Tạo repository và lịch đóng góp thật trong bốn tuần nếu lịch còn cho phép.
3. Làm một luồng xuyên suốt: đăng ký → tự đăng nhập → thông báo chưa kích hoạt → tạo ghi chú → tự lưu → tải lại vẫn còn → sửa → xác nhận xóa.
4. Hoàn thiện tài khoản và ghi chú cơ bản, nhãn, tìm kiếm, ghim, tệp, lựa chọn hiển thị. Kiểm tra trên ba cỡ màn hình trong quá trình làm.
5. Hoàn thiện bảo vệ ghi chú, chia sẻ theo quyền và cộng tác WebSocket. Kiểm tra với hai tài khoản và hai phiên mở cùng lúc, bao gồm đổi/thu hồi quyền.
6. Tích hợp AI Summary và AI Q&A có dẫn nguồn; kiểm tra quyền truy cập ghi chú trước khi đưa nội dung vào AI.
7. Hoàn thiện cache/offline và đồng bộ dựa trên mô hình dữ liệu đã chuẩn bị. Kiểm tra mất mạng, kết nối lại và xung đột chỉnh sửa.
8. Hoàn thiện triển khai, thử từng mục rubric, viết Readme, chuẩn bị dữ liệu mẫu, video, bằng chứng GitHub và luyện vấn đáp.

Đây là thứ tự triển khai, không phải lựa chọn bỏ các tiêu chí ở giai đoạn sau. Việc chốt deadline sẽ quyết định lịch cụ thể.

## Mô hình dữ liệu khởi đầu để thảo luận

- User: email, tên hiển thị, mật khẩu bcrypt, avatar, trạng thái kích hoạt.
- UserPreference: thiết lập giao diện của tài khoản.
- Note: chủ sở hữu, tiêu đề, nội dung, thời điểm tạo/sửa, thời điểm ghim, mật khẩu ghi chú nếu có, thông tin phiên bản để xử lý cập nhật.
- Label và NoteLabel: nhãn và liên kết nhiều–nhiều với ghi chú.
- Attachment: tệp gắn với ghi chú và metadata cần kiểm tra/phục vụ tải xuống.
- NoteShare: ghi chú, người nhận, quyền và thời điểm chia sẻ.
- Các dữ liệu xác minh email, reset mật khẩu và phiên đăng nhập chọn theo framework sau khi chốt stack.

Chưa chốt cách lưu trạng thái cộng tác, nội dung đồng bộ offline hoặc chỉ mục truy xuất AI. Những quyết định này phải tương thích với quyền chia sẻ và mật khẩu ghi chú.

## Những điểm chưa được đề xác định đầy đủ

- Không thấy ngày hết hạn, số thành viên cụ thể và thời gian phát triển chính thức trong file.
- Không quy định framework, LLM/provider hoặc bắt buộc dùng cơ sở dữ liệu nào.
- Chưa nói rõ phạm vi xử lý ghi chú được bảo vệ trong tìm kiếm, AI và dữ liệu offline. Cần thiết kế nhất quán để không làm lộ nội dung trước khi được phép truy cập.
- Chưa chỉ định cách giải quyết xung đột khi cộng tác hoặc đồng bộ offline, và chính sách mở khóa ghi chú kéo dài bao lâu.

Các điểm này là quyết định cần làm rõ hoặc lựa chọn kỹ thuật trong phạm vi đề; không tự biến chúng thành tính năng mở rộng.
