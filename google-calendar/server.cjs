const { exec } = require('child_process');
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

// ==================== Config ====================
const MY_EMAIL = 'dovanduoc1204@gmail.com';

// ==================== Schedule Keywords ====================
const { matchesScheduleKeyword } = require('./check_keyword.cjs');

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
const DEBOUNCE_MS = 5000;
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
    const msgBody = msg.body || '';

    console.log(`WhatsApp new message from ${from}: ${msgBody}`);

    // Skip own messages and status broadcasts
    if (msg.fromMe || from === 'status@broadcast') {
      return;
    }

    // Check keyword using shared function
    if (!matchesScheduleKeyword(msgBody)) {
      console.log(`WhatsApp: Ignoring non-schedule message from ${from}`);
      return;
    }

    console.log(`WhatsApp: Schedule keyword matched, sending email...`);

    // Store chat ID for sending calendar link back later
    pendingWhatsAppChatId = msg.from;

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
const MAX_RETRIES = 3;
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

app.post('/gmail-webhook', (req, res) => {
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    whatsapp: whatsappClient.info ? 'connected' : 'disconnected',
    lastProcessedHistoryId
  });
});

// ==================== Start Server ====================
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log('📧 Gmail webhook: POST /gmail-webhook');
  console.log('💬 WhatsApp: waiting for QR scan');
  console.log('🏥 Health check: GET /health\n');
});