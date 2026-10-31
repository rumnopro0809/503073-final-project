# Checklist đóng gói và nộp bài

Hạn nộp: **trước 23:59 ngày 02/11/2026** (giờ Việt Nam). Nộp trễ bị trừ 1 điểm mỗi ngày, kể cả trễ 1 giây.

## 1. Hồ sơ bắt buộc

| Hạng mục | Trạng thái | Ghi chú |
| --- | --- | --- |
| Source code | ✅ Đã push `main`, commit mới nhất `3dc7888` | Giữ `.git` khi nén nếu khai đóng góp GitHub |
| `Readme.txt` | ⚠️ Còn thiếu MSSV thành viên 2 và URL online | Đã có cách chạy, tài khoản chấm, dữ liệu mẫu |
| `Rubric.xlsx` | ❌ Chưa có file mẫu của thầy | Dùng `RUBRIC_SELF_ASSESSMENT.md` / `.csv` làm nguồn để điền |
| `demo.mp4` | ❌ Chưa quay | Kịch bản: `DEMO_02_11.md`; 1080p, có cả hai thành viên |
| Ảnh GitHub Insights | ❌ Chưa chụp | Chụp repo, member, khoảng thời gian commit |
| `Screenshot.png` | ❌ Chưa có | Có thể dùng ảnh Insights hoặc ảnh giao diện |
| URL online | ❌ Chưa triển khai | Chấm bằng local theo `Readme.txt`; ghi rõ “chưa có URL” |

## 2. Thông tin còn thiếu cần điền

1. **MSSV thành viên 2** (Dương Phạm Thái) trong `Readme.txt` dòng 10.
2. **URL online** nếu kịp triển khai; nếu không, giữ dòng “CHƯA TRIỂN KHAI”.
3. **Rubric.xlsx**: điền đủ 32 dòng theo mẫu, dùng cột “Tự đánh giá”, “Bằng chứng”, “Cách demo” trong `RUBRIC_SELF_ASSESSMENT.csv`.
4. **Tên thư mục/ZIP** theo mẫu mã số + họ tên thành viên của thầy.

## 3. Nội dung ZIP

Nên nén:

```text
503073-<MSSV>-<HọTên>/
  .git/                  (nếu khai đạt điều kiện đóng góp)
  apps/
  scripts/
  package.json
  package-lock.json
  .env.example
  .gitignore
  README.md
  REQUIREMENTS.md
  RUBRIC_SELF_ASSESSMENT.md
  RUBRIC_SELF_ASSESSMENT.csv
  SUBMISSION_CHECKLIST.md
  DEMO_02_11.md
  Readme.txt
  Rubric.xlsx
  demo.mp4               (hoặc link YouTube trong Readme.txt)
  Screenshot.png
```

Không nén:

- `node_modules/`
- `build/`, `dist/`
- `.data/` (database và mail local)
- `.env` (chứa cấu hình riêng)
- `.taste-skill/`, file log, ảnh chụp tạm

## 4. Kiểm tra trên máy sạch trước khi nộp

1. Giải nén ZIP ra thư mục mới.
2. `npm.cmd ci`.
3. `Copy-Item .env.example .env`.
4. `npm.cmd run dev`.
5. Chạy `npm.cmd run seed:demo` ở terminal thứ hai.
6. Đăng nhập A và B, kiểm tra 6 ghi chú, 2 ghi chú chia sẻ, ghi chú bảo vệ.
7. `npm.cmd test` → 125/125.
8. `npm.cmd run build` → exit 0.
9. Mở `http://localhost:5173`, thử tạo ghi chú, tải lại, đăng xuất.

## 5. GitHub và điều kiện đóng góp

- Repo: <https://github.com/rumnopro0809/503073-final-project> (private).
- Cấp quyền đọc cho giảng viên đến hết thời gian chấm.
- Chụp GitHub Insights: repo, danh sách thành viên, contributions theo tuần.
- Lịch sử hiện chỉ có một tác giả (`rumnopro0809`) và bắt đầu từ 21/10, **không đủ 4 tuần và 2 thành viên**. Nếu không chứng minh được, không nộp bằng chứng GitHub và ghi nhận mất 0,5 điểm; **không tạo commit giả**.
- Nếu Thái có commit thật, cần push bằng đúng tài khoản GitHub của Thái trước khi chụp Insights.

## 6. Thứ tự nộp

1. Chốt `Readme.txt` (MSSV, URL, tài khoản).
2. Điền `Rubric.xlsx`.
3. Quay và kiểm tra `demo.mp4`.
4. Chụp `Screenshot.png` / ảnh Insights.
5. Nén ZIP, kiểm tra dung lượng.
6. Nộp trên elearning **trong ngày 02/11**, không chờ sát 23:59.
7. Giữ một bản ZIP và link video dự phòng.

## 7. Câu hỏi vấn đáp cần luyện

- Vì sao chọn React + Express + PostgreSQL? Dữ liệu quan hệ nằm ở đâu?
- Luồng đăng ký → xác minh email → đăng nhập hoạt động thế nào?
- Tự lưu xử lý debounce, retry, mất phản hồi và xung đột version ra sao?
- Kiểm soát quyền ghi chú: owner, share read/write, ghi chú bảo vệ?
- Vì sao chưa làm realtime/AI/online? Nếu làm tiếp sẽ bắt đầu từ đâu?
- Phần nào do AI hỗ trợ, phần nào nhóm tự làm? Trả lời trung thực theo `SPRINT.md`.
