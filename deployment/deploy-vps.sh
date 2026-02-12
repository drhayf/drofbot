#!/bin/bash
#
# Drofbot VPS All-in-One Setup Script
# Run this on a fresh VPS as root
#
# Usage: curl -fsSL https://raw.githubusercontent.com/drhayf/drofbot/main/deploy-vps.sh | bash
# Or: wget -qO- https://raw.githubusercontent.com/drhayf/drofbot/main/deploy-vps.sh | bash
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DROFBOT_DIR="/opt/drofbot"
DROFBOT_USER="drofbot"
DROFBOT_GROUP="drofbot"
DOMAIN="drofy.net"
ADMIN_EMAIL="admin@drofy.net"

# Environment variables (embedded for single-script deployment)
SUPABASE_URL="https://xonmnzosnubojfawkaxh.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhvbm1uem9zbnVib2pmYXdrYXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkyNTcyNDIsImV4cCI6MjA1NDgzMzI0Mn0.JiiIFCFPIqLoOJGkVDMMmF7oGDmB1MH0FvdWQT_NQHQ"
TELEGRAM_BOT_TOKEN="8398888517:AAEx04ovOBdETSQbma0dU1Q1PLCk4ehMYuw"
OPENROUTER_API_KEY="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"
LLM_MODEL="anthropic/claude-opus-4.6"
TELEGRAM_USER_ID="5858823159"

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           DROFBOT VPS DEPLOYMENT SCRIPT                      ║"
echo "║                                                              ║"
echo "║  This script will:                                           ║"
echo "║  1. Install Node.js 22, pnpm, git, Caddy                     ║"
echo "║  2. Clone and build the Drofbot repository                   ║"
echo "║  3. Configure environment and OpenClaw                       ║"
echo "║  4. Set up systemd service for the gateway                   ║"
echo "║  5. Configure Caddy reverse proxy                            ║"
echo "║  6. Start everything and test                                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root${NC}"
    exit 1
fi

# Domain is pre-configured for SSL with Caddy
echo -e "${BLUE}Deploying with domain: $DOMAIN${NC}"

# Step 1: System Setup
echo -e "${GREEN}[Step 1/7] System Setup${NC}"
echo "Updating system packages..."
apt update && apt upgrade -y

echo "Installing Node.js 22..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt install -y nodejs
fi

echo "Installing build essentials and other dependencies..."
apt install -y git build-essential curl wget unzip software-properties-common apt-transport-https

echo "Installing pnpm..."
if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm
fi

echo "Installing Caddy..."
if ! command -v caddy &> /dev/null; then
    apt install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt update
    apt install -y caddy
fi

# Verify installations
echo -e "${GREEN}Verifying installations...${NC}"
echo "Node.js: $(node --version)"
echo "pnpm: $(pnpm --version)"
echo "Caddy: $(caddy version)"

# Step 2: Create user and clone repository
echo -e "${GREEN}[Step 2/7] Creating user and cloning repository${NC}"

# Create drofbot user if it doesn't exist
if ! id "$DROFBOT_USER" &>/dev/null; then
    useradd -r -s /bin/bash -d "$DROFBOT_DIR" "$DROFBOT_USER"
    echo "Created user: $DROFBOT_USER"
fi

# Clone repository
if [ -d "$DROFBOT_DIR" ]; then
    echo -e "${YELLOW}$DROFBOT_DIR already exists. Updating...${NC}"
    cd "$DROFBOT_DIR"
    git config --global --add safe.directory /opt/drofbot
    git pull || true
else
    echo "Cloning Drofbot repository..."
    git clone https://github.com/drhayf/drofbot.git "$DROFBOT_DIR"
    cd "$DROFBOT_DIR"
fi

# Set ownership
chown -R "$DROFBOT_USER:$DROFBOT_GROUP" "$DROFBOT_DIR"

# Step 3: Install dependencies
# Disable corepack to prevent pnpm auto-update issues
echo -e "${GREEN}[Step 3/7] Installing dependencies${NC}"
cd "$DROFBOT_DIR"
export COREPACK_ENABLE=0
su - "$DROFBOT_USER" -c "cd $DROFBOT_DIR && COREPACK_ENABLE=0 pnpm install"

# Step 4: Build everything
echo -e "${GREEN}[Step 4/7] Building backend and frontend${NC}"
cd "$DROFBOT_DIR"

echo "Building backend with tsdown..."
su - "$DROFBOT_USER" -c "cd $DROFBOT_DIR && npx tsdown"

echo "Building dashboard..."
su - "$DROFBOT_USER" -c "cd $DROFBOT_DIR/src/dashboard && pnpm run build"

echo "Building Control UI..."
if [ -d "$DROFBOT_DIR/ui" ]; then
    su - "$DROFBOT_USER" -c "cd $DROFBOT_DIR/ui && COREPACK_ENABLE=0 pnpm install && pnpm run build"
