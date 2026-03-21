/**
 * parse_event.cjs — Parse event details from message
 *
 * Always returns an ARRAY of events (supports multi-event timetables)
 *
 * Modes:
 *   'mock' — Smart regex parsing (for testing/demo)
 *   'ai'   — Call AI model to analyze (TODO)
 *
 * Usage from JS:   const { parseEventDetails } = require('./parse_event.cjs');
 * Usage from CLI:  node parse_event.cjs "message text"
 *                  → outputs JSON array: [{ title, start, end, description }]
 */

// ==================== CONFIG ====================
const MODE = 'mock'; // Change to 'ai' when ready
const CONFIG = require('./config.json');
const TZ = CONFIG.TIMEZONE_OFFSET;

// ==================== HELPERS ====================
function pad(n) { return String(n).padStart(2, '0'); }

function fmt(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${TZ}`;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Parse Vietnamese day: "Thứ 2" → Monday, "Thứ 3" → Tuesday, etc.
function parseVietnameseDay(text) {
  const match = text.match(/th[ứu]\s*(\d)/i);
  if (match) {
    const num = parseInt(match[1]);
    // Thứ 2 = Monday (1), Thứ 3 = Tuesday (2), ... Thứ 7 = Saturday (6), CN = Sunday (0)
    if (num >= 2 && num <= 7) return num - 1; // JS: Mon=1, Tue=2...Sat=6
  }
  if (/ch[ủu]\s*nh[aậ]t|cn/i.test(text)) return 0; // Sunday
  return null;
}

// Parse date: "23/02/2026" or "23/02"
function parseDateSlash(text) {
  const match = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (match) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const year = match[3] ? parseInt(match[3]) : new Date().getFullYear();
    return new Date(year, month, day);
  }
  return null;
}

// Parse time: "7h", "7h30", "7:00", "8:10", "14h", "2pm"
function parseTime(text) {
  // Vietnamese: "7h", "7h30", "14h00"
  let match = text.match(/(\d{1,2})h(\d{2})?/i);
  if (match) {
    return { hour: parseInt(match[1]), minute: match[2] ? parseInt(match[2]) : 0 };
  }
  // Standard: "7:00", "8:10", "14:30"
  match = text.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return { hour: parseInt(match[1]), minute: parseInt(match[2]) };
  }
  // AM/PM: "3pm", "10am"
  match = text.match(/(\d{1,2})\s*(am|pm)/i);
  if (match) {
    let hour = parseInt(match[1]);
    if (match[2].toLowerCase() === 'pm' && hour < 12) hour += 12;
    if (match[2].toLowerCase() === 'am' && hour === 12) hour = 0;
    return { hour, minute: 0 };
  }
  return null;
}

// Parse time range: "7h-8h", "8:10-9:10", "7h30-8h30", "2pm-3pm"
function parseTimeRange(text) {
  // Match various time range patterns
  const patterns = [
    /(\d{1,2}h\d{0,2})\s*[-–]\s*(\d{1,2}h\d{0,2})/i,       // 7h-8h, 7h30-8h30
    /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/,              // 8:10-9:10
    /(\d{1,2}\s*(?:am|pm))\s*[-–]\s*(\d{1,2}\s*(?:am|pm))/i, // 2pm-3pm
    /(\d{1,2})\s*[-–]\s*(\d{1,2})(?:h|\s*(?:am|pm))/i        // 7-8h
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const start = parseTime(match[1]);
      const end = parseTime(match[2]);
      if (start && end) return { start, end };
    }
  }
  return null;
}

// ==================== MULTI-EVENT PARSER ====================
// Detects timetable format and returns multiple events
function parseMultiEvents(message) {
  const lines = message.split(/\n|\\n|\s*\|\s*/).map(l => l.trim()).filter(l => l.length > 0);
  const events = [];
  let currentDate = null;
  let contextTitle = ''; // e.g. "lớp 10A"

  // Extract context from first line (class name, etc.)
  const firstLine = lines[0] || '';
  const classMatch = firstLine.match(/l[oớ]p\s+\S+/i) || firstLine.match(/class\s+\S+/i);
  if (classMatch) contextTitle = classMatch[0];

  for (const line of lines) {
    // Try to detect date line: "Thứ 2 (23/02/2026):" or "Monday 23/02:"
    const dateFromSlash = parseDateSlash(line);
    const dayFromViet = parseVietnameseDay(line);

    if (dateFromSlash) {
      currentDate = dateFromSlash;
    } else if (dayFromViet !== null && !currentDate) {
      // Calculate next occurrence of this weekday
      const now = new Date();
      const today = now.getDay();
      let diff = dayFromViet - today;
      if (diff < 0) diff += 7;
      currentDate = new Date(now);
      currentDate.setDate(currentDate.getDate() + diff);
    }

    // Try to extract subjects with time ranges from this line
    // Pattern: "Toán 7h-8h", "Lý 8:10-9:10", "Math 7h-8h"
    const subjectTimePattern = /([A-Za-zÀ-ỹ\s]+?)\s+(\d{1,2}[h:]\d{0,2}\s*[-–]\s*\d{1,2}[h:]\d{0,2})/gi;
    let subMatch;
    while ((subMatch = subjectTimePattern.exec(line)) !== null) {
      const subject = subMatch[1].trim().replace(/^[-•]\s*/, '');
      const timeStr = subMatch[2];
      const timeRange = parseTimeRange(timeStr);

      if (timeRange && currentDate) {
        const startDate = new Date(currentDate);
        startDate.setHours(timeRange.start.hour, timeRange.start.minute, 0, 0);
        const endDate = new Date(currentDate);
        endDate.setHours(timeRange.end.hour, timeRange.end.minute, 0, 0);

        const title = contextTitle
          ? `${capitalize(subject)} - ${contextTitle}`
          : capitalize(subject);

        events.push({
          title,
          start: fmt(startDate),
          end: fmt(endDate),
          description: `Created from timetable message`
        });
      }
    }
  }

  return events;
}

// ==================== SINGLE EVENT PARSER ====================
function parseSingleEvent(message) {
  const lower = message.toLowerCase();

  // Clean up title
  let title = message
    .replace(/^(Schedule:|Event from email:|Book:|Reserve:|Meeting:|Tạo lịch:)\s*/i, '')
    .replace(/^(schedule|book|reserve|create|set up|plan)\s+(a\s+|an\s+|the\s+)?/i, '')
    .trim() || 'New Event';
  title = capitalize(title);

  const now = new Date();
  let startDate = new Date(now);
  let startHour = 14, startMinute = 0, durationMin = 60;

  // ---- Parse date ----
  const slashDate = parseDateSlash(message);
  if (slashDate) {
    startDate = slashDate;
  } else if (lower.includes('today')) {
    // keep today
  } else if (lower.includes('tomorrow')) {
    startDate.setDate(startDate.getDate() + 1);
  } else if (lower.includes('next week')) {
    startDate.setDate(startDate.getDate() + 7);
  } else {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < days.length; i++) {
      if (lower.includes(days[i])) {
        const today = startDate.getDay();
        let diff = i - today;
        if (diff <= 0) diff += 7;
        startDate.setDate(startDate.getDate() + diff);
        break;
      }
    }

    // Month name: "march 10", "10 march"
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const monthShort = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const dateMatch = lower.match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec\w*)/i)
      || lower.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec\w*)\s+(\d{1,2})/i);
    if (dateMatch) {
      let day, monthStr;
      if (/^\d/.test(dateMatch[1])) { day = parseInt(dateMatch[1]); monthStr = dateMatch[2].toLowerCase(); }
      else { monthStr = dateMatch[1].toLowerCase(); day = parseInt(dateMatch[2]); }
      let monthIdx = months.findIndex(m => monthStr.startsWith(m.substring(0, 3)));
      if (monthIdx !== -1 && day >= 1 && day <= 31) {
        startDate.setMonth(monthIdx, day);
        if (startDate < now) startDate.setFullYear(startDate.getFullYear() + 1);
      }
    }

    // Default to tomorrow if no date found
    if (startDate.toDateString() === now.toDateString() && !lower.includes('today')) {
      startDate.setDate(startDate.getDate() + 1);
    }
  }

  // ---- Parse time ----
  const timeRange = parseTimeRange(message);
  if (timeRange) {
    startHour = timeRange.start.hour;
    startMinute = timeRange.start.minute;
    const endTotal = timeRange.end.hour * 60 + timeRange.end.minute;
    const startTotal = startHour * 60 + startMinute;
    if (endTotal > startTotal) durationMin = endTotal - startTotal;
  } else {
    const time = parseTime(message);
    if (time) { startHour = time.hour; startMinute = time.minute; }
    else if (lower.includes('morning')) startHour = 9;
    else if (lower.includes('afternoon')) startHour = 14;
    else if (lower.includes('evening')) startHour = 18;
    else if (lower.includes('noon') || lower.includes('lunch')) startHour = 12;
  }

  // ---- Parse duration ----
  const durMatch = lower.match(/(\d+)\s*(hour|hr|h|minute|min|m)\b/i);
  if (durMatch && !timeRange) {
    const val = parseInt(durMatch[1]);
    const unit = durMatch[2].toLowerCase();
    durationMin = unit.startsWith('h') ? val * 60 : val;
  }

  // ---- Build result ----
  startDate.setHours(startHour, startMinute, 0, 0);
  const endDate = new Date(startDate.getTime() + durationMin * 60000);

  return [{
    title,
    start: fmt(startDate),
    end: fmt(endDate),
    description: `Created from message: ${message}`
  }];
}

// ==================== MOCK PARSER (main) ====================
function mockParse(message) {
  // Check if this is a multi-event timetable message
  const hasMultipleTimeRanges = (message.match(/\d{1,2}[h:]\d{0,2}\s*[-–]\s*\d{1,2}/gi) || []).length >= 2;
  const hasDateLines = /th[ứu]\s*\d|monday|tuesday|wednesday|thursday|friday/i.test(message);
  const isMultiLine = message.split(/\n|\\n|\s*\|\s*/).filter(l => l.trim()).length >= 3;

  if ((hasMultipleTimeRanges || (hasDateLines && isMultiLine))) {
    const events = parseMultiEvents(message);
    if (events.length > 0) return events;
  }

  // Fallback to single event parser
  return parseSingleEvent(message);
}

// ==================== AI PARSER (TODO) ====================
async function aiParse(message) {
  // TODO: Integrate with OpenClaw RPC or AI model API
  // const result = await openclaw.rpc({ prompt: `Extract event details...`, message });
  console.error('[parse_event] AI mode not implemented yet, falling back to mock');
  return mockParse(message);
}

// ==================== MAIN ====================
async function parseEventDetails(message) {
  if (MODE === 'ai') return await aiParse(message);
  return mockParse(message);
}

// CLI: node parse_event.cjs "message text"
if (require.main === module) {
  const msg = process.argv[2] || '';
  parseEventDetails(msg).then(result => {
    console.log(JSON.stringify(result, null, 2));
  });
}

module.exports = { parseEventDetails, MODE };
