const { execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);
const CONFIG = require('./config.json');

/**
 * CalendarSync: Đồng bộ thời khóa biểu sang Google Calendar
 */
class CalendarSync {
    constructor(sheetsClient) {
        this.sheets = sheetsClient;
        this.gogPath = CONFIG.GOG_PATH || "gog";
    }

    /**
     * Đồng bộ lịch cho giáo viên
     * @param {string} teacherFilter Tên giáo viên cụ thể (nếu có)
     */
    async syncAllTeachers(teacherFilter = "") {
        const teachersRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.TEACHERS);
        const timetableRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.TIMETABLE);

        let teachers = teachersRaw.slice(1);
        const timetable = timetableRaw.slice(1);

        // Nếu có filter, chỉ lọc giáo viên đó
        if (teacherFilter) {
            const filter = teacherFilter.toLowerCase().trim();
            teachers = teachers.filter(t => String(t[0]).toLowerCase().includes(filter));
            if (teachers.length === 0) {
                return { error: `Không tìm thấy giáo viên nào khớp với "${teacherFilter}"` };
            }
        }

        let successCount = 0;
        const masterCalendar = CONFIG.MASTER_CALENDAR_ID || 'primary';

        console.log(`[Calendar] 🚀 Bắt đầu đồng bộ vào lịch: ${masterCalendar}`);

        for (let i = 0; i < teachers.length; i++) {
            const [name] = teachers[i];
            if (!name || !name.trim()) continue;

            const teacherName = name.trim();
            console.log(`[Calendar] ⏳ (${i + 1}/${teachers.length}) Đang xử lý GV: ${teacherName}...`);
            
            const teacherSlots = timetable.filter(r => String(r[0]).trim() === teacherName);
            console.log(`[Calendar]    - Tìm thấy ${teacherSlots.length} tiết dạy. Đang đẩy lên Google...`);

            // Xử lý song song theo từng đợt (batch) 5 tiết để tối ưu tốc độ và tránh lỗi 403
            const batchSize = 5;
            for (let j = 0; j < teacherSlots.length; j += batchSize) {
                const batch = teacherSlots.slice(j, j + batchSize);
                const results = await Promise.all(batch.map(slot => this.createEvent(masterCalendar, slot)));
                
                successCount += results.filter(ok => ok).length;
                process.stdout.write(`[Calendar]    └─ Tiến độ: ${Math.min(j + batchSize, teacherSlots.length)}/${teacherSlots.length} ✅\n`);
                
                // Nghỉ 2 giây giữa các batch để Google không chặn
                if (j + batchSize < teacherSlots.length) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
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
            await execFilePromise(this.gogPath, args);
            return true;
        } catch (error) {
            console.error(`[Calendar] ❌ Lỗi tại ${calendarId}:`, error.message);
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
