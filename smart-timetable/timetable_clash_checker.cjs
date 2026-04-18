const { validateAll, parseDate } = require('./timetable_manager.cjs');
const fs = require('fs');
const path = require('path');
const http = require('http');

const STATE_FILE = path.join(__dirname, 'notified_issues.json');

function sendWhatsApp(message, alertPhoneNumber, callback) {
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
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                if (callback) callback(true);
            } else {
                console.error(`[WhatsApp] Failed: ${res.statusCode} ${body}`);
                if (callback) callback(false);
            }
        });
    });

    req.on('error', e => {
        console.error(`[WhatsApp] Error: ${e.message}`);
        if (callback) callback(false);
    });

    req.write(postData);
    req.end();
}

function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        }
    } catch (e) {}
    return {};
}

function saveState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Chạy kiểm tra toàn diện và gửi báo cáo qua WhatsApp
 */
async function checkTimetableClashes(sheetId, alertPhoneNumber, isManualCheck = false) {
    if (!sheetId) return { error: "Missing sheetId" };
    console.log(`[Smart-Validation] Chạy kiểm tra cho Sheet: ${sheetId}...`);

    const result = await validateAll(sheetId);
    const state = loadState();
    const now = new Date().toISOString();

    let reportSections = [];
    let newIssuesDetected = false;

    // --- 1. OVERLAPS (CLASHES) ---
    if (result.clashes && result.clashes.length > 0) {
        let clashText = "⚠️ *TRÙNG LỊCH (OVERLAPS)*\n";
        result.clashes.forEach(c => {
            const clashId = `clash_${c.teacher}_${c.events.map(e => e.rowNum).join('_')}`;
            if (!state[clashId] || isManualCheck) {
                newIssuesDetected = true;
                state[clashId] = { detectedAt: now };
                clashText += `👤 GV: *${c.teacher}*\n`;
                c.events.forEach(e => {
                    clashText += `  • Dòng ${e.rowNum}: ${e.name} (${e.start} - ${e.end})\n`;
                });
                clashText += "\n";
            }
        });
        if (newIssuesDetected || isManualCheck) reportSections.push(clashText);
    }

    // --- 2. TEACHER LOAD ---
    if (result.loadErrors && result.loadErrors.length > 0) {
        let loadText = "⚖️ *QUÁ TẢI TIẾT DẠY (LOAD)*\n";
        let hasNewLoad = false;
        result.loadErrors.forEach(e => {
            const loadId = `load_${e.teacher}`;
            if (!state[loadId] || isManualCheck) {
                newIssuesDetected = true;
                hasNewLoad = true;
                state[loadId] = { detectedAt: now };
                loadText += `👤 GV: *${e.teacher}* - ${e.error}\n`;
            }
        });
        if (hasNewLoad || isManualCheck) reportSections.push(loadText);
    }

    // --- 3. CONSTRAINTS (BLOCKED SLOTS) ---
    if (result.constraintErrors && result.constraintErrors.length > 0) {
        let constText = "🚫 *VI PHẠM TIẾT CHẶN (CONSTRAINTS)*\n";
        let hasNewConst = false;
        result.constraintErrors.forEach(e => {
            const constId = `const_${e.teacher}_${e.row}`;
            if (!state[constId] || isManualCheck) {
                newIssuesDetected = true;
                hasNewConst = true;
                state[constId] = { detectedAt: now };
                constText += `👤 GV: *${e.teacher}* (Dòng ${e.row}): ${e.error}\n`;
            }
        });
        if (hasNewConst || isManualCheck) reportSections.push(constText);
    }

    saveState(state);

    if (reportSections.length > 0) {
        const fullMessage = "🎓 *BÁO CÁO KIỂM TRA THỜI KHÓA BIỂU*\n" +
                            "──────────────────\n\n" +
                            reportSections.join("──────────────────\n\n") +
                            "\n👉 Vui lòng điều chỉnh dữ liệu trên Google Sheets!";
        
        if (!isManualCheck && newIssuesDetected) {
            sendWhatsApp(fullMessage, alertPhoneNumber);
        }
        return { success: false, message: fullMessage };
    }

    return { success: true, message: "✅ Không phát hiện lỗi logic nào!" };
}

module.exports = {
    checkTimetableClashes,
    sendWhatsApp
};
