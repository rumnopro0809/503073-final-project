# Landing “ghi chú.” — 31/10/2026

## Phạm vi đã chốt

Người dùng chọn: bay qua các mô hình rồi đi vào từng cảnh; chỉ desktop chuyển động, điện thoại dùng cảnh tĩnh; làm bản GSAP mô phỏng trước, không tạo video AI tính phí. Vì vậy đây là bản mô phỏng vector/GSAP lấy ý tưởng từ scroll-world, không phải chuỗi video AI/Monid/Higgsfield của pipeline đầy đủ. Không phát sinh phí tạo ảnh/video, không tải nội dung ghi chú người dùng sang dịch vụ tạo media.

Trang riêng /welcome, có liên kết từ đăng nhập/đăng ký. Trang chủ ghi chú, tự lưu, xác minh email và các luồng tài khoản vẫn giữ. Không bắt người dùng xem hết hành trình: có CTA ngay đầu và liên kết bỏ qua tới cuối.

## Ý tưởng và nội dung

Trên trang này, tờ giấy gập góc của logo trở thành các đảo ghi chú liên kết trong một thế giới nhỏ. Nội dung lấy từ chức năng đã làm: tự lưu, tiêu đề/nội dung, nhãn nhiều màu, ghim, quan trọng, hạn việc vàng/đỏ, tick hoàn thành, lưu cục bộ và tài khoản máy chủ.

Hành trình: Ý tưởng có chỗ ở → Viết rồi để đó → Mỗi ý một góc → Đừng quên việc hẹn → Một chỗ cho bạn. Các mô hình là SVG gốc viết trong source, chứa ví dụ ghi chú bằng tiếng Việt, không phải ảnh tải mạng hay cảnh AI.

Giữ nhận diện hiện có: nền #faf9f6, mực #30263d, tím #6551a4, giấy tím #dcd1ed, vàng #f3dfab, xanh #cde0d3. Giữ Be Vietnam Pro. Art direction one-motif được chọn từ design-taste-frontend; giấy gập góc là motif. Phần điều hướng và nút CTA đều dẫn tới route thật.

## Chuyển động và fallback

GSAP ScrollTrigger scrub timeline trên một world-camera; lùi rộng khi nối cảnh rồi tiến vào đảo kế tiếp, có thời gian dừng đọc. Không có chuỗi video, kiểm tra seek hoặc ghép khung hình video không áp dụng cho bản này. Chỉ bật khi rộng trên 860px, cao ít nhất 600px và không bật giảm chuyển động. Các trường hợp còn lại đọc đủ năm cảnh tĩnh, có minh họa cho từng cảnh. useGSAP/matchMedia dọn timeline và trigger khi rời trang.

## Kiểm chứng

- Đã thấy test thất bại khi /welcome chưa tồn tại, sau đó đạt: landing có heading, CTA /guest và /register khi API offline, không gửi request dữ liệu ghi chú.
- 110 test toàn bộ project và production build đạt.
- Chạy inspector bằng trình duyệt thật tại 1440×900, 768×1024, 390×844, xem ảnh đầu trang và ảnh nhiều điểm cuộn. Sửa chữ xuống dòng thiếu cân bằng, bỏ ký tự tick thành nét SVG, tăng chiều rộng minh họa tablet.
- Kiểm tra production bằng Vite preview tại cổng tạm 5181. Báo cáo cuối 0 FAIL, 1 WARN sau ngoại lệ có giải thích dưới đây. Ảnh và báo cáo đo nằm trong .taste-skill/final (bỏ qua Git).
- Ngoại lệ: few-pictures/no-footage/still-page vì người dùng chọn vector/GSAP và không tạo video AI; palette-cream để giữ nhận diện hiện có; pinned-over-picture do hộp SVG lớn trong phép đo nhưng phần vẽ bị clip trong cột bên phải, đã xem các ảnh giữa cảnh không thấy chữ bị phủ. Cảnh báo off-centre desktop còn lại là khối minh họa cố ý crop bên phải, không có tràn ngang trên điện thoại/tablet. Không coi các ngoại lệ này là bằng chứng đã tạo video hoặc có ảnh thật.

Để nâng lên scroll-world video thật: cần công cụ và tài khoản Monid/Higgsfield, FFmpeg, xác minh model có first/last-frame, chốt ngân sách mới rồi mới tạo media. Không có tự động chạy tác vụ có phí trong source hiện tại.
