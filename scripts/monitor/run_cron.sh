#!/bin/bash
# UTA Monitor — Cron wrapper
# Runs every 30 minutes via cron
# Logs to /home/z/my-project/download/monitor/cron.log

export HOME=/home/z/my-project
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/z/.local/bin

# Ensure monitor directory exists
mkdir -p /home/z/my-project/download/monitor

# Run the monitor
exec /usr/bin/python3 /home/z/my-project/scripts/monitor/uta_monitor.py