fi

# Step 5: Create environment file
echo -e "${GREEN}[Step 5/7] Creating environment file${NC}"

# Generate a random dashboard token
DASHBOARD_TOKEN=$(openssl rand -hex 32)

cat > "$DROFBOT_DIR/.env" << EOF
# Drofbot Environment Configuration
# Generated on $(date)

# Supabase Database
DROFBOT_SUPABASE_URL=$SUPABASE_URL
DROFBOT_SUPABASE_KEY=$SUPABASE_KEY

# Telegram Bot
DROFBOT_TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN

# LLM Configuration (OpenRouter)
DROFBOT_LLM_API_KEY=$OPENROUTER_API_KEY
OPENROUTER_API_KEY=$OPENROUTER_API_KEY
DROFBOT_LLM_MODEL=$LLM_MODEL

# Dashboard Authentication
DROFBOT_DASHBOARD_TOKEN=$DASHBOARD_TOKEN

# Server Configuration
DROFBOT_PORT=18789
DROFBOT_HOST=0.0.0.0
EOF

chown "$DROFBOT_USER:$DROFBOT_GROUP" "$DROFBOT_DIR/.env"
chmod 600 "$DROFBOT_DIR/.env"

echo -e "${GREEN}Environment file created with dashboard token: $DASHBOARD_TOKEN${NC}"
echo -e "${YELLOW}Save this token for dashboard access!${NC}"

# Step 6: Configure OpenClaw
echo -e "${GREEN}[Step 6/7] Configuring OpenClaw${NC}"
cd "$DROFBOT_DIR"

# Telegram configuration
su - "$DROFBOT_USER" -c "cd $DROFBOT_DIR && node drofbot.mjs config set channels.telegram.botToken '$TELEGRAM_BOT_TOKEN'"
su - "$DROFBOT_USER" -c "cd $DROFBOT_DIR && node drofbot.mjs config set channels.telegram.enabled true"
su - "$DROFBOT_USER" -c "cd $DROFBOT_DIR && node drofbot.mjs config set channels.telegram.dmPolicy allowlist"
su - "$DROFBOT_USER" -c "cd $DROFBOT_DIR && node drofbot.mjs config set 'channels.telegram.accounts.default.allowFrom' '[$TELEGRAM_USER_ID]'"

# Plugins
su - "$DROFBOT_USER" -c "cd $DROFBOT_DIR && node drofbot.mjs config set plugins.entries.memory-core.enabled true"
su - "$DROFBOT_USER" -c "cd $DROFBOT_DIR && node drofbot.mjs config set plugins.entries.llm-task.enabled true"
su - "$DROFBOT_USER" -c "cd $DROFBOT_DIR && node drofbot.mjs config set plugins.entries.lobster.enabled true"
su - "$DROFBOT_USER" -c "cd $DROFBOT_DIR && node drofbot.mjs config set plugins.entries.open-prose.enabled true"

# Tools
su - "$DROFBOT_USER" -c "cd $DROFBOT_DIR && node drofbot.mjs config set 'tools.allow' '[\"lobster\",\"llm-task\",\"open-prose\"]'"

# Embedding provider
su - "$DROFBOT_USER" -c "cd $DROFBOT_DIR && node drofbot.mjs config set agents.defaults.memorySearch.provider openai"
su - "$DROFBOT_USER" -c "cd $DROFBOT_DIR && node drofbot.mjs config set agents.defaults.memorySearch.model text-embedding-3-small"
su - "$DROFBOT_USER" -c "cd $DROFBOT_DIR && node drofbot.mjs config set agents.defaults.memorySearch.remote.baseUrl 'https://openrouter.ai/api/v1'"
su - "$DROFBOT_USER" -c "cd $DROFBOT_DIR && node drofbot.mjs config set agents.defaults.memorySearch.remote.apiKey '$OPENROUTER_API_KEY'"

# Agent model
su - "$DROFBOT_USER" -c "cd $DROFBOT_DIR && node drofbot.mjs config set agents.defaults.model.primary 'openrouter/anthropic/claude-opus-4.6'"

# Disable unused services
su - "$DROFBOT_USER" -c "cd $DROFBOT_DIR && node drofbot.mjs config set browser.enabled false"
su - "$DROFBOT_USER" -c "cd $DROFBOT_DIR && node drofbot.mjs config set hooks.enabled false"

# Gateway mode
su - "$DROFBOT_USER" -c "cd $DROFBOT_DIR && node drofbot.mjs config set gateway.mode local"

# Step 7: Create systemd service
echo -e "${GREEN}[Step 7/7] Creating systemd service${NC}"

cat > /etc/systemd/system/drofbot.service << EOF
[Unit]
Description=Drofbot Gateway Service
After=network.target

