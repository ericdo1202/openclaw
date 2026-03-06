#!/bin/bash

# poll_email_to_calendar.sh - Tự động tạo event từ email trong label "Timetable"
# Lấy: tất cả email trong label Timetable (không cần unread)
# Duplicate-proof: lưu ID email đã xử lý để chỉ tạo event 1 lần
# Chỉ dùng subject để parse (gogcli không lấy body được)

QUERY="label:Timetable"  # lấy tất cả trong label Timetable
MAX_EMAILS=10  # giới hạn để tránh nặng
TZ="+07:00"
LOG_FILE="$HOME/poll_log.txt"
PROCESSED_FILE="$HOME/processed_email_ids.txt"  # file lưu ID đã xử lý

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Bắt đầu kiểm tra email trong label Timetable..." | tee -a "$LOG_FILE"

touch "$PROCESSED_FILE"

EMAIL_LIST=$(gog gmail search "$QUERY" --max $MAX_EMAILS --json 2>/dev/null)

echo "=== EMAIL_LIST RAW OUTPUT ===" | tee -a "$LOG_FILE"
echo "$EMAIL_LIST" | tee -a "$LOG_FILE"
echo "=== END EMAIL_LIST ===" | tee -a "$LOG_FILE"

if [ -z "$EMAIL_LIST" ] || ! echo "$EMAIL_LIST" | jq . >/dev/null 2>&1; then
  echo "Không tìm thấy email hoặc lỗi search." | tee -a "$LOG_FILE"
  exit 0
fi

THREADS=$(echo "$EMAIL_LIST" | jq '.threads // []')

if [ "$(echo "$THREADS" | jq 'length')" -eq 0 ]; then
  echo "Không có email nào trong label Timetable." | tee -a "$LOG_FILE"
  exit 0
fi

echo "$THREADS" | jq -c '.[]' | while read -r thread; do
  THREAD_ID=$(echo "$thread" | jq -r '.id')
  SUBJECT=$(echo "$thread" | jq -r '.subject // "No subject"')
  FROM=$(echo "$thread" | jq -r '.from // "Unknown"')

  # Duplicate-proof: nếu ID đã xử lý thì bỏ qua
  if grep -Fxq "$THREAD_ID" "$PROCESSED_FILE"; then
    echo "Bỏ qua email đã xử lý trước đó: $SUBJECT (ID: $THREAD_ID)" | tee -a "$LOG_FILE"
    continue
  fi

  echo "Xử lý email: $SUBJECT từ $FROM (ID: $THREAD_ID)" | tee -a "$LOG_FILE"

  LOWER_SUBJECT=$(echo "$SUBJECT" | tr '[:upper:]' '[:lower:]')
  if [[ "$LOWER_SUBJECT" =~ "tạo lịch" ]]; then
    TITLE="Lịch từ email: $SUBJECT"
    START="$(date -v +1d '+%Y-%m-%dT14:00:00')$TZ"  # giả lập - nâng cấp sau
    END="$(date -v +1d '+%Y-%m-%dT15:00:00')$TZ"

    OUTPUT=$(gog calendar create primary \
      --summary "$TITLE" \
      --from "$START" \
      --to "$END" \
      --reminder popup:10m \
      --event-color 11 2>&1)

    if [[ $? -eq 0 ]]; then
      echo "Tạo event thành công: $TITLE" | tee -a "$LOG_FILE"
      echo "Output: $OUTPUT" | tee -a "$LOG_FILE"

      # Lưu ID để tránh duplicate lần sau
      echo "$THREAD_ID" >> "$PROCESSED_FILE"
      echo "Đã lưu ID $THREAD_ID vào processed_email_ids.txt" | tee -a "$LOG_FILE"
    else
      echo "Lỗi tạo event: $OUTPUT" | tee -a "$LOG_FILE"
    fi
  else
    echo "Email trong Timetable nhưng không phải yêu cầu tạo lịch." | tee -a "$LOG_FILE"
  fi
done

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Kết thúc kiểm tra." | tee -a "$LOG_FILE"