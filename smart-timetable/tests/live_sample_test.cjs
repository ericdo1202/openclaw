const ExcelJS = require('exceljs');
const path = require('path');
const MockSheetsClient = require('./mock_sheets_client.cjs');
const ValidationEngine = require('../validation_engine.cjs');
const ReliefManager = require('../relief_manager.cjs');
const CONFIG = require('../config.json');

/**
 * LIVE EXCEL TEST: Đọc trực tiếp từ file Excel duy nhất
 */
async function runLiveExcelTest() {
    console.log("🚀 Bắt đầu kiểm tra dữ liệu từ file Smart-Timetable-Sample.xlsx...\n");

    const excelPath = path.join(__dirname, '../sample-data/Smart-Timetable-Sample.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);

    const mockData = {};

    // 1. Tự động ánh xạ dữ liệu từ từng Sheet trong Excel
    // Các key trong CONFIG.SHEET_RANGES tương ứng với tên Sheet (ví dụ: TIMETABLE -> Timetable)
    for (const [key, range] of Object.entries(CONFIG.SHEET_RANGES)) {
        const sheetName = range.split('!')[0]; // Lấy "Timetable" từ "Timetable!A:H"
        const worksheet = workbook.getWorksheet(sheetName);
        
        if (worksheet) {
            const rows = [];
            worksheet.eachRow({ includeEmpty: false }, (row) => {
                // Chuyển đổi từ row object của exceljs thành array đơn giản
                const rowValues = [];
                // Lấy giá trị từng cell (loại bỏ headers đặc biệt nếu cần)
                row.eachCell({ includeEmpty: true }, (cell) => {
                    rowValues.push(cell.text || "");
                });
                rows.push(rowValues);
            });
            mockData[range] = rows;
            console.log(`✅ Đã nạp Sheet: [${sheetName}] (${rows.length - 1} dòng)`);
        }
    }

    const sheets = new MockSheetsClient(mockData);
    const validator = new ValidationEngine(sheets);
    const relief = new ReliefManager(sheets, validator);

    console.log("\n--- KẾT QUẢ KIỂM TRA LOGIC (SỬ DỤNG EXCEL) ---");

    // 2. Chạy Validation
    const validationResult = await validator.validateAll();
    if (validationResult.success) {
        console.log("✅ Dữ liệu Excel: TỔNG THỂ HỢP LỆ.");
    } else {
        console.log("⚠️ Phát hiện lỗi trong file Excel:");
        console.log(JSON.stringify(validationResult, null, 2));
    }

    // 3. Chạy Relief Test
    const reliefResult = await relief.planRelief("T2");
    if (reliefResult.plan && reliefResult.plan.length > 0) {
        console.log(`✅ Relief Test: Tìm thấy ${reliefResult.plan.length} tiết cần dạy thay.`);
        console.log(`👉 GV đề xuất thay: ${reliefResult.plan[0].reliefTeacher}`);
    }

    console.log("\n🏁 Hoàn tất Live Excel Test!");
}

if (require.main === module) {
    runLiveExcelTest().catch(err => console.error("❌ Lỗi khi đọc file Excel:", err.message));
}

module.exports = { runLiveExcelTest };
