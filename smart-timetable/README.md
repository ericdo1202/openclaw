# Smart-Timetable System

Hệ thống quản lý và xếp thời khóa biểu tự động (AI Timetabling System) điều khiển hoàn toàn qua **WhatsApp**, tích hợp trực tiếp với **Google Sheets** và **Google Calendar**.

---

## 📋 Client Requirements (Yêu cầu Khách hàng)

Dưới đây là nguyên bản yêu cầu của khách hàng được dùng làm cơ sở phát triển hệ thống:

### Pre-generation of timetables
- [x] The system shall allow the import of key timetabling data such as format and structure of the timetable, listings of teachers, classes, subjects, resources and deployment from MS files into the software/app. *(Supported via Excel upload in WhatsApp & Google Sheets Link)*
- [x] The system shall allow users to specify resources, control parameters and conditions for the timetabling algorithms to take them into consideration when generating the timetables. This includes but not limited to the following:
  - a) banded classes / teaching groups
  - b) subject combinations
  - c) teachers’ load and offloading/ blocked slots
  - d) department whitespace and PLT slots
  - e) distribution of subjects across odd-even weeks
  - f) staggered / fixed recesses
- [x] The system shall allow duplication of class format and teacher formatting. 
- [x] Automatically check for mistakes/ errors in logic and data entry before generation (e.g. overallocation of periods, inconsistent teacher deployment)

### Timetable Generation
- [x] System shall allow generation of timetables for school both online and offline. The timetabling software shall have built-in algorithms to provide multiple solutions to allow for comparison and selection of preferred solution. 
- [x] System shall provide solutions to minimize clashes and maximise resource utilization.
- [x] System shall be cloud-based, including the storage of data to allow multiple users to work on same data set simultaneously via online module, with real time updates.
- [x] System shall allow deployment cards to be fixed at preferred timeslots before generation and regeneration. 
- [x] System shall allow users to manually edit / adjust timetables, shift deployment cards, change resources after generation, shift recesses. *(Supported via `swap` command)*
- [x] System shall have built-in version control management of the generated timetables. Retrieval of past versions of timetable shall be made available.
- [x] Automatic checks for mistakes / errors / unmet conditions and constraints to be flagged out, including automatic overwrite.

### After Generation of Timetable
- [x] Shall provide reporting features to allow users to have multi-dimensional view of the timetables according to their needs. Printing of the reports shall be made available in different formats. *(Grid Matrix, Stats, PDF Export)*
- [x] Shall be able to generate individualised student timetables for students to view. *(Class-based schedule lookup)*
- [x] Allow for exporting of timetables and timetabling data to MS Excel.
- [x] Allow unused venues to be available for booking for other school purposes via the software / app.

### Relief Capability
- [x] Support daily relief applications and functions through automatic syncs with timetabling modules of the app. Any updates to timetables should be automatically updated for relief planning purposes. 
- [x] Allows assignment and prioritisation of relief teachers based on availability and school defined criteria such as number of relief period/ days given in the week/month/term.
- [x] Generates relief details and summary by date report based on day / month/ term/ year.  
- [x] Notify teachers (deployed for relief) and communicate relief plans to them through an app; able to re-notify teachers if changes are made. *(Via WhatsApp)*
- [x] Allow staff to perform relief planning in advance. 
- [x] Allow relief team to select the day of the timetable to be used for relief planning e.g. Tuesday relief needs uses Wednesday timetable. 
- [x] Able to integrate calendaring capability into the software / app to reflect school events and teachers involved in the event, to facilitate relief planning for such events.

---

## 🚀 Hướng dẫn Cài đặt & Setup Ban đầu (Dành cho Admin)

Để bắt đầu sử dụng hệ thống, Admin cần thực hiện 3 bước thiết lập cơ bản:

**Bước 1: Khởi động Bot & Kết nối WhatsApp**
- Mở terminal, chạy lệnh `node app.cjs`.
- Một mã QR sẽ hiện ra trên màn hình. Sử dụng ứng dụng WhatsApp trên điện thoại quét mã này để đăng nhập (giống như đăng nhập WhatsApp Web).
- Sau khi có thông báo "✅ Smart-Timetable Bot is READY!", số điện thoại vừa quét mã sẽ trở thành Bot tổng của trường.

