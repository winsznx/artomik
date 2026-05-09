#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Artomik Setup ==="
echo ""

echo "[1/4] Installing dependencies..."
npm install

echo ""
echo "[2/4] Building shared package..."
npm run build --workspace=packages/shared

echo ""
echo "[3/4] Setting up environment..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  Created .env from .env.example"
  echo "  >> Edit .env and fill in your keys before running the engine."
else
  echo "  .env already exists, skipping."
fi

echo ""
echo "[4/4] Creating data directory..."
mkdir -p data
echo "  Created data/ directory for SQLite database."

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit .env with your PRIVATE_KEY, HELIUS_API_KEY, etc."
echo "  2. Run: npm run dev"
echo ""
