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
              const report = await this.onCheck(
                realPhone,
                "import_media_base64",
                media.data,
              );
              if (report) {
                await replyWithLog(
                  `✅ File received: ${media.filename || "Excel"}. Extracting 11 tabs and updating Google Sheets...`,
                );
                await replyWithLog(report);
              }
              return;
            }
          }
        } catch (e) {
          console.error("[WhatsApp] Error downloading media:", e);
          await replyWithLog("❌ Error downloading file. Please try again.");
          return;
        }
      }

      // 🌟 MENU (Kích hoạt khi nhắn "Hi Timetable")
      const lowerBody = body.trim().toLowerCase();
      if (lowerBody.includes("hi timetable") || lowerBody.includes("hi timtable")) {
        // Kiểm tra quyền trước khi gửi Menu
        const checkAuth = await this.onCheck(realPhone, "menu_check", "");
        if (!checkAuth) return; 

        const n = botPhone;
        const L = (id) => `https://wa.me/${n}?text=${id}`;

        const menuText = `🌟 *SMART-TIMETABLE SYSTEM* 🌟
───────────────────────

🛠 *SETUP PHASE*
👉 ${L(1)} Import Excel Data
👉 ${L(2)} Link Google Sheet ID
👉 ${L(3)} View Rules & Constraints
👉 ${L(4)} Clone Class Format
👉 ${L(5)} Run Validation & Checks

🚀 *GENERATION PHASE*
👉 ${L(6)} Auto Generate (Fast 1x)
👉 ${L(7)} Optimized AI Generate (20x)
👉 ${L(8)} Manual Slot Swap
👉 ${L(9)} View Backup History
👉 ${L(10)} Save Current Snapshot

📊 *REPORTS & DATA EXPORT*
👉 ${L(11)} View Matrix Grid
👉 ${L(12)} Individual Schedule Lookup
👉 ${L(13)} Load & Workload Stats
👉 ${L(14)} Export to Excel (.xlsx)
👉 ${L(15)} Export to PDF (.pdf)

📅 *RELIEF MANAGEMENT*
👉 ${L(16)} Auto Relief Planning
👉 ${L(17)} Notify Relief Teachers
👉 ${L(18)} Advance Relief Planning
👉 ${L(19)} Relief Summary Report
👉 ${L(20)} Find Empty Rooms
👉 ${L(21)} Quick Room Booking

🔄 *SYSTEM INTEGRATION*
👉 ${L(22)} Sync to Google Calendar

───────────────────────
_Tap a link → Press Send to select a feature._`;

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
        9: "backup",
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
        "import", "generate", "check", "clone", "relief", "sync", 
        "matrix", "pdf", "export", "params", "swap", "history", 
        "save", "stats", "schedule", "rooms", "book"
      ];
      
      const cmd = input ? numMapping[input].split(/\s+/)[0] : firstWord;
      const actualArgs = input ? (numMapping[input].split(/\s+/).slice(1).join(" ") || args) : args;

      // 1. Gửi tin nhắn "đang xử lý" NGAY LẬP TỨC nếu là lệnh chậm
      if (slowCommands.includes(cmd)) {
        await sendWithLog(msg.from, `⚙️ System is processing *'${cmd}'*... Please wait!`);
      }

      // 2. Thực hiện xử lý logic
      const report = await this.onCheck(realPhone, cmd, actualArgs);
      
      // 3. Gửi kết quả cuối cùng
      if (report) {
        await sendWithLog(msg.from, report);
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
