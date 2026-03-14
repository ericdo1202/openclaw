#!/bin/bash
# test_timetable_flow.sh

# Timetable Class Checking + Recording Mock Flow
# -----------------------------------------------

# 1. Mock Event Parameters
TEACHER="Duoc"
START="2026-03-24T08:00:00+07:00"
END="2026-03-24T09:00:00+07:00"
LOCATION="Math Class - Mock"
EVENT_NAME="Algebra Basics"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo "🔴 1. Mock Event Info:"
echo "   ▶ Teacher: $TEACHER"
echo "   ▶ Event: $EVENT_NAME"
echo "   ▶ Time: $START -> $END"
echo "=========================================="

echo "🔵 2. Initializing Timetable Headers..."
INIT_RESULT=$(node "$SCRIPT_DIR/timetable_manager.cjs" init 2>/dev/null)
echo "   [Init Result]: $INIT_RESULT"

echo "=========================================="

echo "🟡 3. Checking for Clashes..."
CLASH_RESULT=$(node "$SCRIPT_DIR/timetable_manager.cjs" check "$TEACHER" "$START" "$END" 2>/dev/null)
echo "   [Response JSON]: $CLASH_RESULT"

# Check if SHEET_ID is missing
if [[ $CLASH_RESULT == *"Bạn chưa nhập SHEET_ID"* ]]; then
    echo "🚨 Error: Please open timetable_manager.cjs and add your SHEET_ID."
    exit 1
fi

# Check for clash in JSON
HAS_CLASH=$(echo "$CLASH_RESULT" | grep -o '"hasClash":true')

if [ ! -z "$HAS_CLASH" ]; then
    echo "=========================================="
    echo "❌ CLASH DETECTED!"
    
    # Send alert via WhatsApp API (server.cjs)
    MSG="⚠️ ALERT: Teacher $TEACHER has a timetable clash at $START. Please check the Timetable!"
    
    # Use temporary file to avoid JSON escaping issues
    TMP_DATA=$(mktemp)
    echo "{\"message\": \"$MSG\"}" > "$TMP_DATA"
    
    curl -s -X POST -H "Content-Type: application/json" -d @"$TMP_DATA" http://localhost:3000/send-whatsapp > /dev/null
    rm "$TMP_DATA"
    
    echo "📢 WhatsApp alert sent to Admin."
    echo "=========================================="
    exit 1
else
    echo "=========================================="
    echo "✅ No clashes found."
    echo "🟢 4. Adding new event to Online Timetable..."
    ADD_RESULT=$(node "$SCRIPT_DIR/timetable_manager.cjs" add "$TEACHER" "$START" "$END" "$LOCATION" "$EVENT_NAME" 2>/dev/null)
    echo "   [Add Result]: $ADD_RESULT"
    
    if echo "$ADD_RESULT" | grep -q '"success":true'; then
        echo "✅ Entry saved successfully!"
    else
        echo "❌ Failed to save entry."
        exit 1
    fi
    echo "=========================================="
fi
