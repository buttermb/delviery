#!/bin/bash

# BigMike Wholesale Platform - Pre-Push Validation Hook
# This script validates code quality and security rules before pushing to GitHub

set -e

echo "🔍 Running pre-push validation checks..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Function to print error
print_error() {
    echo -e "${RED}❌ ERROR: $1${NC}"
    ERRORS=$((ERRORS + 1))
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

echo ""
echo "1️⃣  Checking for modifications to auto-generated files..."

# Check for auto-generated files that should NEVER be edited
FORBIDDEN_FILES=(
    "src/integrations/supabase/client.ts"
    "src/integrations/supabase/types.ts"
    "supabase/config.toml"
    ".env"
)

for file in "${FORBIDDEN_FILES[@]}"; do
    if git diff --cached --name-only | grep -q "^${file}$"; then
        print_error "Attempted to modify auto-generated file: ${file}"
        echo "   These files are auto-generated and must NOT be edited manually."
    fi
done

if [ $ERRORS -eq 0 ]; then
    print_success "No auto-generated files modified"
fi

echo ""
echo "2️⃣  Checking for console.log statements..."

# Check for console.log usage (should use logger instead)
CONSOLE_LOGS=$(git diff --cached --name-only | grep -E '\.(ts|tsx|js|jsx)$' | xargs grep -n "console\.log" 2>/dev/null || true)

if [ -n "$CONSOLE_LOGS" ]; then
    print_error "Found console.log statements (use logger utility instead):"
    echo "$CONSOLE_LOGS"
else
    print_success "No console.log statements found"
fi

echo ""
echo "3️⃣  Checking for hardcoded secrets..."

# Check for potential hardcoded secrets
SECRET_PATTERNS=(
    "api[_-]?key"
    "secret[_-]?key"
    "password.*=.*['\"]"
    "token.*=.*['\"]"
    "sk_live_"
    "sk_test_"
)

for pattern in "${SECRET_PATTERNS[@]}"; do
    SECRETS=$(git diff --cached --name-only | grep -E '\.(ts|tsx|js|jsx)$' | xargs grep -iE "${pattern}" 2>/dev/null | grep -v "VITE_SUPABASE" | grep -v "// " || true)
    if [ -n "$SECRETS" ]; then
        print_error "Potential hardcoded secret found (pattern: ${pattern}):"
        echo "$SECRETS"
    fi
done

if [ $ERRORS -eq 0 ]; then
    print_success "No hardcoded secrets detected"
fi

echo ""
echo "4️⃣  Validating SECURITY DEFINER functions..."

# Check that all SECURITY DEFINER functions have SET search_path
MIGRATION_FILES=$(git diff --cached --name-only | grep -E 'supabase/migrations/.*\.sql$' || true)

if [ -n "$MIGRATION_FILES" ]; then
    for file in $MIGRATION_FILES; do
        # Check for SECURITY DEFINER without SET search_path
        if grep -q "SECURITY DEFINER" "$file"; then
            if ! grep -q "SET search_path = public" "$file" && ! grep -q "SET search_path = ''" "$file"; then
                print_error "SECURITY DEFINER function in ${file} missing 'SET search_path = public'"
                echo "   Add: SET search_path = public"
            fi
        fi
        
        # Check for forbidden schema modifications
        FORBIDDEN_SCHEMAS=("auth\." "storage\." "realtime\." "vault\." "supabase_functions\.")
        for schema in "${FORBIDDEN_SCHEMAS[@]}"; do
            if grep -qE "ALTER.*${schema}|DROP.*${schema}|CREATE.*${schema}" "$file"; then
                print_error "Attempted to modify reserved schema in ${file}: ${schema}"
                echo "   NEVER modify auth, storage, realtime, vault, or supabase_functions schemas"
            fi
        done
        
        # Check for auth.users references
        if grep -qE "REFERENCES\s+auth\.users|FOREIGN KEY.*auth\.users" "$file"; then
            print_error "Foreign key reference to auth.users in ${file}"
            echo "   Use public.profiles instead of auth.users"
        fi
    done
    
    if [ $ERRORS -eq 0 ]; then
        print_success "Database migrations follow security rules"
    fi
else
    print_success "No database migrations to validate"
fi

echo ""
echo "5️⃣  Validating Edge Functions..."

EDGE_FUNCTIONS=$(git diff --cached --name-only | grep -E 'supabase/functions/.*index\.ts$' || true)

if [ -n "$EDGE_FUNCTIONS" ]; then
    for func in $EDGE_FUNCTIONS; do
        # Check for Zod validation on req.json()
        if grep -q "req\.json()" "$func"; then
            if ! grep -q "import.*zod" "$func" && ! grep -q "from 'zod'" "$func"; then
                print_warning "Edge function ${func} uses req.json() but may be missing Zod validation"
            fi
        fi
        
        # Check for CORS handling
        if ! grep -q "OPTIONS" "$func"; then
            print_warning "Edge function ${func} may be missing CORS OPTIONS handling"
        fi
        
        # Check for shared deps import
        if ! grep -q "_shared/deps" "$func"; then
            print_warning "Edge function ${func} should import from _shared/deps.ts"
        fi
    done
    
    if [ $ERRORS -eq 0 ]; then
        print_success "Edge functions follow best practices"
    fi
else
    print_success "No edge functions to validate"
fi

echo ""
echo "6️⃣  Running TypeScript type check..."

if ! npx tsc --noEmit --skipLibCheck; then
    print_error "TypeScript compilation failed"
    echo "   Fix type errors before pushing"
else
    print_success "TypeScript types are valid"
fi

echo ""
echo "7️⃣  Running linter..."

if ! npm run lint 2>&1 | grep -q "0 errors"; then
    print_error "Linter found issues"
    echo "   Run 'npm run lint' to see details"
else
    print_success "No linting errors"
fi

echo ""
echo "8️⃣  Running build test..."

# Increase Node.js heap size for build
export NODE_OPTIONS="--max-old-space-size=4096"

if ! npm run build > /dev/null 2>&1; then
    print_error "Build failed"
    echo "   Run 'npm run build' to see details"
else
    print_success "Build successful"
fi

echo ""
echo "9️⃣  Checking commit message format..."

# Get the commit message
COMMIT_MSG=$(git log -1 --pretty=%B)

# Check conventional commit format
if ! echo "$COMMIT_MSG" | grep -qE "^(feat|fix|docs|style|refactor|perf|test|chore|build|ci)(\(.+\))?: .+"; then
    print_warning "Commit message doesn't follow conventional format"
    echo "   Expected: type(scope): description"
    echo "   Examples: feat(auth): add login page"
    echo "            fix(products): resolve SKU validation"
fi

echo ""
echo "================================================"

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All validation checks passed!${NC}"
    echo -e "${GREEN}✅ Ready to push to GitHub${NC}"
    exit 0
else
    echo -e "${RED}❌ Found ${ERRORS} error(s) - Push blocked${NC}"
    echo ""
    echo "Please fix the errors above before pushing."
    echo "To bypass (not recommended): git push --no-verify"
    exit 1
fi
