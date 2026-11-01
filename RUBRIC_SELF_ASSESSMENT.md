# Tự đánh giá 32 tiêu chí và kịch bản demo

Cập nhật ngày 01/11/2026. Đây là **bản nháp tự đánh giá**, không thay thế `Rubric.xlsx` theo mẫu của thầy. Chỉ tính một mục là hoàn thành khi chức năng chạy đúng, xử lý lỗi và **đã được demo trong video**.

Điểm tối đa: **10,00**. Tự đánh giá thận trọng hiện tại: **9,05** (chưa trừ 0,5 điểm điều kiện đóng góp GitHub).

- 26 mục đã có code + kiểm thử tự động; 24 mục đã thử tay hoặc đã có kịch bản demo.
- 3 mục một phần: 2 (chưa có SMTP thật), 30 (chưa chụp đủ 3 cỡ màn hình), 31 (mới có ghi chú khách).
- 2 mục chưa có: 27, 28 (AI Summary và AI Q&A).

## Bảng tự đánh giá

| ID | Tiêu chí | Điểm | Trạng thái | Tự đánh giá | Bằng chứng chính | Cách demo |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Đăng ký tài khoản | 0,25 | Đạt, đã thử 01/11 | 0,25 | `apps/api/src/auth.ts`, `apps/api/test/auth.test.ts` | Đăng ký tài khoản mới; thử email trùng, mật khẩu nhập lại sai. Đã tạo một tài khoản thử và hệ thống tự đăng nhập. |
| 2 | Kích hoạt tài khoản qua email | 0,25 | Một phần, đã thử local | 0,15 | `auth.ts` verify/resend, `mail.ts`; local lưu `.data/mail` | Đăng ký, mở tệp `.txt` mới nhất, mở liên kết, thử dùng lại liên kết. Đã xác minh thành công qua mail local; chưa có SMTP thật. |
| 3 | Đăng nhập và đăng xuất | 0,25 | Đạt, cần demo | 0,25 | `auth.ts` login/logout/session; test phiên hết hạn | Đăng nhập, tải lại trang, đăng xuất, dùng lại cookie cũ. |
| 4 | Khôi phục mật khẩu qua email | 0,25 | Đạt, đã thử 01/11 | 0,25 | `auth.ts` forgot/reset, `PasswordRecovery.tsx`, test reset một lần | Yêu cầu liên kết, mở từ `.data/mail`, đặt mật khẩu mới, đăng nhập thủ công. Đã đổi mật khẩu và đăng nhập lại thành công. |
| 5 | Xem hồ sơ và avatar | 0,25 | Đạt, cần demo | 0,25 | `ProfilePanel.tsx`, `GET /api/auth/avatar`, test avatar | Mở hồ sơ; xem avatar mặc định/chữ cái và avatar đã tải. |
| 6 | Cập nhật hồ sơ và avatar | 0,25 | Đạt, cần demo | 0,25 | `PATCH /auth/profile`, `POST/DELETE /auth/avatar`, test upload | Đổi tên hiển thị; tải PNG/JPEG/WebP; dùng lại avatar mặc định. |
| 7 | Đổi mật khẩu tài khoản | 0,25 | Đạt, cần demo | 0,25 | `POST /auth/change-password`, test revoke session | Đổi với mật khẩu hiện tại sai/đúng; kiểm tra các phiên cũ bị đăng xuất. |
| 8 | Tùy chọn người dùng | 0,25 | Đạt, cần demo | 0,25 | `preferences.ts`, `GET/PATCH /auth/preferences`, dark mode trong `styles.css` | Đổi cỡ chữ, mật độ, sáng/tối, màu ghi chú; tải lại trang. |
| 9 | Xem ghi chú dạng danh sách | 0,25 | Đạt, cần demo | 0,25 | `NotesWorkspace.tsx`, test chuyển lưới/danh sách | Chuyển sang danh sách; kiểm tra nội dung và editor không mất. |
| 10 | Xem ghi chú dạng lưới | 0,25 | Đạt, cần demo | 0,25 | Mặc định lưới trong `NotesWorkspace.tsx`, test giao diện | Mở lại trang; xác nhận mặc định là lưới. |
| 11 | Tạo ghi chú | 0,25 | Đạt, cần demo | 0,25 | `POST /api/notes`, `validateBody`, test tạo ghi chú | Tạo với tiêu đề/nội dung; thử thiếu trường bắt buộc. |
| 12 | Sửa ghi chú | 0,25 | Đạt, cần demo | 0,25 | `PATCH /api/notes/:id`, kiểm tra version | Sửa nội dung, tải lại và mở lại. |
| 13 | Xóa ghi chú | 0,25 | Đạt, cần demo | 0,25 | `DELETE /api/notes/:id`, test xác nhận xóa | Bấm xóa, chọn Hủy; sau đó xóa thật và tải lại. |
| 14 | Tự động lưu ghi chú | 0,25 | Đạt, cần demo | 0,25 | `NoteAutosaver.ts`, `useNoteAutosave.ts`, test debounce/retry/conflict | Gõ và chờ Đã lưu; tải lại; thử mất mạng để thấy bản nháp được giữ. |
| 15 | Đính kèm ảnh/video | 0,25 | Đạt, đã thử tải PNG | 0,25 | `attachments.ts`, `NoteAttachments.tsx`, test upload/quyền | Tải PNG và MP4; xem trước; tải xuống; xóa. Đã tải PNG, thấy ảnh xem trước, tải lại đúng 70 byte. |
| 16 | Đính kèm tệp | 0,25 | Đạt, đã thử tải TXT | 0,25 | `attachments.ts`, `NoteAttachments.tsx`, test tệp | Tải PDF/TXT, tải xuống và kiểm tra giới hạn dung lượng. Đã tải TXT và tải lại đúng nội dung. |
| 17 | Ghim ghi chú lên đầu | 0,25 | Đạt, cần demo | 0,25 | `notes.ts` ORDER BY pinned trước; `localNotes.ts`; test thứ tự ghim | Ghim hai ghi chú, ghim mới nhất trước; ghim vẫn trên mục quá hạn. |
| 18 | Biểu tượng trạng thái đặc biệt | 0,25 | Đạt, cần demo | 0,25 | Badge ghim/khóa/chia sẻ/quan trọng trong `NotesWorkspace.tsx` | Xem badge ở lưới và danh sách; mở ghi chú được chia sẻ/bảo vệ. |
| 19 | Tìm kiếm ghi chú | 0,25 | Đạt, cần demo | 0,25 | Tìm trong `notes.ts`, debounce ở workspace, test tìm kiếm | Gõ từ chỉ có trong nội dung; xóa từ khóa; thử không có kết quả. |
| 20 | Xem, thêm, sửa, xóa nhãn | 0,25 | Đạt, cần demo | 0,25 | `labels.ts`, `LabelManager.tsx`, test nhãn | Tạo, đổi tên/màu, xóa nhãn; ghi chú vẫn còn. |
| 21 | Gắn nhãn vào ghi chú | 0,25 | Đạt, cần demo | 0,25 | `PATCH /notes/:id/organization`, `NoteOrganization.tsx`, test | Gắn hai nhãn, bỏ một nhãn; kiểm tra quyền sở hữu. |
| 22 | Lọc ghi chú theo nhãn | 0,25 | Đạt, cần demo | 0,25 | Bộ lọc `labelId` trong `notes.ts` và workspace, test kết hợp | Lọc theo nhãn, kết hợp tìm kiếm/ghim; tải thêm trang. |
| 23 | Bật/tắt mật khẩu từng ghi chú | 0,50 | Đạt, cần demo | 0,50 | `POST /notes/:id/protection`, `NoteSecurity.tsx`, test bảo vệ | Bật mật khẩu, khóa, mở khóa; tắt bảo vệ cần mật khẩu hiện tại. |
| 24 | Kiểm tra và đổi mật khẩu ghi chú | 0,50 | Đạt, cần demo | 0,50 | `POST /notes/:id/unlock`, đổi protection, test phiên 15 phút | Nhập sai/đúng mật khẩu; đổi mật khẩu; khóa lại. |
| 25 | Chia sẻ và nhận ghi chú | 0,50 | Đạt, đã thử A→B | 0,50 | `POST/GET/DELETE /notes/:id/shares`, `NoteShares.tsx`, shared list; test quyền | A chia sẻ cho B quyền đọc/sửa; B xem trong “Được chia sẻ với tôi”; thu hồi. Đã thử ngày 01/11: B thấy 2 ghi chú, thông báo mới, đúng quyền chỉ đọc/được sửa. |
| 26 | Cộng tác và cập nhật thời gian thực | 0,50 | Đạt, đã có test | 0,50 | `apps/api/src/realtime.ts` (WebSocket + Yjs, kiểm tra origin/phiên/quyền/mở khóa), `apps/web/src/liveSession.ts`, `CollaborativeEditor.tsx`; `realtime.test.ts` + `live-session.test.ts` 10/10 đạt: nhiều người sửa cùng lúc, khôi phục trạng thái, chỉ đọc, thu hồi quyền, chỉnh sửa HTTP cũ không ghi đè | Hai cửa sổ A và B mở cùng ghi chú được chia sẻ quyền sửa; gõ ở A thấy ngay ở B; B chỉ đọc không gõ được; thu hồi quyền thì B không gửi được nữa. |
| 27 | AI Summary | 0,25 | Chưa có | 0,00 | Chưa có tích hợp LLM/API/giao diện | Không demo được. |
| 28 | AI Question & Answer | 0,25 | Chưa có | 0,00 | Chưa có truy xuất ghi chú, LLM và dẫn nguồn | Không demo được. |
| 29 | UI/UX | 0,50 | Đạt, đã kiểm chứng | 0,50 | Trạng thái tải/rỗng/lỗi, GSAP, reduced motion, focus; Lighthouse ngày 01/11: Accessibility 100, Best Practices 100, SEO 100 | Demo bàn phím, thông báo lỗi, dark mode, reduced motion; đã sửa tương phản chữ và tên truy cập nút hồ sơ. |
| 30 | Responsive | 0,50 | Một phần, cần xác minh 3 cỡ | 0,40 | Media query 1500/1000/960/720px, sidebar mobile, editor; đã xem giao diện desktop thật | Chụp/demo 375px, 768px, 1440px; kiểm tra bàn phím. Công cụ browser trong app không đổi được viewport nên phải resize tay khi quay. |
| 31 | Khả năng offline | 0,50 | Một phần | 0,25 | Guest `localStorage` trong `localNotes.ts`; đã thử tạo ghi chú khách, tải lại vẫn còn, không gọi API ghi chú; chưa có service worker/cache tài khoản/đồng bộ | Demo ghi chú khách khi offline và tải lại. Nói rõ giới hạn tài khoản. |
| 32 | Triển khai online | 0,50 | Đạt, URL đã kiểm tra | 0,50 | https://notes-503073.onrender.com/ trả trang ứng dụng ngày 01/11; `DEPLOY_RENDER.md`; `Readme.txt` ghi URL và lưu ý database online chưa có dữ liệu mẫu | Mở URL công khai, đăng ký/đăng nhập, tạo ghi chú, tải lại; nói rõ chưa cấu hình SMTP thật và chưa seed dữ liệu mẫu trên online. |

