const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const CONFIG = require("./config.json");

class WhatsappBot {
  constructor(onCheckCallback) {
    this.client = new Client({
      authStrategy: new LocalAuth({ clientId: CONFIG.WHATSAPP.SESSION_ID }),
      puppeteer: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] }
    });
    this.onCheck = onCheckCallback;
  }

  async init() {
    this.client.on("qr", (qr) => {
      console.log("--- SCAN THIS QR TO ACTIVATE SMART-TIMETABLE ---");
      qrcode.generate(qr, { small: true });
    });

    this.client.on("ready", () => console.log("✅ Smart-Timetable Bot is READY!"));

    this.client.on("message_create", async (msg) => {
      if (msg.from.endsWith('@newsletter') || msg.from.endsWith('@broadcast')) return;

      let body = msg.body || "";
      if (!body.trim() && !msg.hasMedia) return;

      // Bỏ qua các tin nhắn phản hồi tự động của bot (bắt đầu bằng các icon hệ thống) để tránh loop
      const cleanBody = body.trim();
      if (cleanBody.match(/^(✅|❌|🌟|👉|📥|🎓|⚠️|⚙️|📊|🚫|🤖|📋|❓|🕒|🕒|🔔|🔄|🏠|ℹ️|📖|🚀|🛠|📅|🗂)/)) return;
      
      let realPhone = msg.author || msg.from;
      const botPhone = this.client.info.wid.user;
      try {
        const contact = await msg.getContact();
        if (contact && contact.number) realPhone = contact.number;
      } catch (e) {}
      if (msg.fromMe || realPhone.includes(botPhone)) realPhone = botPhone;

      console.log(`\n[WhatsApp] 📥 NHẬN <- [${realPhone}]: ${body ? body : (msg.hasMedia ? '<Media File>' : '<Empty>')}`);

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
                  const mime = (media.mimetype || '').toLowerCase();
                  const filename = (media.filename || '').toLowerCase();
                  const isExcel = mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv') || filename.endsWith('.xlsx') || filename.endsWith('.csv');
                  
                  if (isExcel || firstWord === 'import') {
                      await replyWithLog(`✅ Đã nhận file ${media.filename || 'Excel'}. Hệ thống đang tiến hành bóc tách 11 tab và push lên Google Sheets...`);
                      const report = await this.onCheck(realPhone, 'import_media_base64', media.data);
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

🛠 *PRE-GENERATION (Setup)*
👉 ${L(1)} Import Excel File
👉 ${L(2)} Link Google Sheet ID
👉 ${L(3)} Control Parameters
👉 ${L(4)} Clone Format
👉 ${L(5)} Auto Check & Validation

🚀 *TIMETABLE GENERATION*
👉 ${L(6)} AI Algorithm (Clash-free)
👉 ${L(7)} Multi-Solution (Best of 5)
👉 ${L(8)} Manual Edit (Swap)
👉 ${L(9)} Version Control & Retrieval
👉 ${L(10)} Save Snapshot

📊 *AFTER GENERATION (Reports)*
👉 ${L(11)} Grid Matrix View
👉 ${L(12)} Student/Teacher Lookup
👉 ${L(13)} Resource Stats & Workload
👉 ${L(14)} Export to MS Excel
👉 ${L(15)} Export to PDF

📅 *RELIEF CAPABILITY*
👉 ${L(16)} Relief Auto-Assignment
👉 ${L(17)} Notify Relief Teachers
👉 ${L(18)} Advance Relief Planning
👉 ${L(19)} Relief Summary Report
👉 ${L(20)} Find Empty Rooms
👉 ${L(21)} Venue Booking

🔄 *SYSTEM INTEGRATION*
👉 ${L(22)} Calendar Sync

───────────────────────
_Chạm vào link → Nhấn nút Gửi._`;

        return await sendWithLog(msg.from, menuText);
      }

      // Mapping 22 số → lệnh
      const numMapping = {
        "1": "import", "2": "register", "3": "params", "4": "clone", "5": "check",
        "6": "generate", "7": "generate best", "8": "swap", "9": "history", "10": "save",
        "11": "matrix", "12": "schedule", "13": "stats", "14": "export", "15": "pdf",
        "16": "relief", "17": "relief confirm", "18": "relief advance", "19": "relief report",
        "20": "rooms", "21": "book", "22": "sync"
      };

      const input = numMapping[firstWord] ? firstWord : null;
      const slowCommands = ['import', 'generate', 'check', 'clone', 'relief', 'sync', 'matrix', 'pdf', 'export'];
      const cmd = input ? numMapping[input].split(/\s+/)[0] : firstWord;

      if (input) {
        const mappedParts = numMapping[input].split(/\s+/);
        const actualCmd = mappedParts[0];
        console.log(`[WhatsApp] Xử lý lệnh map số: ${actualCmd} ${mappedParts.slice(1).join(" ") || args}`);
        
        if (slowCommands.includes(actualCmd)) {
            await msg.reply(`⚙️ Hệ thống đang xử lý lệnh *'${actualCmd}'*... Vui lòng đợi trong giây lát!`);
            // Chờ một chút để message được gửi đi trước khi bắt đầu tác vụ nặng (tránh block loop)
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const report = await this.onCheck(realPhone, actualCmd, mappedParts.slice(1).join(" ") || args);
        if (report) await sendWithLog(msg.from, report);
      } else {
        console.log(`[WhatsApp] Xử lý lệnh text: ${firstWord} ${args}`);
        
        if (slowCommands.includes(firstWord)) {
            await msg.reply(`⚙️ Hệ thống đang xử lý lệnh *'${firstWord}'*... Vui lòng đợi trong giây lát!`);
            await new Promise(resolve => setTimeout(resolve, 100));
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
    }
    catch (error) { console.error(`[WhatsApp] Error:`, error.message); }
  }
}

module.exports = WhatsappBot;
