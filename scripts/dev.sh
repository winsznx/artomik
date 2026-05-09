#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Artomik Dev ==="
echo ""

echo "Building shared package..."
npm run build --workspace=packages/shared

echo ""
echo "Building engine..."
npm run build --workspace=apps/engine

echo ""
echo "Starting engine and dashboard concurrently..."
echo "  Engine: node apps/engine/dist/main.js"
echo "  Dashboard: http://localhost:3000"
echo ""

node apps/engine/dist/main.js &
ENGINE_PID=$!

npm run dev --workspace=apps/dashboard &
DASHBOARD_PID=$!

cleanup() {
  echo ""
  echo "Shutting down..."
  kill "$ENGINE_PID" 2>/dev/null || true
  kill "$DASHBOARD_PID" 2>/dev/null || true
  wait
}
trap cleanup EXIT INT TERM

wait
