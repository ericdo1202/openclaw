const { execSync } = require('child_process');

// Tạm thời để trống. Bạn sẽ dán ID của file Online Sheet vào đây
// Ví dụ: const SHEET_ID = '1234abcd5678efgh...';
const SHEET_ID = process.env.SHEET_ID || '1DwZeCkYZEfFQuJqFGBMCaF-JBxyg3LdIe_1BSo_2Rpo';
const RANGE = 'Sheet1!A:E';

function parseDate(isoString) {
  if (!isoString) return NaN;
  // Sửa lỗi nếu người dùng nhập thiếu số 0 (VD: T5:00:00 -> T05:00:00)
  let processed = isoString;
  if (processed.includes('T')) {
    const [date, time] = processed.split('T');
    if (time && /^\d:/.test(time)) {
      processed = `${date}T0${time}`;
    }
  }
  const timestamp = new Date(processed).getTime();
  if (isNaN(timestamp)) {
    console.warn(`[Manager] Warning: Invalid date format: "${isoString}"`);
  }
  return timestamp;
}

/**
 * Kiểm tra xem giáo viên có kẹt lịch không
 */
function checkClash(teacherName, newStartIso, newEndIso) {
    try {
        if (SHEET_ID === 'PLEASE_ENTER_YOUR_SHEET_ID_HERE') {
            return { error: true, message: "Bạn chưa nhập SHEET_ID vào file timetable_manager.cjs" };
        }

        const cmd = `gog sheets get ${SHEET_ID} "${RANGE}" --json`;
        const output = execSync(cmd, { encoding: 'utf8' });
        const data = JSON.parse(output);
        
        const rows = data.values;
        if (!rows || rows.length <= 1) { 
            return { hasClash: false };
        }

        const dataRows = rows.slice(1);
        const newStart = parseDate(newStartIso);
        const newEnd = parseDate(newEndIso);

        for (const row of dataRows) {
            // Cột: A=Teacher(0), B=Start(1), C=End(2), D=Location(3), E=EventName(4)
            const rowTeacher = row[0];
            const rowStart = row[1]; 
            const rowEnd = row[2];

            if (rowTeacher === teacherName) {
                const oldStart = parseDate(rowStart);
                const oldEnd = parseDate(rowEnd);

                if (newStart < oldEnd && newEnd > oldStart) {
                    return {
                        hasClash: true,
                        conflict: {
                            teacher: rowTeacher,
                            start: rowStart,
                            end: rowEnd,
                            location: row[3] || 'Unknown',
                            eventName: row[4] || 'Unknown'
                        }
                    };
                }
            }
        }
        
        return { hasClash: false };
    } catch (error) {
        return { error: true, message: "Lỗi chạy lệnh gog: " + error.message };
    }
}

/**
 * Thêm một lịch mới vào bảng (Nếu không trùng)
 */
function appendEvent(teacherName, startIso, endIso, location, eventName) {
    try {
        if (SHEET_ID === 'PLEASE_ENTER_YOUR_SHEET_ID_HERE') {
            return { success: false, error: "Bạn chưa nhập SHEET_ID" };
        }

        const rowJson = JSON.stringify([teacherName, startIso, endIso, location, eventName]);
        // Dùng printf để truyền JSON string tránh lỗi quoting bash -> dùng mảng cho dễ
        const cmd = `gog sheets append ${SHEET_ID} "${RANGE}" '${rowJson}' --json`;
        
        const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        return { success: true, result: JSON.parse(output) };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Setup ban đầu: Ghi Header cho bảng nếu bảng trống
 */
function initSheetHeaders() {
    try {
        if (SHEET_ID === 'PLEASE_ENTER_YOUR_SHEET_ID_HERE') {
            return { success: false, error: "Bạn chưa nhập SHEET_ID" };
        }

        const headers = JSON.stringify([["Teacher", "Start Time", "End Time", "Location", "Event Name"]]);
        const cmd = `gog sheets update ${SHEET_ID} "Sheet1!A1:E1" '${headers}' --json`;
        const output = execSync(cmd, { encoding: 'utf8' });
        return { success: true, result: JSON.parse(output) };
    } catch (error) {
        return { success: false, error: error.message + " " + (error.stderr || "") };
    }
}

/**
 * Tìm tất cả các vụ trùng lịch, nhóm theo giáo viên
 */
function findAllClashes() {
    try {
        if (SHEET_ID === 'PLEASE_ENTER_YOUR_SHEET_ID_HERE') return { error: "Missing SHEET_ID" };

        const cmd = `gog sheets get ${SHEET_ID} "${RANGE}" --json`;
        const output = execSync(cmd, { encoding: 'utf8' });
        const data = JSON.parse(output);
        const rows = data.values;
        
        if (!rows || rows.length <= 1) return { clusters: [] };

        const dataRows = rows.slice(1); // Bỏ header
        const teacherMap = {};

        // Phân loại hàng theo giáo viên
        dataRows.forEach((row, index) => {
            const teacher = row[0];
            if (!teacher) return;
            if (!teacherMap[teacher]) teacherMap[teacher] = [];
            teacherMap[teacher].push({
                rowNum: index + 2,
                start: row[1],
                end: row[2],
                location: row[3] || "N/A",
                name: row[4] || "No Name"
            });
        });

        const clusters = [];

        // Duyệt từng giáo viên để tìm các hàng bị chồng lấn
        for (const teacher in teacherMap) {
            const list = teacherMap[teacher];
            const clashingRowIndices = new Set();

            for (let i = 0; i < list.length; i++) {
                for (let j = i + 1; j < list.length; j++) {
                    const a = list[i];
                    const b = list[j];
                    const startA = parseDate(a.start);
                    const endA = parseDate(a.end);
                    const startB = parseDate(b.start);
                    const endB = parseDate(b.end);

                    if (isNaN(startA) || isNaN(endA) || isNaN(startB) || isNaN(endB)) continue;

                    if (startA < endB && endA > startB) {
                        clashingRowIndices.add(i);
                        clashingRowIndices.add(j);
                    }
                }
            }

            if (clashingRowIndices.size > 0) {
                const clashingEvents = Array.from(clashingRowIndices)
                    .map(idx => list[idx])
                    .sort((a, b) => a.rowNum - b.rowNum); // Sắp xếp theo dòng để Key luôn cố định

                clusters.push({
                    teacher,
                    events: clashingEvents
                });
            }
        }
        
        return { clusters, headers: rows[0] };
    } catch (error) {
        return { error: error.message };
    }
}

// Chạy trực tiếp từ Bash (để dễ test)
if (require.main === module) {
    const action = process.argv[2];
    
    if (action === 'check') {
        const [, , , teacher, start, end] = process.argv;
        console.log(JSON.stringify(checkClash(teacher, start, end)));
    } 
    else if (action === 'all-clashes') {
        console.log(JSON.stringify(findAllClashes()));
    }
    else if (action === 'add') {
        const [, , , teacher, start, end, loc, event] = process.argv;
        console.log(JSON.stringify(appendEvent(teacher, start, end, loc, event)));
    }
    else if (action === 'init') {
        console.log(JSON.stringify(initSheetHeaders()));
    }
    else {
        console.log(JSON.stringify({ error: "Sử dụng: node timetable_manager.cjs check|add|init ..." }));
    }
}

module.exports = {
    checkClash,
    appendEvent,
    initSheetHeaders,
    findAllClashes
};
