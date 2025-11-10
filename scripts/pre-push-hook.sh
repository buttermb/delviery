#!/bin/bash

# Pre-push Git Hook - BigMike Wholesale Platform
# Validates all critical rules before allowing push to GitHub

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo "🔍 Running pre-push validation..."

# Function to report error
error() {
    echo -e "${RED}❌ ERROR:${NC} $1"
    ERRORS=$((ERRORS + 1))
}

# Function to report warning
warning() {
    echo -e "${YELLOW}⚠️  WARNING:${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

# Function to report success
success() {
    echo -e "${GREEN}✅${NC} $1"
}

# 1. Check for edits to auto-generated files
echo ""
echo "📁 Checking for edits to auto-generated files..."
AUTO_GEN_FILES=(
    "src/integrations/supabase/client.ts"
    "src/integrations/supabase/types.ts"
    ".env"
)

for file in "${AUTO_GEN_FILES[@]}"; do
    if git diff --cached --name-only | grep -q "^${file}$"; then
        error "Auto-generated file modified: ${file}"
        echo "   This file is auto-generated. Import it, don't edit it."
    fi
done

# Check config.toml for project_id changes
if git diff --cached supabase/config.toml | grep -q "^[-+].*project_id"; then
    error "project_id in supabase/config.toml should not be modified"
fi

# 2. Check for console.log statements
echo ""
echo "📝 Checking for console.log statements..."
CONSOLE_LOGS=$(git diff --cached -G "console\.(log|error|warn|info|debug)" --name-only | grep -E "\.(ts|tsx|js|jsx)$" || true)
if [ -n "$CONSOLE_LOGS" ]; then
    error "Found console.log statements in staged files:"
    echo "$CONSOLE_LOGS" | while read -r file; do
        echo "   - $file"
        git diff --cached "$file" | grep -n "console\." | head -3
    done
    echo "   Use logger from @/lib/logger instead"
fi

# 3. Check for hardcoded secrets
echo ""
echo "🔐 Checking for hardcoded secrets..."
SECRET_PATTERNS=(
    "sk_live_"
    "sk_test_"
    "pk_live_"
    "pk_test_"
    "api_key.*=.*['\"][^'\"]{20,}"
    "secret.*=.*['\"][^'\"]{20,}"
    "password.*=.*['\"][^'\"]{8,}"
    "token.*=.*['\"][^'\"]{20,}"
)

for pattern in "${SECRET_PATTERNS[@]}"; do
    if git diff --cached -G "$pattern" --name-only | grep -vE "(package-lock.json|yarn.lock|\.md$)" | grep -q .; then
        error "Potential hardcoded secret found (pattern: $pattern)"
        git diff --cached -G "$pattern" --name-only | head -5
    fi
done

# 4. Check SECURITY DEFINER functions in migrations
echo ""
echo "🔒 Checking SECURITY DEFINER functions..."
MIGRATION_FILES=$(git diff --cached --name-only --diff-filter=ACMR | grep "supabase/migrations/.*\.sql$" || true)
if [ -n "$MIGRATION_FILES" ]; then
    for file in $MIGRATION_FILES; do
        if grep -q "SECURITY DEFINER" "$file" 2>/dev/null; then
            if ! grep -q "SET search_path = public" "$file" 2>/dev/null; then
                error "SECURITY DEFINER function in $file missing SET search_path = public"
            fi
        fi
    done
fi

# 5. Check for forbidden schema modifications
echo ""
echo "🚫 Checking for forbidden schema modifications..."
FORBIDDEN_SCHEMAS=("auth\." "storage\." "realtime\." "vault\." "supabase_functions\.")
for schema in "${FORBIDDEN_SCHEMAS[@]}"; do
    if git diff --cached -G "$schema" --name-only | grep -q "\.sql$"; then
        error "Forbidden schema modification detected: $schema"
        echo "   Never modify reserved Supabase schemas"
    fi
done

# 6. Check edge functions for Zod validation and CORS
echo ""
echo "⚡ Checking edge functions..."
EDGE_FUNCTIONS=$(git diff --cached --name-only --diff-filter=ACMR | grep "supabase/functions/.*/index\.ts$" || true)
if [ -n "$EDGE_FUNCTIONS" ]; then
    for file in $EDGE_FUNCTIONS; do
        # Check for direct imports instead of shared deps
        if grep -q "from \"https://deno.land/std" "$file" 2>/dev/null || \
           grep -q "from 'https://deno.land/std" "$file" 2>/dev/null; then
            if ! grep -q "from '../_shared/deps.ts'" "$file" 2>/dev/null && \
               ! grep -q "from \"../_shared/deps.ts\"" "$file" 2>/dev/null; then
                warning "Edge function $file may not use shared deps.ts"
            fi
        fi
        
        # Check for req.json() without validation
        if grep -q "req\.json()" "$file" 2>/dev/null; then
            if ! grep -q "z\.object\|RequestSchema\|safeParse\|parse" "$file" 2>/dev/null; then
                error "Edge function $file uses req.json() without Zod validation"
            fi
        fi
        
        # Check for CORS headers
        if ! grep -q "OPTIONS\|corsHeaders" "$file" 2>/dev/null; then
            warning "Edge function $file may be missing CORS handling"
        fi
    done
fi

# 7. TypeScript compilation check
echo ""
echo "📘 Checking TypeScript compilation..."
if command -v npx &> /dev/null; then
    if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
        error "TypeScript compilation errors found"
        npx tsc --noEmit 2>&1 | grep "error TS" | head -10
    else
        success "TypeScript compilation passed"
    fi
else
    warning "npx not found, skipping TypeScript check"
fi

# 8. Linter check
echo ""
echo "🔍 Checking linter..."
if [ -f "package.json" ] && grep -q "\"lint\"" package.json; then
    if npm run lint 2>&1 | grep -q "error\|Error\|✖"; then
        error "Linter errors found"
        npm run lint 2>&1 | grep -E "error|Error|✖" | head -10
    else
        success "Linter passed"
    fi
else
    warning "Lint script not found in package.json"
fi

# 9. Build check (optional, can be slow)
echo ""
echo "🏗️  Checking build..."
if [ -f "package.json" ] && grep -q "\"build\"" package.json; then
    read -t 5 -p "Run full build check? (y/N, auto-skip in 5s): " -n 1 -r || true
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if npm run build 2>&1 | grep -qE "error|Error|failed"; then
            error "Build failed"
            npm run build 2>&1 | grep -E "error|Error|failed" | head -10
        else
            success "Build passed"
        fi
    else
        echo "   Skipping build check (use --no-verify to skip all checks)"
    fi
fi

# 10. Check commit message format (conventional commits)
echo ""
echo "📝 Checking commit message format..."
COMMIT_MSG=$(git log -1 --pretty=%B)
if ! echo "$COMMIT_MSG" | grep -qE "^(feat|fix|refactor|docs|style|test|chore|perf|ci|build|revert)(\(.+\))?:"; then
    warning "Commit message doesn't follow conventional commits format"
    echo "   Format: type(scope): description"
    echo "   Types: feat, fix, refactor, docs, style, test, chore, perf, ci, build, revert"
    echo "   Example: feat: Add product search functionality"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found, but no errors${NC}"
    echo "   Push will continue, but please review warnings"
    exit 0
else
    echo -e "${RED}❌ $ERRORS error(s) and $WARNINGS warning(s) found${NC}"
    echo ""
    echo "Please fix the errors above before pushing."
    echo "To skip this hook (NOT RECOMMENDED): git push --no-verify"
    exit 1
fi
