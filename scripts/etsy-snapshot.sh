#!/usr/bin/env bash
# Daily listing snapshot. Run while the app is up, or from cron.
set -euo pipefail
PORT="${PORT:-3001}"
curl -sS -X POST "http://127.0.0.1:${PORT}/api/etsy/analytics"
echo
