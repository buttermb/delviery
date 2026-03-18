#!/usr/bin/env bash
# Post-reboot Context-Engine setup script
# Run this after rebooting and Docker Desktop is running
set -euo pipefail

PROJECT_DIR="/c/Users/Alex/Downloads/delviery-fresh"
DOCKER="/c/Program Files/Docker/Docker/resources/bin/docker.exe"

echo "=== Context-Engine Setup for FloraIQ Ralph Loop ==="

# 1. Check Docker is running
echo "[1/4] Checking Docker..."
if ! "$DOCKER" ps &>/dev/null; then
  echo "ERROR: Docker is not running. Start Docker Desktop first."
  exit 1
fi
echo "  Docker is running."

# 2. Start Context-Engine services
echo "[2/4] Starting Context-Engine services..."
cd "$PROJECT_DIR"
ctx quickstart 2>&1

# 3. Check service health
echo "[3/4] Checking service health..."
ctx status 2>&1

# 4. Index the codebase
echo "[4/4] Indexing FloraIQ codebase..."
ctx reset --mcp 2>&1

echo ""
echo "=== Setup Complete ==="
echo "MCP endpoints:"
echo "  Indexer: http://localhost:8003/mcp"
echo "  Memory:  http://localhost:8002/mcp"
echo ""
echo "Test with:"
echo "  ctx search 'useTenantContext'"
echo "  ctx answer 'How does tenant isolation work?'"
