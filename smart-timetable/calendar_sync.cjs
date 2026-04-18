const { execSync } = require('child_process');
const CONFIG = require('./config.json');

/**
 * CalendarSync: Đồng bộ thời khóa biểu sang Google Calendar
 */
class CalendarSync {
    constructor(sheetsClient) {
        this.sheets = sheetsClient;
        this.gogPath = "/opt/homebrew/bin/gog";
    }

    /**
     * Đồng bộ lịch cho toàn bộ GV
     */
    async syncAllTeachers() {
        const teachersRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.TEACHERS);
        const timetableRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.TIMETABLE);

        const teachers = teachersRaw.slice(1);
        const timetable = timetableRaw.slice(1);

        for (const teacher of teachers) {
            const [name, , , , email] = teacher;
            if (!email) continue;

            console.log(`[Calendar] Đang đồng bộ cho: ${name} (${email})...`);
            const teacherSlots = timetable.filter(r => r[0] === name);
            
            for (const slot of teacherSlots) {
                await this.createEvent(email, slot);
            }
        }
    }

    /**
     * Tạo một sự kiện trên Google Calendar
     */
    async createEvent(calendarId, slot) {
        const [teacher, day, start, end, , className, , room] = slot;
        
        // Giả sử ngày hiện tại là mốc để tính T2, T3... cho tuần tới
        const eventDate = this.getNextDate(day);
        const startTime = `${eventDate}T${start}:00+07:00`;
        const endTime = `${eventDate}T${end}:00+07:00`;

        const event = {
            summary: `Dạy lớp ${className} - ${room}`,
            location: room,
            description: `Tiết dạy thời khóa biểu. GV: ${teacher}`,
            start: { dateTime: startTime },
            end: { dateTime: endTime }
        };

        try {
            const jsonStr = JSON.stringify(event);
            const cmd = `${this.gogPath} calendar events create ${calendarId} '${jsonStr}' --json`;
            execSync(cmd);
            return true;
        } catch (error) {
            console.error(`[Calendar] Lỗi tạo sự kiện cho ${calendarId}:`, error.message);
            return false;
        }
    }

    getNextDate(dayStr) {
        const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
        const targetDay = days.indexOf(dayStr);
        if (targetDay === -1) return new Date().toISOString().split('T')[0];

        const now = new Date();
        const currentDay = now.getDay();
        let diff = targetDay - currentDay;
        if (diff <= 0) diff += 7; // Lấy ngày của tuần tới

        const targetDate = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000);
        return targetDate.toISOString().split('T')[0];
    }
}

module.exports = CalendarSync;
