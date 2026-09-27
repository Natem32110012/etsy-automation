#!/usr/bin/env bash
# LaunchAgent canlı sunucusunu durdurur; Mac açılışında bir daha kalkmaz (live:up'a kadar).
set -euo pipefail
LABEL="com.seckin.etsy-automation"
PORT="${PORT:-3001}"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
UID_NUM="$(id -u)"
DOMAIN="gui/${UID_NUM}"

stop_pid() {
  local pid="$1"
  if [[ -z "$pid" ]]; then return 0; fi
  if ! kill -0 "$pid" 2>/dev/null; then return 0; fi
  kill "$pid" 2>/dev/null || true
  for _ in $(seq 1 20); do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep 0.15
  done
  kill -9 "$pid" 2>/dev/null || true
}

if launchctl print "${DOMAIN}/${LABEL}" >/dev/null 2>&1; then
  launchctl bootout "${DOMAIN}/${LABEL}" 2>/dev/null || true
fi

for pid in $(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true); do
  stop_pid "$pid"
done

if [[ -f "$PLIST" ]]; then
  rm -f "$PLIST"
fi

if lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT hâlâ dolu; elle kontrol et."
  exit 1
fi

echo "Canlı sunucu kapatıldı (LaunchAgent kaldırıldı)."
