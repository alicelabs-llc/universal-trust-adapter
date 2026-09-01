#!/bin/bash
# UTA Monitor — Background loop runner
# Runs the monitor every 30 minutes in a loop
# 
# Usage:
#   nohup /home/z/my-project/scripts/monitor/run_background.sh &
#   
# Or to run in foreground:
#   /home/z/my-project/scripts/monitor/run_background.sh
#
# To stop:
#   pkill -f "run_background.sh"
#   pkill -f "uta_monitor.py"

LOG_FILE="/home/z/my-project/download/monitor/background.log"
SCRIPT="/home/z/my-project/scripts/monitor/uta_monitor.py"
INTERVAL=1800  # 30 minutes in seconds

mkdir -p /home/z/my-project/download/monitor

echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] UTA Monitor background loop started" >> "$LOG_FILE"
echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Interval: ${INTERVAL}s (30 min)" >> "$LOG_FILE"
echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] PID: $$" >> "$LOG_FILE"
echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Log: $LOG_FILE" >> "$LOG_FILE"
echo "---" >> "$LOG_FILE"

while true; do
    echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Running monitor cycle..." >> "$LOG_FILE"
    
    # Run the monitor (auto-respond enabled)
    /usr/bin/python3 "$SCRIPT" >> "$LOG_FILE" 2>&1
    
    EXIT_CODE=$?
    echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Cycle complete (exit: $EXIT_CODE)" >> "$LOG_FILE"
    echo "---" >> "$LOG_FILE"
    
    # Wait for next cycle
    sleep "$INTERVAL"
done
