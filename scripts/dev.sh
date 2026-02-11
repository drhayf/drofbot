#!/usr/bin/env bash
# =============================================================================
# Drofbot — Local Development Stack (Unix/macOS/Linux)
# =============================================================================
# Starts the full Drofbot development environment:
#   1. Gateway process (agent + Dashboard API on :18789)
#   2. Dashboard Vite dev server (HMR on :5173, proxies /api → :18789)
#
# Usage:  ./scripts/dev.sh
# Stop:   Ctrl+C (kills all child processes)
# =============================================================================

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ─── Preflight ───────────────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  echo "[!] No .env file found. Copy .env.example → .env and fill in values."
  echo "    cp .env.example .env"
  exit 1
fi

# Export .env into current shell
set -a
# shellcheck disable=SC1091
source .env
set +a

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║         Drofbot — Local Development Stack           ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ─── Trap cleanup ────────────────────────────────────────────────────────────
PIDS=()
cleanup() {
  echo ""
  echo "[*] Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  done
  echo "[✓] All processes stopped."
}
trap cleanup EXIT INT TERM

# ─── 1. Gateway ──────────────────────────────────────────────────────────────
echo "[1/2] Starting Gateway (agent + Dashboard API on :18789)..."
node scripts/run-node.mjs gateway run --force &
PIDS+=($!)
echo "  → Gateway PID: ${PIDS[-1]}"

sleep 2

# ─── 2. Dashboard Vite ───────────────────────────────────────────────────────
echo "[2/2] Starting Dashboard dev server (Vite HMR on :5173)..."
cd src/dashboard && npx vite --host &
PIDS+=($!)
cd "$ROOT"
echo "  → Dashboard PID: ${PIDS[-1]}"

sleep 1

echo ""
echo "══════════════════════════════════════════════════════"
echo "  Drofbot is running!"
echo ""
echo "  Dashboard UI:   http://localhost:5173"
echo "  Dashboard API:  http://localhost:18789/api/health"
echo "  Gateway WS:     ws://localhost:18789"
echo ""
echo "  Press Ctrl+C to stop all services."
echo "══════════════════════════════════════════════════════"
echo ""

# Wait for any child to exit
wait
