# Kế hoạch cho nhóm hai người

## Dữ kiện và giới hạn

- Ngày lập: 16/10/2026, múi giờ Việt Nam.
- Hạn nộp được xác nhận lại ngày 29/10: 23:59 ngày 03/11/2026, giờ Việt Nam. Mốc 18/11 trước đây là ước tính đã được thay thế; kế hoạch hiện hành ở SPRINT.md.
- Hai người, mỗi người 1–2 giờ/ngày: khoảng 66–132 giờ công cho 33 ngày.
- Chủ tài khoản GitHub đã xác nhận: rumnopro0809; repository 503073-final-project đã được tạo ở chế độ riêng tư.
- Thành viên còn lại là Thái, phụ trách tự lưu theo phân công; chưa có username GitHub trong chat. Thời gian có thể tăng cho sprint, chưa chốt số giờ cụ thể.

Đủ 32 tiêu chí là mục tiêu. Với thời gian trên, đây là kế hoạch khá chặt; không thể bảo đảm đầy đủ trước khi đánh giá tốc độ làm việc và các thử nghiệm cộng tác/offline. Mỗi mốc phải tạo ra phần chạy được và giải thích được. Nếu chậm tiến độ, cập nhật phạm vi đang hoàn thành theo rubric một cách trung thực.

Cập nhật 21/10/2026: bắt đầu triển khai code ngày đầu với cấu trúc ứng dụng và luồng tài khoản. Các mốc 16/10–18/10 bên dưới là kế hoạch ban đầu; phần dựng nền thực tế chuyển sang 21/10. Nếu hạn nộp vẫn khoảng 18/11 thì còn khoảng 28 ngày. Tuần đóng góp đầu tiên 19/10–25/10 vẫn cần kiểm tra riêng cho từng thành viên; commit tài liệu ngày 16/10 không thuộc tuần này.

Cập nhật 27/10/2026: hoàn thành backend ghi chú, gồm schema, API tạo/xem/sửa/xóa, phân trang, kiểm tra quyền sở hữu và xung đột phiên bản. 39 bài test và build đạt. Hướng dẫn ở DAY_02.md. Buổi tiếp theo ưu tiên giao diện tạo/sửa chung và tự lưu; chưa đánh dấu chức năng giao diện ghi chú hoàn thành. Mỗi buổi chọn một phần có kết quả kiểm chứng được rồi commit/push theo công việc thực tế, không ép đủ một commit mỗi ngày.

Cập nhật 29/10/2026: người dùng yêu cầu trợ lý triển khai luôn phần tự lưu trước đây giao cho Thái. Core đã có tạo/tự lưu/sửa, xử lý thử lại và xung đột, đăng nhập lại giữ editor, xóa có xác nhận và lưới/danh sách. 82 bài test và build đạt. Demo thử chốt ngày 31/10, kịch bản ở DEMO_31_10.md; kế hoạch ưu tiên hiện hành ở SPRINT.md. Những phần được trợ lý triển khai không tự quy thành đóng góp độc lập của Thái.

## Bốn tuần đóng góp liên tiếp

Lưu ý cập nhật 29/10: bảng dưới là lịch tham chiếu ban đầu, có mốc sau hạn nộp mới 03/11 nên không còn là lịch làm việc hiện hành. Giữ đúng yêu cầu đóng góp thật của đề và đối chiếu lịch sử đã có; dùng SPRINT.md để tổ chức công việc còn lại.

Các khoảng dưới đây đều là thứ Hai đến Chủ nhật và đều nằm trước mốc nộp dự kiến. Chỉ dùng làm bằng chứng nếu nằm trong giai đoạn phát triển chính thức do thầy quy định.

