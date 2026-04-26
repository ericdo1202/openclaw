# Smart-Timetable WhatsApp Bot (System Architecture & Knowledge)

## 1. Project Overview
Dự án là một hệ thống **AI Timetabling System** tương tác 100% qua **WhatsApp**, lấy **Google Sheets** làm cơ sở dữ liệu trung tâm. Hệ thống đạt 100% compliance với các yêu cầu nghiệp vụ của nhà trường, từ việc import dữ liệu, validate logic, tự động xếp thời khóa biểu (Clash-free), cho đến quản lý dạy thay (Relief) và xuất báo cáo.

## 2. Core Architecture & Modules
Dự án được xây dựng trên NodeJS. Cấu trúc module chính:

- `whatsapp_bot.cjs`: Xử lý giao tiếp với WhatsApp (dùng `whatsapp-web.js`). Quản lý xác thực QR, bắt sự kiện tin nhắn, xử lý file đính kèm (Excel/CSV) và hiển thị Menu 22 tính năng.
- `app.cjs`: Bộ Dispatcher trung tâm. Phân nhánh lệnh (commands) từ WhatsApp sang các module xử lý tương ứng. Kiểm soát quyền Admin thông qua `users_db.json`.
- `sheets_client.cjs`: Wrapper giao tiếp với Google Sheets API (dùng `google-spreadsheet`). Đọc và ghi dữ liệu real-time.
- `validation_engine.cjs`: (Pre-generation) Engine kiểm tra logic trước khi xếp lịch. Bắt các lỗi: GV bị quá tải tiết, 2 GV cùng được xếp vào 1 lớp, sai cấu hình lớp gộp (Banded), thiếu thời gian sinh hoạt chuyên môn chung (Department Whitespace/PLT).
- `generator_engine.cjs`: Thuật toán AI cốt lõi. Chạy vét cạn kết hợp heuristic để nhét các tiết dạy vào khung thời gian sao cho **không trùng lặp** (Clash-free). Cung cấp hàm `generateBest(5)` để chạy 5 kịch bản và chọn ra cái tốt nhất.
- `relief_manager.cjs`: Engine quản lý dạy thay. Quét danh sách vắng mặt (Absence), tìm GV đang trống tiết, ưu tiên người ít phải đi dạy thay nhất (dựa trên ReliefLog), và nhắn tin (Notify) thông báo lịch dạy thay.
- `report_engine.cjs` / `timetable_manager.cjs`: Xử lý đầu ra. In TKB dưới dạng lưới (Matrix), xuất link tải PDF/Excel, và cho phép hoán đổi tiết học thủ công (Swap).

## 3. Database Schema (Google Sheets - 11 Tabs)
File cấu hình `config.json` map các tab này vào hệ thống. Mọi tương tác của AI đều dựa trên 11 tab này:
1. **Teachers**: Danh sách giáo viên (Tên, Mã, Tổ bộ môn, Load tối đa).
2. **Deployment**: Khung chương trình chuẩn (Lớp, Môn, Số tiết, Giáo viên).
3. **Timetable**: Output của AI (Ai dạy, Thứ mấy, Tiết mấy, Phòng nào).
4. **Rooms**: Khai báo danh sách phòng học và loại phòng.
5. **Constraints**: Cài đặt giờ chặn (Blocked Slots) của từng GV.
6. **BandedGroups**: Cài đặt lớp gộp (2-3 lớp học chung 1 môn/1 sân).
7. **Departments**: Cấu hình tổ chuyên môn để tính thời gian rảnh chung (PLT).
8. **Absence**: Báo cáo vắng mặt.
9. **ReliefLog**: Nhật ký số lần dạy thay của toàn trường.
10. **Bookings**: Đặt phòng sự kiện/họp ngoài lịch dạy.
11. **Recess**: Cấu hình giờ ra chơi cố định (AI sẽ bỏ qua các khung giờ này).

## 4. The 22-Feature Interactive Menu
Các lệnh được map dưới dạng số (1-22) trong WhatsApp Bot. Tương ứng với các hành động:
- **1-5 (Pre-generation):** Import file, kết nối Sheet, xem thông số ràng buộc, clone chương trình lớp, và Validate dữ liệu.
- **6-10 (Generation):** Chạy AI sinh lịch (Thường / Best of 5), đổi chỗ thủ công (Swap), xem lịch sử các phiên bản TKB cũ, và Snapshot (Backup) TKB hiện tại.
- **11-15 (Reports):** Xem dạng lưới Matrix, tra cứu lịch cá nhân, xem thống kê Load/Công suất phòng, xuất link Excel và PDF.
- **16-21 (Relief Capability):** Auto-Assign người dạy thay, gửi tin nhắn báo cho người dạy thay, Plan dạy thay tương lai, xuất báo cáo tổng dạy thay, tìm phòng trống, và Book phòng.
- **22 (Integration):** Đồng bộ (Sync) toàn bộ lịch dạy vào Google Calendar cá nhân của từng Giáo viên.

## 5. Development Notes & Best Practices cho AI tương lai
- **Luôn kiểm tra Admin:** Các lệnh nhạy cảm như `swap`, `generate`, `check`, `import` phải được kiểm tra quyền Admin trong `app.cjs`.
- **Relational Integrity:** Mọi tên GV trong `Deployment`, `Constraints` đều phải tồn tại chính xác trong tab `Teachers`. AI luôn phải nhắc user đảm bảo điều này.
- **Sử dụng Data Mẫu:** Khi cần test stress-load, hãy dùng file `Smart-Timetable-MegaData.xlsx` (50 GV, ~400 tiết dạy) để đánh giá thuật toán.
