const SheetsClient = require('./sheets_client.cjs');
const ValidationEngine = require('./validation_engine.cjs');
const GeneratorEngine = require('./generator_engine.cjs');
const ReliefManager = require('./relief_manager.cjs');
const ScheduleManager = require('./schedule_manager.cjs');
const HistoryManager = require('./history_manager.cjs');
const ReportEngine = require('./report_engine.cjs');
const CalendarSync = require('./calendar_sync.cjs');
const WhatsappBot = require('./whatsapp_bot.cjs');
const DeploymentManager = require('./deployment_manager.cjs');
const CONFIG = require('./config.json');
const express = require('express');
const fs = require('fs');
const path = require('path');

async function start() {
    console.log("🚀 Starting Smart-Timetable (Secure Bot Version)...");

    const onCheck = async (phone, command, args) => {
        // 1. Nạp danh sách Admin từ DB
        const dbPath = path.join(__dirname, 'users_db.json');
        const users = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        
        // 2. Kiểm tra log/auth (Chuẩn hóa tuyệt đối: chỉ giữ lại các chữ số để so sánh)
        const normalizedIncoming = phone.replace(/\D/g, "");
        let user = users.find(u => {
            const normalizedDB = u.phone.replace(/\D/g, "");
            // So sánh bao hàm để khớp cả LID và số điện thoại thuần
            return normalizedIncoming.includes(normalizedDB) || normalizedDB.includes(normalizedIncoming);
        });
        let sheetId, role, teacherName;

        if (user) {
            ({ sheetId, role, name: teacherName } = user);
        } else {
            // [NÂNG CẤP] Tự động tìm giáo viên trong các Sheets của Admin
            console.log(`[Auth] Đang kiểm tra danh sách GV từ Sheets cho: ${phone}`);
            const admins = users.filter(u => u.role === 'ADMIN' && u.sheetId);
            
            for (const admin of admins) {
                try {
                    const tempSheets = new SheetsClient(admin.sheetId);
                    const teachersRaw = await tempSheets.getRange(CONFIG.SHEET_RANGES.TEACHERS);
                    const teachers = teachersRaw.slice(1);

                    const match = teachers.find(t => {
                        if (!t[1]) return false;
                        const sheetPhone = String(t[1]).replace(/\D/g, "");
                        const incomingPhone = phone.replace(/\D/g, "");
                        return sheetPhone.length >= 9 && incomingPhone.endsWith(sheetPhone.startsWith('0') ? sheetPhone.substring(1) : sheetPhone);
                    });

                    if (match) {
                        role = 'TEACHER';
                        teacherName = match[0];
                        sheetId = admin.sheetId;
                        console.log(`[Auth] ✅ Teacher recognized: ${teacherName} (from Admin ${admin.name}'s sheet)`);
                        break;
                    }
                } catch (e) { /* Skip errors */ }
            }
        }

        if (!role) {
            console.log(`[Auth] Access Denied: ${phone}`);
            return "❌ Access Denied. You are not authorized to use this system. Please contact the Admin to be added to the teacher list.";
        }

        // Admin-only protection
        const adminOnlyCommands = ['check', 'sync', 'generate', 'relief', 'save', 'history', 'stats', 'clone', 'register', 'params'];
        if (role === 'TEACHER' && adminOnlyCommands.includes(command)) {
            return `❌ Hello ${teacherName}, the command "${command}" is for Admins only. You can use: schedule, rooms, export.`;
        }

        if (command !== 'register' && !sheetId) {
            return "❌ Bạn chưa thiết lập Google Sheet ID. Vui lòng sử dụng lệnh: register [Sheet_ID]";
        }

        const sheets = new SheetsClient(sheetId);
        const validator = new ValidationEngine(sheets);

        // --- XỬ LÝ LỆNH ---
        console.log(`[App] ⚙️ Đang xử lý tính năng: ${command.toUpperCase()} (Args: ${args.substring(0, 50)}${args.length > 50 ? '...' : ''})`);
        try {
            if (command === 'import_media_base64') {
                try {
                    const tempFilePath = path.join(__dirname, `temp_import_${Date.now()}.xlsx`);
                    fs.writeFileSync(tempFilePath, Buffer.from(args, 'base64'));
                    
                    const { execFileSync } = require('child_process');
                    console.log(`[App] ⚙️ Uploading & Converting Excel to Google Sheets...`);
                    
                    const resultRaw = execFileSync('gog', [
                        'drive', 'upload', tempFilePath,
                        '--convert',
                        `--name=Smart Timetable Data (${new Date().toLocaleDateString()})`,
                        '--json'
                    ], { encoding: 'utf8' });
                    
                    const result = JSON.parse(resultRaw);
                    const newSheetId = result.file.id;
                    const webViewLink = result.file.webViewLink;
                    
                    // Cập nhật users_db.json
                    const oldSheetId = sheetId;
                    const adminIndex = users.findIndex(u => {
                        const normalizedDB = u.phone.replace(/\D/g, "");
                        const normalizedIncoming = phone.replace(/\D/g, "");
                        return normalizedIncoming.includes(normalizedDB) || normalizedDB.includes(normalizedIncoming);
                    });
                    
                    if (adminIndex !== -1) {
                        users[adminIndex].sheetId = newSheetId;
                        fs.writeFileSync(dbPath, JSON.stringify(users, null, 2));
                    }
                    
                    // Xóa file tạm
                    fs.unlinkSync(tempFilePath);
                    
                    // Tùy chọn: Xóa file cũ để dọn rác (nếu có)
                    // if (oldSheetId) {
                    //     try { execFileSync('gog', ['drive', 'trash', oldSheetId]); } 
                    //     catch (e) { console.log("[App] ⚠️ Không thể trash file cũ:", e.message); }
                    // }

                    return `✅ *IMPORT HOÀN TẤT!*\n──────────────────\n🎉 Dữ liệu đã được tạo thành file Google Sheets mới toanh!\n\n🔗 *Link Truy Cập:*\n${webViewLink}\n\n👉 Bot đã tự động liên kết hệ thống vào file mới này. Bạn có thể dùng lệnh 'check' để bắt đầu!`;
                } catch (e) {
                    console.error(`[App] ❌ Ngoại lệ khi Import:`, e);
                    return `❌ *LỖI IMPORT*\nVui lòng kiểm tra lại kết nối mạng hoặc phiên đăng nhập Google.`;
                }
            }

            if (command === 'register') {
                const newSheetId = args.trim();
                if (!newSheetId) return "👉 Please provide Sheet ID: register [NEW_ID]";
                
                // Update current user in DB (Using normalization logic)
                const adminIndex = users.findIndex(u => {
                    const normalizedDB = u.phone.replace(/\D/g, "");
                    return normalizedIncoming.includes(normalizedDB) || normalizedDB.includes(normalizedIncoming);
                });

                if (adminIndex !== -1) {
                    users[adminIndex].sheetId = newSheetId;
                    fs.writeFileSync(dbPath, JSON.stringify(users, null, 2));
                }
                return `✅ New Sheet ID registered successfully!\n🆔 ID: ${newSheetId}\nThe system will use this file from now on.`;
            }

            if (command === 'params') {
                let report = "⚙️ *CURRENT CONTROL PARAMETERS*\n──────────────────\n\n";
                const constraintsRaw = await sheets.getRange(CONFIG.SHEET_RANGES.CONSTRAINTS);
                const constraints = constraintsRaw.slice(1);
                report += "*1. Blocked Slots (Constraints):*\n";
                if (constraints.length === 0) report += "  (No blocked slots set)\n";
                constraints.forEach(c => { report += `  • ${c[0]} | ${c[1]} ${c[2]}-${c[3]} | ${c[4] || 'N/A'}\n`; });

                const bandsRaw = await sheets.getRange(CONFIG.SHEET_RANGES.BANDED_GROUPS);
                const bands = bandsRaw.slice(1);
                report += "\n*2. Banded Groups:*\n";
                if (bands.length === 0) report += "  (No banded groups)\n";
                bands.forEach(b => { report += `  • Group ${b[0]}: ${b[1]} | Teachers: ${b[2]} | Classes: ${b[3]}\n`; });

                const recessRaw = await sheets.getRange(CONFIG.SHEET_RANGES.RECESS);
                const recesses = recessRaw.slice(1);
                report += "\n*3. Recess Breaks:*\n";
                if (recesses.length === 0) report += "  (No recess breaks set)\n";
                recesses.forEach(r => { report += `  • ${r[0]}: ${r[1]}-${r[2]} (${r[3] || 'Break'})\n`; });

                return report + "\n👉 Edit these directly in Google Sheets.";
            }

            if (command === 'export') {
                const downloadUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
                return `📥 *EXPORT TO MS EXCEL*\n──────────────────\n\nClick the link below to download:\n\n${downloadUrl}\n\n_Includes all sheets: Timetable, Teachers, Deployment, etc._`;
            }

            if (command === 'check') {
                const result = await validator.validateAll();
                if (result.success) return "✅ Perfect! No timetable conflicts detected.";
                let report = `🎓 *VALIDATION REPORT*\n──────────────────\n`;
                if (result.clashes.length > 0) report += "⚠️ *SCHEDULE CLASHES:*\n" + result.clashes.map(s => `• ${s}`).join('\n') + "\n\n";
                if (result.loadErrors.length > 0) report += "⚖️ *OVERLOAD ERRORS:* \n" + result.loadErrors.map(s => `• ${s}`).join('\n') + "\n\n";
                if (result.constraintErrors.length > 0) report += "🚫 *BLOCKED SLOTS:*\n" + result.constraintErrors.map(s => `• ${s}`).join('\n') + "\n\n";
                if (result.bandErrors.length > 0) report += "🖇️ *BANDED GROUPS:*\n" + result.bandErrors.map(s => `• ${s}`).join('\n') + "\n\n";
                if (result.roomErrors.length > 0) report += "🏠 *ROOM CONFLICTS:*\n" + result.roomErrors.map(s => `• ${s}`).join('\n') + "\n\n";
                if (result.recessErrors && result.recessErrors.length > 0) report += "☕ *RECESS VIOLATIONS:*\n" + result.recessErrors.map(s => `• ${s}`).join('\n') + "\n\n";
                if (result.deployIssues && result.deployIssues.length > 0) report += "🚫 *DEPLOYMENT ISSUES:*\n" + result.deployIssues.map(s => `• ${s}`).join('\n') + "\n\n";
                if (result.deptIssues && result.deptIssues.length > 0) report += "👥 *DEPARTMENT PLT ISSUES:*\n" + result.deptIssues.map(s => `• ${s}`).join('\n') + "\n\n";
                return report + "👉 Please check your Sheets!";
            }

            if (command === 'sync') {
                const sync = new CalendarSync(sheets);
                const summary = await sync.syncAllTeachers();
                
                let report = `✅ Google Calendar synchronization completed!\n──────────────────\n`;
                report += `🔹 Successfully synced: ${summary.successCount} slots\n`;
                report += `📅 *Lịch Master:* ${summary.masterCalendar}\n\n`;
                report += `_Mọi lịch dạy của tất cả GV đã được gộp chung vào một lịch duy nhất để dễ theo dõi._\n\n`;
                report += `📅 *Xem lịch tại đây (Chế độ Tuần):*\nhttps://calendar.google.com/calendar/u/0/r/week`;
                return report;
            }

            if (command === 'import') {
                return `📥 *IMPORT DATA FROM EXCEL*\n──────────────────\n\n_Hãy đính kèm file Excel (.xlsx) hoặc CSV vào tin nhắn này và gửi cho bot._\n\n*Hệ thống sẽ tự động cập nhật dữ liệu!*`;
            }

            if (command === 'swap') {
                const [teacher, day1, time1, day2, time2] = (args || "").split(/\s+/);
                if (!teacher || !day1 || !time1 || !day2 || !time2) {
                    return "🔄 *MANUAL SWAP (Edit)*\n──────────────────\n\n👉 *Cú pháp:* \nswap [Teacher] [Day1] [Time1] [Day2] [Time2]\n\n👉 *Ví dụ:*\n`swap Mr.John T2 08:00 T3 09:00`\n\n_Dùng để hoán đổi 2 tiết dạy của giáo viên._";
                }

                const timetableRaw = await sheets.getRange(CONFIG.SHEET_RANGES.TIMETABLE);
                const timetable = timetableRaw.slice(1);
                
                const slot1Idx = timetable.findIndex(r => r[0] === teacher && r[1] === day1 && r[2] === time1);
                const slot2Idx = timetable.findIndex(r => r[0] === teacher && r[1] === day2 && r[2] === time2);

                if (slot1Idx === -1 && slot2Idx === -1) return `❌ Không tìm thấy lịch dạy nào của ${teacher} ở cả 2 thời điểm.`;

                // Tiến hành đổi chỗ
                let msg = `✅ Đã hoán đổi thành công cho ${teacher}:\n`;
                if (slot1Idx !== -1) {
                    timetable[slot1Idx][1] = day2;
                    timetable[slot1Idx][2] = time2;
                    msg += `• Từ ${day1} ${time1} → ${day2} ${time2}\n`;
                }
                if (slot2Idx !== -1) {
                    timetable[slot2Idx][1] = day1;
                    timetable[slot2Idx][2] = time1;
                    msg += `• Từ ${day2} ${time2} → ${day1} ${time1}\n`;
                }

                // Ghi lại
                await sheets.updateRange(CONFIG.SHEET_RANGES.TIMETABLE, [timetableRaw[0], ...timetable]);
                return msg + "\n👉 Hãy mở Google Sheets, tab 'Timetable' để xem thay đổi và nhớ gõ lệnh *check* để đảm bảo không bị trùng giờ sau khi đổi nhé!";
            }

            if (command === 'pdf') {
                const downloadUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=pdf&portrait=false`;
                return `📄 *EXPORT TO PDF*\n──────────────────\n\nClick the link below to download your printable PDF report:\n\n${downloadUrl}`;
            }

            if (command === 'schedule') {
                const scheduler = new ScheduleManager(sheets);
                const target = (role === 'TEACHER') ? (args || teacherName) : (args || teacherName || "Admin");
                const slots = await scheduler.getSchedule(target);
                if (!slots) return `ℹ️ Could not find schedule for "${target}".`;
                return scheduler.formatSchedules(target, slots);
            }

            if (command === 'rooms') {
                const scheduler = new ScheduleManager(sheets);
                const [day, time] = (args || "").split(/\s+/);
                if (!day || !time) return "👉 Please enter: rooms [Day] [Time] (Example: rooms Mon 09:00)";
                const available = await scheduler.getAvailableRooms(day, time);
                if (available.length === 0) return `❌ No empty rooms found at ${day} ${time}.`;
                return `🏠 *AVAILABLE ROOMS (${day} ${time}):*\n` + available.map(r => `• ${r}`).join('\n');
            }

            if (command === 'generate') {
                const generator = new GeneratorEngine(sheets, validator);
                const isBest = args.includes('best');
                const genResult = isBest ? await generator.generateBest(5) : await generator.generate();
                
                let report = `🤖 *AI GENERATION RESULT ${isBest ? "(OPTIMIZED)" : ""}*\n──────────────────\n`;
                report += `✅ Placed: ${genResult.totalPlaced} slots\n`;
                if (isBest) report += `⭐ Quality Score: ${genResult.score.toFixed(2)}\n`;
                
                if (genResult.failedCount > 0) {
                    report += `❌ Failed: ${genResult.failedCount} slots\n`;
                    report += `*Lý do thất bại:*\n`;
                    const r = genResult.failureReasons;
                    if (r.capacity > 0) {
                        report += `  • Vượt quá 40 tiết/lớp: ${r.capacity} tiết (Lỗi nặng!)\n`;
                        report += `    👉 *Lời khuyên:* Hãy kiểm tra tab 'Deployment', có thể bạn đã clone quá nhiều môn cho cùng một lớp (Tổng số tiết vượt quá dung lượng 1 tuần).\n`;
                    }
                    if (r.class_busy > 0) report += `  • Trùng lịch lớp: ${r.class_busy} tiết\n`;
                    if (r.teacher_busy > 0) report += `  • Trùng lịch GV: ${r.teacher_busy} tiết\n`;
                    if (r.blocked > 0) report += `  • Vướng lịch bận GV: ${r.blocked} tiết\n`;
                    if (r.room_full > 0) report += `  • Hết phòng trống: ${r.room_full} tiết\n`;
                } else {
                    report += `🎊 100% Completed with zero errors!\n`;
                }
                report += `\n👉 Hãy mở Google Sheets, tab 'Timetable' để xem kết quả xếp lịch tự động nhé!`;
                return report;
            }

            if (command === 'clone') {
                const depManager = new DeploymentManager(sheets);
                const [source, target] = (args || "").split(/\s+/);
                if (!source || !target) return "👉 Please enter: clone [Source_Class] [Target_Class]";
                const result = await depManager.cloneClassDeployment(source, target);
                if (result.success) {
                    return `✅ Successfully cloned ${result.count} rows from ${source} to ${target}!\n👉 Hãy mở Google Sheets, tab 'Deployment' để kiểm tra lại dữ liệu của lớp ${target} nhé! (Tránh clone quá nhiều lần gây quá tải tiết dạy)`;
                }
                return `❌ Error: ${result.error}`;
            }

            if (command === 'relief') {
                const manager = new ReliefManager(sheets, validator);
                const isConfirm = args.includes('confirm');
                const isAdvance = args.includes('advance');
                const isReport = args.includes('report');
                const cleanArgs = args.replace('confirm', '').replace('advance', '').replace('report', '').trim();
                const [date, mappingDay] = cleanArgs.split(/\s+/);

                if (isReport) {
                    return await manager.generateSummaryReport(date);
                }

                if (isAdvance && !date) {
                    return `📅 *ADVANCE RELIEF PLANNING*\n──────────────────\n\n_Lên kế hoạch dạy thay cho ngày trong tương lai._\n\n*Cách dùng:*\nrelief advance [Ngày_Vắng] [Ngày_TKB]\n\n*Ví dụ:*\n• \`relief advance T4\` → Lập kế hoạch cho Thứ 4\n• \`relief advance T4 T3\` → Vắng Thứ 4, dùng TKB Thứ 3\n\n👉 Sau khi xem kế hoạch, gõ *relief confirm [Ngày]* để gửi tin báo cho GV.`;
                }

                const targetDay = date || "T2";
                const result = await manager.planRelief(targetDay, mappingDay);
                if (!result.plan || result.plan.length === 0) return result.message || "No relief plan needed.";
                if (isConfirm) {
                    await manager.saveReliefPlan(result.plan);
                    const teachersRaw = await sheets.getRange(CONFIG.SHEET_RANGES.TEACHERS);
                    const teacherMap = {};
                    teachersRaw.slice(1).forEach(t => teacherMap[t[0]] = t[1]);
                    for (const item of result.plan) {
                        const tPhone = teacherMap[item.reliefTeacher];
                        if (tPhone) {
                            const content = `🔔 *RELIEF ASSIGNMENT*\n\nHello Teacher ${item.reliefTeacher},\nYou have been assigned to cover for Teacher ${item.absentTeacher}.\n📍 Class: ${item.className}\n⏱️ Slot: ${item.slot}\n\nRegards!`;
                            await bot.sendMessage(tPhone, content);
                        }
                    }
                    return `✅ Plan saved and notifications sent for ${result.plan.length} slots on ${date}!\n👉 Hãy mở Google Sheets, tab 'ReliefLog' để xem lịch sử dạy thay nhé!`;
                }
                let report = `📋 *RELIEF PLAN (${date})*\n──────────────────\n`;
                result.plan.forEach(p => { report += `🔸 *${p.absentTeacher}* (Class ${p.className})\n   └ Slot: ${p.slot}\n   └ Covering: *${p.reliefTeacher}*\n\n`; });
                return report + "👉 Type *'relief confirm [Date]'* to finalize.";
            }

            if (command === 'save') {
                const history = new HistoryManager();
                const result = await history.createSnapshot(sheetId, args || 'Manual');
                if (result.success) return `✅ Snapshot created successfully: *${result.name}*`;
                return `❌ Error: ${result.error}`;
            }

            if (command === 'history') {
                const history = new HistoryManager();
                const snapshots = await history.listSnapshots();
                if (snapshots.length === 0) return "ℹ️ No snapshots found.";
                let text = "📂 *VERSION HISTORY:*\n\n";
                snapshots.slice(0, 10).forEach(s => { text += `🕒 ${new Date(s.created).toLocaleString()}\n📝 ${s.name}\n🔗 ${s.url}\n\n`; });
                return text;
            }

            if (command === 'stats') {
                const reports = new ReportEngine(sheets);
                return await reports.generateSummaryText();
            }

            if (command === 'matrix') {
                const reports = new ReportEngine(sheets);
                const target = args.trim() || teacherName;
                const table = await reports.generateGridMatrix(target);
                if (!table) return `ℹ️ No schedule found for "${target}" to generate grid.`;
                return table;
            }

            if (command === 'book') {
                const [room, day, start, end, ...rest] = args.trim().split(/\s+/);
                const desc = rest.join(' ') || 'Instant Event';
                if (!room || !day || !start || !end) return "👉 Please enter: book [Room] [Day] [Start] [End] [Description]";
                
                // Conflict check
                const currentBookingsRaw = await sheets.getRange(CONFIG.SHEET_RANGES.BOOKINGS);
                const currentTimetableRaw = await sheets.getRange(CONFIG.SHEET_RANGES.TIMETABLE);
                const errors = await validator.checkRoomConflicts(currentTimetableRaw.slice(1), [...(currentBookingsRaw ? currentBookingsRaw.slice(1) : []), [room, day, start, end, desc]]);
                
                const hasConflict = errors.some(e => e.includes(room) && e.includes(day) && e.includes(start));
                if (hasConflict) return `❌ Booking failed: ${room} is busy at this time!\n${errors.find(e => e.includes(room))}`;

                const newBooking = [room, day, start, end, desc];
                const finalBookings = (currentBookingsRaw || [["Room", "Day", "Start", "End", "Description"]]).concat([newBooking]);
                await sheets.updateRange(CONFIG.SHEET_RANGES.BOOKINGS, finalBookings);
                
                return `✅ Room ${room} booked successfully!\n📅 Date: ${day}\n⏰ Time: ${start} - ${end}\n📝 Note: ${desc}`;
            }

            return `❓ Lệnh *'${command}'* không hợp lệ.\n👉 Gõ *'menu'* để xem danh sách các tính năng khả dụng!`;
        } catch (err) {
            console.error(`[Command Error] Error processing ${command}:`, err.message);
            return `❌ Error: ${err.message}`;
        }
    };

    const bot = new WhatsappBot(onCheck);

    await bot.init();

    // --- WEB DASHBOARD & API ---
    const app = express();
    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));

    // API lấy dữ liệu tổng hợp cho Dashboard
    app.get('/api/data', async (req, res) => {
        try {
            const admin = users.find(u => u.role === 'ADMIN');
            if (!admin || !admin.sheetId) return res.status(403).json({ error: "No Admin Sheet configured" });

            const sheets = new SheetsClient(admin.sheetId);
            const reportEngine = new ReportEngine(sheets);
            const timetableRaw = await sheets.getRange(CONFIG.SHEET_RANGES.TIMETABLE);
            const stats = await reportEngine.getTeacherWorkload();
            const roomUsage = await reportEngine.getRoomUtilization();

            res.json({
                schoolName: "TRƯỜNG SMART-TIMETABLE",
                timetable: timetableRaw,
                stats,
                roomUsage,
                lastUpdated: new Date().toISOString()
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // API: Điều khiển Bot từ xa (Remote Control)
    app.post('/api/command', async (req, res) => {
        const { command, args, phone } = req.body;
        try {
            // Mặc định phản hồi lại số điện thoại yêu cầu hoặc admin
            const targetPhone = phone || (users.find(u => u.role === 'ADMIN') || {}).phone;
            if (!targetPhone) throw new Error("Target phone not specified.");

            console.log(`[Remote] Dashboard gửi lệnh: ${command} (${args || ''}) tới ${targetPhone}`);
            const report = await onCheck(targetPhone, command, args || '');
            
            // Gửi tin nhắn WhatsApp
            await bot.sendMessage(`${targetPhone}@c.us`, report);
            
            res.json({ success: true, report });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.post('/webhook/trigger', async (req, res) => {
        console.log(`[Webhook] Tín hiệu từ Sheet: ${req.body.sheetId}`);
        res.json({ success: true });
    });
    
    app.listen(3001, () => console.log(`📡 Web Dashboard & Webhook đang chạy tại: http://localhost:3001`));
}

start().catch(err => console.error("❌ Lỗi khởi động hệ thống:", err.message));
