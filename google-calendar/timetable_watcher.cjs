const { checkTimetableClashes } = require('./timetable_clash_checker.cjs');

const CONFIG = require('./config.json');
const CHECK_INTERVAL_MS = CONFIG.TIMETABLE_WATCHER_INTERVAL_MS; // 30 seconds

console.log('🚀 Timetable Watcher (Polling Mode) started...');
console.log(`Checking every ${CHECK_INTERVAL_MS / 1000}s...`);

setInterval(checkTimetableClashes, CHECK_INTERVAL_MS);
checkTimetableClashes();
