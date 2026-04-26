const CONFIG = require('./config.json');

/**
 * ValidationEngine: Logic to verify timetable constraints and consistency
 */
class ValidationEngine {
    constructor(sheetsClient) {
        this.sheets = sheetsClient;
    }

    /**
     * Convert HH:mm to minutes for comparison
     */
    timeToMin(timeStr) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + (m || 0);
    }

    /**
     * Check if two week settings clash
     */
    isWeekClash(week1, week2) {
        const w1 = String(week1 || 'All').trim();
        const w2 = String(week2 || 'All').trim();
        if (w1 === 'All' || w2 === 'All') return true;
        return w1 === w2;
    }

    /**
     * 1. Check for Clashes (Teacher/Class overlaps)
     */
    async checkClashes(timetable) {
        const issues = [];
        const teacherMap = {};

        timetable.forEach((row, idx) => {
            const [teacher, day, start, end, , , week] = row; // Week ở cột G (index 6)
            if (!teacher) return;
            if (!teacherMap[teacher]) teacherMap[teacher] = [];
            
            const curStart = this.timeToMin(start);
            const curEnd = this.timeToMin(end);

            teacherMap[teacher].forEach(prev => {
                if (day === prev.day && this.isWeekClash(week, prev.week)) {
                    if (curStart < prev.end && curEnd > prev.start) {
                        issues.push(`Row ${idx + 2}: Schedule clash for week ${week || 'All'} with row ${prev.rowNum} (Teacher: ${teacher})`);
                    }
                }
            });

            teacherMap[teacher].push({ day, start: curStart, end: curEnd, week, rowNum: idx + 2 });
        });

        return issues;
    }

    /**
     * 2. Check Teacher Load (Maximum slots)
     */
    async checkLoad(teachers, timetable) {
        const issues = [];
        teachers.forEach(tRow => {
            const name = tRow[0];
            const maxLoad = parseInt(tRow[2]) || 0;
            const currentLoad = timetable.filter(r => r[0] === name).length;

            if (currentLoad > maxLoad) {
                issues.push(`Teacher ${name}: Overloaded (${currentLoad}/${maxLoad} slots)`);
            }
        });
        return issues;
    }

    /**
     * 3. Check Blocked Slots (Constraints)
     */
    async checkConstraints(constraints, timetable) {
        const issues = [];
        timetable.forEach((row, idx) => {
            const [teacher, day, start, end] = row;
            const curStart = this.timeToMin(start);
            const curEnd = this.timeToMin(end);

            constraints.forEach(c => {
                if (c[0] === teacher && c[1] === day) {
                    const blockStart = this.timeToMin(c[2]);
                    const blockEnd = this.timeToMin(c[3]);

                    if (curStart < blockEnd && curEnd > blockStart) {
                        issues.push(`Row ${idx + 2}: Teaching in blocked slot (${c[4] || 'N/A'}) - Teacher: ${teacher}`);
                    }
                }
            });
        });
        return issues;
    }

    /**
     * 4. Check Banded Groups
     * Ensures all teachers and classes in a banded group are scheduled together.
     */
    async checkBandedGroups(bands, timetable) {
        const issues = [];
        
        bands.forEach(band => {
            const groupId = band[0];
            const subject = band[1];
            const teachers = band[2] ? band[2].split(',').map(s => s.trim()) : [];
            const classes = band[3] ? band[3].split(',').map(s => s.trim()) : [];

            // Tìm tất cả các slot dạy của nhóm này trong Timetable
            const groupSlots = timetable.filter(r => r[4] === groupId); // Giả sử cột E (index 4) là GroupId

            groupSlots.forEach((slot, sIdx) => {
                const day = slot[1];
                const start = slot[2];
                
                // Check missing classes
                classes.forEach(c => {
                    const hasClass = timetable.some(r => r[5] === c && r[1] === day && r[2] === start); 
                    if (!hasClass) {
                        issues.push(`Group ${groupId}: Missing Class ${c} in slot ${day} ${start}`);
                    }
                });
            });
        });

        return issues;
    }

    /**
     * 5. Check Room Conflicts & Bookings
     */
    async checkRoomConflicts(timetable, bookings = []) {
        const issues = [];
        const roomMap = {};

        // 1. Phân tích TKB
        timetable.forEach((row, idx) => {
            const [, day, start, end, , , , room] = row;
            if (!room || room === 'N/A' || room === '[❌ Hết phòng]') return;

            if (!roomMap[room]) roomMap[room] = [];
            const curStart = this.timeToMin(start);
            const curEnd = this.timeToMin(end);

            roomMap[room].forEach(prev => {
                if (day === prev.day) {
                    if (curStart < prev.end && curEnd > prev.start) {
                        issues.push(`Row ${idx + 2}: Room ${room} conflict with row ${prev.rowNum}`);
                    }
                }
            });
            roomMap[room].push({ day, start: curStart, end: curEnd, rowNum: idx + 2, type: 'Timetable' });
        });

        // 2. Phân tích Bookings (Cấu trúc: Room, Day, Start, End, Desc)
        bookings.forEach((row, idx) => {
            const [room, day, start, end, desc] = row;
            if (!roomMap[room]) roomMap[room] = [];

            const curStart = this.timeToMin(start);
            const curEnd = this.timeToMin(end);

            roomMap[room].forEach(prev => {
                if (day === prev.day) {
                    if (curStart < prev.end && curEnd > prev.start) {
                        issues.push(`⚠️ Room Booking: ${room} on ${day} ${start}-${end} (${desc}) conflicts with ${prev.type === 'Timetable' ? `Timetable row ${prev.rowNum}` : `another booking`}`);
                    }
                }
            });
            roomMap[room].push({ day, start: curStart, end: curEnd, type: 'Booking' });
        });

        return issues;
    }

    /**
     * 6. Check Deployment Logic
     */
    async checkDeploymentLogic(deployment, teachers) {
        const issues = [];
        const deployLoad = {};
        
        deployment.forEach(d => {
            const teacher = d[2];
            const periods = parseInt(d[3]) || 0;
            if (teacher) deployLoad[teacher] = (deployLoad[teacher] || 0) + periods;
        });

        teachers.forEach(t => {
            const name = t[0];
            const max = parseInt(t[3]) || 0; 
            if (deployLoad[name] > max) {
                issues.push(`Teacher ${name}: Over-deployed (${deployLoad[name]}/${max} slots) in Deployment tab.`);
            }
        });

        return issues;
    }

    /**
     * 7. Check Recess Breaks
     */
    async checkRecessConflicts(recesses, timetable) {
        const issues = [];
        timetable.forEach((row, idx) => {
            const [, day, start, end] = row;
            const curStart = this.timeToMin(start);
            const curEnd = this.timeToMin(end);

            recesses.forEach(r => {
                const rStart = r[1]; // Cột B: Bắt đầu
                const rEnd = r[2]; // Cột C: Kết thúc
                const rName = r[0] || "Recess Break";

                const blockStart = this.timeToMin(rStart);
                const blockEnd = this.timeToMin(rEnd);

                if (curStart < blockEnd && curEnd > blockStart) {
                    issues.push(`Row ${idx + 2}: Teaching during recess (${rName}) on ${day}`);
                }
            });
        });
        return issues;
    }
    /**
     * 8. Check Department Whitespace / PLT Slots
     * Ensures teachers in the same department have common whitespace (PLT slots)
     */
    async checkDepartmentWhitespace(departments, timetable) {
        const issues = [];
        // Structure of departments: [DepartmentName, Teachers (comma separated), MinCommonSlots]
        
        departments.forEach(dept => {
            const deptName = dept[0];
            if (!dept[1]) return;
            const teachers = dept[1].split(',').map(s => s.trim());
            const minSlots = parseInt(dept[2]) || 1;

            if (teachers.length < 2) return; // Need at least 2 teachers for common whitespace

            // A simplified check: Find how many common free slots exist for ALL teachers in this department
            const days = ["T2", "T3", "T4", "T5", "T6"];
            const timeSlots = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];
            
            let commonFreeSlots = 0;

            for (const day of days) {
                for (const slot of timeSlots) {
                    // Check if ALL teachers in this dept are free in this slot
                    const allFree = teachers.every(teacher => {
                        return !timetable.some(r => r[0] === teacher && r[1] === day && r[2] === slot);
                    });
                    
                    if (allFree) commonFreeSlots++;
                }
            }

            if (commonFreeSlots < minSlots) {
                issues.push(`Department ${deptName}: Not enough common whitespace (PLT slots). Required: ${minSlots}, Found: ${commonFreeSlots}`);
            }
        });
        
        return issues;
    }

    async validateAll() {
        const timetable = await this.sheets.getRange(CONFIG.SHEET_RANGES.TIMETABLE);
        const teachers = await this.sheets.getRange(CONFIG.SHEET_RANGES.TEACHERS);
        const constraints = await this.sheets.getRange(CONFIG.SHEET_RANGES.CONSTRAINTS);
        const recesses = await this.sheets.getRange(CONFIG.SHEET_RANGES.RECESS);
        const bands = await this.sheets.getRange(CONFIG.SHEET_RANGES.BANDED_GROUPS);
        const bookingsRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.BOOKINGS || "Bookings!A:E");

        // Bỏ header
        const tRows = timetable.slice(1);
        const gRows = teachers.slice(1);
        const cRows = constraints.slice(1);
        const bRows = (bands && bands.length > 0) ? bands.slice(1) : [];
        const rRows = recesses.slice(1);
        const bookingRows = bookingsRaw ? bookingsRaw.slice(1) : [];

        const clashes = await this.checkClashes(tRows);
        const loadErrors = await this.checkLoad(gRows, tRows);
        const constraintErrors = await this.checkConstraints(cRows, tRows);
        const bandErrors = await this.checkBandedGroups(bRows, tRows);
        const roomErrors = await this.checkRoomConflicts(tRows, bookingRows);
        const recessErrors = await this.checkRecessConflicts(rRows, tRows);

        // Nâng cấp: Kiểm tra lỗi logic từ Deployment
        const deploymentRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.DEPLOYMENT);
        const deployIssues = await this.checkDeploymentLogic(deploymentRaw.slice(1), gRows);

        // Kiểm tra PLT Slots / Department Whitespace
        let deptIssues = [];
        try {
            const departmentsRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.DEPARTMENTS);
            if (departmentsRaw && departmentsRaw.length > 1) {
                deptIssues = await this.checkDepartmentWhitespace(departmentsRaw.slice(1), tRows);
            }
        } catch (e) {
            console.log("[Validation] Skipping department check (tab not found or error).");
        }

        return {
            success: 
                clashes.length === 0 && 
                loadErrors.length === 0 && 
                constraintErrors.length === 0 && 
                bandErrors.length === 0 && 
                roomErrors.length === 0 && 
                recessErrors.length === 0 &&
                deployIssues.length === 0 &&
                deptIssues.length === 0,
            clashes,
            loadErrors,
            constraintErrors,
            bandErrors,
            roomErrors,
            recessErrors,
            deployIssues,
            deptIssues
        };
    }
}

module.exports = ValidationEngine;
