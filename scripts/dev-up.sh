#!/usr/bin/env bash
# Cursor agent shell'inden bağımsız çalışır; sen `npm run dev:down` deyene kadar açık kalır.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PID_FILE="$ROOT/.dev-server.pid"
LOG_FILE="$ROOT/.dev-server.log"
PORT="${PORT:-3001}"

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${OLD_PID:-}" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Dev sunucu zaten çalışıyor (pid $OLD_PID) → http://localhost:$PORT"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

EXISTING="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "$EXISTING" ]]; then
  echo "Port $PORT dolu (pid: $EXISTING). Önce: npm run dev:down"
  exit 1
fi

nohup npx next dev -H 127.0.0.1 -p "$PORT" >>"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"

for _ in $(seq 1 40); do
  if lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    LISTEN_PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN | head -1)"
    echo "$LISTEN_PID" >"$PID_FILE"
    echo "Dev sunucu açıldı (pid $LISTEN_PID) → http://localhost:$PORT"
    echo "Log: $LOG_FILE"
    exit 0
  fi
  sleep 0.25
done

echo "Başladı ama port $PORT henüz dinlemiyor; loga bak: $LOG_FILE"
exit 1
