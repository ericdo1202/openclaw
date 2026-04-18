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
        const adminOnlyCommands = ['check', 'sync', 'generate', 'relief', 'save', 'history', 'stats', 'clone', 'register'];
        if (role === 'TEACHER' && adminOnlyCommands.includes(command)) {
            return `❌ Hello ${teacherName}, the command "${command}" is for Admins only. You can use: schedule, rooms.`;
        }

        const sheets = new SheetsClient(sheetId);
        const validator = new ValidationEngine(sheets);

        // --- XỬ LÝ LỆNH ---
        try {
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
                return report + "👉 Please check your Sheets!";
            }

            if (command === 'sync') {
                const sync = new CalendarSync(sheets);
                await sync.syncAllTeachers();
                return "✅ Google Calendar synchronization completed for all teachers!";
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
                    report += `❌ Failed: ${genResult.failedCount} slots\nReason: No available slots left!\n`;
                } else {
                    report += `🎊 100% Completed with zero errors!`;
                }
                return report;
            }

            if (command === 'clone') {
                const depManager = new DeploymentManager(sheets);
                const [source, target] = (args || "").split(/\s+/);
                if (!source || !target) return "👉 Please enter: clone [Source_Class] [Target_Class]";
                const result = await depManager.cloneClassDeployment(source, target);
                if (result.success) return `✅ Successfully cloned ${result.count} rows from ${source} to ${target}!`;
                return `❌ Error: ${result.error}`;
            }

            if (command === 'relief') {
                const manager = new ReliefManager(sheets, validator);
                const isConfirm = args.includes('confirm');
                const cleanArgs = args.replace('confirm', '').trim();
                const [date, mappingDay] = cleanArgs.split(/\s+/);
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
                    return `✅ Plan saved and notifications sent for ${result.plan.length} slots on ${date}!`;
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
