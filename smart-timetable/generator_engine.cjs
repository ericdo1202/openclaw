const CONFIG = require('./config.json');

/**
 * GeneratorEngine: Simple Automated Scheduling Algorithm (Greedy Search)
 */
class GeneratorEngine {
    constructor(sheetsClient, validationEngine) {
        this.sheets = sheetsClient;
        this.validator = validationEngine;
        // Ưu tiên xếp tiết vào buổi sáng (Heuristic Optimization)
        this.timeSlots = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];
        this.days = ["T2", "T3", "T4", "T5", "T6"];
    }

    /**
     * GENERATE OPTIMAL TIMETABLE (RUN MULTIPLE ITERATIONS)
     */
    async generateBest(iterations = 10) {
        let bestResult = null;
        let bestScore = -1;

        console.log(`[Engine] Running ${iterations} iterations to find optimal solution...`);

        for (let i = 0; i < iterations; i++) {
            // Lưu dữ liệu gốc để rollback nếu cần (Dùng snapshot tạm thời hoặc clone object)
            // Ở đây generate() trả về dữ liệu mới, ta sẽ chấm điểm trên đó.
            const result = await this.generate(false); // false = không lưu trực tiếp vào Sheet ngay
            const score = this.calculateScore(result.timetable, result.failedCount);

            console.log(`   - Round ${i + 1}: Score = ${score.toFixed(2)} (Failed: ${result.failedCount})`);

            if (score > bestScore) {
                bestScore = score;
                bestResult = result;
            }
        }

        if (bestResult) {
            const header = [["Teacher", "Day", "Start", "End", "Subject", "Class", "Week", "Room"]];
            const finalData = header.concat(bestResult.timetable);
            await this.sheets.updateRange(CONFIG.SHEET_RANGES.TIMETABLE, finalData);
            bestResult.score = bestScore;
        }

        return bestResult;
    }

    /**
     * CALCULATE QUALITY SCORE (SCORING)
     */
    calculateScore(timetable, failedCount) {
        if (!timetable || timetable.length === 0) return 0;

        // 1. Điểm số lượng (Trọng số 100)
        const totalTasks = timetable.length + failedCount;
        const fillRate = timetable.length / totalTasks;
        const volumeScore = fillRate * 100;

        // 2. Điểm cân bằng giáo viên (Trọng số 20)
        const teacherLoads = {};
        timetable.forEach(r => {
            teacherLoads[r[0]] = (teacherLoads[r[0]] || 0) + 1;
        });
        const loads = Object.values(teacherLoads);
        const avg = loads.reduce((a, b) => a + b, 0) / loads.length;
        const variance = loads.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / loads.length;
        const balanceScore = Math.max(0, 20 - Math.sqrt(variance));

        // 3. Điểm quản lý giờ nghỉ/trống (Gap) - Ưu tiên lịch tập trung
        // (Logic đơn giản: Càng ít "ngày bị rời rạc" càng tốt)
        
        return volumeScore + balanceScore;
    }

    /**
     * TẠO LỊCH (CẬP NHẬT ĐỂ HỖ TRỢ CHẾ ĐỘ PREVIEW)
     */
    async generate(shouldSave = true) {
        const deploymentRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.DEPLOYMENT);
        const currentTimetableRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.TIMETABLE);
        const constraintsRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.CONSTRAINTS);
        const roomsRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.ROOMS);
        const recessesRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.RECESS);

        const deployment = deploymentRaw.slice(1);
        const fixedSlots = currentTimetableRaw.slice(1).filter(r => r[0]); 
        const constraints = constraintsRaw.slice(1);
        const rooms = roomsRaw.slice(1).map(r => r[0]);
        const recesses = recessesRaw.slice(1);

        const newTimetable = [...fixedSlots];
        
        let tasks = [];
        deployment.forEach(d => {
            const [className, subject, periods, teacher, groupId, week] = d;
            const count = parseInt(periods) || 0;
            if (teacher && count > 0) {
                for (let i = 0; i < count; i++) {
                    tasks.push({ className, subject, teacher, groupId, week: week || "All" });
                }
            }
        });

        // Xáo trộn ngẫu nhiên để tạo ra các giải pháp khác nhau mỗi lần chạy
        tasks = tasks.sort(() => Math.random() - 0.5);
        tasks = tasks.sort((a, b) => {
            if (a.groupId && !b.groupId) return -1;
            if (!a.groupId && b.groupId) return 1;
            return 0;
        });

        let failedTasks = [];
        const failureReasons = {
            capacity: 0,
            teacher_busy: 0,
            class_busy: 0,
            blocked: 0,
            room_full: 0,
            recess: 0
        };

        const classCounts = {};
        tasks.forEach(t => classCounts[t.className] = (classCounts[t.className] || 0) + 1);
        const maxCapacity = this.days.length * this.timeSlots.length;

        for (const task of tasks) {
            if (classCounts[task.className] > maxCapacity) {
                // Tự động fail nếu vượt quá tổng số slot trong tuần
                // (Chỉ đếm 1 lần cho mỗi task thừa)
            }

            let placed = false;
            const shuffledDays = [...this.days].sort(() => Math.random() - 0.5);
            
            // Theo dõi lý do tại sao không xếp được vào TẤT CẢ các slot
            let reasonsForThisTask = { teacher: 0, class: 0, blocked: 0, recess: 0, room: 0 };

            for (const day of shuffledDays) {
                for (const slot of this.timeSlots) {
                    const start = slot;
                    const end = this.addOneHour(slot);

                    const isRecess = recesses.some(r => {
                        const blockStart = this.validator.timeToMin(r[1]);
                        const blockEnd = this.validator.timeToMin(r[2]);
                        return this.validator.timeToMin(start) < blockEnd && this.validator.timeToMin(end) > blockStart;
                    });
                    if (isRecess) { reasonsForThisTask.recess++; continue; }

                    const teacherBusy = newTimetable.some(r => r[0] === task.teacher && r[1] === day && r[2] === start && this.validator.isWeekClash(task.week, r[6]));
                    const classBusy = newTimetable.some(r => r[5] === task.className && r[1] === day && r[2] === start && this.validator.isWeekClash(task.week, r[6]));

                    const isBlocked = constraints.some(c => 
                        c[0] === task.teacher && c[1] === day && 
                        this.validator.timeToMin(start) < this.validator.timeToMin(c[3]) && 
                        this.validator.timeToMin(end) > this.validator.timeToMin(c[2])
                    );

                    if (teacherBusy) reasonsForThisTask.teacher++;
                    else if (classBusy) reasonsForThisTask.class++;
                    else if (isBlocked) reasonsForThisTask.blocked++;
                    else {
                        const busyRooms = newTimetable
                            .filter(r => r[1] === day && r[2] === start && this.validator.isWeekClash(task.week, r[6]))
                            .map(r => r[7]);
                            
                        const availableRooms = rooms.filter(r => !busyRooms.includes(r));
                        if (availableRooms.length === 0) {
                            reasonsForThisTask.room++;
                            continue;
                        }

                        const assignedRoom = availableRooms[0];
                        newTimetable.push([
                            task.teacher, day, start, end, 
                            task.subject, task.className, task.week, assignedRoom
                        ]);
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }

            if (!placed) {
                failedTasks.push(task);
                // Phân loại lý do chính (thường là do lớp hoặc gv bận nhiều nhất)
                if (classCounts[task.className] > maxCapacity) failureReasons.capacity++;
                else if (reasonsForThisTask.class > reasonsForThisTask.teacher) failureReasons.class_busy++;
                else if (reasonsForThisTask.teacher > reasonsForThisTask.blocked) failureReasons.teacher_busy++;
                else if (reasonsForThisTask.blocked > 0) failureReasons.blocked++;
                else failureReasons.room_full++;
            }
        }

        if (shouldSave && newTimetable.length > 0) {
            const header = [["Teacher", "Day", "Start", "End", "Subject", "Class", "Week", "Room"]];
            const finalData = header.concat(newTimetable);
            await this.sheets.updateRange(CONFIG.SHEET_RANGES.TIMETABLE, finalData);
        }

        return {
            success: failedTasks.length === 0,
            totalPlaced: tasks.length - failedTasks.length,
            failedCount: failedTasks.length,
            timetable: newTimetable,
            failedTasks,
            failureReasons
        };
    }

    addOneHour(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        return `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
}

module.exports = GeneratorEngine;

