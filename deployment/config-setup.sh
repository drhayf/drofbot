#!/usr/bin/env bash
# =============================================================================
# Drofbot — OpenClaw Configuration Setup
# =============================================================================
# This script configures OpenClaw on a fresh VPS installation.
# Run AFTER cloning the repo and installing dependencies.
#
# Usage: bash deployment/config-setup.sh
# =============================================================================

set -euo pipefail

APP_DIR="/opt/drofbot"
CONFIG_CMD="node drofbot.mjs config set"

echo "╔══════════════════════════════════════════════════════╗"
echo "║       Drofbot — OpenClaw Configuration              ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

cd "$APP_DIR"

# ─── Load environment variables ───────────────────────────────────────────────
if [ -f ".env" ]; then
    echo "[0] Loading environment from .env..."
    set -a
    source .env
    set +a
else
    echo "ERROR: .env file not found at $APP_DIR/.env"
    echo "Run: cp deployment/.env.production .env"
    exit 1
fi

# ─── 1. Telegram Channel ──────────────────────────────────────────────────────
echo "[1/7] Configuring Telegram channel..."
$CONFIG_CMD channels.telegram.botToken "$DROFBOT_TELEGRAM_BOT_TOKEN"
$CONFIG_CMD channels.telegram.enabled true
$CONFIG_CMD channels.telegram.dmPolicy allowlist
$CONFIG_CMD channels.telegram.allowFrom "[\"$DROFBOT_TELEGRAM_CHAT_ID\"]"
echo "  ✓ Telegram configured (@drdrofbot)"

# ─── 2. Plugins ───────────────────────────────────────────────────────────────
echo "[2/7] Enabling plugins..."
$CONFIG_CMD plugins.entries.memory-core.enabled true
$CONFIG_CMD plugins.entries.llm-task.enabled true
$CONFIG_CMD plugins.entries.lobster.enabled true
echo "  ✓ Plugins enabled: memory-core, llm-task, lobster"

# ─── 3. Tools Allowlist ───────────────────────────────────────────────────────
echo "[3/7] Configuring tools allowlist..."
$CONFIG_CMD tools.allow '["lobster","llm-task"]'
echo "  ✓ Tools allowlist set"

# ─── 4. Embedding Provider (Memory Search) ────────────────────────────────────
echo "[4/7] Configuring embedding provider..."
$CONFIG_CMD agents.defaults.memorySearch.provider openai
$CONFIG_CMD agents.defaults.memorySearch.model text-embedding-3-small
$CONFIG_CMD agents.defaults.memorySearch.remote.baseUrl https://openrouter.ai/api/v1
$CONFIG_CMD agents.defaults.memorySearch.remote.apiKey "$DROFBOT_LLM_API_KEY"
echo "  ✓ Embedding provider: openai/text-embedding-3-small via OpenRouter"

# ─── 5. Agent Model ───────────────────────────────────────────────────────────
echo "[5/7] Configuring agent model..."
$CONFIG_CMD agents.defaults.model.primary "openrouter/$DROFBOT_LLM_MODEL"
echo "  ✓ Agent model: $DROFBOT_LLM_MODEL"

# ─── 6. Disable Unused Services ───────────────────────────────────────────────
echo "[6/7] Disabling unused services..."
$CONFIG_CMD browser.enabled false
$CONFIG_CMD hooks.enabled false
echo "  ✓ Disabled: browser, hooks"

# ─── 7. Run Doctor ────────────────────────────────────────────────────────────
echo "[7/7] Running doctor --fix..."
node drofbot.mjs doctor --fix || true
echo "  ✓ Doctor completed"

# ─── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
echo "  Configuration complete!"
echo ""
echo "  Config file: ~/.drofbot/drofbot.json"
echo ""
echo "  To verify:"
echo "    node drofbot.mjs config list"
echo ""
echo "  To start the gateway:"
echo "    sudo systemctl start drofbot"
echo "══════════════════════════════════════════════════════"
