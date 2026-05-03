# BẢNG TEST CASE - SMART TIMETABLE BOT

Tài liệu này cung cấp các kịch bản kiểm thử (Test Cases) để kiểm tra toàn bộ tính năng của hệ thống Smart-Timetable qua giao diện WhatsApp, bao gồm các cải tiến mới về đồng bộ dữ liệu và trải nghiệm người dùng.

## 💻 GIAI ĐOẠN 1: SETUP & AUTHENTICATION

| Test ID | Tính năng | Bước thực hiện (Steps to Reproduce) | Kết quả mong đợi (Expected Result) | Trạng thái |
|---|---|---|---|---|
| **TC-01** | Khởi động & Đăng nhập | 1. Mở terminal, chạy `node app.cjs`.<br>2. Dùng WhatsApp quét mã QR.<br>3. Đảm bảo số ĐT nằm trong file `users_db.json`. | Terminal hiện "READY!". WhatsApp nhận lệnh `menu` và trả về danh sách tính năng. | [ ] |
| **TC-02** | Đồng bộ Admin (Mới) | 1. Admin A dùng lệnh `register [ID_Mới]`.<br>2. Kiểm tra file `users_db.json`.<br>3. Admin B gõ lệnh `check`. | 1. File `users_db.json` cập nhật `sheetId` cho tất cả Admin.<br>2. Admin B tự động dùng Sheet mới mà không cần register lại. | [ ] |

---

## 📥 GIAI ĐOẠN 2: PRE-GENERATION (Dữ liệu đầu vào)

| Test ID | Tính năng | Bước thực hiện (Steps to Reproduce) | Kết quả mong đợi (Expected Result) | Trạng thái |
|---|---|---|---|---|
| **TC-03** | Import & Feedback | 1. Gửi file Excel đính kèm caption `import`. | 1. Bot gửi tin nhắn "⚙️ System is processing..." ngay lập tức.<br>2. File được lưu vào Drive gốc `Smart-Timetable-Storage` với tên `Import_YYYY-MM-DD_HHmmss.xlsx`. | [ ] |
| **TC-04** | Control Parameters | 1. Gõ lệnh `params` vào WhatsApp. | Bot trả về danh sách các luật ràng buộc (Giờ ra chơi, Các lớp gộp, Tổ bộ môn) khớp với file Sheets. | [ ] |
| **TC-05** | Clone Format | 1. Gõ lệnh `clone 10A 10B`. | Bot báo đã sao chép khung chương trình môn học từ 10A sang 10B thành công. | [ ] |
| **TC-06** | Auto Check | 1. Gõ lệnh `check`. | 1. Bot phản hồi "Processing" ngay.<br>2. Bot quét dữ liệu và trả về báo cáo Validation (VD: Không có lỗi logic, hoặc cảnh báo GV quá tải). | [ ] |

---

## 🧠 GIAI ĐOẠN 3: GENERATION (Xếp Lịch & Chỉnh sửa)

| Test ID | Tính năng | Bước thực hiện (Steps to Reproduce) | Kết quả mong đợi (Expected Result) | Trạng thái |
|---|---|---|---|---|
| **TC-07** | AI Algorithm | 1. Gõ lệnh `generate`. | 1. Bot phản hồi "Processing" ngay.<br>2. AI xếp lịch và báo cáo số slot đã điền thành công. Tab `Timetable` trên Sheets có dữ liệu. | [ ] |
| **TC-08** | Generate Best | 1. Gõ lệnh `generate best`. | 1. Bot phản hồi "Processing" ngay.<br>2. AI chạy nhiều kịch bản, trả về báo cáo kèm Điểm Chất Lượng. | [ ] |
| **TC-09** | Manual Edit | 1. Gõ lệnh `swap [Tên_GV] T2 08:00 T3 09:00`. | Tiết học trên Google Sheets bị đổi chỗ. Không gây trùng phòng/trùng lịch. | [ ] |
| **TC-10** | Save Snapshot | 1. Gõ `save [Tên_Gợi_Nhớ]`. | 1. Bot phản hồi "Processing" ngay.<br>2. File backup lưu tại Drive gốc, tên: `[Tên]_YYYY-MM-DD_HHmmss`.<br>3. Bot trả về **đường link trực tiếp** để mở file Sheet vừa backup. | [ ] |
| **TC-11** | History | 1. Gõ `history`. | Liệt kê danh sách các file trong thư mục `Smart-Timetable-Storage` kèm link truy cập. | [ ] |

