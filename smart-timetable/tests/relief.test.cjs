const MockSheetsClient = require('./mock_sheets_client.cjs');
const ReliefManager = require('../relief_manager.cjs');
const ValidationEngine = require('../validation_engine.cjs');
const CONFIG = require('../config.json');

async function testRelief() {
    console.log("🧪 Đang chạy Unit Test cho ReliefManager...");

    const mockData = {
        [CONFIG.SHEET_RANGES.ABSENCE]: [
            ["Date", "Teacher", "Session", "Reason"],
            ["T2", "GV Vắng", "Sáng", "Ốm"]
        ],
        [CONFIG.SHEET_RANGES.TIMETABLE]: [
            ["Teacher", "Day", "Start", "End", "GroupId", "Class", "Week", "Room"],
            ["GV Vắng", "T2", "08:00", "09:00", "", "10A1", "All", "P101"],
            ["GV Bận", "T2", "08:00", "09:00", "", "10A2", "All", "P102"]
        ],
        [CONFIG.SHEET_RANGES.TEACHERS]: [
            ["Name", "Phone", "MaxLoad"],
            ["GV Rảnh 1", "phone1", 20],
            ["GV Rảnh 2", "phone2", 20],
            ["GV Bận", "phone3", 20]
        ],
        [CONFIG.SHEET_RANGES.RELIEF_LOG]: [
            ["Date", "Absent", "Class", "Relief", "Slot"],
            ["T1", "X", "10A", "GV Rảnh 1", "08:00"] // GV Rảnh 1 đã dạy thay 1 lần
        ],
        [CONFIG.SHEET_RANGES.CONSTRAINTS]: []
    };

    const sheets = new MockSheetsClient(mockData);
    const validator = new ValidationEngine(sheets);
    const manager = new ReliefManager(sheets, validator);

    // CHẠY TEST
    const result = await manager.planRelief("T2");
    
    let passed = true;

    // Test 1: Không chọn người đang bận
    const reliefTeacher = result.plan[0].reliefTeacher;
    if (reliefTeacher !== "GV Bận") {
        console.log("✅ PASS: Không chọn giáo viên đang có tiết dạy.");
    } else {
        console.log("❌ FAIL: Chọn nhầm giáo viên đang bận.");
        passed = false;
    }

    // Test 2: Ưu tiên người ít dạy thay hơn (GV Rảnh 2 có 0 lần, GV Rảnh 1 có 1 lần)
    if (reliefTeacher === "GV Rảnh 2") {
        console.log("✅ PASS: Ưu tiên giáo viên ít dạy thay hơn (Relief Priority).");
    } else {
        console.log("❌ FAIL: Không ưu tiên đúng người rảnh nhất.");
        passed = false;
    }

    return passed;
}

if (require.main === module) {
    testRelief().then(p => process.exit(p ? 0 : 1));
}

module.exports = testRelief;
