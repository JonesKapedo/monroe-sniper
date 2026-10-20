#!/bin/sh
# Revive the preview dev server. Idempotent and repo-local.
ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if curl -sf -o /dev/null --max-time 1 http://127.0.0.1:8080/; then
  exit 0
fi

cd "$ROOT_DIR"

# Patch: @ledgerhq/hw-transport lib-es imports "./errors" without extension —
# fatal for native Node ESM dev SSR (extensionless internal imports bypass the
# package exports map). Runs only when the unpatched pattern is present.
node -e "
const fs = require('fs');
const p = 'node_modules/@ledgerhq/hw-transport/lib-es/Transport.js';
try {
  const s = fs.readFileSync(p, 'utf8');
  const fixed = s.replace(/from \"\.\/([A-Za-z0-9_-]+)\"/g, 'from \"./\$1.js\"');
  if (fixed !== s) fs.writeFileSync(p, fixed);
} catch (e) { /* package absent — fine */ }
" >/dev/null 2>&1

npm run dev > /tmp/monroe-dev.log 2>&1 &

i=0
while [ "$i" -lt 40 ]; do
  if curl -sf -o /dev/null --max-time 1 http://127.0.0.1:8080/; then
    exit 0
  fi
  i=$((i + 1))
  sleep 0.5
done
exit 1
