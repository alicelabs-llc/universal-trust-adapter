#!/bin/bash
# ============================================================
# UTA Verify Bot — Oracle Cloud Free Tier Deployment Script
# ============================================================
# Run this ON the Oracle Cloud VM after SSH-ing in.
# 
# Prerequisites:
#   1. Create Oracle Cloud account (free): https://cloud.oracle.com
#   2. Create Always Free VM (Ubuntu 22.04, AMD shape VM.Standard.E2.1.Micro)
#   3. Open port 443 in security list (for webhook) or just use polling
#   4. SSH into VM
#   5. Run: bash deploy_oracle.sh
# ============================================================

set -e

BOT_TOKEN="8724927280:AAGbG4EaDuMjTBd0tRcNM-vCue9XfUzWEA4"
REPO_URL="https://github.com/alicelabs-llc/universal-trust-adapter"
INSTALL_DIR="/opt/uta-bot"

echo "=== UTA Bot — Oracle Cloud Deployment ==="
echo ""

# 1. Install Python and dependencies
echo "[1/6] Installing Python..."
sudo apt-get update -qq
sudo apt-get install -y -qq python3 python3-pip git > /dev/null

# 2. Create directory
echo "[2/6] Creating install directory..."
sudo mkdir -p "$INSTALL_DIR"
sudo chown $USER:$USER "$INSTALL_DIR"

# 3. Clone repo (or just download the bot script)
echo "[3/6] Downloading bot script..."
if [ ! -f "$INSTALL_DIR/uta_verify_bot.py" ]; then
    # Download just the bot script from GitHub raw
    curl -sL "https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/scripts/telegram/uta_verify_bot.py" \
        -o "$INSTALL_DIR/uta_verify_bot.py"
    echo "   Downloaded uta_verify_bot.py"
fi

# 4. Create environment file
echo "[4/6] Creating environment file..."
cat > "$INSTALL_DIR/.env" << EOF
UTA_BOT_TOKEN=$BOT_TOKEN
UTA_API_URL=https://www.marketnow.site/api/trust
EOF
chmod 600 "$INSTALL_DIR/.env"

# 5. Create systemd service (auto-restart on crash)
echo "[5/6] Creating systemd service..."
sudo tee /etc/systemd/system/uta-bot.service > /dev/null << EOF
[Unit]
Description=UTA Verify Bot
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=/usr/bin/python3 $INSTALL_DIR/uta_verify_bot.py
Restart=always
RestartSec=5
StandardOutput=append:/var/log/uta-bot.log
StandardError=append:/var/log/uta-bot.log

[Install]
WantedBy=multi-user.target
EOF

sudo touch /var/log/uta-bot.log
sudo chown $USER:$USER /var/log/uta-bot.log

# 6. Enable and start
echo "[6/6] Starting bot..."
sudo systemctl daemon-reload
sudo systemctl enable uta-bot
sudo systemctl start uta-bot

sleep 3

echo ""
echo "=== STATUS ==="
sudo systemctl status uta-bot --no-pager | head -15
echo ""

echo "=== LOG ==="
tail -10 /var/log/uta-bot.log 2>/dev/null
echo ""

echo "=== DEPLOYMENT COMPLETE ==="
echo ""
echo "Bot: @uta_verify_bot"
echo "Status: $(sudo systemctl is-active uta-bot)"
echo "Logs: tail -f /var/log/uta-bot.log"
echo "Restart: sudo systemctl restart uta-bot"
echo "Stop: sudo systemctl stop uta-bot"
echo ""
echo "Bot will auto-restart if it crashes."
echo "Bot will survive VM reboots (systemd enabled)."
