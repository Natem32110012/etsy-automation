#!/usr/bin/env bash
# Production sunucuyu LaunchAgent olarak yükler: Mac açılınca 3001'de kalkar, çökerse yeniden başlar.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LABEL="com.seckin.etsy-automation"
PORT="${PORT:-3001}"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_FILE="$ROOT/.live-server.log"
NODE_BIN="$(command -v node)"
UID_NUM="$(id -u)"
DOMAIN="gui/${UID_NUM}"

if [[ -z "$NODE_BIN" ]]; then
  echo "node bulunamadı — PATH içinde olmalı."
  exit 1
fi

if [[ ! -f "$ROOT/node_modules/next/dist/bin/next" ]]; then
  echo "next binary yok. Önce: npm install"
  exit 1
fi

echo "Eski sunucu kapatılıyor (port $PORT)…"
bash "$ROOT/scripts/dev-down.sh" >/dev/null 2>&1 || true
bash "$ROOT/scripts/live-down.sh" >/dev/null 2>&1 || true

echo "Production build alınıyor…"
npm run build

mkdir -p "$HOME/Library/LaunchAgents"

PATH_VALUE="/usr/local/bin:/opt/homebrew/bin:${HOME}/.npm-global/bin:/usr/bin:/bin"

cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>WorkingDirectory</key>
  <string>${ROOT}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${ROOT}/node_modules/next/dist/bin/next</string>
    <string>start</string>
    <string>-H</string>
    <string>127.0.0.1</string>
    <string>-p</string>
    <string>${PORT}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>
    <string>production</string>
    <key>PORT</key>
    <string>${PORT}</string>
    <key>PATH</key>
    <string>${PATH_VALUE}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>${LOG_FILE}</string>
  <key>StandardErrorPath</key>
  <string>${LOG_FILE}</string>
</dict>
</plist>
EOF

launchctl bootstrap "$DOMAIN" "$PLIST"

for _ in $(seq 1 40); do
  if lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Canlı sunucu açık → http://127.0.0.1:${PORT}"
    echo "Mac açılınca kendiliğinden kalkar. Durdurmak: npm run live:down"
    echo "Log: $LOG_FILE"
    exit 0
  fi
  sleep 0.25
done

echo "Yüklendi ama port ${PORT} henüz dinlemiyor; loga bak: $LOG_FILE"
tail -n 40 "$LOG_FILE" || true
exit 1
