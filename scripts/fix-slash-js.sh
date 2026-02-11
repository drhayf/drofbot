#!/usr/bin/env bash
# Fix the /.js import bug pattern globally
# The fix-imports.ts script incorrectly mapped:
#   channels/shared/typing/.js  →  should be  channels/shared/typing.js
# This also applies to other patterns like brain/agent-runner/foo/.js, shared/config/foo/.js etc.

cd "$(dirname "$0")/.."

count=0

# Fix channels/shared/NAME/.js → channels/shared/NAME.js
for f in $(grep -rl 'shared/[a-z_-]*/\.js' src/ extensions/ --include='*.ts' 2>/dev/null); do
  sed -i 's|/shared/\([a-z_-]*\)/\.js|/shared/\1.js|g' "$f"
  count=$((count + 1))
done

# Also fix any other pattern where /NAME/.js should be /NAME.js
# This catches brain/agent-runner/foo/.js, shared/config/foo/.js, etc.
for f in $(grep -rl '[a-z_-]*/\.js' src/ extensions/ --include='*.ts' 2>/dev/null); do
  sed -i 's|\([a-z_-]*\)/\.js|\1.js|g' "$f"
  count=$((count + 1))
done

echo "Fixed /.js patterns in $count files"