[Service]
Type=simple
User=$DROFBOT_USER
Group=$DROFBOT_GROUP
WorkingDirectory=$DROFBOT_DIR
EnvironmentFile=$DROFBOT_DIR/.env
ExecStart=/usr/bin/node $DROFBOT_DIR/drofbot.mjs gateway run --port 18789 --force
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=drofbot

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DROFBOT_DIR
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# Configure Caddy
echo -e "${GREEN}Configuring Caddy reverse proxy...${NC}"

if [ -n "$DOMAIN" ]; then
    # With domain - automatic HTTPS
    cat > /etc/caddy/Caddyfile << EOF
# Drofbot Caddy Configuration
$DOMAIN {
    email $ADMIN_EMAIL
    
    # Dashboard
    root * $DROFBOT_DIR/src/dashboard/dist
    file_server
    
    # API proxy
    handle /api/* {
        reverse_proxy localhost:18789
    }
    
    # WebSocket proxy
    handle /ws/* {
        reverse_proxy localhost:18789
    }
    
    # SPA fallback
    handle {
        try_files {path} /index.html
        file_server
    }
}

# Alternative: just proxy everything to the gateway
:8080 {
    reverse_proxy localhost:18789
}
EOF
else
    # No domain - HTTP only
    cat > /etc/caddy/Caddyfile << EOF
# Drofbot Caddy Configuration (HTTP only)
:80 {
    # Dashboard
    root * $DROFBOT_DIR/src/dashboard/dist
    file_server
    
    # API proxy
    handle /api/* {
        reverse_proxy localhost:18789
    }
    
    # WebSocket proxy
    handle /ws/* {
        reverse_proxy localhost:18789
    }
    
    # SPA fallback
    handle {
        try_files {path} /index.html
        file_server
    }
}

# Direct gateway access
:8080 {
    reverse_proxy localhost:18789
}
EOF
fi

# Enable and start services
echo -e "${GREEN}Enabling and starting services...${NC}"
systemctl daemon-reload
systemctl enable drofbot
systemctl enable caddy

# Start Drofbot first
systemctl start drofbot

# Wait for gateway to be ready
echo "Waiting for gateway to start..."
sleep 5

# Check if gateway is running
if systemctl is-active --quiet drofbot; then
    echo -e "${GREEN}Drofbot gateway is running!${NC}"
else
    echo -e "${RED}Drofbot gateway failed to start. Check logs:${NC}"
    journalctl -u drofbot -n 50
    exit 1
fi

# Start Caddy
systemctl start caddy

if systemctl is-active --quiet caddy; then
    echo -e "${GREEN}Caddy is running!${NC}"
else
    echo -e "${RED}Caddy failed to start. Check logs:${NC}"
    journalctl -u caddy -n 50
fi

# Final status
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}              DROFBOT DEPLOYMENT COMPLETE!                    ${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Services:${NC}"
echo "  - Drofbot Gateway: $(systemctl is-active drofbot)"
echo "  - Caddy Proxy: $(systemctl is-active caddy)"
echo ""
echo -e "${BLUE}Access Points:${NC}"
if [ -n "$DOMAIN" ]; then
    echo "  - Dashboard: https://$DOMAIN"
    echo "  - API: https://$DOMAIN/api"
else
    echo "  - Dashboard: http://$(curl -s ifconfig.me)/"
    echo "  - API: http://$(curl -s ifconfig.me)/api"
    echo "  - Direct Gateway: http://$(curl -s ifconfig.me):8080"
fi
echo ""
echo -e "${BLUE}Dashboard Token:${NC}"
echo "  $DASHBOARD_TOKEN"
echo ""
echo -e "${BLUE}Telegram Bot:${NC}"
echo "  @drdrofbot - Send a message to test!"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "  View logs:     journalctl -u drofbot -f"
echo "  Restart:       systemctl restart drofbot"
echo "  Status:        systemctl status drofbot"
echo "  Update:        cd $DROFBOT_DIR && git pull && pnpm install && npx tsdown && systemctl restart drofbot"
echo ""
echo -e "${YELLOW}IMPORTANT: Save your dashboard token!${NC}"
echo -e "${YELLOW}The token above is needed to access the dashboard.${NC}"
echo ""

# Test Telegram bot
echo -e "${BLUE}Testing Telegram bot connection...${NC}"
sleep 2
if journalctl -u drofbot -n 20 --no-pager | grep -q "telegram"; then
    echo -e "${GREEN}Telegram bot appears to be connected!${NC}"
else
    echo -e "${YELLOW}Check logs for Telegram status: journalctl -u drofbot -n 50${NC}"
fi

echo ""
echo -e "${GREEN}Deployment complete! Send a message to @drdrofbot on Telegram to test.${NC}"
