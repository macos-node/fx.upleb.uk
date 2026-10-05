#!/bin/bash
# deploy.sh - Deploy fx.upleb.uk to your server
# Usage: ./deploy.sh

set -e

# ============================================
# CONFIGURATION - Edit these values
# ============================================
SERVER="upleb.uk"   # a Host alias in ~/.ssh/config: the user, port and key live there
REMOTE_PATH="/var/www/fx.upleb.uk" # <-- CHANGE THIS if different on your server

# Local paths
LOCAL_DIST="./dist"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting deployment of fx.upleb.uk${NC}"
echo "=========================================="

# ============================================
# STEP 1: Build
# ============================================
echo -e "${YELLOW}📦 Building project...${NC}"

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Are you in the right directory?${NC}"
    exit 1
fi

echo "Installing dependencies..."
npm ci --silent

echo "Building..."
npm run build

if [ ! -d "$LOCAL_DIST" ]; then
    echo -e "${RED}❌ Error: dist/ folder not found after build${NC}"
    exit 1
fi

if [ ! -f "$LOCAL_DIST/index.html" ]; then
    echo -e "${RED}❌ Error: index.html not found in dist/${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"

# ============================================
# STEP 2: Deploy
# ============================================
echo -e "${YELLOW}🚀 Deploying to server...${NC}"

echo "Server: $SERVER"
echo "Remote path: $REMOTE_PATH"
echo ""

# Check if we can connect
echo "Testing SSH connection..."
if ! ssh -o BatchMode=yes -o ConnectTimeout=5 "$SERVER" "echo 'SSH OK'" > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Cannot connect to server via SSH${NC}"
    echo "Please check:"
    echo "  - ~/.ssh/config has a Host entry named $SERVER (user, port, key)"
    echo "  - that entry logs in: ssh $SERVER"
    exit 1
fi

# Use rsync to deploy
echo "Syncing files..."
# nginx only reads, so force world-readable modes rather than copying whatever
# the local files happen to have. --chmod needs real rsync (not macOS openrsync).
rsync -avz --delete --chmod=D755,F644 \
    --exclude='.DS_Store' \
    --exclude='*.log' \
    --exclude='.git' \
    "$LOCAL_DIST/" \
    "$SERVER:$REMOTE_PATH/"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: rsync failed${NC}"
    exit 1
fi

# No ownership step: the webroot belongs to the deploy user, so the files land
# with the right owner and nginx only needs to read them. Root login is off on
# the server and sudo asks for a password, so nothing here uses either.

# ============================================
# STEP 3: Verify
# ============================================
echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo "=========================================="
echo ""
echo "🌐 Your site should be live at:"
echo "   https://fx.upleb.uk"
echo ""
echo "🧪 Quick checks:"
echo "   curl -I https://fx.upleb.uk"
echo ""
echo "📋 If rsync says Permission denied, the webroot is not the deploy user's."
echo "   Fix it once, on the server: sudo chown -R \$USER: $REMOTE_PATH"