## Kiểm chứng ngày 01/11/2026

Đã chạy ứng dụng thật tại `http://localhost:5173` bằng tài khoản demo và ghi nhận:

| Nội dung | Kết quả |
| --- | --- |
| Đăng ký → xác minh email | Tạo tài khoản thử, tự đăng nhập, banner chưa xác minh; mở link trong `.data/mail` thì banner biến mất và báo xác minh thành công. Tài khoản thử này không dùng để chấm. |
| Quên / đặt lại mật khẩu | Gửi yêu cầu, mở link trong `.data/mail`, đặt mật khẩu mới, đăng nhập lại bằng mật khẩu mới thành công. |
| Đăng nhập / đăng xuất | Đăng nhập A, tải lại vẫn giữ phiên; đăng xuất quay về chế độ khách. |
| Tải ảnh và tệp | Tải PNG 70 byte và TXT qua giao diện; ảnh có xem trước, cả hai tải xuống đúng nội dung; xoá ghi chú xoá kèm tệp. |
| Lưới / danh sách | Mặc định lưới; chuyển danh sách giữ nguyên 6 ghi chú và editor. |
| Tìm kiếm | Gõ “Express” trả 2 ghi chú đúng nội dung, không cần nút Search. |
| Chia sẻ A → B | B thấy thông báo “2 ghi chú được chia sẻ mới”, mở đúng khu vực; ghi chú quyền sửa cho nhập liệu, ghi chú quyền đọc ở trạng thái `readOnly`. |
| Bảo vệ ghi chú | Sai mật khẩu báo lỗi; `Note@1234` mở đúng tiêu đề/nội dung. |
| Đính kèm | Hiện 2 tệp mẫu, có xem trước ảnh và nút xoá. |
| Sáng/tối | Đổi sang Tối, tải lại vẫn giữ; đã trả về Sáng + Lưới cho dữ liệu chấm. |
| Ghi chú khách | Tạo ghi chú, tải lại vẫn còn; chỉ gọi `/api/auth/me`, không gọi API ghi chú. |
| Lighthouse | Accessibility **100**, Best Practices 100, SEO 100 sau khi sửa tương phản và `aria-label`. |
| Realtime | `npm.cmd test` 136/136 đạt, trong đó 10 test realtime: hai người sửa cùng lúc, hợp nhất bản nháp khi mất kết nối, chỉ đọc không ghi được, thu hồi quyền chặn ghi, chỉnh sửa HTTP cũ không ghi đè bản realtime. |
| Online | `https://notes-503073.onrender.com/` trả trang “Ghi chú — Không gian cho ý tưởng” ngày 01/11. Chưa seed dữ liệu mẫu và chưa có SMTP thật trên môi trường này. |

