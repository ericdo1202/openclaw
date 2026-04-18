const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const CONFIG = require("./config.json");

class WhatsappBot {
  constructor(onCheckCallback) {
    this.client = new Client({
      authStrategy: new LocalAuth({ clientId: CONFIG.WHATSAPP.SESSION_ID }),
      puppeteer: { headless: true, args: ["--no-sandbox"] },
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
      if (msg.body && msg.body.includes("SMART-TIMETABLE ULTIMATE")) return;
      if (!msg.body) return;

      let realPhone = msg.author || msg.from;
      const botPhone = this.client.info.wid.user;

      try {
        const contact = await msg.getContact();
        if (contact && contact.number) {
          realPhone = contact.number;
        }
      } catch (e) {
        console.log(`[Bot] Warning: Could not resolve contact, using raw ID: ${realPhone}`);
      }

      if (msg.fromMe || realPhone.includes(botPhone) || botPhone.includes(realPhone)) {
        realPhone = botPhone;
      }

      console.log(`[Bot] Received from ${realPhone}: ${msg.body}`);

      const baseLink = `https://wa.me/${botPhone}?text=`;
      const LINK_MENU = `🌟 *SMART-TIMETABLE ULTIMATE* 🌟
──────────────────────

🛠 *1. PRE-GENERATION & SETUP*
1️⃣. *Register Source:* ${baseLink}register
   👉 _Link Google Sheet to import teachers & class data_
2️⃣. *Validate Logic:* ${baseLink}check
   👉 _Automatic check for clashes & data entry errors_
3️⃣. *Clone Format:* ${baseLink}clone
   👉 _Quickly duplicate class/teacher formatting_

🚀 *2. TIMETABLE GENERATION*
4️⃣. *AI Generation:* ${baseLink}generate%20best
   👉 _Run AI algorithm to minimize conflicts & overlaps_
5️⃣. *Version History:* ${baseLink}history
   👉 _Retrieve and restore past timetable versions_

📊 *3. POST-GENERATION & REPORT*
6️⃣. *Grid Matrix:* ${baseLink}matrix
   👉 _View 2D multi-dimensional timetable grid_
7️⃣. *Schedule Lookup:* ${baseLink}schedule
   👉 _Individualized lookup for Teacher/Student_
8️⃣. *Resource Stats:* ${baseLink}stats
   👉 _View workload & room utilization reports_
9️⃣. *Export to Excel:* ${baseLink}save
   👉 _Save and export data to MS Excel format_

📅 *4. RELIEF CAPABILITY*
🔟. *Relief Planning:* ${baseLink}relief
    👉 _Auto-assign relief teachers based on priority_
1️⃣1️⃣. *Advance Mapping:* ${baseLink}relief%20[date]%20[day]
    👉 _Select specific day's timetable for relief planning_
1️⃣2️⃣. *Finalize & Notify:* ${baseLink}relief%20confirm
    👉 _Push relief plans to teachers via WhatsApp_

🏠 *5. RESOURCE BOOKING*
1️⃣3️⃣. *Venue Booking:* ${baseLink}book
    👉 _Book unused venues for meetings or events_
1️⃣4️⃣. *Find Empty:* ${baseLink}rooms
    👉 _Check real-time room availability per slot_

🔄 *6. INTEGRATION*
1️⃣5️⃣. *Calendar Sync:* ${baseLink}sync
    👉 _Sync timetable with school events/calendars_

🌐 *WEB DASHBOARD:* http://localhost:3001
──────────────────────
👉 *Tip:* Tap numeric links or enter numbers (1-15) for quick access.`;

      const body = msg.body.trim();
      const parts = body.split(/\s+/);
      const firstWord = parts[0].toLowerCase();
      const args = parts.slice(1).join(" ");

      if (["menu", "help", "hi", "?", "hello"].includes(firstWord)) {
        return await msg.reply(LINK_MENU);
      }

      const numMapping = {
        "1": "register",
        "2": "check",
        "3": "clone",
        "4": "generate best",
        "5": "history",
        "6": "matrix",
        "7": "schedule",
        "8": "stats",
        "9": "save",
        "10": "relief",
        "11": "relief [date] [day]",
        "12": "relief confirm",
        "13": "book",
        "14": "rooms",
        "15": "sync"
      };

      let command = null;
      let finalArgs = args;

      if (numMapping[firstWord]) {
        const mappedParts = numMapping[firstWord].split(/\s+/);
        command = mappedParts[0];
        finalArgs = mappedParts.slice(1).join(" ") || args;
      } else {
        command = firstWord;
      }

      try {
        const report = await this.onCheck(realPhone, command, finalArgs);
        if (report) {
          await this.client.sendMessage(msg.from, report);
        }
      } catch (err) {
        console.error("[Bot Error]", err.message);
        if (!numMapping[firstWord]) {
          await msg.reply(`❓ Invalid command.\n\n${LINK_MENU}`);
        }
      }
    });

    await this.client.initialize();
  }

  async sendMessage(to, content) {
    try {
      await this.client.sendMessage(to, content);
      console.log(`[WhatsApp] Notification sent to ${to}`);
    } catch (error) {
      console.error(`[WhatsApp] Error sending to ${to}:`, error.message);
    }
  }
}

module.exports = WhatsappBot;
