# Smart-Timetable: Hệ thống Quản lý Thời khóa biểu & Dạy thay Thông minh

Smart-Timetable là một giải pháp tự động hóa toàn diện cho việc quản lý lịch dạy, kiểm tra xung đột và lập kế hoạch dạy thay, được điều khiển trực tiếp thông qua giao diện WhatsApp.

---

## 🚀 Tính năng nổi bật

- **Bot WhatsApp Đa Người Dùng**: Phân quyền thông minh cho Admin và Giáo viên.
- **Xác thực Thông minh (Smart Auth)**: Tự động nhận diện thiết bị gửi (Mobile/Web) thông qua số điện thoại chuẩn.
- **Kiểm tra Trùng lịch (Clash Detection)**: Tự động phát hiện các lỗi trùng tiết, quá tải hoặc vi phạm tiết chặn.
- **Lập kế hoạch Dạy thay (Relief Planning)**: Tự động tìm kiếm giáo viên thay thế dựa trên lịch trống và thông báo qua WhatsApp.
- **Tích hợp Google Calendar**: Đồng bộ lịch trực tiếp để kiểm tra sự kiện trường học trước khi phân công dạy thay.
- **Báo cáo & Thống kê**: Tóm tắt tải trọng giáo viên và hiệu suất sử dụng phòng học.

---

## 🛠 Yêu cầu hệ thống

1. **Môi trường**: Node.js (v16+)
2. **Công cụ kết nối**: `gog` CLI (Đã được xác thực với tài khoản Google).
3. **Cơ sở dữ liệu**: Google Sheets (Định dạng Google Trang tính chuẩn).
4. **Liên lạc**: Một tài khoản WhatsApp để làm Bot.

---

## 📦 Quy trình Cài đặt (Setup)

### Bước 1: Chuẩn bị Google Sheets
1. Tạo một file Google Sheets mới từ Template.
2. Đảm bảo file có đủ các tab: `Timetable`, `Teachers`, `Absence`, `ReliefLog`, `Rooms`, `Constraints`, `BandedGroups`.
3. **Quan trọng**: File phải là định dạng Google Sheets (không phải .xlsx). Nếu là Excel, hãy vào `Tệp` -> `Lưu dưới dạng Google Trang tính`.
4. Chia sẻ quyền **Người chỉnh sửa (Editor)** cho email mà công cụ `gog` đang sử dụng.

### Bước 2: Cấu hình Hệ thống
Chỉnh sửa file `users_db.json` để khai báo quyền truy cập:
```json
[
  {
    "name": "Tên Admin",
    "phone": "84xxxxxxxxx@c.us",
    "sheetId": "MÃ_ID_GOOGLE_SHEETS",
    "role": "ADMIN"
  },
  {
    "name": "Tên Giáo Viên",
    "phone": "84xxxxxxxxx@c.us",
    "sheetId": "MÃ_ID_GOOGLE_SHEETS",
    "role": "TEACHER"
  }
]
```

### Bước 3: Cài đặt thư viện
Mở Terminal tại thư mục dự án và chạy:
```bash
npm install
```

---

## 🎮 Cách vận hành (Run)

1. **Khởi động Bot**:
   ```bash
   node app.cjs
   ```
2. **Kích hoạt WhatsApp**:
   - Một mã QR sẽ hiện ra trên Terminal.
   - Dùng điện thoại đăng ký làm Bot, vào WhatsApp -> Thiết bị liên kết -> Quét mã QR.
3. **Sử dụng**:
   - **Admin**: Nhắn các lệnh `check`, `stats`, `relief`, `save` để quản trị.
   - **Giáo viên**: Nhắn `schedule` (xem lịch cá nhân) hoặc `rooms` (tìm phòng trống).

---

## 📜 Danh sách Lệnh điều khiển

| Lệnh | Vai trò | Mô tả |
| :--- | :--- | :--- |
| `check` | Admin | Kiểm tra lỗi trùng lịch, quá tải và **xung đột giờ nghỉ (Recess)**. |
| `register [ID]` | Admin | Đăng ký hoặc cập nhật ID Google Sheets mới để quản lý. |
| `stats` | Admin | Xem báo cáo tải trọng, hiệu suất phòng và **danh sách lớp thiếu tiết**. |
| `clone [Gốc] [Đích]` | Admin | Nhân bản phân công từ lớp này sang lớp khác (VD: `clone 10A1 10A2`). |
| `relief [Ngày] [Lịch_Mẫu]` | Admin | Lập kế hoạch dạy thay. Có thể chọn lịch mẫu (VD: `relief T2 T4`). |
| `relief confirm [Ngày]` | Admin | Chốt kế hoạch và tự động nhắn tin thông báo cho GV dạy thay. |
| `schedule [Tên]` | Cả hai | Xem lịch dạy (Giáo viên chỉ xem được lịch của mình). |
| `rooms [Ngày] [Giờ]` | Cả hai | Tìm các phòng còn trống (Ví dụ: `rooms T3 08:00`). |
| `sync` | Admin | Đồng bộ lịch dạy sang Google Calendar. |
| `save` | Admin | Tạo một bản sao lưu (Snapshot) của file Sheets hiện tại. |

---

## ⚠️ Giải quyết lỗi thường gặp

- **Lỗi 403 Forbidden**: Bot chưa được chia sẻ quyền truy cập vào file Google Sheets. Hãy nhấn nút "Chia sẻ" trên Sheets cho email của Bot.
- **Lỗi 400 failedPrecondition**: File đang ở định dạng Excel (.xlsx). Cần chuyển đổi sang Google Sheets chuẩn.
- **Lỗi 130/Ngắt kết nối**: Chạy lại lệnh `node app.cjs` và quét lại mã QR nếu phiên làm việc hết hạn.

---

### 📝 Cấu hình Sheets Nâng cao
Để sử dụng các tính năng siêu nâng cấp, bạn cần thiết lập dữ liệu như sau:

1. **Tab `Recess`**: Tạo tab mới với các cột:
   - **Cột A (Ngày)**: Nhập T2, T3... hoặc `All` cho các ngày.
   - **Cột B (Bắt đầu)**: Giờ bắt đầu (VD: `09:30`).
   - **Cột C (Kết thúc)**: Giờ kết thúc (VD: `10:00`).
   - **Cột D (Tên)**: Tên tiết nghỉ (VD: Giải lao).

2. **Tab `Deployment`**: Cập nhật cột F (Cột thứ 6) là **Week**:
   - Nhập `Odd` (Lẻ), `Even` (Chẵn), hoặc `All` (Cả hai).
   - Bot sẽ tự động xếp lịch và kiểm tra xung đột dựa trên giá trị này.

---

*Hệ thống được phát triển nhằm mục tiêu tối ưu hóa vận hành trường học và giảm thiểu sai sót thủ công.*
