# Ngày 27 tháng 10 Database và API ghi chú

Đã hoàn thành phần backend quản lý ghi chú: tạo, lấy danh sách, đọc chi tiết, sửa và xóa. Mỗi thao tác kiểm tra phiên đăng nhập và quyền sở hữu ở server. Đây là bước nền để nối giao diện tạo/sửa chung và tự lưu trong buổi tiếp theo.

## Các file cần đọc

- apps/api/src/session.ts: tìm tài khoản từ cookie và phiên trong database; dùng chung cho tài khoản và ghi chú.
- apps/api/src/database.ts: tạo bảng notes và index khi khởi động, giữ nguyên các bảng tài khoản đã có.
- apps/api/src/notes.ts: validate dữ liệu, kiểm tra chủ sở hữu, phân trang và xử lý API.
- apps/api/src/app.ts: gắn router /api/notes và giới hạn JSON riêng cho nội dung ghi chú.
- apps/api/test/notes.test.ts: kiểm thử bằng hai tài khoản trên database thử nghiệm riêng.

## Mô hình dữ liệu

| Cột | Vai trò |
| --- | --- |
| id | UUID do server sinh |
| owner_id | ID tài khoản lấy từ phiên, tham chiếu users và xóa liên đới khi tài khoản bị xóa |
| title | Tiêu đề, tối đa 200 ký tự; bỏ khoảng trắng ở hai đầu |
| content | Nội dung không rỗng, tối đa 100.000 ký tự; giữ nguyên xuống dòng và khoảng trắng |
| version | Số phiên bản, bắt đầu từ 1 và tăng mỗi lần sửa thành công |
| created_at | Thời điểm tạo, không đổi khi sửa |
| updated_at | Thời điểm sửa cuối, dùng để sắp xếp mới nhất lên đầu |

Chỉ title và content là dữ liệu người dùng phải nhập khi tạo. Các cột còn lại do hệ thống quản lý. API không nhận owner_id, ownerId hoặc id từ client để gán chủ sở hữu. Các giới hạn ở API được tính bằng độ dài chuỗi JavaScript; ký tự ngoài BMP như một số emoji có thể chiếm hai đơn vị độ dài.

## Hợp đồng API

Tất cả endpoint cần đăng nhập. Request thay đổi dữ liệu cần Content-Type: application/json và X-Requested-With: GhiChu; trình duyệt phải gọi từ nguồn APP_URL đã cấu hình. Các phản hồi API có Cache-Control: no-store.

| Method | Đường dẫn | Dữ liệu và kết quả |
| --- | --- | --- |
| GET | /api/notes | Danh sách thuộc tài khoản hiện tại, mới sửa nhất trước |
| GET | /api/notes?limit=20&offset=0 | Phân trang; limit mặc định 50, từ 1–100; offset mặc định 0, tối đa 1.000.000 |
| POST | /api/notes | Gửi title và content; trả 201, Location và note |
| GET | /api/notes/:id | Trả một note hoặc 404 |
| PATCH | /api/notes/:id | Gửi ít nhất title hoặc content cùng version hiện tại; trả note với phiên bản mới |
| DELETE | /api/notes/:id | Gửi JSON rỗng {}; trả 204 nếu xóa thành công |

Danh sách có dạng { notes: [...], pagination: { limit, offset, hasMore } }. Mỗi note có id, title, content, version, createdAt và updatedAt; không trả thông tin phiên hoặc mật khẩu tài khoản. Nếu thời điểm sửa bằng nhau, server sắp thêm theo id để thứ tự phân trang ổn định khi tập dữ liệu không đổi.

Cập nhật 29/10: POST hỗ trợ header Idempotency-Key là UUID do client sinh cho một lần tạo. Gửi lại cùng mã trong cùng tài khoản trả ghi chú đã tạo thay vì tạo trùng, kể cả khi request trùng đến đồng thời. Nếu ghi chú đã được sửa sau lần tạo, phản hồi là bản hiện tại; client phải đối chiếu nếu khác nội dung đang chờ lưu. Không gửi mã này như một trường nhập trong body. Mã tạo được lưu ở creation_key, tách theo owner_id.

Mã lỗi cần hiểu:

- 401: chưa đăng nhập, phiên đã hết hạn hoặc đã đăng xuất.
- 404: ID không hợp lệ, ghi chú không tồn tại hoặc không thuộc người dùng hiện tại. Cùng một thông báo để tránh tiết lộ dữ liệu tài khoản khác.
- 409 và code NOTE_VERSION_CONFLICT: ghi chú đã được sửa sau phiên bản mà client đang giữ. Client cần tải lại và xử lý thay đổi trước khi lưu tiếp.
- 422: title/content/version hoặc phân trang không hợp lệ; không cập nhật một phần dữ liệu sai.
- 413: JSON vượt giới hạn 1 MB của API ghi chú. Các API tài khoản vẫn giữ giới hạn 16 KB.
- 403: request thay đổi dữ liệu vi phạm kiểm tra nguồn, header hoặc kiểu nội dung.

