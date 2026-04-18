const CONFIG = require('./config.json');

class ReportEngine {
    constructor(sheetsClient) {
        this.sheets = sheetsClient;
    }

    /**
     * Teacher Workload Report
     */
    async getTeacherWorkload() {
        const timetable = await this.sheets.getRange(CONFIG.SHEET_RANGES.TIMETABLE);
        if (!timetable || timetable.length <= 1) return {};

        const stats = {};
        // Bỏ qua header
        for (let i = 1; i < timetable.length; i++) {
            const [teacher, day, start, end] = timetable[i];
            if (!teacher) continue;
            
            if (!stats[teacher]) stats[teacher] = 0;
            // Giả định mỗi dòng là 1 tiết (hoặc tính theo duration nếu cần)
            stats[teacher]++;
        }
        return stats;
    }

    /**
     * Room Utilization Report
     */
    async getRoomUtilization() {
        const timetable = await this.sheets.getRange(CONFIG.SHEET_RANGES.TIMETABLE);
        const rooms = await this.sheets.getRange(CONFIG.SHEET_RANGES.ROOMS);
        
        if (!timetable || !rooms) return {};

        const roomUsage = {};
        const totalRooms = rooms.length - 1;
        
        // Tổng hợp số tiết tại mỗi phòng
        for (let i = 1; i < timetable.length; i++) {
            const room = timetable[i][7]; // Cột Room (0-indexed 7)
            if (!room) continue;
            if (!roomUsage[room]) roomUsage[room] = 0;
            roomUsage[room]++;
        }

        // Giả sử 1 tuần có 5 ngày, mỗi ngày 10 tiết = 50 tiết tối đa
        const maxSlots = 50; 
        const utilization = {};
        
        for(let i=1; i<rooms.length; i++) {
            const roomId = rooms[i][0];
            const usage = roomUsage[roomId] || 0;
            utilization[roomId] = {
                usage,
                percent: ((usage / maxSlots) * 100).toFixed(1) + "%"
            };
        }

        return utilization;
    }

    /**
     * Check for missing periods (vs Deployment)
     */
    async getMissingPeriods() {
        const deploymentRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.DEPLOYMENT);
        const timetableRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.TIMETABLE);
        
        const deployment = deploymentRaw.slice(1);
        const timetable = timetableRaw.slice(1);

        // Tổng số tiết yêu cầu trong Deployment
        const required = {};
        deployment.forEach(d => {
            const cls = d[0];
            const p = parseInt(d[3]) || 0;
            if (cls) required[cls] = (required[cls] || 0) + p;
        });

        // Tổng số tiết đã xếp trong Timetable
        const placed = {};
        timetable.forEach(r => {
            const cls = r[5];
            if (cls) placed[cls] = (placed[cls] || 0) + 1;
        });

        const missing = [];
        Object.keys(required).forEach(cls => {
            const reqCount = required[cls];
            const placedCount = placed[cls] || 0;
            if (placedCount < reqCount) {
                missing.push(`${cls}: Còn thiếu ${reqCount - placedCount} tiết`);
            }
        });
        return missing;
    }

    /**
     * Generate summary text for WhatsApp
     */
    async generateSummaryText() {
        const workload = await this.getTeacherWorkload();
        const rooms = await this.getRoomUtilization();
        const missing = await this.getMissingPeriods();

        let report = "📊 *STATISTICAL SUMMARY REPORT*\n\n";
        
        report += "*1. Teacher Workload:*\n";
        Object.entries(workload).forEach(([name, count]) => {
            report += `👤 ${name}: ${count} slots/week\n`;
        });

        report += "\n*2. Room Utilization:*\n";
        Object.entries(rooms).forEach(([id, data]) => {
            report += `🏠 ${id}: ${data.percent} (${data.usage} slots)\n`;
        });

        if (missing.length > 0) {
            report += "\n*⚠️ WARNING: MISSING PERIODS:*\n";
            missing.forEach(m => report += `• ${m}\n`);
        } else {
            report += "\n✅ All classes have reached required deployment slots.";
        }

        return report;
    }

    /**
     * GENERATE TIMETABLE GRID (MATRIX VIEW)
     */
    async generateGridMatrix(targetName) {
        const timetableRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.TIMETABLE);
        const timetable = timetableRaw.slice(1);
        
        const days = ["T2", "T3", "T4", "T5", "T6"];
        const timeSlots = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];

        // Lọc lịch cho đối tượng (GV hoặc Lớp)
        const filtered = timetable.filter(r => r[0] === targetName || r[5] === targetName);
        if (filtered.length === 0) return null;

        let table = `📅 *TIMETABLE GRID: ${targetName}*\n\n`;
        table += `| Slot | ${days.join(' | ')} |\n`;
        table += `| :--- | ${days.map(() => ':---').join(' | ')} |\n`;

        for (const slot of timeSlots) {
            let row = `| ${slot} |`;
            for (const day of days) {
                const match = filtered.find(r => r[1] === day && r[2] === slot);
                if (match) {
                    const content = (match[0] === targetName) ? match[5] : match[0]; // Nếu xem theo GV thì hiện Lớp, ngược lại hiện GV
                    row += ` ${content} |`;
                } else {
                    row += " - |";
                }
            }
            table += row + "\n";
        }

        return table;
    }
}

module.exports = ReportEngine;
