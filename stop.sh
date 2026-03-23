#!/bin/bash

# ========================================
#  TRADER MYTHOS ALPHA - Stop All
# ========================================

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "Stopping Trader Mythos..."

# Kill by PID file
if [ -f .pids ]; then
    while read -r pid; do
        kill "$pid" 2>/dev/null && echo "  Killed PID $pid"
    done < .pids
    rm -f .pids
fi

# Kill by process name (fallback)
pkill -f "freqtrade trade" 2>/dev/null && echo "  Killed freqtrade" || true
pkill -f "next start" 2>/dev/null && echo "  Killed frontend" || true
pkill -f "next dev" 2>/dev/null || true

echo -e "${GREEN}All stopped.${NC}"
