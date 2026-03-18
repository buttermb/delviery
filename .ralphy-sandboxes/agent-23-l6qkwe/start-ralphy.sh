#!/usr/bin/env bash
# FloraIQ Storefront Sprint — Ralphy Launcher
# Uses Claude Code with Opus 4.6 via Max plan (no API key needed)
# Run after reboot from Git Bash or WSL2

set -e

PROJECT_DIR="/c/Users/Alex/Downloads/delviery-fresh"
PRD_FILE="ralphy-prd.json"

cd "$PROJECT_DIR"

# ── Check ralphy ──────────────────────────────────────────────────────────────
if ! command -v ralphy &> /dev/null; then
  echo "Installing ralphy-cli..."
  npm install -g ralphy-cli
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  FloraIQ Storefront Launch Sprint"
echo "  400 tasks · Claude Opus 4.6 · Max Plan"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Modes:"
echo "    Sequential (safe):  ./start-ralphy.sh"
echo "    Parallel 3 agents:  ./start-ralphy.sh --parallel"
echo "    Parallel 5 agents:  ./start-ralphy.sh --parallel --max-parallel 5"
echo ""

# Pass any extra args through (e.g. --parallel --max-parallel 5)
ralphy \
  --json "$PRD_FILE" \
  --claude \
  --model claude-opus-4-6 \
  --fast \
  "$@"
