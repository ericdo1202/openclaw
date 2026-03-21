const { exec } = require('child_process');
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

// ==================== Config ====================
// ADMIN_EMAIL hiện được cấu hình trong config.json

// ==================== Schedule Keywords ====================
const { matchesScheduleKeyword } = require('./check_keyword.cjs');

// ==================== Timetable Watcher (Trigger-based Logic) ====================
const { checkTimetableClashes } = require('./timetable_clash_checker.cjs');

// Database (Load 1 lần lúc start, hoặc đọc từ file JSON thật tuỳ ý)
const USERS_DB = require('./users_db.json');
const CONFIG = require('./config.json');



// ==================== Shell Escape ====================
function shellEscape(str) {
  return str.replace(/'/g, "'\\''");
}

const app = express();
app.use(express.json());

// ==================== Pending WhatsApp replies ====================
// Stores chatId so we can send calendar link back after event is created
let pendingWhatsAppChatId = null;

// ==================== Debounce / Lock for script ====================
let scriptRunning = false;
let scriptPending = false;
const DEBOUNCE_MS = CONFIG.SCRIPT_DEBOUNCE_MS;
let debounceTimer = null;

function runScriptDebounced(source) {
  if (scriptRunning) {
    console.log(`[${source}] Script already running, marking pending...`);
    scriptPending = true;
    return;
  }

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    scriptRunning = true;
    const scriptPath = path.resolve(__dirname, './poll_email_to_calendar.sh');
    console.log(`[${source}] Running script: ${scriptPath}`);
    // Shell script tự đọc config.json, không cần truyền tham số
    exec(`bash "${scriptPath}"`, { cwd: __dirname, timeout: 60000 }, (err, stdout, stderr) => {
      scriptRunning = false;

      if (err) {
        console.error(`[${source}] Script error:`, err.message);
      } else {
        if (stdout.trim()) console.log(`[${source}] Script output:\n${stdout}`);
        if (stderr.trim()) console.warn(`[${source}] Script stderr:\n${stderr}`);
      }

      // Parse calendar events from script output and notify WhatsApp
      const chatId = pendingWhatsAppChatId;
      pendingWhatsAppChatId = null; // Clear immediately to avoid race conditions

      if (chatId) {
        if (err) {
          whatsappClient.sendMessage(chatId, '❌ Failed to create calendar event. Please try again.')
            .catch(e => console.error('WhatsApp: Failed to send error:', e.message));
        } else if (stdout) {
          // Parse title + link pairs from script output
          const titleMatches = stdout.match(/Event created successfully: .+/g) || [];
          const linkMatches = stdout.match(/Calendar link: https?:\/\/[^\s]+/g) || [];

          if (titleMatches.length > 0) {
            let replyMsg = `✅ ${titleMatches.length} calendar event(s) created!\n`;
            for (let i = 0; i < titleMatches.length; i++) {
              const title = titleMatches[i].replace('Event created successfully: ', '');
              const link = linkMatches[i] ? linkMatches[i].replace('Calendar link: ', '') : '';
              replyMsg += `\n📅 ${title}`;
              if (link) replyMsg += `\n🔗 ${link}`;
            }
            whatsappClient.sendMessage(chatId, replyMsg)
              .then(() => console.log('WhatsApp: Sent calendar links to', chatId))
              .catch(e => console.error('WhatsApp: Failed to send link:', e.message));
          } else if (stdout.includes('Failed to create event')) {
            whatsappClient.sendMessage(chatId, '❌ Failed to create calendar event. Please try again.')
              .catch(e => console.error('WhatsApp: Failed to send error:', e.message));
          } else {
            whatsappClient.sendMessage(chatId, '⚠️ No new calendar event was created.')
              .catch(e => console.error('WhatsApp: Failed to send status:', e.message));
          }
        }
      }

      if (scriptPending) {
        scriptPending = false;
        console.log(`[${source}] Pending notification found, re-running script...`);
        runScriptDebounced(source + '-retry');
      }
    });
  }, DEBOUNCE_MS);
}

