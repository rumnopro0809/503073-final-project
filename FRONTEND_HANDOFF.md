# Giao diện và tự lưu ghi chú

Cập nhật 29/10/2026: theo yêu cầu mới của người dùng, trợ lý đã làm và ghép cả phần tự lưu trước đây giao cho Thái. Giao diện tiếp tục từ các file người dùng đã bắt đầu. Không cần ghép thêm một bộ tự lưu riêng; nếu Thái có thay đổi local, cần đối chiếu với bản này trước khi push. Cả nhóm vẫn cần đọc, thử và giải thích phần code được hỗ trợ AI.

Kiểm chứng: 82 bài test đạt, gồm 42 bài backend, 15 bài engine tự lưu, 24 bài giao diện DOM và một bài tích hợp engine qua API thật; TypeScript và build đạt. Kiểm thử DOM chưa xác nhận bố cục hiển thị thực tế trên từng trình duyệt. Kịch bản thử ngày 31/10 ở DEMO_31_10.md.

## Đã có

- Danh sách mặc định dạng lưới, chuyển được sang danh sách; lấy dữ liệu thật từ GET /api/notes, có đang tải, rỗng, lỗi, thử lại và tải thêm.
- Mở ghi chú gọi GET /api/notes/:id để nhận nội dung cùng phiên bản mới nhất trước khi sửa.
- Nút Ghi chú mới và thẻ ghi chú cùng mở một component NoteEditor, chỉ có tiêu đề và nội dung.
- Bản nháp dùng state React; khi hợp lệ và ngừng gõ khoảng 600 ms sẽ POST hoặc PATCH. Không có nút Save.
- Trạng thái chưa lưu được hiển thị rõ. Tải lại danh sách không thay thế nội dung đang soạn.
- Đóng/chuyển ghi chú và đăng xuất chờ lưu xong. Nếu không lưu được mới hỏi có bỏ bản nháp không; rời/tải lại trang có beforeunload khi còn thay đổi. Trình duyệt quyết định việc hiện hộp nhắc và người dùng vẫn có thể chọn rời trang.
- Request đọc cũ được hủy hoặc bỏ qua để không ghi đè ghi chú vừa chọn. Gõ trong trình soạn sẽ hủy thao tác mở ghi chú khác đang chờ.
- Callback đăng xuất ổn định, nên refresh phiên khi quay lại tab không tự tải lại danh sách hoặc mất bản nháp. Không gian soạn được tách theo user.id.
- Xóa luôn có xác nhận, chờ request lưu đang chạy kết thúc rồi mới DELETE để tránh thao tác ghi đến sau thao tác xóa.
- Có trạng thái đang lưu/đã lưu/lỗi/xung đột, nút thử kết nối và lưu lại, tự thử lại khi nhận sự kiện online.
- Phiên hết hạn sẽ hiện giao diện đăng nhập lại của chính tài khoản đang soạn; editor được giữ trong bộ nhớ và tự lưu tiếp sau đăng nhập thành công.

Luồng tạo/sửa/tự lưu đã nối với database. Chỉ báo Đã lưu khi bản nháp mới nhất đã được xác nhận. Nếu đang lỗi và người dùng vẫn đóng tab hoặc tải lại sau cảnh báo, bản nháp trong bộ nhớ có thể mất; đây chưa phải PWA/offline có lưu trữ và đồng bộ cục bộ.

## Các file

| File | Vai trò |
| --- | --- |
| apps/web/src/types/notes.ts | Note, NoteDraft, NotesResponse và NoteSaveStatus |
| apps/web/src/components/NotesWorkspace.tsx | Danh sách, phân trang, editor session và các điều hướng có bản nháp |
| apps/web/src/components/NoteEditor.tsx | Form controlled dùng chung cho tạo/sửa; nhận trạng thái lưu và lỗi qua props |
| apps/web/src/api.ts | Giữ API cũ; thêm method, idempotencyKey và signal qua tham số thứ ba |
| apps/web/src/notesApi.ts | Gọi read/create/update/delete qua API ghi chú |
| apps/web/src/autosave/NoteAutosaver.ts | Engine debounce, tuần tự hóa, thử lại, xử lý phản hồi mất và xung đột |
| apps/web/src/hooks/useNoteAutosave.ts | Gắn vòng đời engine với React và sự kiện online/đăng nhập lại |
| apps/web/src/App.tsx | Trang chủ, chờ tự lưu trước đăng xuất và đăng nhập lại giữ editor |
| apps/web/src/styles.css | Giữ màu sắc thiết kế cũ; thêm thẻ ghi chú và editor responsive |
| apps/web/test/notes-ui.test.tsx | 24 kiểm thử tương tác DOM |
| apps/web/test/autosave.test.ts | 15 kiểm thử engine |
| apps/web/test/autosave-api.test.ts | Một luồng engine → API thật → database → mở lại nội dung |

