#!/usr/bin/env bash
# =============================================================================
# Drofbot — Update Script
# =============================================================================
# Run this after pushing new code to GitHub to update the VPS deployment.
#
# Usage: bash deployment/update.sh
# =============================================================================

set -euo pipefail

APP_DIR="/opt/drofbot"
DASH_SRC="$APP_DIR/src/dashboard"
DASH_DIST="$APP_DIR/dashboard-dist"

echo "╔══════════════════════════════════════════════════════╗"
echo "║           Drofbot — Update Deployment               ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

cd "$APP_DIR"

# ─── 1. Pull latest code ──────────────────────────────────────────────────────
echo "[1/6] Pulling latest code from GitHub..."
git pull --rebase origin main
echo "  ✓ Code updated"

# ─── 2. Install/update dependencies ───────────────────────────────────────────
echo "[2/6] Installing dependencies..."
pnpm install --frozen-lockfile
echo "  ✓ Dependencies installed"

# ─── 3. Build backend ─────────────────────────────────────────────────────────
echo "[3/6] Building backend..."
npx tsdown
echo "  ✓ Backend built"

# ─── 4. Build dashboard ───────────────────────────────────────────────────────
echo "[4/6] Building dashboard..."
cd "$DASH_SRC"
npm install
npm run build
cd "$APP_DIR"
echo "  ✓ Dashboard built"

# ─── 5. Deploy dashboard static files ─────────────────────────────────────────
echo "[5/6] Deploying dashboard..."
rm -rf "$DASH_DIST"/*
cp -r "$DASH_SRC/dist/"* "$DASH_DIST/"
echo "  ✓ Dashboard deployed"

# ─── 6. Restart services ──────────────────────────────────────────────────────
echo "[6/6] Restarting services..."
sudo systemctl restart drofbot
echo "  ✓ Services restarted"

# ─── Health check ─────────────────────────────────────────────────────────────
echo ""
echo "Running health check..."
sleep 3

if curl -sf http://localhost:18789/api/health >/dev/null 2>&1; then
    echo "  ✓ Gateway is healthy"
else
    echo "  ✗ Gateway health check failed!"
    echo "    Check logs: journalctl -u drofbot -n 50"
fi

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
echo "  Update complete!"
echo ""
echo "  View logs:  journalctl -u drofbot -f"
echo "  Status:     systemctl status drofbot"
echo "══════════════════════════════════════════════════════"
