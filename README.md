# Lịch phân xe ô tô dùng chung — Văn phòng Tỉnh uỷ Cao Bằng

Ứng dụng web xem và nhập liệu Lịch phân xe ô tô dùng chung, kiến trúc giống 2 App
"Lịch công tác online" đã triển khai trước đó (Firebase + GitHub Pages, không cần máy chủ riêng).

## Khác biệt so với 2 App Lịch công tác

1. **2 loại người dùng**:
   - **Cán bộ quản lý**: nhập/sửa dữ liệu cho tất cả các xe; được thêm tài khoản (cán bộ quản lý, lái xe) và khoá/mở khoá tài khoản.
   - **Lái xe**: chỉ nhập/sửa dữ liệu cho đúng cột xe mình phụ trách; không được thêm tài khoản.
2. **Tên đăng nhập** không phải email — là chuỗi chữ và số, tối đa 10 ký tự (hệ thống tự gắn thêm domain nội bộ để tương thích với Firebase Authentication, người dùng không cần biết điều này).
3. Mọi người dùng (quản lý và lái xe) đều **tự đổi được mật khẩu của mình**.
4. Mỗi xe, mỗi ngày được chia **2 buổi Sáng/Chiều** (giống App Lịch công tác) — ô nào bỏ trống sẽ
   hiển thị rõ "✓ Xe trống" trên trang xem công khai, giúp lãnh đạo nhìn vào biết ngay buổi nào
   còn xe để bố trí đi công tác.
5. Có thêm chức năng **"Nhập dữ liệu từ file (Word/PDF)"** (chỉ Cán bộ quản lý thấy mục này): tải
   lên file Thông báo lịch phân xe (.docx/.pdf), hệ thống tự đọc bảng, khớp cột theo biển số xe,
   tách nội dung từng ô thành Sáng/Chiều theo giờ ghi trong văn bản, rồi nạp vào tuần đang chọn để
   kiểm tra lại trước khi lưu. Nhập từ file Word (.docx) cho kết quả chính xác nhất; nhập từ PDF là
   tính năng thử nghiệm (dựa vào vị trí chữ trên trang), nên luôn kiểm tra lại trước khi lưu.

## Cấu trúc dữ liệu Firestore

- `accounts/{uid}` — tài khoản: `username`, `displayName`, `role` ("manager"|"driver"), `carId`, `disabled`.
- `settings/cars` — danh sách xe: `{ list: [{id, bienSo, taiXe, dienThoai}, ...] }`.
- `weeks/{weekId}/cars/{carId}` — lịch phân xe theo tuần, theo từng xe:
  `{ carId, days: [{date, weekday, sessions: {morning, afternoon}}, ...7 ngày] }`.

Trang xem công khai (`index.html`) không cần đăng nhập. Trang nhập liệu (`admin.html`) cần đăng nhập
bằng tài khoản được cấp.

## Triển khai

1. Tạo Firebase project mới, bật Firestore + Authentication (Email/Password).
2. Điền cấu hình Firebase thật vào `firebase-config.js` (thay các giá trị `REPLACE_ME`).
3. Áp dụng `firestore.rules` cho project.
4. Tạo tài khoản Cán bộ quản lý đầu tiên (qua Firebase Console hoặc qua chính trang Admin với
   một tài khoản khởi tạo thủ công trong Console).
5. Đẩy toàn bộ mã nguồn lên GitHub, bật GitHub Pages.

   - **Lái xe**: chỉ nhập/sửa dữ liệu cho đúng cột xe mình phụ trách; không được thêm tài khoản.
2. **Tên đăng nhập** không phải email — là chuỗi chữ và số, tối đa 10 ký tự (hệ thống tự gắn thêm domain nội bộ để tương thích với Firebase Authentication, người dùng không cần biết điều này).
3. Mọi người dùng (quản lý và lái xe) đều **tự đổi được mật khẩu của mình**.

## Cấu trúc dữ liệu Firestore

- `accounts/{uid}` — tài khoản: `username`, `displayName`, `role` ("manager"|"driver"), `carId`, `disabled`.
- `settings/cars` — danh sách xe: `{ list: [{id, bienSo, taiXe, dienThoai}, ...] }`.
- `weeks/{weekId}/cars/{carId}` — lịch phân xe theo tuần, theo từng xe: `{ carId, days: [{date, weekday, text}, ...7 ngày] }`.

Trang xem công khai (`index.html`) không cần đăng nhập. Trang nhập liệu (`admin.html`) cần đăng nhập
bằng tài khoản được cấp.

## Phạm vi của bản v1

Bản v1 này **chưa có** chức năng "Nhập dữ liệu từ file Word/PDF" (tính năng này có ở 2 App Lịch
công tác trước, nhưng được xây riêng cho khuôn mẫu 4 lãnh đạo x Sáng/Chiều — không áp dụng trực
tiếp cho khuôn mẫu 8 xe x 1 nội dung/ngày của Lịch phân xe). Nếu cần, có thể bổ sung sau — hiện tại
nhập liệu thực hiện trực tiếp trên các ô của từng ngày.

## Trạng thái triển khai

- Firebase project: `lich-phan-xe-oto` (Firestore + Authentication Email/Password đã bật).
- Tài khoản Cán bộ quản lý đầu tiên đã được tạo (xem thông tin đăng nhập do quản trị viên cung cấp riêng).
- Mã nguồn đã đẩy lên repo này; GitHub Pages phục vụ trực tiếp từ nhánh `main`.
