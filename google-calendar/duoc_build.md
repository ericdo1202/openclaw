1. Chạy server
node server.cjs

2. Chạy ngrok cho Gmail webhook (nếu dùng push):
ngrok http 3000

3. watch gcloud

gcloud pubsub topics add-iam-policy-binding openclaw-gmail-watch \
--member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
--role=roles/pubsub.publisher

phải gọi lệnh này để pass lỗi 403

sau đó chạy lại
gog gmail watch start --topic projects/timtabling-setting/topics/openclaw-gmail-watch




4. Với whatsapp-web.js, bạn phải quét QR ít nhất 1 lần — đây là yêu cầu bảo mật từ WhatsApp, không thể bypass bằng số phone.

Tuy nhiên, sau khi quét QR 1 lần, LocalAuth sẽ lưu session trong .wwebjs_auth/. Các lần restart sau sẽ không cần quét lại — nó tự reconnect.

Vấn đề hiện tại là session bị xóa/hỏng do lỗi puppeteer nên phải quét đi quét lại.

Có 2 lựa chọn:
Option 1: Dùng Pairing Code (không cần quét QR) Thay vì QR, bạn nhập mã code trên WhatsApp. Vẫn cần làm 1 lần nhưng tiện hơn quét QR trên terminal:

Option 2: Dùng @whiskeysockets/baileys (đã có trong 

package.json
) Library này hỗ trợ pairing code bằng số phone — chỉ cần nhập số, nó gửi code về WhatsApp, bạn confirm là xong. Không cần QR.

Bạn muốn tôi chuyển sang dùng baileys không? Nó cũng ổn định hơn với Node.js mới vì không cần Puppeteer/Chromium.

5. Kiểm tra trùng lịch (Clash Check)
Có 2 cách:
* Cách 1 (Polling 30s/lần): `node timetable_watcher.cjs` (Tự động quét định kỳ)
* Cách 2 (Triggered by Sheets): Đã tích hợp sẵn trong `server.cjs` tại endpoint `/check-timetable-clashes`. 
  Bạn cần cài đặt Apps Script trên Google Sheets để kích hoạt bộ lọc này ngay khi sửa file:
  - Trên Google Sheets chọn **Extensions** -> **Apps Script**.
  - Dán đoạn mã sau vào và lưu lại:
    ```javascript
    function clashCheckOnEdit(e) {
      // Thay url này bằng link ngrok mà bạn nhận được ở bước 2 
      // (VD: https://a1b2c3d4.ngrok-free.app/check-timetable-clashes)
      var url = "https://lymphocytotic-lustered-laci.ngrok-free.dev/check-timetable-clashes";
      
      try {
        UrlFetchApp.fetch(url, { "method": "post", "muteHttpExceptions": true });
      } catch (err) {}
    }
    ```