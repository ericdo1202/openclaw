const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const CONFIG = require("./config.json");

class WhatsappBot {
  constructor(onCheckCallback) {
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: CONFIG.WHATSAPP.SESSION_ID || "smart-timetable-session",
      }),
      puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        protocolTimeout: 120000,
        executablePath:
          process.platform === "darwin"
            ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
            : undefined,
      },
    });
    this.onCheck = onCheckCallback;
  }

  async init() {
    this.client.on("qr", (qr) => {
      console.log("--- SCAN THIS QR TO ACTIVATE SMART-TIMETABLE ---");
      qrcode.generate(qr, { small: true });
    });

    this.client.on("ready", () =>
      console.log("✅ Smart-Timetable Bot is READY!"),
    );

    this.client.on("message_create", async (msg) => {
      // 1. Chặn vòng lặp: Nếu bot gửi cho người khác thì bỏ qua
      if (msg.fromMe && msg.to !== msg.from) return;

      const bodyContent = msg.body || "";
      const cleanBodyContent = bodyContent.trim();

      // 2. Chặn tin nhắn chứa icon hoặc từ khóa hệ thống để tránh loop
      // Sử dụng regex bao quát hơn để chặn mọi tin nhắn bắt đầu bằng Emoji
      if (
        cleanBodyContent.match(
          /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/,
        )
      )
        return;
      if (
        [
          "no teachers reported",
          "click the link below",
          "printable pdf report",
          "includes all sheets",
        ].some((k) => cleanBodyContent.toLowerCase().includes(k))
      )
        return;

      if (msg.from.endsWith("@newsletter") || msg.from.endsWith("@broadcast"))
        return;

      let body = msg.body || "";
      if (!body.trim() && !msg.hasMedia) return;

      // Bỏ qua các tin nhắn phản hồi tự động của bot (bắt đầu bằng các icon hệ thống) để tránh loop
      const cleanBody = body.trim();
      if (
        cleanBody.match(
          /^(✅|❌|🌟|👉|📥|🎓|⚠️|⚙️|📊|🚫|🤖|📋|❓|🕒|🔔|🔄|🏠|ℹ️|📖|🚀|🛠|📅|🗂|📄|📂|📦|📁)/,
        )
      )
        return;
      if (
        [
          "no teachers reported",
          "click the link below",
          "printable pdf report",
        ].some((k) => cleanBody.toLowerCase().includes(k))
      )
        return;

      let realPhone = msg.author || msg.from;
      const botPhone = this.client.info.wid.user;
      try {
        const contact = await msg.getContact();
        if (contact && contact.number) realPhone = contact.number;
      } catch (e) {}
      if (msg.fromMe || realPhone.includes(botPhone)) realPhone = botPhone;

      console.log(
        `\n[WhatsApp] 📥 NHẬN <- [${realPhone}]: ${body ? body : msg.hasMedia ? "<Media File>" : "<Empty>"}`,
      );

      const parts = body.trim().split(/\s+/);
      const firstWord = parts[0].toLowerCase();
      const args = parts.slice(1).join(" ");

      const replyWithLog = async (content) => {
        console.log(`[WhatsApp] 📤 TRẢ LỜI -> [${msg.from}]:\n${content}`);
        await msg.reply(content);
      };

      const sendWithLog = async (to, content) => {
        console.log(`[WhatsApp] 📤 GỬI -> [${to}]:\n${content}`);
        await this.client.sendMessage(to, content);
      };

      // Xử lý file đính kèm (Import Excel/CSV)
      if (msg.hasMedia) {
        try {
          const media = await msg.downloadMedia();
          if (media) {
            const mime = (media.mimetype || "").toLowerCase();
            const filename = (media.filename || "").toLowerCase();
            const isExcel =
              mime.includes("spreadsheet") ||
              mime.includes("excel") ||
              mime.includes("csv") ||
              filename.endsWith(".xlsx") ||
              filename.endsWith(".csv");

            if (isExcel || firstWord === "import") {
              await replyWithLog(
                `✅ Đã nhận file ${media.filename || "Excel"}. Hệ thống đang tiến hành bóc tách 11 tab và push lên Google Sheets...`,
              );
              const report = await this.onCheck(
                realPhone,
                "import_media_base64",
                media.data,
              );
              if (report) await replyWithLog(report);
              return;
            }
          }
        } catch (e) {
          console.error("[WhatsApp] Error downloading media:", e);
          await replyWithLog("❌ Lỗi khi tải file. Vui lòng thử lại.");
          return;
        }
      }

      // 🌟 MENU 21 TÍNH NĂNG (Chuẩn Requirement)
      if (["menu", "help", "hi", "?", "hello"].includes(firstWord)) {
        const n = botPhone;
        const L = (id) => `https://wa.me/${n}?text=${id}`;

        const menuText = `🌟 *SMART-TIMETABLE SYSTEM* 🌟
───────────────────────

🛠 *GIAI ĐOẠN THIẾT LẬP (Setup)*
👉 ${L(1)} Nhập dữ liệu Excel (Import)
👉 ${L(2)} Liên kết Google Sheet ID
👉 ${L(3)} Xem tham số & Ràng buộc (Rules)
👉 ${L(4)} Sao chép khung môn học (Clone)
👉 ${L(5)} Kiểm tra lỗi & Trùng lịch (Check)

🚀 *GIAI ĐOẠN XẾP LỊCH (Generation)*
👉 ${L(6)} Xếp lịch tự động (Nhanh 1x)
👉 ${L(7)} Xếp lịch tối ưu (AI 20x)
👉 ${L(8)} Hoán đổi tiết dạy (Swap)
👉 ${L(9)} Xem lịch sử phiên bản (History)
👉 ${L(10)} Lưu bản sao hiện tại (Snapshot)

📊 *BÁO CÁO & XUẤT DỮ LIỆU (Reports)*
👉 ${L(11)} Xem bảng Grid Ma trận
👉 ${L(12)} Tra cứu lịch Cá nhân (Lookup)
👉 ${L(13)} Thống kê Tải trọng & Workload
👉 ${L(14)} Xuất file Excel (.xlsx)
👉 ${L(15)} Xuất file PDF (.pdf)

📅 *QUẢN LÝ DẠY THAY (Relief)*
👉 ${L(16)} Lập kế hoạch dạy thay tự động
👉 ${L(17)} Gửi thông báo cho GV dạy thay
👉 ${L(18)} Lên lịch dạy thay nâng cao
👉 ${L(19)} Báo cáo tổng hợp dạy thay
👉 ${L(20)} Tìm phòng học trống
👉 ${L(21)} Đặt phòng nhanh (Booking)

🔄 *TÍCH HỢP HỆ THỐNG (Integration)*
👉 ${L(22)} Đồng bộ Google Calendar

───────────────────────
_Chạm vào link → Nhấn nút Gửi để chọn tính năng._`;

        return await sendWithLog(msg.from, menuText);
      }

      // Mapping 22 số → lệnh
      const numMapping = {
        1: "import",
        2: "register",
        3: "params",
        4: "clone",
        5: "check",
        6: "generate",
        7: "generate best",
        8: "swap",
        9: "history",
        10: "save",
        11: "matrix",
        12: "schedule",
        13: "stats",
        14: "export",
        15: "pdf",
        16: "relief",
        17: "relief confirm",
        18: "relief advance",
        19: "relief report",
        20: "rooms",
        21: "book",
        22: "sync",
      };

      const input = numMapping[firstWord] ? firstWord : null;
      const slowCommands = [
        "import",
        "generate",
        "check",
        "clone",
        "relief",
        "sync",
        "matrix",
        "pdf",
        "export",
        "params",
        "swap",
        "history",
        "save",
        "stats",
        "schedule",
        "rooms",
        "book",
      ];
      const cmd = input ? numMapping[input].split(/\s+/)[0] : firstWord;

      if (input) {
        const mappedParts = numMapping[input].split(/\s+/);
        const actualCmd = mappedParts[0];
        console.log(
          `[WhatsApp] Xử lý lệnh map số: ${actualCmd} ${mappedParts.slice(1).join(" ") || args}`,
        );

        if (slowCommands.includes(actualCmd)) {
          await msg.reply(
            `⚙️ Hệ thống đang xử lý lệnh *'${actualCmd}'*... Vui lòng đợi trong giây lát!`,
          );
          // Chờ một chút để message được gửi đi trước khi bắt đầu tác vụ nặng (tránh block loop)
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const report = await this.onCheck(
          realPhone,
          actualCmd,
          mappedParts.slice(1).join(" ") || args,
        );
        if (report) await sendWithLog(msg.from, report);
      } else {
        console.log(`[WhatsApp] Xử lý lệnh text: ${firstWord} ${args}`);

        if (slowCommands.includes(firstWord)) {
          await msg.reply(
            `⚙️ Hệ thống đang xử lý lệnh *'${firstWord}'*... Vui lòng đợi trong giây lát!`,
          );
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const report = await this.onCheck(realPhone, firstWord, args);
        if (report) await sendWithLog(msg.from, report);
      }
    });

    await this.client.initialize();
  }

  async sendMessage(to, content) {
    try {
      console.log(`[WhatsApp] 📤 GỬI CHỦ ĐỘNG -> [${to}]:\n${content}`);
      await this.client.sendMessage(to, content);
    } catch (error) {
      console.error(`[WhatsApp] Error:`, error.message);
    }
  }
}

module.exports = WhatsappBot;
