#!/usr/bin/env bash
# Kalıcı dev sunucusunu durdurur (dev:up ile açılan).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$ROOT/.dev-server.pid"
PORT="${PORT:-3001}"

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

if [[ -f "$PID_FILE" ]]; then
  stop_pid "$(cat "$PID_FILE" 2>/dev/null || true)"
  rm -f "$PID_FILE"
fi

for pid in $(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true); do
  stop_pid "$pid"
done

if lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT hâlâ dolu; elle kontrol et."
  exit 1
fi

echo "Dev sunucu kapatıldı."
