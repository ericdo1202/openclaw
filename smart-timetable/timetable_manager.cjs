const { execSync } = require('child_process');
const CONFIG = require('./config.json');

/**
 * Utility to fetch data from Google Sheets via gog CLI
 */
function fetchSheetData(sheetId, range) {
    try {
        if (!sheetId) return { error: "Missing sheetId" };
        const cmd = `gog sheets get "${sheetId}" "${range}" --json`;
        const output = execSync(cmd, { encoding: 'utf8' });
        return JSON.parse(output);
    } catch (error) {
        return { error: error.message };
    }
}

/**
 * Normalize date/time from Sheets
 */
function parseDate(isoString) {
    if (!isoString) return NaN;
    let s = isoString.trim();
    s = s.replace(/:+$/, '');
    if (!s.includes('T') && s.includes(' ')) {
        s = s.replace(/\s+/, 'T');
    }
    if (s.includes('T')) {
        let [datePart, timePart] = s.split('T');
        const dateSegments = datePart.split('-');
        if (dateSegments.length === 3) {
            datePart = dateSegments[0] + '-' +
                dateSegments[1].padStart(2, '0') + '-' +
                dateSegments[2].padStart(2, '0');
        }
        let tzSuffix = '';
        const tzMatch = timePart.match(/([+-]\d{1,2}:\d{2}|Z)$/);
        if (tzMatch) {
            tzSuffix = tzMatch[0];
            timePart = timePart.slice(0, -tzSuffix.length);
        }
        const timeSegments = timePart.split(':');
        const paddedTime = timeSegments.map(seg => seg.padStart(2, '0')).join(':');
        const fullTime = paddedTime.split(':');
        while (fullTime.length < 3) fullTime.push('00');
        s = datePart + 'T' + fullTime.join(':') + tzSuffix;
    }
    const timestamp = new Date(s).getTime();
    return timestamp;
}

/**
 * CHECK TEACHER LOAD
 */
async function validateTeacherLoad(sheetId) {
    const teachersData = fetchSheetData(sheetId, CONFIG.SHEET_RANGES.TEACHERS);
    const timetableData = fetchSheetData(sheetId, CONFIG.SHEET_RANGES.TIMETABLE);

    if (teachersData.error || timetableData.error) return { error: "Sheet data missing or malformed." };

    const teachers = teachersData.values.slice(1);
    const timetable = timetableData.values.slice(1);
    const results = [];

    teachers.forEach(tRow => {
        const name = tRow[0];
        const maxLoad = parseInt(tRow[2]) || 0; // Cột C: Load
        const currentLoad = timetable.filter(entry => entry[0] === name).length;

        if (currentLoad > maxLoad) {
            results.push({
                teacher: name,
                error: `Over-loaded: ${currentLoad}/${maxLoad} slots.`
            });
        }
    });

    return results;
}

/**
 * CHECK BLOCKED SLOTS (Constraints)
 */
async function validateConstraints(sheetId) {
    const constraintsData = fetchSheetData(sheetId, CONFIG.SHEET_RANGES.CONSTRAINTS);
    const timetableData = fetchSheetData(sheetId, CONFIG.SHEET_RANGES.TIMETABLE);

    if (constraintsData.error || timetableData.error) return [];

    const constraints = constraintsData.values.slice(1);
    const timetable = timetableData.values.slice(1);
    const results = [];

    timetable.forEach((entry, idx) => {
        const teacher = entry[0];
        const start = parseDate(entry[1]);
        const end = parseDate(entry[2]);

        constraints.forEach(c => {
            if (c[0] === teacher) {
                const cStart = parseDate(`${entry[1].split('T')[0]}T${c[2]}`); // Cột C: Giờ bắt đầu
                const cEnd = parseDate(`${entry[1].split('T')[0]}T${c[3]}`);   // Cột D: Giờ kết thúc

                if (start < cEnd && end > cStart) {
                    results.push({
                        teacher,
                        row: idx + 2,
                        error: `Blocked slot violation: ${c[2]} - ${c[3]} (${c[4] || 'Other reason'})`
                    });
                }
            }
        });
    });

    return results;
}

/**
 * FIND CLASHES (Legacy support & Enhanced)
 */
function findAllClashes(sheetId) {
    const data = fetchSheetData(sheetId, CONFIG.SHEET_RANGES.TIMETABLE);
    if (data.error || !data.values) return { clusters: [] };

    const rows = data.values.slice(1);
    const teacherMap = {};

    rows.forEach((row, index) => {
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
    for (const teacher in teacherMap) {
        const list = teacherMap[teacher];
        const clashingIndices = new Set();
        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const startA = parseDate(list[i].start);
                const endA = parseDate(list[i].end);
                const startB = parseDate(list[j].start);
                const endB = parseDate(list[j].end);

                if (startA < endB && endA > startB) {
                    clashingIndices.add(i);
                    clashingIndices.add(j);
                }
            }
        }
        if (clashingIndices.size > 0) {
            clusters.push({
                teacher,
                events: Array.from(clashingIndices).map(idx => list[idx])
            });
        }
    }
    return { clusters, headers: data.values[0] };
}

/**
 * COMPREHENSIVE VALIDATION (Main Pre-generation Check)
 */
async function validateAll(sheetId) {
    console.log(`[Smart-Timetable] Starting comprehensive validation for Sheet: ${sheetId}`);
    
    const clashes = findAllClashes(sheetId);
    const loadErrors = await validateTeacherLoad(sheetId);
    const constraintErrors = await validateConstraints(sheetId);

    return {
        success: clashes.clusters.length === 0 && loadErrors.length === 0 && constraintErrors.length === 0,
        clashes: clashes.clusters,
        loadErrors,
        constraintErrors
    };
}

module.exports = {
    initSheetHeaders,
    findAllClashes,
    parseDate
};