## Vì sao cần version

Ví dụ hai tab cùng đọc version 1. Tab A lưu thành công, server tăng lên version 2. Nếu tab B gửi lại version 1, câu UPDATE không ghi đè mà trả 409. Kiểm tra phiên bản nằm trong cùng câu SQL UPDATE nên hai request đồng thời không thể cùng ghi lên phiên bản 1.

Đây là cơ chế phát hiện lần lưu cũ, chưa phải cộng tác WebSocket và chưa tự hòa trộn thay đổi. Khi nối giao diện, frontend phải giữ nội dung chưa lưu, dùng version do server trả về và xử lý phản hồi 409 rõ ràng.

## Thử thủ công bằng trình duyệt

1. Dừng server cũ của project nếu đang chạy, rồi tại thư mục gốc dùng npm.cmd run dev. Không dừng dịch vụ của project khác nếu dùng trùng cổng; khi đó chọn API_PORT, WEB_PORT và APP_URL phù hợp trong .env.
2. Đăng nhập ứng dụng ở Local URL do Vite in ra, mặc định http://localhost:5173.
3. Mở Developer Tools, chọn Console và chạy từng đoạn dưới đây. Các thao tác tạo/xóa thật sẽ tác động lên dữ liệu local của tài khoản đang đăng nhập, nên dùng nội dung thử nghiệm.

Tạo ghi chú:

```javascript
const noteHeaders = { 'Content-Type': 'application/json', 'X-Requested-With': 'GhiChu' };
const createdResponse = await fetch('/api/notes', {
  method: 'POST', headers: noteHeaders,
  body: JSON.stringify({ title: 'Thử API ngày 2', content: 'Nội dung ghi chú thử nghiệm.' }),
});
const createdData = await createdResponse.json();
console.log(createdResponse.status, createdData);
const testNote = createdData.note;
```

Xem danh sách:

```javascript
console.log(await (await fetch('/api/notes')).json());
```

Sửa ghi chú:

```javascript
const updatedResponse = await fetch(`/api/notes/${testNote.id}`, {
  method: 'PATCH', headers: noteHeaders,
  body: JSON.stringify({ content: 'Đã cập nhật nội dung.', version: testNote.version }),
});
console.log(updatedResponse.status, await updatedResponse.json());
```

Chạy lại đoạn sửa với testNote.version cũ để thấy phản hồi 409. Không tự đổi version bằng cách đoán số; ứng dụng phải dùng phiên bản mới do server trả về.

Xóa ghi chú thử nghiệm sau khi xác nhận:

```javascript
if (window.confirm('Xóa ghi chú thử nghiệm này?')) {
  const deletedResponse = await fetch(`/api/notes/${testNote.id}`, {
    method: 'DELETE', headers: noteHeaders, body: JSON.stringify({}),
  });
  console.log(deletedResponse.status); // 204
}
```

Giao diện trang chủ chưa lấy danh sách từ API và chưa có trình sửa ghi chú; việc tạo dữ liệu bằng Console chưa làm xuất hiện thẻ ghi chú trên trang. Dialog xác nhận trong ví dụ chỉ phục vụ thao tác thử; giao diện xóa chính thức ở buổi sau vẫn bắt buộc có xác nhận theo đề.

## Chạy kiểm thử

```powershell
npm.cmd test
npm.cmd run build
```

Các test dùng database riêng; không xóa bảng hoặc tài khoản của database local đang dùng. Chúng kiểm tra cả truy cập khác chủ sở hữu, giả mạo owner_id, phiên hết hạn, dữ liệu sai/quá lớn, xung đột hai lần lưu, phân trang, nội dung giống SQL, dữ liệu tồn tại sau khi mở lại database và thêm schema ghi chú mà không mất tài khoản.

## Việc tiếp theo

Nối danh sách ghi chú vào trang chủ; làm một giao diện dùng chung cho tạo/sửa, tự lưu và xử lý lỗi/xung đột; thêm xác nhận trước khi xóa. Sau đó mới hoàn thiện lưới/danh sách, tìm kiếm, ghim, nhãn và đính kèm. Source được làm với hỗ trợ AI; mỗi thành viên cần đọc, tự thử và giải thích phần mình phụ trách theo quy định môn học.
