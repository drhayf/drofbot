#!/usr/bin/env bash
# Fix specific wrong-file imports that the search-based fixer matched incorrectly.
cd "$(dirname "$0")/.."

count=0

fix() {
  local file="$1"
  local wrong="$2"
  local correct="$3"
  if [ -f "$file" ]; then
    if grep -q "$wrong" "$file" 2>/dev/null; then
      sed -i "s|$wrong|$correct|g" "$file"
      count=$((count + 1))
      echo "  Fixed: $file"
    fi
  fi
}

echo "=== Fixing getChildLogger/toPinoLikeLogger → logging/logger ==="
# These incorrectly point to channels/shared/logging.ts instead of logging/logger.ts

# From src/channels/telegram/ (depth 2 from src/)
fix src/channels/telegram/api-logging.ts '"../shared/logging/subsystem.js"' '"../../logging/subsystem.js"'
fix src/channels/telegram/bot.ts '"../shared/logging.js"' '"../../logging/logger.js"'
fix src/channels/telegram/bot-native-commands.ts '"../shared/logging.js"' '"../../logging/logger.js"'
fix src/channels/telegram/fetch.ts '"../shared/logging/subsystem.js"' '"../../logging/subsystem.js"'

# From src/channels/discord/monitor/ (depth 3)
fix src/channels/discord/monitor/message-handler.preflight.ts '"../../shared/logging.js"' '"../../../logging/logger.js"'
fix src/channels/discord/monitor/provider.ts '"../../shared/logging.js"' '"../../../logging/logger.js"'
fix src/channels/discord/monitor/listeners.ts '"../../shared/logging.js"' '"../../../logging/logger.js"'

# From src/channels/slack/monitor/ (depth 3)
fix src/channels/slack/monitor/context.ts '"../../shared/logging.js"' '"../../../logging/logger.js"'

# From src/channels/web/ (depth 2)
fix src/channels/web/auth-store.ts '"../shared/logging.js"' '"../../logging/logger.js"'
fix src/channels/web/session.ts '"../shared/logging.js"' '"../../logging/logger.js"'

# From src/channels/web/auto-reply/ (depth 3)
fix src/channels/web/auto-reply/heartbeat-runner.ts '"../../shared/logging.js"' '"../../../logging/logger.js"'
fix src/channels/web/auto-reply/monitor.ts '"../../shared/logging.js"' '"../../../logging/logger.js"'
fix src/channels/web/auto-reply/loggers.ts '"../../shared/logging/subsystem.js"' '"../../../logging/subsystem.js"'

# From src/channels/web/auto-reply/monitor/ (depth 4)
fix src/channels/web/auto-reply/monitor/on-message.ts '"../../../shared/logging' '"../../../../logging/logger'
fix src/channels/web/auto-reply/monitor/process-message.ts '"../../../shared/logging.js"' '"../../../../logging/logger.js"'

echo ""
echo "=== Fixing loadWebMedia → channels/web/media ==="
# These incorrectly point to slack/monitor/media.ts or inbound/media.ts

# From src/channels/telegram/send.ts (depth 2 → ../web/media.js)
fix src/channels/telegram/send.ts '"../slack/monitor/media.js"' '"../web/media.js"'
# From src/channels/telegram/bot/delivery.ts (depth 3 → ../../web/media.js)
fix src/channels/telegram/bot/delivery.ts '"../../slack/monitor/media.js"' '"../../web/media.js"'
# From src/channels/discord/send.shared.ts (depth 2)
fix src/channels/discord/send.shared.ts '"../slack/monitor/media.js"' '"../web/media.js"'
# From src/channels/discord/send.emojis-stickers.ts
fix src/channels/discord/send.emojis-stickers.ts '"../slack/monitor/media.js"' '"../web/media.js"'
# From src/channels/discord/monitor/native-command.ts (depth 3)
fix src/channels/discord/monitor/native-command.ts '"../../slack/monitor/media.js"' '"../../web/media.js"'
# From src/channels/signal/send.ts (depth 2)
fix src/channels/signal/send.ts '"../slack/monitor/media.js"' '"../web/media.js"'
# From src/channels/imessage/send.ts (depth 2)
fix src/channels/imessage/send.ts '"../slack/monitor/media.js"' '"../web/media.js"'
# From src/channels/slack/send.ts (depth 2) → need to use full path
fix src/channels/slack/send.ts '"./monitor/media.js"' '"../web/media.js"'
# From src/channels/web/outbound.ts  
fix src/channels/web/outbound.ts '"./inbound/media.js"' '"./media.js"'
# From src/channels/web/auto-reply/deliver-reply.ts
fix src/channels/web/auto-reply/deliver-reply.ts '"../inbound/media.js"' '"../media.js"'

echo ""
echo "=== Fixing resolveWhatsAppAccount → channels/web/accounts ==="

# From src/channels/shared/dock.ts → should import from channels/web/accounts
fix src/channels/shared/dock.ts '"../discord/accounts.js"' '"../web/accounts.js"'
# From src/channels/shared/plugins/directory-config.ts
fix src/channels/shared/plugins/directory-config.ts '"../../discord/accounts.js"' '"../../web/accounts.js"'
# From src/channels/shared/plugins/onboarding/whatsapp.ts
fix src/channels/shared/plugins/onboarding/whatsapp.ts '"../../../discord/accounts.js"' '"../../../web/accounts.js"'

echo ""
echo "=== Fixing plugin commands → plugins/commands ==="

# From src/channels/telegram/bot-native-commands.ts
fix src/channels/telegram/bot-native-commands.ts '"../../shared/config/commands.js"' '"../../plugins/commands.js"'

echo ""
echo "=== Fixing plugin registry/runtime → plugins/runtime ==="

# From src/channels/shared/plugins/index.ts
fix src/channels/shared/plugins/index.ts '"../../imessage/monitor/runtime.js"' '"../../../plugins/runtime.js"'
# From src/channels/shared/plugins/outbound/load.ts
fix src/channels/shared/plugins/outbound/load.ts '"../../../imessage/monitor/runtime.js"' '"../../../../plugins/runtime.js"'
# Fix PluginRegistry from registry.ts
fix src/channels/shared/plugins/outbound/load.ts '"../../registry.js"' '"../../../plugins/registry.js"'

echo ""
echo "Total files fixed: $count"
