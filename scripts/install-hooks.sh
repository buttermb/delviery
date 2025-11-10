#!/bin/bash

# Install Git Hooks for BigMike Wholesale Platform
# This script installs the pre-push hook to validate code before pushing

set -e

GIT_HOOKS_DIR=".git/hooks"
PRE_PUSH_HOOK="$GIT_HOOKS_DIR/pre-push"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRE_PUSH_SCRIPT="$SCRIPT_DIR/pre-push-hook.sh"

echo "🔧 Installing Git hooks..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p "$GIT_HOOKS_DIR"

# Make pre-push script executable
if [ -f "$PRE_PUSH_SCRIPT" ]; then
    chmod +x "$PRE_PUSH_SCRIPT"
    echo "✅ Made pre-push-hook.sh executable"
else
    echo "❌ Error: pre-push-hook.sh not found at $PRE_PUSH_SCRIPT"
    exit 1
fi

# Install pre-push hook
cat > "$PRE_PUSH_HOOK" << 'EOF'
#!/bin/bash
# Pre-push hook installed by BigMike Wholesale Platform
# This hook validates code before allowing push to GitHub

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
"$SCRIPT_DIR/scripts/pre-push-hook.sh"
EOF

chmod +x "$PRE_PUSH_HOOK"
echo "✅ Installed pre-push hook"

# Check if hook is working
if [ -x "$PRE_PUSH_HOOK" ]; then
    echo ""
    echo "✅ Git hooks installed successfully!"
    echo ""
    echo "The pre-push hook will now validate:"
    echo "  - No edits to auto-generated files"
    echo "  - No console.log statements"
    echo "  - No hardcoded secrets"
    echo "  - SECURITY DEFINER functions have SET search_path"
    echo "  - Edge functions use Zod validation & CORS"
    echo "  - TypeScript compilation"
    echo "  - Linter passes"
    echo "  - Conventional commit format"
    echo ""
    echo "To test: Try making a commit with console.log and push"
    echo "To skip (not recommended): git push --no-verify"
else
    echo "❌ Error: Failed to install pre-push hook"
    exit 1
fi
