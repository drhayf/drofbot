#!/usr/bin/env bash
# =============================================================================
# Drofbot VPS — First-Time Setup Script
# =============================================================================
# Target: Ubuntu 22.04+ on Contabo Cloud VPS
# Run as root: bash /tmp/setup-vps.sh
# =============================================================================

set -euo pipefail

echo "╔══════════════════════════════════════════════════════╗"
echo "║        Drofbot VPS — First-Time Setup               ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ─── 1. System update ───────────────────────────────────────────────────────
echo "[1/8] Updating system packages..."
apt-get update -y && apt-get upgrade -y
apt-get install -y curl wget git build-essential ufw unzip jq

# ─── 2. Node.js 22 LTS ──────────────────────────────────────────────────────
echo "[2/8] Installing Node.js 22..."
if ! command -v node &>/dev/null || [[ "$(node -v)" != v22* ]]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi
echo "  Node: $(node -v)"
echo "  npm:  $(npm -v)"

# ─── 3. pnpm ────────────────────────────────────────────────────────────────
echo "[3/8] Installing pnpm..."
if ! command -v pnpm &>/dev/null; then
    npm install -g pnpm
fi
echo "  pnpm: $(pnpm -v)"

# ─── 4. Caddy web server ────────────────────────────────────────────────────
echo "[4/8] Installing Caddy..."
if ! command -v caddy &>/dev/null; then
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -y
    apt-get install -y caddy
fi
echo "  Caddy: $(caddy version)"

# ─── 5. Firewall ────────────────────────────────────────────────────────────
echo "[5/8] Configuring firewall (ufw)..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable
ufw status verbose

# ─── 6. Create drofbot user ─────────────────────────────────────────────────
echo "[6/8] Creating drofbot user..."
if ! id -u drofbot &>/dev/null; then
    useradd -m -s /bin/bash -d /home/drofbot drofbot
    mkdir -p /home/drofbot/.ssh
    # Copy root's authorized_keys so you can SSH as drofbot too
    if [ -f /root/.ssh/authorized_keys ]; then
        cp /root/.ssh/authorized_keys /home/drofbot/.ssh/authorized_keys
        chown -R drofbot:drofbot /home/drofbot/.ssh
        chmod 700 /home/drofbot/.ssh
        chmod 600 /home/drofbot/.ssh/authorized_keys
    fi
    echo "  Created user 'drofbot'"
else
    echo "  User 'drofbot' already exists"
fi

# ─── 7. Directory structure ─────────────────────────────────────────────────
echo "[7/8] Setting up /opt/drofbot..."
mkdir -p /opt/drofbot/dashboard-dist
mkdir -p /opt/drofbot/logs
chown -R drofbot:drofbot /opt/drofbot

# ─── 8. Cloudflare Tunnel ───────────────────────────────────────────────────
echo "[8/8] Installing cloudflared..."
if ! command -v cloudflared &>/dev/null; then
    curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
    dpkg -i /tmp/cloudflared.deb
    rm -f /tmp/cloudflared.deb
fi
echo "  cloudflared: $(cloudflared version)"

# ─── Done ────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
echo "  VPS setup complete!"
echo ""
echo "  Next steps:"
echo "    1. Clone repo:  cd /opt/drofbot && git clone <repo-url> ."
echo "    2. Copy .env:   cp .env.example .env && nano .env"
echo "    3. Install:     pnpm install"
echo "    4. Build:       pnpm build"
echo "    5. Build dash:  cd src/dashboard && npm run build && cd ../.."
echo "    6. Deploy:      bash deployment/deploy.sh"
echo "    7. Start:       systemctl start drofbot"
echo ""
echo "  See deployment/cloudflare-tunnel-setup.md for tunnel config."
echo "══════════════════════════════════════════════════════"