| Tuần | Thời gian | Người 1 | Người 2 |
| --- | --- | --- | --- |
| 1 | 19/10–25/10/2026 | Ít nhất 2 commit có ý nghĩa | Ít nhất 2 commit có ý nghĩa |
| 2 | 26/10–01/11/2026 | Ít nhất 2 commit có ý nghĩa | Ít nhất 2 commit có ý nghĩa |
| 3 | 02/11–08/11/2026 | Ít nhất 2 commit có ý nghĩa | Ít nhất 2 commit có ý nghĩa |
| 4 | 09/11–15/11/2026 | Ít nhất 2 commit có ý nghĩa | Ít nhất 2 commit có ý nghĩa |

Tổng tối thiểu là 8 commit/người và 16 commit/nhóm, nhưng đủ tổng số không thay thế điều kiện từng người trong từng tuần. Đây là mức tối thiểu cần kiểm tra, không phải lịch tạo commit nhân tạo.

## Các mốc dự kiến

| Khoảng thời gian | Kết quả cần có |
| --- | --- |
| 16/10–18/10 | Repo, nhận diện Git đúng tài khoản, đọc đề cùng nhau, thiết kế dữ liệu và giao diện; dựng ứng dụng tối thiểu và thử lưu dữ liệu; thử nhỏ WebSocket/Yjs để nhận diện rủi ro |
| 19/10–25/10 | Luồng tài khoản và tạo/sửa/xóa ghi chú tự lưu chạy xuyên suốt; tiếp tục hồ sơ, email xác minh/reset, responsive; thử triển khai sớm |
| 26/10–01/11 | Hoàn thiện ghi chú cơ bản, nhãn, tìm kiếm, ghim, đính kèm; khóa ghi chú và chia sẻ theo quyền; chốt mô hình dữ liệu đồng bộ và kiểm tra quyền ở backend |
| 02/11–08/11 | Cộng tác WebSocket không ghi đè mất thay đổi; offline và đồng bộ cơ bản; tích hợp AI Summary và Q&A có nguồn |
| 09/11–15/11 | Hoàn thiện các mục còn thiếu, xử lý lỗi/mất mạng/xung đột/thu hồi quyền; kiểm tra đủ 32 mục, thử Docker Compose và triển khai online ổn định |
| 16/11–18/11 | Dành phần lớn thời gian cho demo, Readme, rubric, tài khoản có dữ liệu mẫu, ảnh Insights, clone sạch giữ .git, kiểm tra ZIP và luyện vấn đáp; nộp trước giờ hạn thực tế |

Mốc này cần điều chỉnh ngay khi có ngày/giờ nộp chính xác hoặc phát hiện khối lượng lớn hơn dự kiến. Đưa một bản tối thiểu lên online sớm; không để đến cuối mới phát hiện vấn đề môi trường.

## Phân công đề xuất

Người 1 tạm chỉ chủ tài khoản rumnopro0809; người 2 chưa biết username. Cả hai cùng tham gia frontend, backend và dữ liệu để tránh một người chỉ biết giao diện, người kia chỉ biết API.

| Giai đoạn | Người 1 phụ trách chính | Người 2 phụ trách chính |
| --- | --- | --- |
| Khởi động | Cấu trúc ứng dụng, luồng tài khoản, giao diện đăng ký/đăng nhập | Thiết kế dữ liệu ghi chú/nhãn, trình sửa ghi chú và API liên quan |
| Cơ bản | Hồ sơ, avatar, tùy chọn, email xác minh/reset | Nhãn, lọc/tìm kiếm, ghim, tệp, lưới/danh sách |
| Nâng cao | Mật khẩu ghi chú và chia sẻ theo quyền | Cộng tác, lưu dữ liệu cập nhật và offline |
| AI và hoàn thiện | AI Summary/Q&A, hỗ trợ kiểm tra quyền và triển khai | Hoàn thiện responsive, kiểm chứng đồng bộ và hỗ trợ triển khai |
| Nộp bài | Cùng demo, rà rubric, kiểm tra source và giải thích code | Cùng demo, rà rubric, kiểm tra source và giải thích code |

