#!/bin/bash

# poll_email_to_calendar.sh - Auto-create calendar events from emails in "Timetable" label
# - Fetches all emails in Timetable label
# - Duplicate-proof: saves Thread IDs already processed
# - Lock file: prevents multiple instances running simultaneously
# - Creates calendar event for every unprocessed email

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Đọc toàn bộ config 1 lần duy nhất từ config.json
eval "$(node -e "
  const c = require('$SCRIPT_DIR/config.json');
  console.log('CONFIG_LABEL=' + JSON.stringify(c.GMAIL_TRIGGER_LABEL));
  console.log('MAX_EMAILS=' + c.GMAIL_MAX_EMAILS_PER_POLL);
  console.log('TZ=' + JSON.stringify(c.TIMEZONE_OFFSET));
  console.log('GMAIL_ACCOUNT=' + JSON.stringify(c.GMAIL_ACCOUNT));
")"
QUERY="label:$CONFIG_LABEL"

# Schedule keyword check — uses shared check_keyword.js (same logic as server.cjs)
matches_schedule_keyword() {
  node "$SCRIPT_DIR/check_keyword.cjs" "$1"
}

LOG_FILE="$HOME/poll_log.txt"
PROCESSED_FILE="$HOME/processed_email_ids.txt"
LOCK_FILE="/tmp/poll_email_to_calendar.lock"

# ==================== Lock file: prevent concurrent runs ====================
cleanup() {
  rm -f "$LOCK_FILE"
}
trap cleanup EXIT

if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
  if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Script already running by PID $LOCK_PID, exiting." | tee -a "$LOG_FILE"
    exit 0
  else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stale lock file found, continuing..." | tee -a "$LOG_FILE"
    rm -f "$LOCK_FILE"
  fi
fi

echo $$ > "$LOCK_FILE"

# ==================== Start processing ====================
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=========================================="
log "Checking emails in Timetable label..."

touch "$PROCESSED_FILE"

# Fetch email list
EMAIL_LIST=$(gog gmail search "$QUERY" --max $MAX_EMAILS --json 2>/dev/null || echo "")

if [ -z "$EMAIL_LIST" ]; then
  log "No results from gog gmail search."
  exit 0
fi

# Validate JSON
if ! echo "$EMAIL_LIST" | jq . >/dev/null 2>&1; then
  log "Error: output is not valid JSON."
  log "Raw output: $EMAIL_LIST"
  exit 1
fi

THREADS=$(echo "$EMAIL_LIST" | jq '.threads // []')
THREAD_COUNT=$(echo "$THREADS" | jq 'length')

if [ "$THREAD_COUNT" -eq 0 ]; then
  log "No emails found in Timetable label."
  exit 0
fi

log "Found $THREAD_COUNT email(s) in Timetable."

# ==================== Process each thread ====================
NEW_EVENTS=0
SKIPPED=0

while read -r thread; do
  THREAD_ID=$(echo "$thread" | jq -r '.id')
  SUBJECT=$(echo "$thread" | jq -r '.subject // "No subject"')
  FROM=$(echo "$thread" | jq -r '.from // "Unknown"')

  # Skip if missing thread ID
  if [ -z "$THREAD_ID" ] || [ "$THREAD_ID" = "null" ]; then
    log "⚠️  Skipping email with no ID: $SUBJECT"
    continue
  fi

  # Duplicate check: skip if ID already processed
  if grep -Fxq "$THREAD_ID" "$PROCESSED_FILE" 2>/dev/null; then
    log "⏭️  Already processed: $SUBJECT (ID: $THREAD_ID)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  log "📧 Processing email: \"$SUBJECT\" from $FROM (ID: $THREAD_ID)"

  # Keyword check — only create event if subject matches schedule keywords
  if ! matches_schedule_keyword "$SUBJECT"; then
    log "ℹ️  Skipping, no schedule keyword in subject: \"$SUBJECT\""
    # Save ID so we don't re-check this email
    echo "$THREAD_ID" >> "$PROCESSED_FILE"
    continue
  fi

  # Parse event details from subject using shared parser (returns array)
  EVENTS_JSON=$(node "$SCRIPT_DIR/parse_event.cjs" "$SUBJECT" 2>/dev/null || echo "")
  if [ -z "$EVENTS_JSON" ]; then
    log "❌ Failed to parse event details from: \"$SUBJECT\""
    echo "$THREAD_ID" >> "$PROCESSED_FILE"
    continue
  fi

  EVENT_COUNT=$(echo "$EVENTS_JSON" | jq 'length')
  log "   Parsed $EVENT_COUNT event(s) from message"

  # Iterate over each event in the array
  for i in $(seq 0 $((EVENT_COUNT - 1))); do
    TITLE=$(echo "$EVENTS_JSON" | jq -r ".[$i].title")
    START=$(echo "$EVENTS_JSON" | jq -r ".[$i].start")
    END=$(echo "$EVENTS_JSON" | jq -r ".[$i].end")

    log "📅 Creating event $((i+1))/$EVENT_COUNT: \"$TITLE\""
    log "   Time: $START → $END"

    OUTPUT=$(gog calendar create primary \
      --summary "$TITLE" \
      --from "$START" \
      --to "$END" \
      --reminder popup:10m \
      --event-color 11 --json 2>&1) || true

    if [ $? -eq 0 ] && [ -n "$OUTPUT" ]; then
      log "✅ Event created successfully: $TITLE"

      # Extract and log Google Calendar link
      EVENT_LINK=$(echo "$OUTPUT" | jq -r '.event.htmlLink // .htmlLink // .link // empty' 2>/dev/null || echo "")
      if [ -n "$EVENT_LINK" ]; then
        log "   🔗 Calendar link: $EVENT_LINK"
      fi
      NEW_EVENTS=$((NEW_EVENTS + 1))
    else
      log "❌ Failed to create event: $OUTPUT"
    fi
  done

  # Mark thread as processed after all events created
  echo "$THREAD_ID" >> "$PROCESSED_FILE"
  log "   Saved Thread ID: $THREAD_ID"
done < <(echo "$THREADS" | jq -c '.[]')

log "Done: $NEW_EVENTS new event(s), $SKIPPED already processed."
log "=========================================="