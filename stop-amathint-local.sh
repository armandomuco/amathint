#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_PORT="${API_PORT:-4000}"
WEB_PORT="${WEB_PORT:-5173}"

kill_pid() {
  local pid="$1"
  local reason="$2"

  if [ -z "$pid" ]; then
    return 0
  fi

  if kill -0 "$pid" 2>/dev/null; then
    echo "Stopping PID $pid ($reason)"
    kill "$pid" 2>/dev/null || true
  fi
}

kill_port_listeners() {
  local port="$1"
  local pids

  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -z "$pids" ]; then
    echo "Port $port is already free."
    return 0
  fi

  while IFS= read -r pid; do
    kill_pid "$pid" "listening on port $port"
  done <<< "$pids"
}

kill_project_processes() {
  local pids

  pids="$(pgrep -f "$ROOT_DIR/apps/(api|web)" 2>/dev/null || true)"
  if [ -z "$pids" ]; then
    return 0
  fi

  while IFS= read -r pid; do
    if [ "$pid" != "$$" ]; then
      kill_pid "$pid" "AmathInt project process"
    fi
  done <<< "$pids"
}

force_kill_port_listeners() {
  local port="$1"
  local pids

  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -z "$pids" ]; then
    return 0
  fi

  while IFS= read -r pid; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      echo "Force stopping PID $pid still listening on port $port"
      kill -9 "$pid" 2>/dev/null || true
    fi
  done <<< "$pids"
}

echo "Stopping AmathInt local processes..."
kill_port_listeners "$API_PORT"
kill_port_listeners "$WEB_PORT"
kill_project_processes

sleep 1
force_kill_port_listeners "$API_PORT"
force_kill_port_listeners "$WEB_PORT"

sleep 1

if lsof -nP -iTCP:"$API_PORT" -sTCP:LISTEN >/dev/null 2>&1 || lsof -nP -iTCP:"$WEB_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Some AmathInt ports are still busy. Run this to inspect them:"
  echo "lsof -nP -iTCP:$API_PORT -sTCP:LISTEN"
  echo "lsof -nP -iTCP:$WEB_PORT -sTCP:LISTEN"
  exit 1
fi

echo "AmathInt ports are free: $API_PORT, $WEB_PORT"