Phần cộng tác/offline có rủi ro cao nên phải thử sớm và hai người cùng xem thiết kế. Bảng phân công là điểm bắt đầu; điều chỉnh khối lượng sau các ngày đầu, ghi nhận đúng người thực hiện và không coi tài liệu do trợ lý chuẩn bị là đóng góp code của một thành viên.

## Nhịp làm việc hằng ngày

1. Đầu buổi dành khoảng 5–10 phút: cập nhật main, đọc thay đổi của bạn cùng nhóm, chốt một công việc vừa sức.
2. Dành phần lớn buổi làm một phần chức năng có kết quả kiểm chứng được; đọc tài liệu đúng chỗ cần dùng.
3. Cuối buổi kiểm tra, ghi lại kết quả và vấn đề còn lại; commit khi đã có thay đổi có ý nghĩa.
4. Một người mở pull request, người kia đọc và thử trước khi merge. Nếu cả hai sửa cùng chỗ, thống nhất người phụ trách trước.

## Quy trình GitHub

- Dùng một repository chung; mỗi người dùng tài khoản và email Git gắn với chính tài khoản mình. Không dùng chung danh tính hoặc tự gán công việc của người khác.
- main chứa phiên bản đã tích hợp. Mỗi việc dùng nhánh ngắn, ví dụ feat/account-registration hoặc feat/note-autosave.
- Chu trình: issue → nhánh → thay đổi có ý nghĩa → kiểm tra → commit → push → pull request → bạn cùng nhóm review → merge.
- Trong giai đoạn cần chứng minh lịch sử commit, ưu tiên merge giữ nguyên các commit gốc có ý nghĩa. Không squash nhiều commit thành một rồi mặc nhiên cho rằng tất cả vẫn được đếm trong lịch sử nộp.
- Merge commit tự nó không được tính là đóng góp có ý nghĩa theo đề.
- Kiểm tra hằng tuần: từng người đủ đóng góp thực, đã push, đã tích hợp vào main; email Git đúng tài khoản. Đối chiếu lịch sử cùng Insights, không chỉ nhìn các ô xanh trên trang cá nhân.
- Không push mật khẩu, API key, .env, node_modules, bản build, dữ liệu runtime hoặc video lớn vào repository.
- Chỉ mời đúng cộng tác viên sau khi xác định username. Trước chấm, cấp quyền cho giảng viên theo yêu cầu nếu repo vẫn private.
- Khi đóng gói cuối cùng, clone từ GitHub sang thư mục nộp mới và giữ .git; không dùng Download ZIP để thay bằng chứng Git theo đề.

## Buổi làm việc đầu tiên

- [x] Đăng nhập GitHub rumnopro0809; tạo 503073-final-project ở chế độ private.
- [ ] Cấu hình danh tính Git trên từng máy bằng email đã liên kết với tài khoản GitHub.
- [ ] Xác định username thành viên còn lại và mời người đó theo yêu cầu của chủ repo.
- [ ] Cả hai cùng đọc và diễn giải các ràng buộc quan trọng trong REQUIREMENTS.md.
- [ ] Chốt cách chạy local, database và thử nghiệm WebSocket/Yjs nhỏ.
- [ ] Tạo/sửa được một ghi chú qua frontend → API → database sau khi dựng nền ứng dụng.

## Nguồn hướng dẫn GitHub

- [Mời cộng tác viên vào repo cá nhân](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/inviting-collaborators-to-a-personal-repository)
- [Email Git và nhánh ảnh hưởng việc hiển thị đóng góp](https://docs.github.com/en/account-and-profile/how-tos/contribution-settings/troubleshooting-missing-contributions)

Quy tắc chấm commit lấy từ đề môn học; cách GitHub hiển thị biểu đồ chỉ hỗ trợ cung cấp bằng chứng, không thay thế quy tắc của thầy.
