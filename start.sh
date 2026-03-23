#!/bin/bash
set -e

# ========================================
#  TRADER MYTHOS ALPHA - Start (Linux)
# ========================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

cd "$(dirname "$0")"
PROJECT_DIR="$(pwd)"

# Load nvm if available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

echo -e "${CYAN}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║   TRADER MYTHOS - DRY RUN            ║"
echo "  ║   Paper trading with \$100 USDT       ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

# Kill any existing instances
echo -e "${YELLOW}Cleaning up old processes...${NC}"
pkill -f "freqtrade trade" 2>/dev/null || true
pkill -f "next" 2>/dev/null || true
sleep 1

# Activate venv
source .venv/bin/activate

# Start Freqtrade in background
echo -e "${YELLOW}[1/2]${NC} Starting Freqtrade bot..."
nohup freqtrade trade \
    --config freqtrade-develop/user_data/config/config_mythos_dry.json \
    --strategy MythosScalper \
    --strategy-path freqtrade-develop/user_data/strategies \
    --userdir freqtrade-develop/user_data \
    > freqtrade.log 2>&1 &

FREQTRADE_PID=$!
echo "  Freqtrade PID: $FREQTRADE_PID"

# Wait for API
echo -n "  Waiting for API..."
for i in $(seq 1 30); do
    if curl -s http://127.0.0.1:8080/api/v1/ping > /dev/null 2>&1; then
        echo -e " ${GREEN}LIVE!${NC}"
        break
    fi
    echo -n "."
    sleep 2
done

if ! curl -s http://127.0.0.1:8080/api/v1/ping > /dev/null 2>&1; then
    echo -e " ${RED}FAILED${NC}"
    echo "Check freqtrade.log for errors"
    exit 1
fi

# Start Next.js frontend
echo -e "${YELLOW}[2/2]${NC} Starting web dashboard..."
cd "$PROJECT_DIR/frontend"
nohup npx next start -p 3000 -H 0.0.0.0 > "$PROJECT_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"
cd "$PROJECT_DIR"

# Wait for frontend
echo -n "  Waiting for dashboard..."
for i in $(seq 1 20); do
    if curl -s http://127.0.0.1:3000 > /dev/null 2>&1; then
        echo -e " ${GREEN}LIVE!${NC}"
        break
    fi
    echo -n "."
    sleep 2
done

# Save PIDs for stop script
echo "$FREQTRADE_PID" > .pids
echo "$FRONTEND_PID" >> .pids

# Get server IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ALL SYSTEMS GO!                    ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                      ║${NC}"
echo -e "${GREEN}║  Dashboard: http://${SERVER_IP}:3000  ${NC}"
echo -e "${GREEN}║  API:       http://${SERVER_IP}:8080  ${NC}"
echo -e "${GREEN}║                                      ║${NC}"
echo -e "${GREEN}║  Logs:                               ║${NC}"
echo -e "${GREEN}║    tail -f freqtrade.log             ║${NC}"
echo -e "${GREEN}║    tail -f frontend.log              ║${NC}"
echo -e "${GREEN}║                                      ║${NC}"
echo -e "${GREEN}║  Stop: ./stop.sh                     ║${NC}"
echo -e "${GREEN}║                                      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
