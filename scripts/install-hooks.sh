#!/bin/bash

# Install Git hooks for BigMike Wholesale Platform

echo "🔧 Installing Git hooks..."

# Make sure we're in the project root
if [ ! -d ".git" ]; then
    echo "❌ Error: Must be run from project root (where .git folder exists)"
    exit 1
fi

# Make the pre-push hook executable
chmod +x scripts/pre-push-hook.sh

# Create symlink from .git/hooks to our script
ln -sf ../../scripts/pre-push-hook.sh .git/hooks/pre-push

echo "✅ Git hooks installed successfully!"
echo ""
echo "The following hooks are now active:"
echo "  • pre-push: Validates code quality and security rules"
echo ""
echo "To bypass hooks (not recommended): git push --no-verify"
