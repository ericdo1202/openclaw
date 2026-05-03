const ExcelJS = require('exceljs');
const path = require('path');

async function debugData() {
    const excelPath = path.join(__dirname, '../sample-data/Smart-Timetable-MegaData.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);

    const ttSheet = workbook.getWorksheet('Timetable');
    const rows = [];
    if (ttSheet) {
        ttSheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
            if (rowNumber <= 20) { // Check first 20 rows
                rows.push(row.values.slice(1)); // 1-indexed
            }
        });
    }

    const absSheet = workbook.getWorksheet('Absence');
    const absRows = [];
    if (absSheet) {
        absSheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
            if (rowNumber <= 10) {
                absRows.push(row.values.slice(1));
            }
        });
    }

    console.log("TIMETABLE ROWS (First 20):");
    console.log(JSON.stringify(rows, null, 2));
    console.log("\nABSENCE ROWS (First 10):");
    console.log(JSON.stringify(absRows, null, 2));
}

debugData().catch(console.error);
