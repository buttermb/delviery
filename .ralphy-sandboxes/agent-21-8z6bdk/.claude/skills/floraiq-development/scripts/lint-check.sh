#!/bin/bash
# Quick lint and type check for FloraIQ

echo "🔍 Running ESLint..."
npm run lint

echo ""
echo "📦 Running TypeScript check..."
npx tsc --noEmit

echo ""
echo "✅ Checks complete!"
