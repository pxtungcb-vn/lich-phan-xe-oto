# Lịch phân xe ô tô dùng chung — Văn phòng Tỉnh uỷ Cao Bằng

Ứng dụng web xem và nhập liệu Lịch phân xe ô tô dùng chung, kiến trúc giống 2 App
"Lịch công tác online" đã triển khai trước đó (Firebase + GitHub Pages, không cần máy chủ riêng).

Trang xem công khai: https://pxtungcb-vn.github.io/lich-phan-xe-oto/
Trang nhập liệu (đăng nhập): https://pxtungcb-vn.github.io/lich-phan-xe-oto/admin.html

## Khác biệt so với 2 App Lịch công tác

1. **2 loại người dùng**:
   - **Cán bộ quản lý**: nhập/sửa dữ liệu cho tất cả các xe; được thêm tài khoản (cán bộ quản lý, lái xe) và khoá/mở khoá tài khoản.
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
