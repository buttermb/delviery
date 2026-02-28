#!/usr/bin/env bash
# FloraIQ Storefront Sprint — Ralph TUI Launcher
# Run this after reboot to start the autonomous 400-task loop

set -e

PROJECT_DIR="/c/Users/Alex/Downloads/delviery-fresh"
PRD_FILE="storefront-prd.json"

# ── API Key Check ─────────────────────────────────────────────────────────────
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo ""
  echo "ERROR: ANTHROPIC_API_KEY is not set."
  echo ""
  echo "Add it to ~/.bash_profile:"
  echo '  export ANTHROPIC_API_KEY="sk-ant-..."'
  echo ""
  echo "Then run: source ~/.bash_profile && ./start-ralph.sh"
  exit 1
fi

# ── ralph-tui Check ───────────────────────────────────────────────────────────
if ! command -v ralph-tui &> /dev/null; then
  echo "ralph-tui not found. Installing..."
  bun install -g ralph-tui
fi

# ── Launch ────────────────────────────────────────────────────────────────────
cd "$PROJECT_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  FloraIQ Storefront Launch Sprint"
echo "  400 tasks · Agent: Claude Sonnet 4.6"
echo "  PRD: $PRD_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ralph-tui run --prd "$PRD_FILE" --iterations 400
