const ExcelJS = require('exceljs');
const path = require('path');

async function extractData() {
    const excelPath = path.join(__dirname, '../sample-data/Smart-Timetable-MegaData.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);

    // 1. Teachers
    const teachers = [];
    const teachersSheet = workbook.getWorksheet('Teachers');
    if (teachersSheet) {
        teachersSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber > 1) teachers.push(row.getCell(1).text);
        });
    }

    // 2. Classes (from Deployment)
    const classes = new Set();
    const deploySheet = workbook.getWorksheet('Deployment');
    if (deploySheet) {
        deploySheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber > 1) classes.add(row.getCell(1).text);
        });
    }

    // 3. Timetable sample to find a valid swap
    const timetable = [];
    const ttSheet = workbook.getWorksheet('Timetable');
    if (ttSheet) {
        ttSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber > 1) {
                timetable.push({
                    teacher: row.getCell(1).text,
                    day: row.getCell(2).text,
                    start: row.getCell(3).text,
                    end: row.getCell(4).text,
                    class: row.getCell(6).text // Index 6 is column F for Class
                });
            }
        });
    }

    // 4. Rooms
    const rooms = [];
    const roomsSheet = workbook.getWorksheet('Rooms');
    if (roomsSheet) {
        roomsSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber > 1) rooms.push(row.getCell(1).text);
        });
    }

    // Find a teacher with at least 2 slots for swap example
    const teacherSlots = {};
    timetable.forEach(s => {
        if (!teacherSlots[s.teacher]) teacherSlots[s.teacher] = [];
        teacherSlots[s.teacher].push(s);
    });

    let swapExample = null;
    for (const [teacher, slots] of Object.entries(teacherSlots)) {
        if (slots.length >= 2) {
            swapExample = {
                teacher,
                slot1: { day: slots[0].day, start: slots[0].start },
                slot2: { day: slots[1].day, start: slots[1].start }
            };
            break;
        }
    }

    console.log(JSON.stringify({
        teachers: teachers.slice(0, 5),
        classes: Array.from(classes).slice(0, 5),
        rooms: rooms.slice(0, 5),
        swapExample
    }, null, 2));
}

extractData().catch(console.error);
