#!/bin/bash
set -e

# ========================================
#  TRADER MYTHOS ALPHA - Linux Setup
#  Run once after cloning the repo
# ========================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║   TRADER MYTHOS ALPHA - SETUP        ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

cd "$(dirname "$0")"
PROJECT_DIR="$(pwd)"

# ---------- System dependencies ----------
echo -e "${YELLOW}[1/5]${NC} Installing system dependencies..."

if command -v apt-get &> /dev/null; then
    sudo apt-get update -qq
    sudo apt-get install -y -qq python3 python3-pip python3-venv python3-dev \
        build-essential libssl-dev libffi-dev curl git nodejs npm \
        libta-lib0-dev 2>/dev/null || true
elif command -v dnf &> /dev/null; then
    sudo dnf install -y python3 python3-pip python3-devel gcc openssl-devel \
        libffi-devel curl git nodejs npm ta-lib-devel 2>/dev/null || true
elif command -v pacman &> /dev/null; then
    sudo pacman -Sy --noconfirm python python-pip base-devel openssl \
        libffi curl git nodejs npm 2>/dev/null || true
else
    echo -e "${RED}Unsupported package manager. Install Python 3.10+, Node 18+, and TA-Lib manually.${NC}"
fi

# Check Node version, install via nvm if too old
NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${YELLOW}Node.js 18+ required. Installing via nvm...${NC}"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
fi

echo -e "${GREEN}✓ System dependencies OK${NC}"

# ---------- TA-Lib (if not installed) ----------
echo -e "${YELLOW}[2/5]${NC} Checking TA-Lib..."

if ! ldconfig -p 2>/dev/null | grep -q libta_lib; then
    if ! [ -f /usr/local/lib/libta_lib.so ]; then
        echo "  Installing TA-Lib from source..."
        cd /tmp
        curl -sL https://github.com/ta-lib/ta-lib/releases/download/v0.6.4/ta-lib-0.6.4-src.tar.gz -o ta-lib.tar.gz
        tar -xzf ta-lib.tar.gz
        cd ta-lib-0.6.4
        ./configure --prefix=/usr/local
        make -j$(nproc)
        sudo make install
        sudo ldconfig
        cd "$PROJECT_DIR"
        echo -e "${GREEN}✓ TA-Lib installed${NC}"
    else
        echo -e "${GREEN}✓ TA-Lib already installed${NC}"
    fi
else
    echo -e "${GREEN}✓ TA-Lib already installed${NC}"
fi

# ---------- Python venv + freqtrade ----------
echo -e "${YELLOW}[3/5]${NC} Setting up Python environment & Freqtrade..."

if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi

source .venv/bin/activate

pip install --quiet --upgrade pip wheel setuptools

# Install freqtrade from local source
cd "$PROJECT_DIR/freqtrade-develop"
pip install --quiet -e . 2>&1 | tail -3

# Remove aiodns (causes issues on some systems)
pip uninstall -y aiodns 2>/dev/null || true

cd "$PROJECT_DIR"
echo -e "${GREEN}✓ Freqtrade installed${NC}"

# ---------- Frontend ----------
echo -e "${YELLOW}[4/5]${NC} Installing frontend dependencies..."

cd "$PROJECT_DIR/frontend"
npm install --silent 2>&1 | tail -3
npm run build 2>&1 | tail -3

cd "$PROJECT_DIR"
echo -e "${GREEN}✓ Frontend built${NC}"

# ---------- Make scripts executable ----------
echo -e "${YELLOW}[5/5]${NC} Setting up run scripts..."
chmod +x start.sh stop.sh 2>/dev/null || true

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   SETUP COMPLETE!                    ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                      ║${NC}"
echo -e "${GREEN}║  To start dry-run:  ./start.sh       ║${NC}"
echo -e "${GREEN}║  To stop:           ./stop.sh        ║${NC}"
echo -e "${GREEN}║                                      ║${NC}"
echo -e "${GREEN}║  Dashboard: http://YOUR_VPS_IP:3000  ║${NC}"
echo -e "${GREEN}║                                      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