// ==================== Send Email + Label Timetable ====================
function sendEmailWithLabel(subject, body, source) {
  const safeSubject = shellEscape(subject);
  const safeBody = shellEscape(body);

  const sendCmd = `gog gmail send --to '${MY_EMAIL}' --subject '${safeSubject}' --body '${safeBody}' --force --json`;

  console.log(`[${source}] Sending email: "${subject}"`);

  exec(sendCmd, { cwd: __dirname, timeout: 30000 }, (err, stdout, stderr) => {
    if (err) {
      console.error(`[${source}] Failed to send email:`, err.message);
      return;
    }

    console.log(`[${source}] Email sent successfully!`);

    // Parse thread ID to apply Timetable label
    try {
      const result = JSON.parse(stdout);
      const threadId = result.threadId || result.thread_id || result.id;
      if (threadId) {
        const labelCmd = `gog gmail labels modify ${threadId} --add "Timetable" --force`;
        exec(labelCmd, { cwd: __dirname, timeout: 15000 }, (err2, stdout2) => {
          if (err2) {
            console.error(`[${source}] Failed to add Timetable label:`, err2.message);
          } else {
            console.log(`[${source}] Timetable label applied to thread ${threadId}`);
          }
        });
      } else {
        console.warn(`[${source}] No threadId found in response:`, stdout);
      }
    } catch (e) {
      console.error(`[${source}] Failed to parse response:`, e.message, stdout);
    }
  });
}

// ==================== WhatsApp Client ====================
const whatsappClient = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--single-process'
    ]
  }
});

whatsappClient.on('qr', qr => {
  console.log('Scan QR code to connect WhatsApp...');
  qrcode.generate(qr, { small: true });
});

whatsappClient.on('ready', () => {
  console.log('WhatsApp client is connected and ready!');
  console.log('WhatsApp number:', whatsappClient.info.wid.user + '@c.us');
  console.log('Device name:', whatsappClient.info.pushname);
});