Chưa kiểm tra bằng công cụ: ba cỡ màn hình 375/768/1440 (cửa sổ browser trong app không cho đổi viewport) và tải video MP4/WebM (mới thử PNG và TXT).

## Tổng hợp điểm

| Nhóm | Điểm tối đa | Tự đánh giá |
| --- | --- | --- |
| Tài khoản (1–8) | 2,00 | 1,90 |
| Ghi chú cơ bản (9–22) | 3,50 | 3,50 |
| Ghi chú nâng cao (23–25) | 1,50 | 1,50 |
| Cộng tác (26) | 0,50 | 0,50 |
| AI (27–28) | 0,50 | 0,00 |
| UI/UX và responsive (29–30) | 1,00 | 0,90 |
| Offline (31) | 0,50 | 0,25 |
| Triển khai online (32) | 0,50 | 0,50 |
| **Tổng** | **10,00** | **9,05** |

Chưa trừ **0,5 điểm** nếu không đáp ứng điều kiện đóng góp GitHub. Điểm thực tế phụ thuộc việc demo trong video và đánh giá của giảng viên.

## Kịch bản video gợi ý

1. Giới thiệu nhóm, công nghệ, kiến trúc thư mục và cách chạy local.
2. Tài khoản: đăng ký → xác minh email → đăng nhập → hồ sơ/avatar → đổi mật khẩu → quên/đặt lại mật khẩu.
3. Tùy chọn: cỡ chữ, màu ghi chú, sáng/tối; tải lại để thấy được lưu.
4. Ghi chú: tạo → tự lưu → tải lại → sửa → xóa có xác nhận; lưới/danh sách.
5. Tìm kiếm, ghim, nhãn, lọc, nhắc việc.
6. Đính kèm ảnh/video/tệp.
7. Bảo vệ ghi chú: bật mật khẩu, khóa, mở khóa, đổi mật khẩu, tắt bảo vệ.
8. Chia sẻ: tài khoản A chia sẻ cho B quyền đọc/sửa; B xem khu vực được chia sẻ; thu hồi.
9. Realtime: hai profile A và B mở cùng một ghi chú được chia sẻ quyền sửa; gõ ở A thấy nội dung sang B; B ở quyền chỉ đọc không gõ được; thu hồi quyền thì B ngừng nhận/gửi.
10. Responsive: 375px, 768px, 1440px; kiểm tra bàn phím và reduced motion.
11. Triển khai online: mở https://notes-503073.onrender.com/, đăng ký/đăng nhập và tạo ghi chú trên môi trường Render.
12. Nêu rõ phần chưa làm: AI Summary, AI Q&A, offline đầy đủ (service worker/cache tài khoản/đồng bộ); mục 2 chưa có SMTP thật. Không demo hoặc khai khống các mục này.

