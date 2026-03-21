const { findAllClashes, parseDate } = require('./timetable_manager.cjs');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http'); // Added http module for http.request

const STATE_FILE = path.join(__dirname, 'notified_clashes.json');

function sendWhatsApp(message, alertPhoneNumber, callback) { // Added alertPhoneNumber parameter
    const postData = JSON.stringify({
        message: message,
        targetPhone: alertPhoneNumber || null
    });

    const CONFIG = require('./config.json');
    const options = {
        hostname: '127.0.0.1',
        port: CONFIG.SERVER_PORT,
        path: CONFIG.API_ROUTES.SEND_WHATSAPP,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = http.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
            responseBody += chunk;
        });
        res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                console.log('[Logic] WhatsApp notification sent!');
                if (callback) callback(true);
            } else {
                console.error(`[Logic] Failed to send WhatsApp. Status: ${res.statusCode}, Response: ${responseBody}`);
                if (callback) callback(false);
            }
        });
    });

    req.on('error', (e) => {
        console.error(`[Logic] Failed to send WhatsApp ERROR: ${e.message}`);
        if (callback) callback(false);
    });

    req.write(postData);
    req.end();
}

function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const content = fs.readFileSync(STATE_FILE, 'utf8').trim();
            return content ? JSON.parse(content) : {};
        }
    } catch (e) {}
    return {};
}

function saveState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Export single unified clash check function, receiving sheetId and the target phone number
async function checkTimetableClashes(sheetId, alertPhoneNumber, isManualCheck = false) {
    if (!sheetId) return { error: "Missing sheetId" };
    console.log(`[${new Date().toLocaleTimeString()}] Triggered: Checking Google Sheets for timetable clashes (Sheet: ${sheetId})...`);

    // Pass the sheet ID down to the manager
    const result = await findAllClashes(sheetId); // Added await

    if (result.error) {
        console.error('[Logic] Error reading sheet:', result.error);
        return { error: result.error };
    }

    const state = loadState();
    let teacherSections = [];
    let combinedAllMessages = [];
    let allConflictsSummary = [];

    result.clusters.forEach(cluster => {
        const h = result.headers || ["Teacher", "Start Time", "End Time", "Location", "Event Name"];
        const rowIdentities = cluster.events.map(e => `R${e.rowNum}_${e.start.slice(11,16)}`).join('|');
        const clashKey = `${cluster.teacher}_${rowIdentities}`;
        
        let eventListMsg = "";
        cluster.events.forEach((ev) => {
            const startTimestamp = parseDate(ev.start);
            const endTimestamp = parseDate(ev.end);
            const startDateObj = new Date(startTimestamp);
            
            const startStr = startDateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            const endStr = new Date(endTimestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            const duration = Math.round((endTimestamp - startTimestamp) / (1000 * 60));
            const dateStr = startDateObj.toLocaleDateString('en-US');
            
            eventListMsg += `❌ *Row*: ${ev.rowNum}\n` +
                            `   • *Date*: ${dateStr}\n` +
                            `   • *${h[1]}*: ${startStr} - ${endStr} (${duration} mins)\n` +
                            `   • *Event*: ${ev.name}\n` +
                            `   • *${h[3]}*: ${ev.location}\n\n`;
        });

        // Tìm các cặp trùng nhau để đưa lên phần Summary chung
        for (let i = 0; i < cluster.events.length; i++) {
            for (let j = i + 1; j < cluster.events.length; j++) {
                const a = cluster.events[i];
                const b = cluster.events[j];
                const startA = parseDate(a.start);
                const endA = parseDate(a.end);
                const startB = parseDate(b.start);
                const endB = parseDate(b.end);

                if (startA < endB && endA > startB) {
                    const timeA = new Date(startA).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
                    const timeB = new Date(startB).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
                    const endA_str = new Date(endA).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
                    const endB_str = new Date(endB).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
                    
                    allConflictsSummary.push(`• Event *${a.name}* (Teacher ${cluster.teacher}) ${timeA} to ${endA_str} ↔️ Event *${b.name}* (Teacher ${cluster.teacher}) ${timeB} to ${endB_str}. And vice versa`);
                }
            }
        }

        const teacherSection = `👤 *Teacher*: *${cluster.teacher}*\n` +
                              `📢 *Status*: These ${cluster.events.length} events overlap each other!\n\n` +
                              eventListMsg;
        
        // Luôn thu thập mọi báo cáo để trả về cho Manual Check
        combinedAllMessages.push(teacherSection);

        if (!state[clashKey]) {
            state[clashKey] = {
                detectedAt: new Date().toISOString(),
                rows: cluster.events.map(e => e.rowNum)
            };
            saveState(state);
            
            // Collect section for push notification (Gộp các vụ MỚI)
            teacherSections.push(teacherSection);
            
            if (isManualCheck) {
                console.log(`[Logic] Manual check: Found CLASH for ${clashKey}`);
            } else {
                console.log(`[Logic] Auto check: Found NEW clash for ${clashKey}`);
            }
        } else {
            if (isManualCheck) {
                console.log(`[Logic] Manual check: Already notified/found for ${clashKey}`);
            }
        }
    });

    // --- Xử lý gửi tin nhắn (Gộp chung 1 message duy nhất) ---
    const buildFullMessage = (sections, summaries) => {
        if (!sections || sections.length === 0) return null;
        
        let summaryText = "";
        if (summaries && summaries.length > 0) {
            summaryText = `📍 *Conflict Summary*:\n${summaries.join('\n')}\n\n──────────────────\n\n`;
        }

        return `⚠️ TIMETABLE CLASH DETECTED\n` +
               `──────────────────\n\n` +
               summaryText +
               sections.join('──────────────────\n\n') +
               `──────────────────\n` +
               `👉 Please adjust these overlapping times in Google Sheets!`;
    };

    if (isManualCheck) {
        // Trả về toàn bộ (cũ + mới) cho manual check
        const report = buildFullMessage(combinedAllMessages, allConflictsSummary);
        return { clusters: result.clusters, allMessages: report ? [report] : [] };
    } else {
        // Chỉ gửi Push cho các vụ MỚI (và summary tương ứng)
        const report = buildFullMessage(teacherSections, allConflictsSummary);
        if (report) {
            sendWhatsApp(report, alertPhoneNumber, (success) => {
                if (success) console.log(`[Logic] Unified WhatsApp alert sent for ${teacherSections.length} teachers.`);
            });
        }
        return { clusters: result.clusters, newClashes: report ? [report] : [] };
    }
}

module.exports = {
    checkTimetableClashes,
    sendWhatsApp
};
