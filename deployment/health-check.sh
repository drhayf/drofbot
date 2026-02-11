#!/usr/bin/env bash
# =============================================================================
# Drofbot — Health Check Script
# =============================================================================
# Quick health check for the Drofbot VPS deployment.
#
# Usage: bash deployment/health-check.sh [TOKEN]
# =============================================================================

set -euo pipefail

TOKEN="${1:-}"

echo "╔══════════════════════════════════════════════════════╗"
echo "║           Drofbot — Health Check                    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ─── 1. Systemd Services ──────────────────────────────────────────────────────
echo "=== Systemd Services ==="

if systemctl is-active --quiet drofbot; then
    echo "✓ drofbot service: active"
else
    echo "✗ drofbot service: inactive"
fi

if systemctl is-active --quiet caddy; then
    echo "✓ caddy service: active"
else
    echo "✗ caddy service: inactive"
fi

if systemctl is-active --quiet cloudflared; then
    echo "✓ cloudflared service: active"
else
    echo "✗ cloudflared service: inactive"
fi

echo ""

# ─── 2. Gateway Health ────────────────────────────────────────────────────────
echo "=== Gateway Health ==="

if curl -sf http://localhost:18789/api/health | jq -c . 2>/dev/null; then
    echo "✓ Gateway API: healthy"
else
    HEALTH=$(curl -sf http://localhost:18789/api/health 2>/dev/null || echo '{"status":"error"}')
    echo "✗ Gateway API: $HEALTH"
fi

echo ""

# ─── 3. Dashboard ─────────────────────────────────────────────────────────────
echo "=== Dashboard ==="

if curl -sf http://localhost:8080 >/dev/null 2>&1; then
    echo "✓ Dashboard (Caddy): serving"
else
    echo "✗ Dashboard (Caddy): not responding"
fi

echo ""

# ─── 4. Model Configuration ───────────────────────────────────────────────────
echo "=== Model Configuration ==="

if [ -n "$TOKEN" ]; then
    MODEL=$(curl -sf -H "Authorization: Bearer $TOKEN" http://localhost:18789/api/models/current 2>/dev/null | jq -r '.model // "unknown"' 2>/dev/null || echo "error")
    echo "  Current model: $MODEL"
else
    echo "  (pass TOKEN as argument to check model)"
fi

echo ""

# ─── 5. Memory Stats ──────────────────────────────────────────────────────────
echo "=== Memory Stats ==="

if [ -n "$TOKEN" ]; then
    curl -sf -H "Authorization: Bearer $TOKEN" http://localhost:18789/api/memory/stats 2>/dev/null | jq -c '.banks | to_entries[] | {bank: .key, count: .value.count}' 2>/dev/null || echo "  (unable to fetch)"
else
    echo "  (pass TOKEN as argument to check memory)"
fi

echo ""

# ─── 6. Telegram Status ───────────────────────────────────────────────────────
echo "=== Telegram Status ==="

if sudo journalctl -u drofbot -n 100 --no-pager 2>/dev/null | grep -q "telegram.*starting provider"; then
    echo "✓ Telegram: connected"
else
    echo "⚠ Telegram: check logs for connection status"
fi

echo ""

# ─── 7. Cron Jobs ─────────────────────────────────────────────────────────────
echo "=== Cron Jobs ==="

if sudo journalctl -u drofbot -n 100 --no-pager 2>/dev/null | grep -q "heartbeat.*started"; then
    echo "✓ Heartbeat: running"
else
    echo "⚠ Heartbeat: check logs"
fi

if sudo journalctl -u drofbot -n 100 --no-pager 2>/dev/null | grep -q "Consolidation started"; then
    echo "✓ Consolidation: running"
else
    echo "⚠ Consolidation: check logs"
fi

echo ""

# ─── 8. Disk Space ────────────────────────────────────────────────────────────
echo "=== Disk Space ==="

df -h /opt/drofbot 2>/dev/null | tail -1 | awk '{print "  /opt/drofbot: " $3 " used of " $2 " (" $5 " full)"}'

echo ""

# ─── Summary ───────────────────────────────────────────────────────────────────
echo "══════════════════════════════════════════════════════"
echo "  Health check complete"
echo ""
echo "  For detailed logs:"
echo "    sudo journalctl -u drofbot -f"
echo ""
echo "  For full API check:"
echo "    bash deployment/health-check.sh <YOUR_DASHBOARD_TOKEN>"
echo "══════════════════════════════════════════════════════"
