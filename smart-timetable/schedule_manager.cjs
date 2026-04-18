const CONFIG = require('./config.json');

/**
 * ScheduleManager: Individual lookup for Teachers and Classes
 */
class ScheduleManager {
    constructor(sheetsClient) {
        this.sheets = sheetsClient;
    }

    async getSchedule(target) {
        const timetableRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.TIMETABLE);
        const timetable = timetableRaw.slice(1);

        const searchLower = target.toLowerCase();
        
        // Lọc tiết dạy (Cột 0 là Teacher, Cột 5 là Class)
        const slots = timetable.filter(r => 
            (r[0] && r[0].toLowerCase().includes(searchLower)) || 
            (r[5] && r[5].toLowerCase().includes(searchLower))
        );

        if (slots.length === 0) return null;

        // Sắp xếp theo Thứ và Giờ
        const daysOrder = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
        slots.sort((a, b) => {
            const dayA = daysOrder.indexOf(a[1]);
            const dayB = daysOrder.indexOf(b[1]);
            if (dayA !== dayB) return dayA - dayB;
            return a[2].localeCompare(b[2]);
        });

        return slots;
    }

    async getAvailableRooms(day, time) {
        const roomsRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.ROOMS);
        const timetableRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.TIMETABLE);

        const rooms = roomsRaw.slice(1).map(r => r[0]);
        const timetable = timetableRaw.slice(1);

        const busyRooms = timetable
            .filter(r => r[1] === day && this.isTimeOverlapping(time, r[2], r[3]))
            .map(r => r[7]);

        return rooms.filter(r => !busyRooms.includes(r));
    }

    isTimeOverlapping(checkTime, start, end) {
        const check = this.timeToMin(checkTime);
        const s = this.timeToMin(start);
        const e = this.timeToMin(end);
        return check >= s && check < e;
    }

    timeToMin(timeStr) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + (m || 0);
    }

    translateDay(day) {
        const mapping = {
            "T2": "Mon", "T3": "Tue", "T4": "Wed", "T5": "Thu", "T6": "Fri", "T7": "Sat", "CN": "Sun"
        };
        return mapping[day] || day;
    }

    formatSchedules(target, slots) {
        let report = `📅 *TIMETABLE: ${target.toUpperCase()}* \n`;
        report += "──────────────────\n";

        let currentDay = "";
        slots.forEach(s => {
            const [teacher, day, start, end, , className, week, room] = s;
            if (day !== currentDay) {
                const dayLabel = this.translateDay(day);
                report += `\n📍 *${dayLabel}:*\n`;
                currentDay = day;
            }
            report += `• ${start}-${end}: ${teacher} | Class ${className} | ${week || 'All'} | Room ${room || 'N/A'}\n`;
        });

        return report;
    }
}

module.exports = ScheduleManager;
