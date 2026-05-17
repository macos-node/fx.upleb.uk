#!/bin/bash
# deploy.sh - Deploy glimpse.fizx.uk to your server
# Usage: ./deploy.sh

set -e

# ============================================
# CONFIGURATION - Edit these values
# ============================================
SERVER="root@88.218.206.187"         # <-- CHANGE THIS: your SSH user@hostname
REMOTE_PATH="/var/www/glimpse.fizx.uk" # <-- CHANGE THIS if different on your server
SSH_PORT="2121"                          # <-- CHANGE THIS if using non-standard SSH port

# Local paths
LOCAL_DIST="./dist"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting deployment of glimpse.fizx.uk${NC}"
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
if ! ssh -p "$SSH_PORT" -o ConnectTimeout=5 "$SERVER" "echo 'SSH OK'" > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Cannot connect to server via SSH${NC}"
    echo "Please check:"
    echo "  - SERVER variable is set correctly (current: $SERVER)"
    echo "  - SSH key is configured: ssh-copy-id $SERVER"
    echo "  - SSH port is correct (current: $SSH_PORT)"
    exit 1
fi

# Use rsync to deploy
echo "Syncing files..."
rsync -avz --delete \
    -e "ssh -p $SSH_PORT" \
    --exclude='.DS_Store' \
    --exclude='*.log' \
    --exclude='.git' \
    "$LOCAL_DIST/" \
    "$SERVER:$REMOTE_PATH/"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: rsync failed${NC}"
    exit 1
fi

# ============================================
# STEP 3: Fix Permissions
# ============================================
echo -e "${YELLOW}🔧 Setting permissions...${NC}"

ssh -p "$SSH_PORT" "$SERVER" "sudo chown -R www-data:www-data $REMOTE_PATH && sudo chmod -R 755 $REMOTE_PATH"

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️ Warning: Could not set permissions automatically${NC}"
    echo "You may need to run manually on server:"
    echo "  sudo chown -R www-data:www-data $REMOTE_PATH"
fi

# ============================================
# STEP 4: Verify
# ============================================
echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo "=========================================="
echo ""
echo "🌐 Your site should be live at:"
echo "   https://glimpse.fizx.uk"
echo ""
echo "🧪 Quick checks:"
echo "   curl -I https://glimpse.fizx.uk"
echo ""
echo "📋 If you see 403 errors, check permissions:"
echo "   ssh $SERVER 'sudo chown -R www-data:www-data $REMOTE_PATH'"
echo ""
echo "🔄 To reload Nginx (if needed):"
echo "   ssh $SERVER 'sudo systemctl reload nginx'"
