const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function mergeCSVsToExcel() {
    console.log("🚀 Bắt đầu gộp CSV thành file Excel (.xlsx)...");
    const workbook = new ExcelJS.Workbook();
    const sampleDataDir = './sample-data';
    const files = fs.readdirSync(sampleDataDir).filter(f => f.endsWith('.csv'));

    for (const file of files) {
        const sheetName = path.basename(file, '.csv');
        console.log(`--- Đang xử lý Sheet: ${sheetName}`);
        const worksheet = workbook.addWorksheet(sheetName);
        
        const content = fs.readFileSync(path.join(sampleDataDir, file), 'utf-8');
        const lines = content.split('\n').filter(line => line.trim() !== '');
        
        lines.forEach(line => {
            // Xử lý dấu phẩy trong ngoặc kép (nếu có)
            const row = parseCSVLine(line);
            worksheet.addRow(row);
        });

        // Định dạng tiêu đề (Header row)
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };
    }

    const outputPath = 'Smart-Timetable-Sample.xlsx';
    await workbook.xlsx.writeFile(outputPath);
    console.log(`\n✅ THÀNH CÔNG! Đã tạo file: ${outputPath}`);
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

mergeCSVsToExcel().catch(err => {
    console.error("❌ Lỗi khi gộp file:", err.message);
});
