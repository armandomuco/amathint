#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT_DIR/apps/api"
WEB_DIR="$ROOT_DIR/apps/web"
API_ENV="$API_DIR/.env"
API_PORT="${API_PORT:-4000}"
WEB_PORT="${WEB_PORT:-5173}"
WEB_DEMO_HOST="${WEB_DEMO_HOST:-amathint.localhost}"
BUNDLED_NODE_DIR="/Users/armandomuco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
API_PID=""
WEB_PID=""

cleanup() {
  echo
  echo "Stopping AmathInt local servers..."
  if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
  fi
  if [ -n "$WEB_PID" ] && kill -0 "$WEB_PID" 2>/dev/null; then
    kill "$WEB_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    echo "Install it first, then run this script again."
    exit 1
  fi
}

node_major_version() {
  node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0
}

ensure_modern_node() {
  local current_major
  current_major="$(node_major_version)"

  if [ "$current_major" -ge 20 ]; then
    return 0
  fi

  if [ -x "$BUNDLED_NODE_DIR/node" ]; then
    local bundled_major
    bundled_major="$("$BUNDLED_NODE_DIR/node" -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)"
    if [ "$bundled_major" -ge 20 ]; then
      export PATH="$BUNDLED_NODE_DIR:$PATH"
      echo "Using bundled Node $(node -v) because the active Node was too old for Vite."
      return 0
    fi
  fi

  echo "Node.js 20 or newer is required for the web app. Current Node: $(node -v 2>/dev/null || echo missing)"
  echo "Install or activate Node 20+ and run this script again."
  exit 1
}

port_is_busy() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

install_if_needed() {
  local app_dir="$1"
  local app_name="$2"

  if [ ! -d "$app_dir/node_modules" ]; then
    echo "Installing $app_name dependencies..."
    (cd "$app_dir" && npm install)
  fi
}

wait_for_api() {
  echo "Waiting for API health check..."
  for _ in $(seq 1 40); do
    if curl -fsS "http://127.0.0.1:$API_PORT/health" >/dev/null 2>&1; then
      echo "API ready: http://127.0.0.1:$API_PORT"
      return 0
    fi
    sleep 1
  done

  echo "API did not become ready. Check the backend output above."
  exit 1
}

require_command npm
require_command node
require_command curl
require_command lsof
ensure_modern_node

if [ ! -f "$API_ENV" ]; then
  echo "Creating apps/api/.env from .env.example..."
  cp "$API_DIR/.env.example" "$API_ENV"
fi

if [ "${AMATHINT_SKIP_PRESTOP:-0}" != "1" ] && [ -x "$ROOT_DIR/stop-amathint-local.sh" ]; then
  "$ROOT_DIR/stop-amathint-local.sh"
fi

if port_is_busy "$API_PORT"; then
  echo "Port $API_PORT is already in use. Stop the existing API server first."
  exit 1
fi

if port_is_busy "$WEB_PORT"; then
  echo "Port $WEB_PORT is already in use. Stop the existing web server first."
  exit 1
fi

install_if_needed "$API_DIR" "API"
install_if_needed "$WEB_DIR" "web"

echo "Preparing Prisma client and database schema..."
(cd "$API_DIR" && npm run prisma:generate && npm run prisma:push)

echo
echo "Starting AmathInt locally..."
echo "API: http://127.0.0.1:$API_PORT"
echo "Web: http://$WEB_DEMO_HOST:$WEB_PORT"
echo "Raw web URL: http://127.0.0.1:$WEB_PORT"
echo "Press Ctrl+C to stop both servers."
echo

(cd "$API_DIR" && PORT="$API_PORT" npm run dev) &
API_PID="$!"

wait_for_api

(cd "$WEB_DIR" && npm run dev -- --host 127.0.0.1 --port "$WEB_PORT" --strictPort) &
WEB_PID="$!"

while true; do
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "API server stopped."
    exit 1
  fi
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    echo "Web server stopped."
    exit 1
  fi
  sleep 2
done
