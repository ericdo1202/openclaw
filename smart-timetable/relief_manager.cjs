const { execSync } = require('child_process');
const CONFIG = require('./config.json');

/**
 * ReliefManager: Logic for finding covering teachers (Relief)
 */
class ReliefManager {
    constructor(sheetsClient, validationEngine) {
        this.sheets = sheetsClient;
        this.validator = validationEngine;
        this.gogPath = CONFIG.GOG_PATH || '/opt/homebrew/bin/gog';
    }

    /**
     * FIND RELIEF TEACHER FOR A SPECIFIC DATE
     */
    async planRelief(dateInput, mappingDay = null) {
        // 1. Lấy dữ liệu
        const absenceRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.ABSENCE);
        const timetableRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.TIMETABLE);
        const teachersRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.TEACHERS);
        const constraintsRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.CONSTRAINTS);

        const absences = absenceRaw.slice(1).filter(r => r[0] === dateInput);
        const timetable = timetableRaw.slice(1);
        const teachersList = teachersRaw.slice(1);
        const constraints = constraintsRaw.slice(1);
        const logRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.RELIEF_LOG);
        const reliefLog = logRaw.slice(1);

        // Đếm số lần dạy thay của từng GV
        const reliefCounts = {};
        reliefLog.forEach(row => {
            const teacher = row[3]; // ReliefTeacher ở cột D
            reliefCounts[teacher] = (reliefCounts[teacher] || 0) + 1;
        });

        if (absences.length === 0) return { success: true, message: `No teachers reported absent for ${dateInput}.` };

        const reliefPlan = [];

        // 2. Với mỗi giáo viên vắng mặt
        for (const abs of absences) {
            const absentTeacher = abs[1];
            // NÂNG CẤP: Nếu có mappingDay, lấy lịch dạy của ngày đó thay vì ngày vắng
            const timetableDay = mappingDay || this.getDayOfWeek(dateInput); 
            const missingSlots = timetable.filter(r => 
                String(r[0]).trim() === String(absentTeacher).trim() && 
                String(r[1]).trim() === String(timetableDay).trim()
            );

            for (const slot of missingSlots) {
                const [ , day, start, end, , className] = slot;

                // 3. Tìm GV thay thế "Sạch"
                let candidates = await Promise.all(teachersList.filter(t => t[0] !== absentTeacher).map(async (t) => {
                    const name = t[0];
                    const email = t[5]; // Cột Email (0-indexed 5: Column F)
                    
                    const isBusyClass = timetable.some(r => 
                        String(r[0]).trim() === String(name).trim() && 
                        String(r[1]).trim() === String(day).trim() && 
                        String(r[2]).trim() === String(start).trim()
                    );
                    const isBusyConstraint = constraints.some(c => 
                        String(c[0]).trim() === String(name).trim() && 
                        String(c[1]).trim() === String(day).trim() && 
                        this.validator.timeToMin(start) < this.validator.timeToMin(c[3]) && 
                        this.validator.timeToMin(end) > this.validator.timeToMin(c[2])
                    );

                    if (isBusyClass || isBusyConstraint) return null;

                    // --- NÂNG CẤP: KIỂM TRA GOOGLE CALENDAR (COMPLIANCE) ---
                    const hasCalendarConflict = await this.checkCalendarConflict(email, dateInput, start);
                    if (hasCalendarConflict) {
                        console.log(`[Relief] 📅 Skipping ${name} due to Google Calendar conflict.`);
                        return null;
                    }

                    return { name, count: reliefCounts[name] || 0 };
                }));

                candidates = candidates.filter(c => c !== null);

                // Ưu tiên người ít tiết dạy thay nhất (Priority)
                candidates.sort((a, b) => a.count - b.count);
                const bestCandidate = candidates[0]; 

                reliefPlan.push({
                    date: dateInput,
                    absentTeacher,
                    className,
                    slot: `${day} ${start}-${end}`,
                    reliefTeacher: bestCandidate ? bestCandidate.name : "❌ NO AVAILABLE TEACHER (Conflict)"
                });
            }
        }

        return { success: true, plan: reliefPlan };
    }

    /**
     * Kiểm tra xung đột sự kiện trên Google Calendar
     */
    async checkCalendarConflict(email, dateInput, startTime) {
        if (!email || email === "N/A" || !email.includes('@')) return false;

        try {
            // Giả định dateInput là T2, T3... ta cần chuyển thành ISO DATE thực tế (dùng tạm ngày hôm nay cho logic CLI)
            // Trong thực tế, hệ thống sẽ ánh xạ T2 -> ngày thứ 2 gần nhất
            const dummyISO = new Date().toISOString().split('T')[0];
            const checkTime = `${dummyISO}T${startTime}:00Z`;
            
            // Lệnh gog check conflicts
            const cmd = `${this.gogPath} calendar conflicts --from "${checkTime}" --to "${checkTime}" -a "${email}" --json`;
            const result = JSON.parse(execSync(cmd, { encoding: 'utf-8' }));
            
            // Nếu có event overlapping, result sẽ chứa danh sách
            return Array.isArray(result) && result.length > 0;
        } catch (e) {
            return false;
        }
    }

    /**
     * SAVE RELIEF PLAN TO SHEETS LOG
     */
    async saveReliefPlan(plan) {
        const logData = plan
            .filter(p => !p.reliefTeacher.includes("❌"))
            .map(p => [p.date, p.absentTeacher, p.className, p.reliefTeacher, p.slot]);

        if (logData.length === 0) return;

        const currentLog = await this.sheets.getRange(CONFIG.SHEET_RANGES.RELIEF_LOG);
        const finalLog = currentLog.concat(logData);
        await this.sheets.updateRange(CONFIG.SHEET_RANGES.RELIEF_LOG, finalLog);
    }

    /**
     * BÁO CÁO TỔNG HỢP RELIEF THEO GV / THÁNG
     */
    async generateSummaryReport(period) {
        const logRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.RELIEF_LOG);
        const log = logRaw.slice(1);

        if (log.length === 0) return "ℹ️ No relief records found.";

        // Tổng hợp theo GV
        const byTeacher = {};
        const byMonth = {};

        log.forEach(row => {
            const [date, absent, className, reliefTeacher, slot] = row;
            // Đếm theo GV dạy thay
            if (reliefTeacher) {
                byTeacher[reliefTeacher] = (byTeacher[reliefTeacher] || 0) + 1;
            }
            // Đếm theo tháng (giả sử date format: YYYY-MM-DD hoặc T2, T3...)
            const month = date && date.includes('-') ? date.substring(0, 7) : date;
            if (!byMonth[month]) byMonth[month] = 0;
            byMonth[month]++;
        });

        let report = "📊 *RELIEF SUMMARY REPORT*\n──────────────────\n\n";

        // By Teacher
        report += "*Relief Count by Teacher:*\n";
        const sorted = Object.entries(byTeacher).sort((a, b) => b[1] - a[1]);
        sorted.forEach(([name, count]) => {
            report += `  👤 ${name}: ${count} slots\n`;
        });

        // By Month
        report += "\n*Relief Count by Period:*\n";
        Object.entries(byMonth).forEach(([month, count]) => {
            report += `  📅 ${month}: ${count} slots\n`;
        });

        report += `\n*Total:* ${log.length} relief slots recorded.`;
        return report;
    }

    getDayOfWeek(dateStr) {
        if (!dateStr || dateStr.includes('T')) return dateStr; // Đã là T2, T3...
        
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;

        const day = date.getDay(); // 0 (Sun) to 6 (Sat)
        const mapping = {
            0: "CN",
            1: "T2",
            2: "T3",
            3: "T4",
            4: "T5",
            5: "T6",
            6: "T7"
        };
        return mapping[day];
    }
}

module.exports = ReliefManager;
