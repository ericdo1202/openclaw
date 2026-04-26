# BẢNG TEST CASE - SMART TIMETABLE BOT

Tài liệu này cung cấp các kịch bản kiểm thử (Test Cases) để kiểm tra toàn bộ 22 tính năng của hệ thống Smart-Timetable qua giao diện WhatsApp.

## 💻 GIAI ĐOẠN 1: SETUP & AUTHENTICATION

| Test ID | Tính năng | Bước thực hiện (Steps to Reproduce) | Kết quả mong đợi (Expected Result) | Trạng thái |
|---|---|---|---|---|
| **TC-01** | Khởi động & Đăng nhập | 1. Mở terminal, chạy `node app.cjs`.<br>2. Dùng WhatsApp quét mã QR.<br>3. Đảm bảo số ĐT nằm trong file `users_db.json`. | Terminal hiện "READY!". WhatsApp nhận lệnh `menu` và trả về danh sách 22 tính năng. | [ ] |

---

## 📥 GIAI ĐOẠN 2: PRE-GENERATION (Dữ liệu đầu vào)

| Test ID | Tính năng | Bước thực hiện (Steps to Reproduce) | Kết quả mong đợi (Expected Result) | Trạng thái |
|---|---|---|---|---|
| **TC-02** | Import & Link Sheet (Lệnh 1, 2) | 1. Import file `Smart-Timetable-MegaData.xlsx` lên Google Drive.<br>2. Gõ lệnh `register [Sheet_ID]` vào WhatsApp. | Bot báo kết nối Google Sheets thành công và sẵn sàng đọc dữ liệu. | [ ] |
| **TC-03** | Control Parameters (Lệnh 3) | 1. Gõ lệnh `params` vào WhatsApp. | Bot trả về danh sách các luật ràng buộc (Giờ ra chơi, Các lớp gộp, Tổ bộ môn) khớp với file Sheets. | [ ] |
| **TC-04** | Clone Format (Lệnh 4) | 1. Gõ lệnh `clone 10A 10B`. | Bot báo đã sao chép khung chương trình môn học từ 10A sang 10B thành công. | [ ] |
| **TC-05** | Auto Check (Lệnh 5) | 1. Gõ lệnh `check`. | Bot quét dữ liệu và trả về báo cáo Validation (VD: Không có lỗi logic, hoặc cảnh báo GV quá tải). | [ ] |

---

## 🧠 GIAI ĐOẠN 3: GENERATION (Xếp Lịch & Chỉnh sửa)

| Test ID | Tính năng | Bước thực hiện (Steps to Reproduce) | Kết quả mong đợi (Expected Result) | Trạng thái |
|---|---|---|---|---|
| **TC-06** | AI Algorithm (Lệnh 6) | 1. Gõ lệnh `generate`. | AI xếp lịch và báo cáo số slot đã điền thành công. Tab `Timetable` trên Sheets có dữ liệu. | [ ] |
| **TC-07** | Generate Best (Lệnh 7) | 1. Gõ lệnh `generate best`. | AI chạy 5 kịch bản, trả về báo cáo kèm Điểm Chất Lượng (Quality Score). TKB trên Sheet được cập nhật bản tốt nhất. | [ ] |
| **TC-08** | Manual Edit (Lệnh 8) | 1. Gõ lệnh `swap [Tên_GV] T2 08:00 T3 09:00` (lấy tên có thật). | Tiết học trên Google Sheets bị đổi chỗ. Không gây trùng phòng/trùng lịch. | [ ] |
| **TC-09** | Save & History (Lệnh 9, 10) | 1. Gõ `save Ban_Chinh_Thuc`.<br>2. Gõ `history`. | 1. Bot tạo file backup.<br>2. Lệnh history liệt kê link file backup vừa tạo. | [ ] |

---

## 📊 GIAI ĐOẠN 4: REPORTS (Báo cáo & Trích xuất)

| Test ID | Tính năng | Bước thực hiện (Steps to Reproduce) | Kết quả mong đợi (Expected Result) | Trạng thái |
|---|---|---|---|---|
| **TC-10** | View Matrix (Lệnh 11) | 1. Gõ `matrix 10A`. | Bot hiển thị TKB của lớp 10A dưới dạng lưới (Matrix) trực quan trên tin nhắn. | [ ] |
| **TC-11** | Text Schedule (Lệnh 12) | 1. Gõ `schedule 10A`. | Bot liệt kê lịch học chi tiết từng ngày của lớp 10A (dạng text). | [ ] |
| **TC-12** | Resource Stats (Lệnh 13) | 1. Gõ `stats`. | Bot trả về báo cáo tổng số tiết của từng GV và tỷ lệ lấp đầy phòng học. | [ ] |
| **TC-13** | PDF/Excel Export (Lệnh 14, 15) | 1. Gõ `export`.<br>2. Gõ `pdf`. | Bot trả về 2 đường link. Click vào sẽ tải được file `.xlsx` và `.pdf` tương ứng. | [ ] |

---

## 🚑 GIAI ĐOẠN 5: RELIEF & ROOMS (Dạy thay & Xếp phòng)

| Test ID | Tính năng | Bước thực hiện (Steps to Reproduce) | Kết quả mong đợi (Expected Result) | Trạng thái |
|---|---|---|---|---|
| **TC-14** | Auto-Assign Relief (Lệnh 16) | 1. Thêm 1 GV vào tab `Absence` (Vắng hôm nay, giả sử T2).<br>2. Gõ lệnh `relief T2`. | Bot tự tìm danh sách tiết vắng và đề xuất người rảnh đi dạy thay. | [ ] |
| **TC-15** | Notify Relief (Lệnh 17) | 1. Gõ lệnh `relief confirm T2`. | Bot "bắn" tin nhắn tự động đến các số WhatsApp của GV vừa bị phân công dạy thay. | [ ] |
| **TC-16** | Advance Relief (Lệnh 18) | 1. Gõ lệnh `relief advance T4 T2`. | Lên kế hoạch dạy thay cho T4 nhưng lấy khung chương trình của T2 áp vào. | [ ] |
| **TC-17** | Relief Report (Lệnh 19) | 1. Gõ `relief report 2026-05`. | Xuất thống kê mỗi GV đã đi dạy thay bao nhiêu lần trong tháng. | [ ] |
| **TC-18** | Find Empty Rooms (Lệnh 20) | 1. Gõ lệnh `rooms T4 09:00`. | Liệt kê danh sách các phòng học không có ai dạy vào lúc đó. | [ ] |
| **TC-19** | Venue Booking (Lệnh 21) | 1. Gõ `book A101 T4 09:00 11:00 Họp`. | Cập nhật thông tin vào tab `Bookings`. Phòng A101 sẽ báo "Bận" nếu có ai check giờ đó. | [ ] |

---

## 🔄 GIAI ĐOẠN 6: INTEGRATION (Đồng bộ Hệ thống)

| Test ID | Tính năng | Bước thực hiện (Steps to Reproduce) | Kết quả mong đợi (Expected Result) | Trạng thái |
|---|---|---|---|---|
| **TC-20** | Calendar Sync (Lệnh 22) | 1. Gõ lệnh `sync`. | Toàn bộ lịch dạy trong Google Sheets được đẩy lên Google Calendar của từng giáo viên (Nếu email hợp lệ). | [ ] |