## Tạo lại `Rubric.xlsx`

`Rubric.xlsx` trong project được sinh tự động từ `RUBRIC_SELF_ASSESSMENT.csv`:

```powershell
powershell -NoProfile -File scripts\build-rubric.ps1
```

- Script cần Microsoft Excel đã cài (dùng COM), đọc `scripts/rubric-config.json` để lấy tiêu đề, họ tên/MSSV và thông tin chấm.
- Kết quả: sheet `Rubric` gồm 32 dòng, cột điểm tối đa, trạng thái, tự đánh giá, bằng chứng, cách demo, dòng TỔNG dùng công thức `SUM`; sheet `Thông tin chấm` ghi URL, tài khoản, cách chạy và các mục còn thiếu.
- Sửa điểm trong CSV rồi chạy lại script để cập nhật cả workbook và dòng tổng.
- **Đây không phải mẫu chính thức của giảng viên.** Nếu thầy cấp `Rubric.xlsx` mẫu, chép giá trị từ CSV vào đúng các cột của mẫu đó thay vì dùng file tự tạo.

## Việc phải làm trước khi điền Rubric.xlsx

- [x] Commit và push toàn bộ source; kiểm tra GitHub có đủ file mới (01/11, commit `3dc7888`).
- [x] Chạy lại `npm.cmd test` và `npm.cmd run build` (136/136 test đạt, build exit 0).
- [x] Điền họ tên, MSSV hai thành viên (524H0072, 524H0189) và tài khoản chấm vào `Readme.txt`.
- [x] Tạo tài khoản demo và dữ liệu mẫu bằng `npm.cmd run seed:demo`.
- [x] Demo thủ công 29, 26 (test realtime) và 32 (URL Render trả trang); mục 30 còn chờ chụp 3 cỡ màn hình.
- [x] Tạo `Rubric.xlsx` từ bảng này bằng `scripts/build-rubric.ps1` (32 dòng, tổng 9,05).
- [ ] Thay bằng file mẫu của thầy nếu giảng viên cung cấp, chép giá trị tương ứng.
- [ ] Cấu hình SMTP thật để nâng mục 2 lên 0,25 nếu demo được.
- [ ] Làm offline thực chất để nâng mục 31 nếu còn thời gian.
- [ ] Quay `demo.mp4` có cả hai thành viên, 1080p, âm thanh rõ.
- [ ] Chụp ảnh GitHub Insights và đóng gói ZIP.
- [ ] Xem `SUBMISSION_CHECKLIST.md` và `VIDEO_RECORDING_CHECKLIST.md` trước khi nộp.