whatsappClient.on('message', async msg => {
  try {
    const from = msg.from || 'unknown';
    let msgBody = msg.body || '';

    // Bản cập nhật mới của WhatsApp (Multi-Device) đôi khi dùng định dạng @lid thay vì @c.us
    // Nên chúng ta dùng hàm getContact() để truy ngược ra số điện thoại thật của người đó.
    let realPhoneStr = from;
    try {
      const contact = await msg.getContact();
      if (contact && contact.number) {
        realPhoneStr = contact.number + '@c.us';
      }
    } catch (err) {
      console.log('Cannot get contact:', err.message);
    }

    console.log(`WhatsApp new message from ${from} (Resolved: ${realPhoneStr}): ${msgBody}`);

    // Lùi dòng gán Chat ID xuống dưới để không bị lưu nhầm ID của người lạ

    // ==================== [NEW] DEDICATED BOT (MULTI-TENANT) ====================
    // Lấy thông tin user từ Database dựa theo số điện thoại (chấp nhận cả 2 định dạng)
    let userInfo = USERS_DB.find(u => u.phone === realPhoneStr || u.phone === from);

    if (!userInfo) {
      console.log(`WhatsApp: Ignoring message from stranger ${realPhoneStr} (Not found in users_db.json)`);
      return; 
    }

    // ==================== [NEW] AUTO SEEN (Hiện Tích Xanh) ====================
    try {
      const chat = await msg.getChat();
      if (chat.sendSeen) {
        await chat.sendSeen();
      }
    } catch (err) {
      console.log("Cannot mark as seen:", err.message);
    }
    // =========================================================================

    // Bỏ qua tin nhắn từ Group Chat (Đề phòng SIM rác bj add vào group)

    if (from.includes('@g.us')) {
      return;
    }
    // =========================================================================

    // ==================== [NEW] Manual Check Clash via WhatsApp ====================
    if (CONFIG.WHATSAPP_CLASH_CHECK_KEYWORDS.some(kw => msgBody.toLowerCase().includes(kw))) {
      console.log(`WhatsApp: Manual clash check requested by ${realPhoneStr} (Sheet: ${userInfo.sheetId})`);
      await msg.reply(`🔍 Checking Google Sheets (${userInfo.name}) for any timetable clashes...`);
      
      // Truyền tham số thứ 3 (isManualCheck = true) để nó nhả Full báo cáo
      const result = await checkTimetableClashes(userInfo.sheetId, realPhoneStr, true);
      
      if (result.error) {
        await msg.reply(`❌ Error checking Excel: ${result.error.message || result.error}`);
      } else if (result.allMessages && result.allMessages.length > 0) {
        // Tin nhắn báo cáo (Đã được gộp chuẩn Header/Footer bên trong Logic)
        for (const report of result.allMessages) {
          await msg.reply(report);
          console.log(`[WhatsApp Reply] Sent report to ${realPhoneStr}`);
        }
      } else {
        await msg.reply('✅ The current spreadsheet is clean, NO timetable clashes found!');
      }
      return;
    }

    // ===============================================================================

    // Check keyword using shared function
    if (!matchesScheduleKeyword(msgBody)) {
      console.log(`WhatsApp: Ignoring non-schedule message from ${realPhoneStr}`);
      return;
    }

    console.log(`WhatsApp: Schedule keyword matched, processing request from ${realPhoneStr}...`);

    // CHỈ lưu Chat ID khi tin nhắn hợp lệ và thực sự ra lệnh lên lịch
    // Lưu lại cái ID nguyên bản (from) để lúc reply API không bị lỗi mạng
    pendingWhatsAppChatId = from;

    // Reply immediately
    await msg.reply('⏳ Creating calendar event, please wait...');

    // Send email to self + apply Timetable label
    // Full message in subject (replace newlines with ' | ' since subject can't have newlines)
    const emailSubject = `Schedule: ${msgBody.replace(/\n/g, ' | ')}`;
    const emailBody = msgBody;
    sendEmailWithLabel(emailSubject, emailBody, 'WhatsApp');
  } catch (err) {
    console.error('WhatsApp handler error:', err.message);
  }
});

whatsappClient.on('auth_failure', err => {
  console.error('WhatsApp auth failed:', err);
});

whatsappClient.on('disconnected', reason => {
  console.log('WhatsApp disconnected:', reason);
});

// Initialize with retry logic
const MAX_RETRIES = CONFIG.WHATSAPP_MAX_RETRIES;
async function initWhatsApp(attempt = 1) {
  try {
    console.log(`WhatsApp: Initializing (attempt ${attempt}/${MAX_RETRIES})...`);
    await whatsappClient.initialize();
  } catch (err) {
    console.error(`WhatsApp init error (attempt ${attempt}):`, err.message);
    if (attempt < MAX_RETRIES) {
      const delay = attempt * 3000;
      console.log(`WhatsApp: Retrying in ${delay / 1000} seconds...`);
      setTimeout(() => initWhatsApp(attempt + 1), delay);
    } else {
      console.error('WhatsApp: Failed to initialize after multiple attempts.');
      console.error('💡 Tip: Try installing a compatible puppeteer: npm install puppeteer@21.11.0');
    }
  }
}

initWhatsApp();

// Prevent unhandled rejections from crashing the server
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

// ==================== Gmail Webhook ====================
let lastProcessedHistoryId = 0;

