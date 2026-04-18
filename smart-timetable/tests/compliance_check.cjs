const HistoryManager = require('../history_manager.cjs');
const ReportEngine = require('../report_engine.cjs');
const ReliefManager = require('../relief_manager.cjs');
const MockSheetsClient = require('./mock_sheets_client.cjs');
const ValidationEngine = require('../validation_engine.cjs');
const CONFIG = require('../config.json');

/**
 * COMPLIANCE MODULES TEST
 */
async function testCompliance() {
    console.log("🧪 Đang kiểm tra các Module Compliance mới...\n");

    const mockData = {
        [CONFIG.SHEET_RANGES.TIMETABLE]: [
            ["Teacher", "Day", "Start", "End", "GroupId", "Class", "Week", "Room"],
            ["GV An", "T2", "08:00", "09:00", "", "10A1", "All", "P101"]
        ],
        [CONFIG.SHEET_RANGES.ROOMS]: [
            ["RoomID", "Type", "Capacity"],
            ["P101", "Lý thuyết", "40"]
        ]
    };

    const sheets = new MockSheetsClient(mockData);
    const validator = new ValidationEngine(sheets);

    // 1. Kiểm tra ReportEngine
    console.log("--- Test ReportEngine ---");
    const reports = new ReportEngine(sheets);
    const workload = await reports.getTeacherWorkload();
    console.log("✅ Workload stats:", workload);
    const utilization = await reports.getRoomUtilization();
    console.log("✅ Room utilization:", utilization['P101'].percent);

    // 2. Kiểm tra ReliefManager (Calendar Integration check)
    console.log("\n--- Test ReliefManager (Calendar Logic) ---");
    const relief = new ReliefManager(sheets, validator);
    // Ta chỉ kiểm tra xem hàm checkCalendarConflict có tồn tại và trả về đúng kiểu không
    const conflictResult = await relief.checkCalendarConflict("test@gmail.com", "T2", "08:00");
    console.log("✅ Calendar check function exists and returned:", conflictResult);

    // 3. Kiểm tra HistoryManager
    console.log("\n--- Test HistoryManager ---");
    const history = new HistoryManager();
    console.log("✅ HistoryManager initialized with folder:", history.historyFolderName);

    console.log("\n🏁 Hoàn tất kiểm tra Module Compliance!");
}

testCompliance().catch(console.error);
