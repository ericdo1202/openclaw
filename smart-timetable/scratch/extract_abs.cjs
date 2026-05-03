const ExcelJS = require('exceljs');
const path = require('path');

async function extractAbsence() {
    const excelPath = path.join(__dirname, '../sample-data/Smart-Timetable-MegaData.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);

    const absSheet = workbook.getWorksheet('Absence');
    const absences = [];
    if (absSheet) {
        absSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber > 1) {
                absences.push({
                    date: row.getCell(1).text,
                    teacher: row.getCell(2).text
                });
            }
        });
    }
    console.log(JSON.stringify(absences.slice(0, 5), null, 2));
}

extractAbsence().catch(console.error);
