const { findAllClashes } = require('./timetable_manager.cjs');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'notified_clashes.json');
const CHECK_INTERVAL_MS = 30000; // 30 giây check 1 lần

// Hàm mượn server.cjs để gửi WhatsApp
function sendWhatsApp(message, callback) {
    // Dùng file tạm để tránh lỗi "SyntaxError" hoặc lỗi escaping shell khi message có dấu ngoặc kép
    const tmpFile = path.join(__dirname, `tmp_msg_${Date.now()}.json`);
    const data = JSON.stringify({ message });
    
    fs.writeFileSync(tmpFile, data);
    
    const cmd = `curl -s -X POST -H "Content-Type: application/json" --data-binary @"${tmpFile}" http://127.0.0.1:3000/send-whatsapp`;
    
    exec(cmd, (err, stdout, stderr) => {
        if (err) {
            console.error('[Watcher] Failed to send WhatsApp notification ERROR:', err.message);
            if (stderr) console.error('[Watcher] curl stderr:', stderr);
            if (callback) callback(false);
        } else {
            console.log('[Watcher] WhatsApp notification sent successfully!');
            if (callback) callback(true);
        }
        // Xóa file tạm sau khi gửi
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    });
}

function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const content = fs.readFileSync(STATE_FILE, 'utf8').trim();
            return content ? JSON.parse(content) : {};
        }
    } catch (e) {
        console.warn('[Watcher] Warning: notified_clashes.json is invalid, resetting to empty.');
    }
    return {};
}

function saveState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function watchSheet() {
    console.log(`[${new Date().toLocaleTimeString()}] Checking Google Sheets for manual clashes...`);
    
    const result = findAllClashes();
    if (result.error) {
        console.error('[Watcher] Error reading sheet:', result.error);
        return;
    }

    const state = loadState();
    let newStateFound = false;

    if (!result.clusters) return;

    result.clusters.forEach(cluster => {
        // Use column headers from Sheet
        const h = result.headers || ["Teacher", "Start Time", "End Time", "Location", "Event Name"];

        // Create Unique Key based on Teacher + Row Numbers + Start Times
        const rowIdentities = cluster.events.map(e => `R${e.rowNum}_${e.start.slice(11,16)}`).join('|');
        const clashKey = `${cluster.teacher}_${rowIdentities}`;
        
        if (!state[clashKey]) {
            let eventListMsg = "";
            cluster.events.forEach((ev, idx) => {
                eventListMsg += `❌ *Row ${ev.rowNum}:*\n` +
                                `   • *${h[4]}*: ${ev.name}\n` +
                                `   • *${h[1]}*: ${new Date(ev.start).toLocaleString('en-US')} - ${new Date(ev.end).toLocaleTimeString('en-US')}\n` +
                                `   • *${h[3]}*: ${ev.location}\n\n`;
            });

            const msg = `⚠️ TIMETABLE CLASH DETECTED\n` +
                        `──────────────────\n` +
                        `👤 *${h[0]}*: *${cluster.teacher}*\n` +
                        `📢 Found *${cluster.events.length} overlapping entries*:\n\n` +
                        eventListMsg +
                        `──────────────────\n` +
                        `👉 Please check and adjust on Google Sheets!`;
            
            // Log to console in English
            console.log(`\n--- NEW CLASH DETECTED ---\n${msg}\n--------------------------\n`);
            
            // Mark as notified immediately
            state[clashKey] = {
                detectedAt: new Date().toISOString(),
                rows: cluster.events.map(e => e.rowNum)
            };
            saveState(state);

            // Send via WhatsApp
            sendWhatsApp(msg, (success) => {
                if (success) {
                    console.log(`[Watcher] WhatsApp notification sent for: ${clashKey}`);
                }
            });
            
            newStateFound = true;
        }
    });
}

// Bắt đầu vòng lặp lắng nghe
console.log('🚀 Timetable Watcher started (Checking every 30s)...');
setInterval(watchSheet, CHECK_INTERVAL_MS);
watchSheet(); // Chạy ngay lập tức lần đầu
