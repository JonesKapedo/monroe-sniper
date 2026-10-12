#!/bin/sh
cd /app/applet 2>/dev/null || cd /workspace 2>/dev/null || true
if curl -sf -o /dev/null --max-time 1 http://127.0.0.1:3000/; then
  exit 0
fi
npm run dev > /tmp/monroe-dev.log 2>&1 &
