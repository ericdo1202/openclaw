const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

// ==================== Schedule Keywords ====================
const { matchesScheduleKeyword } = require('./check_keyword.cjs');

// ==================== Timetable Watcher (Trigger-based Logic) ====================
const { checkTimetableClashes } = require('./timetable_clash_checker.cjs');

const USERS_DB = require('./users_db.json');
const CONFIG = require('./config.json');

const app = express();
app.use(express.json());

// ==================== Shell Escape ====================
function shellEscape(str) {
  return str.replace(/'/g, "'\\''");
}

let pendingWhatsAppChatId = null;

// ==================== WhatsApp Client ====================
const whatsappClient = new Client({
  authStrategy: new LocalAuth({
    clientId: 'smart-timetable-auth' // Tách session ra khỏi folder cũ
  }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

whatsappClient.on('qr', qr => {
  console.log('Scan QR để kết nối Smart-Timetable...');
  qrcode.generate(qr, { small: true });
});

whatsappClient.on('ready', () => {
  console.log('Smart-Timetable bot đã sẵn sàng!');
});

whatsappClient.on('message', async msg => {
  try {
    const from = msg.from;
    const body = msg.body || '';
    
    // Resolve real phone number
    const contact = await msg.getContact();
    const realPhoneStr = (contact && contact.number) ? contact.number + '@c.us' : from;

    const userInfo = USERS_DB.find(u => u.phone === realPhoneStr || u.phone === from);
    if (!userInfo) return;

    // Manual Clash Check
    if (CONFIG.WHATSAPP_CLASH_CHECK_KEYWORDS.some(kw => body.toLowerCase().includes(kw))) {
      await msg.reply(`🔍 [Smart-Checker] Đang kiểm tra toàn diện dữ liệu của ${userInfo.name}...`);
      
      const result = await checkTimetableClashes(userInfo.sheetId, realPhoneStr, true);
      await msg.reply(result.message);
      return;
    }

    // Existing Schedule logic (Legacy)
    if (matchesScheduleKeyword(body)) {
        await msg.reply('⏳ Tính năng lên lịch tự động đang được bảo trì để nâng cấp lên Smart-Timetable...');
    }
  } catch (err) {
    console.error('WhatsApp Error:', err.message);
  }
});

async function initWhatsApp() {
    try {
        await whatsappClient.initialize();
    } catch (err) {
        console.error('WhatsApp Init Error:', err.message);
    }
}

initWhatsApp();

// ==================== Webhooks ====================

app.post(CONFIG.API_ROUTES.CHECK_TIMETABLE_CLASHES, async (req, res) => {
  const sheetId = req.body.sheetId;
  res.json({ success: true, message: 'Triggered smart validation' });

  if (sheetId) {
    const user = USERS_DB.find(u => u.sheetId === sheetId);
    if (user) {
      await checkTimetableClashes(sheetId, user.phone);
    }
  }
});

app.post(CONFIG.API_ROUTES.SEND_WHATSAPP, async (req, res) => {
  try {
    const { message, targetPhone } = req.body;
    const chatId = targetPhone || CONFIG.FALLBACK_WHATSAPP_NUMBER;
    if (chatId) await whatsappClient.sendMessage(chatId, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(CONFIG.SERVER_PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Smart-Timetable Server chạy tại: http://0.0.0.0:${CONFIG.SERVER_PORT}`);
  console.log(`📧 Gmail webhook: POST ${CONFIG.API_ROUTES.GMAIL_WEBHOOK}`);
  console.log(`📊 Excel Trigger (onEdit): POST ${CONFIG.API_ROUTES.CHECK_TIMETABLE_CLASHES}`);
  console.log(`🏥 Health check: GET ${CONFIG.API_ROUTES.HEALTH_CHECK}\n`);
});