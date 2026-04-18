const MockSheetsClient = require('./mock_sheets_client.cjs');
const GeneratorEngine = require('../generator_engine.cjs');
const ValidationEngine = require('../validation_engine.cjs');
const CONFIG = require('../config.json');

async function testGenerator() {
    console.log("🧪 Đang chạy Unit Test cho GeneratorEngine...");

    const mockData = {
        [CONFIG.SHEET_RANGES.DEPLOYMENT]: [
            ["Class", "Subject", "Teacher", "Periods", "GroupId"],
            ["10A1", "Toán", "GV An", "1", ""]
        ],
        [CONFIG.SHEET_RANGES.TIMETABLE]: [
            ["Teacher", "Day", "Start", "End", "GroupId", "Class", "Week", "Room"]
        ],
        [CONFIG.SHEET_RANGES.CONSTRAINTS]: [],
        [CONFIG.SHEET_RANGES.ROOMS]: [
            ["ID"], ["P101"], ["P102"]
        ]
    };

    const sheets = new MockSheetsClient(mockData);
    const validator = new ValidationEngine(sheets);
    const generator = new GeneratorEngine(sheets, validator);

    // CHẠY TEST
    const result = await generator.generate();

    let passed = true;

    // Test 1: Có xếp được tiết không?
    if (result.totalPlaced > 0) {
        console.log(`✅ PASS: Đã xếp thành công ${result.totalPlaced} tiết học.`);
    } else {
        console.log("❌ FAIL: Không xếp được tiết học nào.");
        passed = false;
    }

    // Test 2: Có gán phòng tự động không?
    const generatedRow = mockData[CONFIG.SHEET_RANGES.TIMETABLE][1]; // Dòng đầu tiên sau header
    if (generatedRow && generatedRow[7] === "P101") {
        console.log("✅ PASS: Tự động gán phòng học trống (P101).");
    } else {
        console.log("❌ FAIL: Không gán phòng hoặc gán sai phòng.");
        passed = false;
    }

    return passed;
}

if (require.main === module) {
    testGenerator().then(p => process.exit(p ? 0 : 1));
}

module.exports = testGenerator;