Đã thay file trống apps/web/src/types trên GitHub bằng thư mục types/notes.ts đúng cấu trúc. Thay đổi DAY_02.md đã có trên GitHub được giữ lại.

## Cách tự lưu hoạt động

Hook useNoteAutosave quản lý một engine cho mỗi lần mở editor. Snapshot có hai phần chính:

- note: Note hoặc null. null nghĩa là chưa tạo trên server; nếu có thì chứa id, version và dữ liệu đã lưu gần nhất.
- draft: { title, content }, cập nhật mỗi lần onChange của NoteEditor chạy.

Mỗi engine có một mã tạo ngẫu nhiên ổn định. POST gửi mã này trong header Idempotency-Key. Database có creation_key và index duy nhất theo owner_id + creation_key. Thử lại cùng mã trả ghi chú đã tạo thay vì tạo thêm; frontend tiếp tục PATCH nội dung gõ mới hơn khi nhận được ID.

1. Chỉ lưu khi tiêu đề và nội dung hợp lệ; mỗi ghi chú có tối đa một request ghi đang chạy.
2. Nội dung gõ trong lúc chờ được giữ riêng. Sau phản hồi, engine dùng ID/version mới để lưu tiếp nội dung mới nhất, không thay thế bằng phản hồi cũ.
3. PATCH bị mất phản hồi được đối chiếu bằng GET: nếu server đã lưu đúng nội dung và phiên bản dự kiến, ghi nhận thành công; nếu có sửa đổi khác thì báo xung đột.
4. Khi xung đột, giữ bản đang nhập. Người dùng đọc bản máy chủ rồi chọn dùng bản máy chủ hoặc xác nhận tiếp tục với nội dung đang nhập. PATCH vẫn kiểm tra version, nên sửa đổi xảy ra sau lúc đối chiếu vẫn được chặn.
5. Một POST thử lại nhưng trả ghi chú đã được tab khác sửa cũng chuyển sang đối chiếu, không tự thay bản nháp bằng dữ liệu khác.
6. Trước đóng/chuyển editor/đăng xuất, flush lần lưu. Xóa chờ request đang chạy kết thúc; engine cũ bị dispose không cập nhật editor mới.

NoteEditor nhận đủ saveStatus idle, unsaved, saving, saved, error, conflict; nhận saveError và fieldErrors theo title/content. Bản máy chủ trong màn hình đối chiếu được hiển thị như văn bản, không chạy HTML từ nội dung ghi chú.

## Tự thử

Chạy npm.cmd run dev từ thư mục project sau khi dừng server cũ của chính project. Nếu một dịch vụ khác chiếm cổng, đổi API_PORT, WEB_PORT và APP_URL phù hợp, không dừng nhầm project khác.

1. Đăng nhập, kiểm tra trạng thái rỗng hoặc danh sách ghi chú đã có từ API.
2. Bấm Ghi chú mới, nhập tiêu đề/nội dung, chờ Đã lưu.
3. Tải lại toàn trang, mở ghi chú vừa tạo, sửa tiếp và chờ Đã lưu.
4. Thử ghi chú chỉ có tiêu đề: chưa tạo bản không hợp lệ; đóng sẽ hỏi bỏ bản nháp.
5. Thử hai tab để đối chiếu xung đột, thử lỗi mạng và thử xóa có xác nhận theo DEMO_31_10.md.
6. Kiểm tra bằng bàn phím và các độ rộng điện thoại, tablet, desktop.

