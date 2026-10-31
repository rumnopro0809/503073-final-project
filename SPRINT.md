# Sprint nộp project ngày 2 tháng 11

Hạn được người dùng xác nhận lại ngày 31/10/2026: **trước 23:59 ngày 02/11/2026, giờ Việt Nam**. Mốc này thay cho ước tính 03/11 trước đó và 18/11 trong kế hoạch ban đầu, nên chỉ còn trọn ngày 31/10 và 01/11 để hoàn thiện. Người dùng đã yêu cầu trợ lý làm và ghép luôn phần tự lưu trước đây giao cho Thái; mục tiêu demo thử ngày **31/10**, sau đó sửa lỗi. Nếu Thái đã có code local thì cần so sánh với main mới trước khi push, tránh ghi đè hai bộ tự lưu.

## Cập nhật thực tế ngày 31/10

- Đã vượt mốc 31/10 ở phần tài khoản và ghi chú nâng cao: có quên/đặt lại mật khẩu, hồ sơ/avatar, đổi mật khẩu, tùy chọn sáng/tối + màu ghi chú, đính kèm ảnh/video/tệp, bảo vệ ghi chú, chia sẻ/thu hồi quyền và khu vực ghi chú được chia sẻ.
- Đã sửa thứ tự ghim đúng yêu cầu; **125/125 test** và build đạt sau khi sửa lỗi TypeScript ở `labels.ts`.
- Chưa đạt mốc 01/11: chưa có WebSocket/Yjs, AI Summary, AI Q&A. Offline mới ở mức ghi chú khách; chưa có service worker/cache tài khoản/đồng bộ. Chưa có URL online, Docker Compose hoặc SMTP thật.
- Rủi ro lớn nhất: phần lớn code mới **chưa commit** và hồ sơ nộp (`Rubric.xlsx`, `demo.mp4`, `Readme.txt`, ảnh Insights) chưa có. Ưu tiên đóng gói hồ sơ trước khi làm thêm tính năng.
- Xem `STATUS_2026-10-31.md` để biết chi tiết và `RUBRIC_SELF_ASSESSMENT.md` để đối chiếu 32 mục.

## Ưu tiên triển khai

Hoàn thiện và ghép từng luồng chạy xuyên suốt theo rubric. Không nhận một hạng mục là xong chỉ vì có giao diện hoặc API; cần chạy đúng, xử lý lỗi và có tình huống demo. Mục tiêu vẫn là đề bài, không thêm chức năng ngoài phạm vi để làm đẹp hồ sơ.

| Ngày | Mục tiêu | Điều kiện chuyển bước |
| --- | --- | --- |
| 29/10 | Đã ghép core tự lưu, xóa có xác nhận, lưới/danh sách, thử lại/xung đột và đăng nhập lại giữ editor | 82 bài test và build đạt; còn kiểm tra trực quan và demo thủ công |
| 30/10 | Đã ghép tìm kiếm trực tiếp, ghim, nhãn màu, lọc kết hợp, sắp xếp và cải thiện giao diện; tiếp tục tài khoản/upload/triển khai | 94 bài test và build đạt; kịch bản demo nhãn/ghim đã bổ sung, cần cả nhóm thử thủ công |
| 31/10 | Demo thử đầu buổi theo DEMO_31_10.md, ghi lỗi và sửa theo mức ưu tiên; tiếp tục upload, bảo vệ ghi chú và các phần còn thiếu | Core chạy lại sau khi sửa, có danh sách lỗi tái hiện được; không coi core là toàn bộ 32 mục |
| 01/11 | Chốt hồ sơ nộp: commit/push toàn bộ source, điền Readme.txt và Rubric.xlsx, tạo dữ liệu mẫu, thử hai tài khoản và responsive; chỉ làm offline/deploy nếu còn thời gian | Repo có đủ file mới; Readme có tài khoản chấm; Rubric khớp 32 mục; demo thủ công không còn lỗi chặn |
| 02/11 | Quay video có cả hai người, điền rubric bản cuối, đóng gói ZIP, kiểm tra source/video/rubric và nộp | Nộp xong trong ngày 02/11, không chờ sát 23:59; không đưa chức năng mới chưa kiểm chứng vào bản nộp |

Đây là mục tiêu sprint cần điều chỉnh theo code thực tế, không phải cam kết đã đủ 32 tiêu chí. Nếu chậm, báo rõ những phần chưa hoàn thành và ưu tiên các luồng đang dùng được để không làm hỏng bản demo. Các tính năng chia sẻ, cộng tác, AI và offline còn rủi ro tích hợp cao, cần thử sớm khi người phụ trách bắt đầu.

## Phân công hiện tại

- Người dùng: giao diện danh sách và editor dùng chung. Trợ lý đang hỗ trợ hoàn thiện và kiểm tra phần này.
- Phần tự lưu đã được trợ lý triển khai/ghép theo ủy quyền mới của người dùng, có ghi nhận hỗ trợ AI. Thái cần đọc, thử cùng nhóm và chọn đầu việc còn thiếu tiếp theo; không ghi nhận phần này là đóng góp độc lập của Thái.
- Sau khi ghép core, hai người chia tiếp các mục còn thiếu theo khối lượng thực tế. Không mặc định quy phần trợ lý hoặc người khác làm thành đóng góp độc lập của một thành viên.
- Cả hai cùng kiểm tra quyền, dữ liệu, video, cách chạy bài và luyện giải thích code.

## Chốt mỗi buổi

1. Fetch và đọc code mới trước khi sửa; không ghi đè phần đang làm của bạn cùng nhóm.
2. Chọn hạng mục có tiêu chí kiểm chứng cụ thể, làm và thử lỗi trước khi commit.
3. Push code đã kiểm tra, ghi rõ còn thiếu gì để người kia ghép. Commit theo đúng người và ngày thực hiện.
4. Đối chiếu rubric và kịch bản video; phần không demo được phải ghi nhận đúng tình trạng.

Yêu cầu đóng góp GitHub của đề vẫn giữ nguyên. Lịch bốn tuần đến 15/11 ở kế hoạch cũ không còn dùng được cho hạn mới; đánh giá đóng góp phải dựa trên lịch sử thật trong thời gian hợp lệ, không tạo hoặc lùi ngày commit để bù.
