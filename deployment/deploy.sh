#!/usr/bin/env bash
# =============================================================================
# Drofbot — Deployment Script
# =============================================================================
# Run on the VPS after initial setup to deploy or update Drofbot.
# Usage:  bash /opt/drofbot/deployment/deploy.sh
# =============================================================================

set -euo pipefail

APP_DIR="/opt/drofbot"
DASH_SRC="$APP_DIR/src/dashboard"
DASH_DIST="$APP_DIR/dashboard-dist"

echo "╔══════════════════════════════════════════════════════╗"
echo "║           Drofbot — Deploy / Update                 ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

cd "$APP_DIR"

# ─── 1. Pull latest ─────────────────────────────────────────────────────────
echo "[1/7] Pulling latest code..."
git pull --rebase origin main

# ─── 2. Install dependencies ────────────────────────────────────────────────
echo "[2/7] Installing dependencies..."
pnpm install --frozen-lockfile

# ─── 3. Build agent (TypeScript → dist/) ────────────────────────────────────
echo "[3/7] Building agent..."
pnpm build

# ─── 4. Build dashboard ─────────────────────────────────────────────────────
echo "[4/7] Building dashboard..."
cd "$DASH_SRC"
npm install
npm run build
cd "$APP_DIR"

# ─── 5. Copy dashboard to serving directory ─────────────────────────────────
echo "[5/7] Deploying dashboard static files..."
rm -rf "$DASH_DIST"/*
cp -r "$DASH_SRC/dist/"* "$DASH_DIST/"

# ─── 6. Install/reload systemd services ─────────────────────────────────────
echo "[6/7] Reloading systemd..."
sudo cp deployment/drofbot.service /etc/systemd/system/drofbot.service
sudo cp deployment/Caddyfile /etc/caddy/Caddyfile
sudo systemctl daemon-reload
sudo systemctl restart drofbot
sudo systemctl reload caddy

# ─── 7. Health check ────────────────────────────────────────────────────────
echo "[7/7] Running health check..."
sleep 3

if curl -sf http://localhost:18789/api/health >/dev/null 2>&1; then
    echo "  [✓] Dashboard API is responding"
else
    echo "  [✗] Dashboard API is not responding!"
    echo "      Check: journalctl -u drofbot -n 50"
fi

if curl -sf http://localhost:8080 >/dev/null 2>&1; then
    echo "  [✓] Caddy is serving dashboard"
else
    echo "  [✗] Caddy is not responding!"
    echo "      Check: journalctl -u caddy -n 50"
fi

echo ""
echo "══════════════════════════════════════════════════════"
echo "  Deployment complete!"
echo ""
echo "  View logs:  journalctl -u drofbot -f"
echo "  Status:     systemctl status drofbot"
echo "══════════════════════════════════════════════════════"
