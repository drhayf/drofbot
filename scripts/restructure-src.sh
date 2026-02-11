#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "=== Phase 1: Moving channels shared files ==="
# Move shared .ts files from channels/ to channels/shared/
for f in src/channels/*.ts; do
  if [ -f "$f" ]; then
    mv "$f" src/channels/shared/
    echo "  Moved $f"
  fi
done

# Move shared subdirectories
if [ -d src/channels/allowlists ]; then
  mv src/channels/allowlists src/channels/shared/
  echo "  Moved allowlists/"
fi
if [ -d src/channels/plugins ]; then
  mv src/channels/plugins src/channels/shared/
  echo "  Moved plugins/"
fi
if [ -d src/channels/web ]; then
  mv src/channels/web src/channels/shared/web-shared
  echo "  Moved web/ -> shared/web-shared/"
fi

echo ""
echo "=== Phase 2: Moving channel adapters ==="
for ch in telegram discord slack signal imessage; do
  if [ -d "src/$ch" ]; then
    cp -r "src/$ch/." "src/channels/$ch/"
    rm -rf "src/$ch"
    echo "  Moved $ch/"
  fi
done

# Move web (WhatsApp Web) - src/web/ → src/channels/web/
if [ -d src/web ]; then
  cp -r src/web/. src/channels/web/
  rm -rf src/web
  echo "  Moved web/ (WhatsApp) -> channels/web/"
fi

echo ""
echo "=== Phase 3: Moving config → shared/config/ ==="
if [ -d src/config ]; then
  cp -r src/config/. src/shared/config/
  rm -rf src/config
  echo "  Done"
fi

echo ""
echo "=== Phase 4: Moving sessions → shared/sessions/ ==="
if [ -d src/sessions ]; then
  cp -r src/sessions/. src/shared/sessions/
  rm -rf src/sessions
  echo "  Done"
fi

echo ""
echo "=== Phase 5: Moving routing → shared/routing/ ==="
if [ -d src/routing ]; then
  cp -r src/routing/. src/shared/routing/
  rm -rf src/routing
  echo "  Done"
fi

echo ""
echo "=== Phase 6: Moving memory → brain/memory/ ==="
if [ -d src/memory ]; then
  cp -r src/memory/. src/brain/memory/
  rm -rf src/memory
  echo "  Done"
fi

echo ""
echo "=== Phase 7: Moving cron → brain/cron/ ==="
if [ -d src/cron ]; then
  cp -r src/cron/. src/brain/cron/
  rm -rf src/cron
  echo "  Done"
fi

echo ""
echo "=== Phase 8: Moving agents → brain/agent-runner/ ==="
if [ -d src/agents ]; then
  cp -r src/agents/. src/brain/agent-runner/
  rm -rf src/agents
  echo "  Done"
fi

echo ""
echo "=== All file moves complete! ==="
echo ""
echo "Directory structure after moves:"
ls -d src/brain/*/  2>/dev/null || echo "  (none)"
ls -d src/channels/*/ 2>/dev/null || echo "  (none)"
ls -d src/shared/*/ 2>/dev/null || echo "  (none)"
echo ""
echo "Next: run 'node --import tsx scripts/fix-imports.ts' to update import paths."
