/**
 * check_keyword.js — Shared keyword matcher
 * 
 * Usage from JS:   const { matchesScheduleKeyword } = require('./check_keyword.js');
 * Usage from CLI:  node check_keyword.js "some text to check"
 *                  Exit code 0 = match, 1 = no match
 */

const path = require('path');
const CONFIG = require(path.join(__dirname, 'config.json'));
const KEYWORDS = CONFIG.EMAIL_SCHEDULE_KEYWORDS;

function matchesScheduleKeyword(text) {
  const lower = (text || '').toLowerCase();
  return KEYWORDS.some(kw => lower.includes(kw));
}

// If called from CLI (bash), check argv and exit with code
if (require.main === module) {
  const text = process.argv[2] || '';
  process.exit(matchesScheduleKeyword(text) ? 0 : 1);
}

module.exports = { matchesScheduleKeyword };