---

## 📊 GIAI ĐOẠN 4: REPORTS (Báo cáo & Trích xuất)

| Test ID | Tính năng | Bước thực hiện (Steps to Reproduce) | Kết quả mong đợi (Expected Result) | Trạng thái |
|---|---|---|---|---|
| **TC-12** | View Matrix | 1. Gõ `matrix 10A`. | Bot hiển thị TKB của lớp 10A dưới dạng lưới (Matrix) trực quan trên tin nhắn. | [ ] |
| **TC-13** | Text Schedule | 1. Gõ `schedule 10A`. | Bot liệt kê lịch học chi tiết từng ngày của lớp 10A (dạng text). | [ ] |
| **TC-14** | Resource Stats | 1. Gõ `stats`. | Bot trả về báo cáo tổng số tiết của từng GV và tỷ lệ lấp đầy phòng học. | [ ] |
| **TC-15** | PDF/Excel Export | 1. Gõ `export` hoặc `pdf`. | Bot gửi tin nhắn "Processing" ngay, sau đó trả về link tải file tương ứng. | [ ] |

---

## 🚑 GIAI ĐOẠN 5: RELIEF & ROOMS (Dạy thay & Xếp phòng)

| Test ID | Tính năng | Bước thực hiện (Steps to Reproduce) | Kết quả mong đợi (Expected Result) | Trạng thái |
|---|---|---|---|---|
| **TC-16** | Auto-Assign Relief | 1. Thêm 1 GV vắng vào tab `Absence`.<br>2. Gõ lệnh `relief T2`. | Bot tự tìm danh sách tiết vắng và đề xuất người rảnh đi dạy thay. | [ ] |
| **TC-17** | Notify Relief | 1. Gõ lệnh `relief confirm T2`. | Bot "bắn" tin nhắn tự động đến các số WhatsApp của GV vừa bị phân công dạy thay. | [ ] |
| **TC-18** | Relief Report | 1. Gõ `relief report 2026-05`. | Xuất thống kê mỗi GV đã đi dạy thay bao nhiêu lần trong tháng. | [ ] |
| **TC-19** | Find Empty Rooms | 1. Gõ lệnh `rooms T4 09:00`. | Liệt kê danh sách các phòng học không có ai dạy vào lúc đó. | [ ] |
| **TC-20** | Venue Booking | 1. Gõ `book A101 T4 09:00 11:00 Họp`. | Cập nhật thông tin vào tab `Bookings`. Phòng bận sẽ được cảnh báo khi check. | [ ] |

---

## 🔄 GIAI ĐOẠN 6: INTEGRATION (Đồng bộ Hệ thống)

| Test ID | Tính năng | Bước thực hiện (Steps to Reproduce) | Kết quả mong đợi (Expected Result) | Trạng thái |
|---|---|---|---|---|
| **TC-21** | Calendar Sync | 1. Gõ lệnh `sync`. | 1. Bot phản hồi "Processing" ngay.<br>2. Lịch được đẩy lên Google Calendar của giáo viên. | [ ] |
| **TC-22** | File Storage Cleanup | 1. Kiểm tra Google Drive sau khi thực hiện các lệnh Import/Save. | Không còn thư mục con `Smart-Timetable-History`. Tất cả file nằm tập trung tại `Smart-Timetable-Storage`. | [ ] |
