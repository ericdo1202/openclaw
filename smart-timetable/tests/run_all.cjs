const testValidation = require('./validation.test.cjs');
const testRelief = require('./relief.test.cjs');
const testGenerator = require('./generator.test.cjs');
const { runLiveExcelTest } = require('./live_sample_test.cjs');

async function runAllTests() {
    console.log("🚀 KHỞI CHẠY TOÀN BỘ HỆ THỐNG KIỂM THỬ (SMART-TIMETABLE)\n");
    
    let total = 0;
    let passed = 0;

    const run = async (name, fn) => {
        total++;
        try {
            const ok = await fn();
            // Nếu fn không trả về gì (như runLiveExcelTest) thì coi như thành công nếu không catch lỗi
            if (ok !== false) {
                passed++;
                console.log(`[${name}] SUCCESS\n`);
            } else {
                console.log(`[${name}] FAILED\n`);
            }
        } catch (err) {
            console.log(`[${name}] ERROR: ${err.message}\n`);
        }
    };

    // 1. Kiểm tra từng module logic (Unit Tests)
    await run("UNIT: VALIDATION", testValidation);
    await run("UNIT: RELIEF", testRelief);
    await run("UNIT: GENERATOR", testGenerator);

    // 2. Kiểm tra dữ liệu thực từ file Excel (Live Test)
    await run("LIVE: EXCEL DATA", async () => {
        try {
            await runLiveExcelTest();
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    });

    console.log("──────────────────────────────────");
    console.log(`KẾT QUẢ TỔNG HỢP: ${passed}/${total} hạng mục thành công.`);
    
    if (passed < total) {
        console.log("❌ Một số bài test không vượt qua. Vui lòng kiểm tra lại.");
        process.exit(1);
    } else {
        console.log("✅ Hệ thống Đạt Chuẩn và Sẵn sàng Vận hành!");
        process.exit(0);
    }
}

runAllTests();
