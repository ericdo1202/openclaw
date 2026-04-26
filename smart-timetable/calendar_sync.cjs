const { execSync, execFileSync } = require('child_process');
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
     * Đồng bộ lịch cho toàn bộ GV (Cách 1: Dùng chung một lịch Master)
     */
    async syncAllTeachers() {
        const teachersRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.TEACHERS);
        const timetableRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.TIMETABLE);

        const teachers = teachersRaw.slice(1);
        const timetable = timetableRaw.slice(1);

        let successCount = 0;
        const masterCalendar = CONFIG.MASTER_CALENDAR_ID || 'primary';

        console.log(`[Calendar] 🚀 Bắt đầu đồng bộ vào lịch Master: ${masterCalendar}`);

        for (const teacher of teachers) {
            const [name] = teacher;
            if (!name) continue;

            const teacherSlots = timetable.filter(r => r[0] === name);
            for (const slot of teacherSlots) {
                // Tạo sự kiện trên lịch Master, thêm tên GV vào tiêu đề
                const ok = await this.createEvent(masterCalendar, slot);
                if (ok) successCount++;
            }
        }

        return { successCount, masterCalendar };
    }

    /**
     * Tạo sự kiện trên Google Calendar
     */
    async createEvent(calendarId, slot) {
        const [teacher, day, start, end, subject, className, type, room] = slot;
        
        // Chuyển đổi Thứ sang Ngày cụ thể (Logic tạm thời: Tuần tới)
        const date = this.getNextDate(day);
        
        // Format RFC3339: YYYY-MM-DDTHH:mm:ss+HH:mm
        const formatTime = (timeStr) => {
            let [h, m] = timeStr.split(':');
            return `${h.padStart(2, '0')}:${(m || '00').padStart(2, '0')}:00`;
        };

        const tz = CONFIG.TIMEZONE_OFFSET || '+07:00';
        const startTime = `${date}T${formatTime(start)}${tz}`;
        const endTime = `${date}T${formatTime(end)}${tz}`;

        const summary = `Dạy lớp ${className} - ${room} (GV: ${teacher})`;

        const args = [
            'calendar', 'create', calendarId,
            '--summary', summary,
            '--location', room || 'N/A',
            '--description', `Tiết dạy thời khóa biểu. GV: ${teacher}. Môn: ${subject}. Loại: ${type}`,
            '--from', startTime,
            '--to', endTime,
            '--json'
        ];

        try {
            // Sử dụng execFileSync để tránh lỗi shell escape với các ký tự đặc biệt trong ID (dấu ngoặc, dấu chấm...)
            execFileSync(this.gogPath, args, { encoding: 'utf8' });
            return true;
        } catch (error) {
            console.error(`[Calendar] Lỗi tạo sự kiện cho ${calendarId}:`, error.message);
            if (error.stderr) console.error(`[Calendar] Chi tiết: ${error.stderr}`);
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
