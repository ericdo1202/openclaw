# KỊCH BẢN DEMO VIDEO - SMART TIMETABLE BOT
(Dữ liệu thực tế 100% từ file Smart-Timetable-MegaData.xlsx)

Tài liệu này cung cấp các lệnh copy-paste chính xác để quay video demo. Tất cả tên giáo viên, ngày tháng và thời gian đã được đối soát trực tiếp với dữ liệu trong file.

---

## 🟢 PHẦN 1: KHỞI ĐỘNG & KẾT NỐI (Admin)

**1. Xem menu lệnh:**
> menu

**2. Kết nối hệ thống với Google Sheet:**
> register 1N_R9-7s1pkuTnLoAmO0KWIMKXQaRYaY52M48Ao-bPoo

---

## 🔵 PHẦN 2: NHẬP DỮ LIỆU & KIỂM TRA (Pre-Generation)

**3. Import dữ liệu mới (Gửi file MegaData.xlsx đính kèm tin nhắn này):**
> import

**4. Kiểm tra các ràng buộc (Constraints):**
> params

**5. Sao chép khung chương trình (VD: Từ lớp 10B sang lớp 10C):**
> clone 10B 10C

**6. Kiểm tra lỗi logic dữ liệu trước khi xếp lịch:**
> check

---

## 🟡 PHẦN 3: XẾP LỊCH TỰ ĐỘNG BẰNG AI (Generation)

**7. Chạy AI xếp lịch (Bản nhanh):**
> generate

**8. Chạy AI tối ưu hóa (Tìm bản tốt nhất):**
> generate best

---

## 🟠 PHẦN 4: ĐIỀU CHỈNH THỦ CÔNG & BÁO CÁO (Post-Generation)

**9. Xem lịch dạy chi tiết của giáo viên Samantha Watkins:**
> schedule Samantha Watkins

**10. Đổi tiết dạy của giáo viên Samantha Watkins:**
> swap Samantha Watkins T2 8:00 T3 8:00

**11. Xem Thời khóa biểu dạng lưới của lớp 10B:**
> matrix 10B

**12. Xem thống kê tải trọng giáo viên & phòng học:**
> stats

---

## 🔴 PHẦN 5: QUẢN LÝ DẠY THAY & ĐẶT PHÒNG (Relief & Booking)

**13. Tìm giáo viên dạy thay cho ngày 2026-04-14 (Ngày có GV Samantha Watkins vắng):**
> relief 2026-04-14

**14. Xác nhận dạy thay và gửi thông báo tự động cho GV:**
> relief confirm 2026-04-14

**15. Xuất báo cáo tổng hợp dạy thay tháng 04/2026:**
> relief report 2026-04

**16. Kiểm tra phòng trống vào Thứ 4 lúc 8:00:**
> rooms T4 8:00

**17. Đặt phòng họp/phòng chức năng (Phòng Room 101):**
> book Room 101 2026-04-14 10:00 12:00 Weekly Meeting

---

## 🟣 PHẦN 6: LƯU TRỮ & XUẤT BẢN (History & Export)

**18. Đồng bộ lịch dạy lên Google Calendar (VD: GV Samantha Watkins):**
> sync Samantha Watkins

**19. Lưu bản sao lưu (Snapshot) hiện tại:**
> save Final_S01

**20. Xem lịch sử các bản sao lưu:**
> history

**21. Xuất dữ liệu (Excel / PDF):**
> export excel
> export pdf

---

## 💡 LƯU Ý KỸ THUẬT KHI QUAY VIDEO:
1. **Samantha Watkins:** Là nhân vật chính trong demo vì cô ấy có dữ liệu ở cả 3 bảng: Timetable, Absence và Teachers.
2. **Định dạng giờ:** Hãy sử dụng `8:00` (không có số 0 ở đầu) để khớp với dữ liệu trong Google Sheet.
3. **Ngày dạy thay:** `2026-04-14` là ngày Thứ 3 (T3), trùng với lịch dạy của Samantha Watkins, nên lệnh `relief` sẽ tìm thấy dữ liệu ngay lập tức.
4. **Phản hồi:** Đợi Bot trả lời "⚙️ System is processing..." xong mới thực hiện lệnh tiếp theo.