**Bước 2: Cấp quyền Admin**
- Hệ thống bảo mật bằng cách kiểm tra số điện thoại. 
- Trong file `users_db.json`, Admin cần thêm số điện thoại WhatsApp của chính mình vào danh sách Admin để có thể ra lệnh cho Bot.

**Bước 3: Nạp Dữ liệu (Database)**
- Bạn cần một file Google Sheets làm CSDL trung tâm chứa các sheet: `Teachers`, `Deployment`, `Timetable`, `Rooms`, `Constraints`, `BandedGroups`, `Recess`, `Departments`.
- Có 2 cách nạp dữ liệu: 
  - Gửi file Excel thẳng vào chat WhatsApp để Bot tự tải lên.
  - Hoặc nhắn lệnh `register [Sheet_ID]` để trỏ Bot vào file Google Sheets đã tạo sẵn.

---

## 🛠 Hướng dẫn Sử dụng & Mapping 22 Tính năng

Tất cả thao tác đều thực hiện qua tin nhắn WhatsApp. Gõ `menu` để xem danh sách. Bấm vào link hiển thị trong menu và ấn gửi để gọi lệnh.

### 1. PRE-GENERATION (Chuẩn bị Dữ liệu)
- **1. Import Excel File:** Gửi file Excel/CSV chứa dữ liệu thô vào chat.
  - *Cách dùng:* Kéo thả file Excel vào khung chat WhatsApp và gửi. Bot sẽ tự động nhận diện.
  - *(Mapping: "allow the import of key timetabling data from MS files")*
- **2. Link Google Sheet ID:** Kết nối hệ thống với bảng tính Google Sheets có sẵn.
  - *Cách dùng:* Gõ lệnh `register 1BxiMVs0XRY...` (Thay bằng ID Google Sheets thực tế của trường).
  - *(Mapping: "System shall be cloud-based... allow multiple users")*
- **3. Control Parameters:** Xem/quản lý các luật ràng buộc (giờ ra chơi, giờ trống, tổ chuyên môn).
  - *Cách dùng:* Gõ lệnh `params`. Bot sẽ trả về danh sách các luật hiện tại.
  - *(Mapping: "specify resources, control parameters and conditions")*
- **4. Clone Format:** Copy khung phân công từ lớp này sang lớp khác.
  - *Cách dùng:* Gõ lệnh `clone 10A1 10A2`. Bot sẽ copy toàn bộ môn học của 10A1 sang 10A2.
  - *(Mapping: "allow duplication of class format")*
- **5. Auto Check & Validation:** Quét và báo lỗi logic dữ liệu.
  - *Cách dùng:* Gõ lệnh `check`. Bot sẽ rà soát và báo cáo nếu có giáo viên bị trùng giờ, quá tải, hoặc thiếu PLT slots.
  - *(Mapping: "Automatically check for mistakes/errors")*

### 2. TIMETABLE GENERATION (AI Xếp Lịch)
- **6. AI Algorithm (Clash-free):** Bot tự động chạy thuật toán xếp thời khóa biểu.
  - *Cách dùng:* Gõ lệnh `generate`. Quá trình xếp lịch mất vài giây.
  - *(Mapping: "solutions to minimize clashes")*
- **7. Multi-Solution (Best of 5):** AI chạy ngầm 5 kịch bản khác nhau để tìm ra phương án tối ưu.
  - *Cách dùng:* Gõ lệnh `generate best`. Khuyên dùng lệnh này thay vì lệnh số 6.
  - *(Mapping: "provide multiple solutions to allow for comparison")*
- **8. Manual Edit (Swap):** Hoán đổi thủ công 2 tiết học bất kỳ.
  - *Cách dùng:* Gõ lệnh `swap Mr.John T2 08:00 T3 09:00` để đổi 2 tiết dạy của thầy John.
  - *(Mapping: "manually edit / adjust timetables, shift deployment cards")*
