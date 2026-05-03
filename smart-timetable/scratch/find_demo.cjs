const ExcelJS = require('exceljs');
const path = require('path');

function getDayOfWeek(dateStr) {
    const date = new Date(dateStr);
    const day = date.getDay();
    const mapping = { 0: "CN", 1: "T2", 2: "T3", 3: "T4", 4: "T5", 5: "T6", 6: "T7" };
    return mapping[day];
}

async function findPerfectDemo() {
    const excelPath = path.join(__dirname, '../sample-data/Smart-Timetable-MegaData.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);

    const absSheet = workbook.getWorksheet('Absence');
    const ttSheet = workbook.getWorksheet('Timetable');

    const timetable = [];
    ttSheet.eachRow((row, i) => {
        if (i > 1) timetable.push({ teacher: row.getCell(1).text, day: row.getCell(2).text, start: row.getCell(3).text });
    });

    const absences = [];
    absSheet.eachRow((row, i) => {
        if (i > 1) absences.push({ date: row.getCell(1).text, teacher: row.getCell(2).text });
    });

    for (const abs of absences) {
        const day = getDayOfWeek(abs.date);
        const match = timetable.find(t => t.teacher === abs.teacher && t.day === day);
        if (match) {
            console.log(`FOUND PERFECT RELIEF DEMO:`);
            console.log(`Teacher: ${abs.teacher}`);
            console.log(`Date: ${abs.date} (which is ${day})`);
            console.log(`Slot: ${match.day} ${match.start}`);
            return;
        }
    }
    console.log("No perfect match found. Searching for any teacher with 2 slots for SWAP...");
    // ...
}

findPerfectDemo().catch(console.error);