app.post(CONFIG.API_ROUTES.GMAIL_WEBHOOK, (req, res) => {
  // ACK immediately (Google requires fast response)
  res.sendStatus(200);

  try {
    const body = req.body;
    console.log('Gmail push notification received:', new Date().toISOString());

    // Decode Pub/Sub message data
    if (body && body.message && body.message.data) {
      const decoded = Buffer.from(body.message.data, 'base64').toString('utf-8');
      let payload;
      try {
        payload = JSON.parse(decoded);
      } catch (e) {
        console.error('Gmail: Failed to parse data:', decoded);
        return;
      }

      const historyId = parseInt(payload.historyId, 10) || 0;
      const emailAddress = payload.emailAddress || 'unknown';

      console.log(`Gmail notification: email=${emailAddress}, historyId=${historyId}`);

      // Only process if historyId is newer
      if (historyId <= lastProcessedHistoryId) {
        console.log(`Gmail: Skipping old notification (historyId ${historyId} <= ${lastProcessedHistoryId})`);
        return;
      }

      lastProcessedHistoryId = historyId;
      console.log(`Gmail: New notification, historyId=${historyId}, running script...`);
      runScriptDebounced('Gmail');
    } else {
      console.log('Gmail: Notification body has no data, skipping.');
    }
  } catch (err) {
    console.error('Gmail webhook error:', err.message);
  }
});

// ==================== Internal API: Send WhatsApp ====================
// Used by independent scripts (like timetable checking) to send alerts
app.post(CONFIG.API_ROUTES.SEND_WHATSAPP, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    let chatId = req.body.targetPhone || pendingWhatsAppChatId;

    if (!chatId) {
        // Trường hợp Fallback (Rất chắp vá nếu xài cho nhiều Users)
        chatId = CONFIG.FALLBACK_WHATSAPP_NUMBER; 
    }


    if (!chatId) {
      return res.status(503).json({ error: 'WhatsApp client not ready or no chat found' });
    }

    await whatsappClient.sendMessage(chatId, message);
    console.log(`[Internal API] Sent message to ${chatId}: ${message.replace(/\n/g, ' ')}`);
    res.json({ success: true, to: chatId });
  } catch (error) {
    console.error('[Internal API] Error sending WhatsApp message:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Webhook: Trigger Clash Check ====================
// This endpoint is for manual Excel triggers (via Google Apps Script onEdit)
app.post(CONFIG.API_ROUTES.CHECK_TIMETABLE_CLASHES, async (req, res) => {
  const incomingSheetId = (req && req.body && req.body.sheetId) || null; // Sẽ được truyền qua Apps Script

  console.log(`Got trigger from Excel modification (Sheet: ${incomingSheetId || 'Unknown'}), running clash check...`);
  res.json({ success: true, message: 'Checking sheet for clashes...' });
  
  try {
    if (incomingSheetId) {
      // Tìm số điện thoại của người sở hữu Sheet ID này trong Database
      const targetUser = USERS_DB.find(u => u.sheetId === incomingSheetId);
      
      if (targetUser) {
        await checkTimetableClashes(incomingSheetId, targetUser.phone);
      } else {
        console.error(`[Webhook] No user found configured with Sheet ID: ${incomingSheetId}`);
      }
    } else {
      // Fallback cho hàm cũ
      // Tìm user đầu tiên trong DB để test nếu không có request body
      const firstUser = USERS_DB[0];
      if (firstUser) {
        await checkTimetableClashes(firstUser.sheetId, firstUser.phone);
      }
    }
  } catch (err) {
    console.error('Check triggered error:', err.message);
  }
});



// Health check endpoint
app.get(CONFIG.API_ROUTES.HEALTH_CHECK, (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    whatsapp: whatsappClient.info ? 'connected' : 'disconnected',
    lastProcessedHistoryId
  });
});

// ==================== Start Server ====================
app.listen(CONFIG.SERVER_PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Server running on http://0.0.0.0:${CONFIG.SERVER_PORT}`);
  console.log(`📧 Gmail webhook: POST ${CONFIG.API_ROUTES.GMAIL_WEBHOOK}`);
  console.log(`📊 Excel Trigger (onEdit): POST ${CONFIG.API_ROUTES.CHECK_TIMETABLE_CLASHES}`);
  console.log(`🏥 Health check: GET ${CONFIG.API_ROUTES.HEALTH_CHECK}\n`);
});