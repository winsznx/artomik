#!/usr/bin/env bash
set -euo pipefail

mkdir -p data

echo "[start] launching engine in background"
node apps/engine/dist/main.js &
ENGINE_PID=$!

cleanup() {
  echo "[start] shutting down engine (pid=$ENGINE_PID)"
  kill "$ENGINE_PID" 2>/dev/null || true
  wait "$ENGINE_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[start] launching dashboard on port ${PORT:-3000}"
cd apps/dashboard
exec npx next start -p "${PORT:-3000}"