Chạy npm.cmd run test:web để kiểm thử giao diện DOM; npm.cmd test để chạy cả backend/frontend; npm.cmd run build để kiểm tra TypeScript và build. Các kiểm thử DOM không thay thế kiểm tra trực quan trong trình duyệt.

## Tìm kiếm và phân loại

GET /api/notes có category=all|important|overdue|upcoming|daily|completed, lọc trước LIMIT/OFFSET và luôn đi cùng owner_id. Upcoming chỉ lấy việc chưa hoàn thành với hạn trong 24 giờ tới; completed dùng quy tắc hoàn thành trong ngày Việt Nam cho việc daily. localNotes dùng chung inCategory ở reminders.ts. Sidebar giữ state panel notes/settings/about trong cùng workspace, chỉ ẩn vùng notes để không hủy engine. Mật độ/cỡ chữ lưu local theo user.id hoặc guest; không gửi lên hồ sơ máy chủ.

useCardLayout.ts chụp Flip.getState ngay trước setView, rồi Flip.from sau khi React đổi bố cục. Capture hoàn tất tween cũ trước khi đo, giới hạn 18 thẻ trong viewport, dọn animation qua useGSAP/matchMedia. Thay đổi view không chạy lại entrance của danh sách để tránh hai hiệu ứng cùng ghi transform. Editor dùng timeline trượt/scale và stagger các phần, không phụ thuộc draft/version.

useEntrance.ts dùng GSAP + useGSAP, scope theo ref và revertOnUpdate để dọn tween khi đổi nội dung/unmount. matchMedia chỉ chạy khi prefers-reduced-motion: no-preference. Animation chỉ thay transform/opacity, hoàn tất thì xóa inline style; danh sách giới hạn 18 phần tử trong viewport. Dependency của editor không gồm draft hoặc version nên gõ/tự lưu không khởi động lại hiệu ứng. Không có callback animation điều khiển thao tác lưu hay mạng.

Chế độ khách dùng localNotes.ts với khóa localStorage ghichu.guest.v1, cùng hợp đồng request qua createNoteServices. useNoteAutosave nhận transport theo nơi lưu; dữ liệu khách không đi qua API. Web Locks tuần tự hóa ghi giữa các tab nếu trình duyệt hỗ trợ; version vẫn dùng để đối chiếu. Mỗi thay đổi ghi chú/nhãn lưu trong một lần setItem; lỗi quota giữ bản nháp. Server tiếp tục kiểm tra session/chủ sở hữu như trước.

GET /api/notes nhận thêm q (tối đa 200 ký tự), pinned=true, labelId và sort=updated|created|title. Tìm kiếm cả tiêu đề và nội dung, không phân biệt hoa/thường; các ký tự %, _ và dấu gạch chéo được hiểu như văn bản. Theo yêu cầu bổ sung, việc quá hạn/sắp hạn/quan trọng được ưu tiên trước ghim; trong các ghi chú cùng mức ưu tiên, ghim theo pinnedAt mới nhất trước, rồi mới đến thứ tự chọn. Note trả thêm pinned, pinnedAt và labels.

GET/POST /api/labels và PATCH/DELETE /api/labels/:id quản lý nhãn riêng từng tài khoản. Tên dài 1–40 ký tự, không trùng trong tài khoản (không phân biệt hoa/thường), có sáu màu định sẵn. Xóa nhãn không xóa ghi chú.

PATCH /api/notes/:id/organization nhận version cùng pinned và/hoặc labelIds (tối đa 20). Backend kiểm tra chủ sở hữu cả ghi chú lẫn nhãn, tăng version trong transaction. Đổi tên/màu hoặc xóa nhãn cũng tăng version các ghi chú liên quan. Nếu tab khác đang soạn bản cũ, cơ chế đối chiếu xung đột vẫn áp dụng.

Frontend lưu hết nội dung đang nhập trước khi thay đổi phân loại, khóa thao tác trong thời gian chờ, rồi nhận phiên bản mới để tiếp tục tự lưu. Nếu không lưu được thì giữ bản nháp và không thực hiện thao tác phân loại. Đổi bộ lọc không đóng editor; các phản hồi tìm kiếm cũ bị hủy/bỏ qua.
