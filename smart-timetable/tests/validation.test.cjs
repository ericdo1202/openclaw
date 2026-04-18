const MockSheetsClient = require('./mock_sheets_client.cjs');
const ValidationEngine = require('../validation_engine.cjs');
const CONFIG = require('../config.json');

/**
 * UNIT TESTS CHO VALIDATION ENGINE
 */
async function testValidation() {
    console.log("🧪 Đang chạy Unit Test cho ValidationEngine...");

    // 1. Dữ liệu giả lập có lỗi TRÙNG LỊCH (Clash)
    const mockData = {
        [CONFIG.SHEET_RANGES.TIMETABLE]: [
            ["Teacher", "Day", "Start", "End", "GroupId", "Class", "Week", "Room"],
            ["GV An", "T2", "08:00", "09:00", "", "10A1", "All", "P101"],
            ["GV An", "T2", "08:30", "09:30", "", "10A2", "All", "P102"] // LỖI: GV An trùng giờ
        ],
        [CONFIG.SHEET_RANGES.TEACHERS]: [["Name", "Phone", "MaxLoad"], ["GV An", "841@c.us", 1]],
        [CONFIG.SHEET_RANGES.CONSTRAINTS]: [["Teacher", "Day", "Start", "End", "Reason"]],
        [CONFIG.SHEET_RANGES.BANDED_GROUPS]: [["GroupId", "Subject", "Teachers", "Classes"]],
        [CONFIG.SHEET_RANGES.ROOMS]: [["ID"], ["P101"], ["P102"]]
    };

    const sheets = new MockSheetsClient(mockData);
    const validator = new ValidationEngine(sheets);

    // CHẠY TEST
    const result = await validator.validateAll();

    // KIỂM TRA KẾT QUẢ
    let passed = true;

    // Test 1: Trùng giờ giáo viên
    if (result.clashes.some(c => c.includes("GV An"))) {
        console.log("✅ PASS: Phát hiện trùng lịch giáo viên.");
    } else {
        console.log("❌ FAIL: Không phát hiện trùng lịch giáo viên.");
        passed = false;
    }

    // Test 2: Quá tải giáo viên (MaxLoad = 1, nhưng có 2 tiết)
    if (result.loadErrors.some(e => e.includes("GV An"))) {
        console.log("✅ PASS: Phát hiện GV quá tải tiết dạy.");
    } else {
        console.log("❌ FAIL: Không phát hiện GV quá tải.");
        passed = false;
    }

    return passed;
}

if (require.main === module) {
    testValidation().then(p => process.exit(p ? 0 : 1));
}

module.exports = testValidation;
