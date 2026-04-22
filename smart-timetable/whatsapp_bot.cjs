const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const CONFIG = require("./config.json");

class WhatsappBot {
  constructor(onCheckCallback) {
    this.client = new Client({
      authStrategy: new LocalAuth({ clientId: CONFIG.WHATSAPP.SESSION_ID }),
      puppeteer: { 
        headless: true, 
        args: ["--no-sandbox", "--disable-setuid-sandbox"] 
      }
    });
    this.onCheck = onCheckCallback;
  }

  async init() {
    this.client.on("qr", (qr) => {
      console.log("--- SCAN THIS QR TO ACTIVATE SMART-TIMETABLE ---");
      qrcode.generate(qr, { small: true });
    });

    this.client.on("ready", () => {
      console.log("✅ Smart-Timetable Bot is READY!");
    });

    this.client.on("message_create", async (msg) => {
      if (msg.from.endsWith('@newsletter') || msg.from.endsWith('@broadcast')) return;

      let body = msg.body || "";
      if (!body.trim()) return;

      let realPhone = msg.author || msg.from;
      const botPhone = this.client.info.wid.user;

      try {
        const contact = await msg.getContact();
        if (contact && contact.number) realPhone = contact.number;
      } catch (e) {}
      if (msg.fromMe || realPhone.includes(botPhone)) realPhone = botPhone;

      const parts = body.trim().split(/\s+/);
      const firstWord = parts[0].toLowerCase();
      const args = parts.slice(1).join(" ");

      // 🌟 MENU (Text + Link wa.me)
      if (["menu", "help", "hi", "?", "hello"].includes(firstWord)) {
        const n = botPhone;
        const L = (id) => `https://wa.me/${n}?text=${id}`;

        const menuText = `🌟 *SMART-TIMETABLE SYSTEM FUNCTIONALITY* 🌟
───────────────────────

🛠 *PRE-GENERATION (Setup)*
👉 ${L(1)} Data Import
👉 ${L(2)} Control Parameters
👉 ${L(3)} Clone Format
👉 ${L(4)} Auto Check & Validation

🚀 *TIMETABLE GENERATION*
👉 ${L(5)} AI Algorithm (Clash-free)
👉 ${L(6)} Multi-Solution Generation
👉 ${L(7)} Version Control & Retrieval

📊 *AFTER GENERATION (Reports)*
👉 ${L(8)} Multi-dimensional Grid
👉 ${L(9)} Student Timetable
👉 ${L(10)} Export to MS Excel

📅 *RELIEF CAPABILITY*
👉 ${L(11)} Relief Auto-Assignment
👉 ${L(12)} Relief Notification
👉 ${L(13)} Advance Relief Planning
👉 ${L(14)} Venue Booking

🔄 *SYSTEM INTEGRATION*
👉 ${L(15)} Calendar Sync

───────────────────────
_Chạm vào link → Nhấn nút Gửi._`;

        return await this.client.sendMessage(msg.from, menuText);
      }

      // Mapping số → lệnh
      const numMapping = {
        "1": "register", "2": "check", "3": "clone", "4": "check",
        "5": "generate", "6": "generate best", "7": "history",
        "8": "matrix", "9": "schedule", "10": "save",
        "11": "relief", "12": "relief confirm", "13": "relief advance",
        "14": "book", "15": "sync"
      };

      const input = numMapping[firstWord] ? firstWord : null;

      if (input) {
        const mappedParts = numMapping[input].split(/\s+/);
        const report = await this.onCheck(realPhone, mappedParts[0], mappedParts.slice(1).join(" ") || args);
        if (report) await this.client.sendMessage(msg.from, report);
      } else {
        const report = await this.onCheck(realPhone, firstWord, args);
        if (report) await this.client.sendMessage(msg.from, report);
      }
    });

    await this.client.initialize();
  }

  async sendMessage(to, content) {
    try {
      await this.client.sendMessage(to, content);
    } catch (error) {
      console.error(`[WhatsApp] Error:`, error.message);
    }
  }
}

module.exports = WhatsappBot;