- **9. Version Control & Retrieval:** Xem danh sách các phiên bản TKB đã lưu.
  - *Cách dùng:* Gõ lệnh `history`. Bot sẽ trả về danh sách link các bản backup cũ.
  - *(Mapping: "retrieval of past versions of timetable")*
- **10. Save Snapshot:** Sao lưu toàn bộ cấu trúc TKB hiện tại.
  - *Cách dùng:* Gõ lệnh `save Backup_Ky_1`. Bot sẽ tự tạo 1 bản copy an toàn trên Google Drive.
  - *(Mapping: "built-in version control management")*

### 3. AFTER GENERATION (Báo cáo & Trích xuất)
- **11. Grid Matrix View:** Xem bảng TKB dạng lưới.
  - *Cách dùng:* Gõ lệnh `matrix Mr.John` (để xem lịch GV) hoặc `matrix 10A1` (để xem lịch lớp).
  - *(Mapping: "multi-dimensional view of the timetables")*
- **12. Student/Teacher Lookup:** Tra cứu lịch dạng text đơn giản.
  - *Cách dùng:* Gõ lệnh `schedule 10A1`. Liệt kê từng ngày học môn gì, mấy giờ.
  - *(Mapping: "generate individualised student timetables")*
- **13. Resource Stats & Workload:** Thống kê số tiết dạy, công suất phòng.
  - *Cách dùng:* Gõ lệnh `stats`. Trả về báo cáo hiệu suất của toàn trường.
  - *(Mapping: "maximise resource utilization")*
- **14. Export to MS Excel:** Lấy link tải file Excel.
  - *Cách dùng:* Gõ lệnh `export`.
  - *(Mapping: "exporting of timetables and timetabling data to MS Excel")*
- **15. Export to PDF:** Lấy link tải file PDF.
  - *Cách dùng:* Gõ lệnh `pdf`. Thích hợp để in ấn ra giấy.
  - *(Mapping: "Printing of the reports... in different formats")*

### 4. RELIEF CAPABILITY (Quản lý Dạy Thay)
- **16. Relief Auto-Assignment:** Tìm người dạy thay tự động.
  - *Cách dùng:* Gõ lệnh `relief T2`. Bot sẽ tìm danh sách GV vắng Thứ 2 và tự xếp người thay thế.
  - *(Mapping: "assignment and prioritisation of relief teachers")*
- **17. Notify Relief Teachers:** Gửi tin nhắn tự động cho GV bị xếp đi dạy thay.
  - *Cách dùng:* Gõ lệnh `relief confirm T2`. Bot sẽ tự động bắn tin nhắn cho từng GV có liên quan.
  - *(Mapping: "Notify teachers and communicate relief plans")*
- **18. Advance Relief Planning:** Lên kế hoạch dạy thay cho tương lai.
  - *Cách dùng:* Gõ lệnh `relief advance T4 T3` (Nghỉ Thứ 4, nhưng lấy khung lịch của Thứ 3 để tính).
  - *(Mapping: "perform relief planning in advance" & "select the day")*
- **19. Relief Summary Report:** Báo cáo tổng kết số lần dạy thay.
  - *Cách dùng:* Gõ lệnh `relief report 2026-04` (Lấy báo cáo tháng 4).
  - *(Mapping: "Generates relief details and summary by date report")*
- **20. Find Empty Rooms:** Tìm phòng học trống.
  - *Cách dùng:* Gõ lệnh `rooms T4 09:00`.
  - *(Mapping: "Allow unused venues to be available")*
- **21. Venue Booking:** Chốt đặt một phòng trống.
  - *Cách dùng:* Gõ lệnh `book A101 T4 09:00 11:00 Họp tổ Hóa`. Phòng A101 sẽ bị khóa lại.
  - *(Mapping: "booking for other school purposes")*

### 5. SYSTEM INTEGRATION (Tích hợp Hệ thống)
- **22. Calendar Sync:** Đồng bộ lịch dạy vào Google Calendar cá nhân.
  - *Cách dùng:* Gõ lệnh `sync`. Máy tính sẽ bắn lịch của cả 100 GV lên Google Calendar của họ, tự động nhắc nhở trước khi lên lớp.
  - *(Mapping: "integrate calendaring capability... reflect school events")*
