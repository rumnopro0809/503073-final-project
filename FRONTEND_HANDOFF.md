# Giao diện ghi chú và phần ghép tự lưu

Cập nhật 29/10/2026. Hoàn thiện từ file types/notes.ts và đoạn lấy danh sách trong App.tsx người dùng đã bắt đầu. Phạm vi lần này là phần giao diện của người dùng; Thái tiếp tục phần tự lưu theo phân công. Code được hoàn thiện với hỗ trợ AI và cần cả nhóm đọc, thử và giải thích khi vấn đáp.

Kiểm chứng: 54 bài test đạt, gồm 39 bài backend và 15 bài giao diện DOM; TypeScript và build đạt. Đã cập nhật bản vá body-parser tương thích, npm audit báo 0 lỗ hổng ở lần kiểm tra này. Kiểm thử DOM chưa xác nhận bố cục hiển thị thực tế trên từng trình duyệt.

## Đã có

- Danh sách dạng lưới lấy dữ liệu thật từ GET /api/notes, có đang tải, rỗng, lỗi, thử lại và tải thêm theo phân trang.
- Mở ghi chú gọi GET /api/notes/:id để nhận nội dung cùng phiên bản mới nhất trước khi sửa.
- Nút Ghi chú mới và thẻ ghi chú cùng mở một component NoteEditor, chỉ có tiêu đề và nội dung.
- Bản nháp dùng state React, không ghi xuống localStorage và chưa gọi POST/PATCH.
- Trạng thái chưa lưu được hiển thị rõ. Tải lại danh sách không thay thế nội dung đang soạn.
- Đóng/chuyển ghi chú và đăng xuất có xác nhận bỏ bản nháp; rời/tải lại trang có beforeunload khi có thay đổi. Trình duyệt quyết định có hiện hộp nhắc beforeunload hay không; người dùng vẫn có thể chọn rời trang.
- Request đọc cũ được hủy hoặc bỏ qua để không ghi đè ghi chú vừa chọn. Gõ trong trình soạn sẽ hủy thao tác mở ghi chú khác đang chờ.
- Callback đăng xuất ổn định, nên refresh phiên khi quay lại tab không tự tải lại danh sách hoặc mất bản nháp. Không gian soạn được tách theo user.id.

Đây chưa phải chức năng tạo/sửa đã lưu hoàn chỉnh. Khi chưa ghép tự lưu, nhập vào form rồi tải lại trang sẽ không có ghi chú mới trên server. Không đánh dấu các tiêu chí tạo/sửa/tự lưu là hoàn thành chỉ từ phần giao diện này. Không có nút Save hoặc thông báo lưu thành công giả.

## Các file

| File | Vai trò |
| --- | --- |
| apps/web/src/types/notes.ts | Note, NoteDraft, NotesResponse và NoteSaveStatus |
| apps/web/src/components/NotesWorkspace.tsx | Danh sách, phân trang, editor session và các điều hướng có bản nháp |
| apps/web/src/components/NoteEditor.tsx | Form controlled dùng chung cho tạo/sửa; nhận trạng thái lưu và lỗi qua props |
| apps/web/src/api.ts | Giữ API GET/POST cũ; thêm tham số thứ ba { signal } để hủy request đọc |
| apps/web/src/App.tsx | Trang chủ gắn NotesWorkspace, kiểm tra bản nháp trước đăng xuất |
| apps/web/src/styles.css | Giữ màu sắc thiết kế cũ; thêm thẻ ghi chú và editor responsive |
| apps/web/test/notes-ui.test.tsx | 15 kiểm thử tương tác DOM, request cũ, phân trang, lỗi và bản nháp |

Đã thay file trống apps/web/src/types trên GitHub bằng thư mục types/notes.ts đúng cấu trúc. Thay đổi DAY_02.md đã có trên GitHub được giữ lại.

## Điểm ghép cho Thái

Trong NotesWorkspace, EditorSession có hai phần:

- note: Note hoặc null. null nghĩa là chưa tạo trên server; nếu có thì chứa id, version và dữ liệu đã lưu gần nhất.
- draft: { title, content }, cập nhật mỗi lần onChange của NoteEditor chạy.

Thái có thể đặt logic lưu trong hooks/useNoteAutosave.ts, rồi ghép vào NotesWorkspace. Không cần tạo giao diện thêm và sửa riêng.

1. Ghi chú mới: chờ tiêu đề/nội dung hợp lệ và debounce trước khi POST /api/notes. Giữ ID trả về ngay khi tạo thành công để các lần tiếp theo PATCH, tránh tạo trùng.
2. Ghi chú cũ: PATCH /api/notes/:id với title/content và version hiện tại. api.ts hiện vẫn chọn GET/POST theo body; cần bổ sung tùy chọn method theo cách giữ tương thích các lời gọi tài khoản và tùy chọn signal.
3. Mỗi ghi chú chỉ có một lần lưu đang chạy. Nếu người dùng gõ tiếp trong lúc request đang chờ, giữ draft mới và lưu tiếp sau phản hồi; không lấy phản hồi cũ thay nội dung mới đang gõ.
4. Khi lưu thành công, cập nhật note.id/version/nội dung đã lưu trong EditorSession, cập nhật thẻ trong danh sách theo updatedAt. Chỉ báo saved khi draft hiện tại thực sự khớp dữ liệu đã lưu.
5. Khi nhận 409, giữ draft, báo conflict và cho người dùng xử lý với phiên bản mới. Không tự tăng version để ghi đè nội dung của phiên khác.
6. Trước đóng/chuyển ghi chú hoặc đăng xuất, hoàn tất lần lưu đang chờ; nếu không lưu được, giữ bản nháp và hỏi người dùng rõ ràng. Không để request của editor đã đóng cập nhật editor khác.

NoteEditor nhận saveStatus với các giá trị idle, unsaved, saving, saved, error, conflict; nhận saveError và fieldErrors theo title/content. Các props này đã có để ghép phản hồi của hook. Luồng hiện tại chỉ truyền idle/unsaved/saved theo bản nháp local và bản ghi vừa đọc.

## Tự thử

Chạy npm.cmd run dev từ thư mục project sau khi dừng server cũ của chính project. Nếu một dịch vụ khác chiếm cổng, đổi API_PORT, WEB_PORT và APP_URL phù hợp, không dừng nhầm project khác.

1. Đăng nhập, kiểm tra trạng thái rỗng hoặc danh sách ghi chú đã có từ API.
2. Bấm Ghi chú mới, nhập tiêu đề/nội dung, thấy Bản nháp chưa lưu.
3. Thử đóng hoặc chuyển ghi chú, chọn Hủy để giữ nội dung.
4. Bấm Tải lại danh sách: bản nháp đang nhập vẫn còn.
5. Với ghi chú có sẵn, mở để xem nội dung thật; sửa trong form làm trạng thái chuyển sang chưa lưu.
6. Kiểm tra bằng bàn phím và các độ rộng điện thoại, tablet, desktop.

Chạy npm.cmd run test:web để kiểm thử giao diện DOM; npm.cmd test để chạy cả backend/frontend; npm.cmd run build để kiểm tra TypeScript và build. Các kiểm thử DOM không thay thế kiểm tra trực quan trong trình duyệt.
