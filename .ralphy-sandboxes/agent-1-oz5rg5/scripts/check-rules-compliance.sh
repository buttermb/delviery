#!/bin/bash

# Comprehensive Rules Compliance Checker
# Validates code against all established rules
# Usage: bash scripts/check-rules-compliance.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

VIOLATIONS=0
WARNINGS=0

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 COMPREHENSIVE RULES COMPLIANCE CHECK${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Function to report violations
violation() {
  echo -e "${RED}❌ VIOLATION:${NC} $1"
  VIOLATIONS=$((VIOLATIONS + 1))
}

warning() {
  echo -e "${YELLOW}⚠️  WARNING:${NC} $1"
  WARNINGS=$((WARNINGS + 1))
}

success() {
  echo -e "${GREEN}✅${NC} $1"
}

# 1. Check for console.log in frontend
echo "1️⃣ Checking for console.log in frontend..."
CONSOLE_LOGS=$(grep -r "console\.log\|console\.error\|console\.warn" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" | grep -v "\.test\." | grep -v "\.spec\." || true)
if [ -n "$CONSOLE_LOGS" ]; then
  violation "Found console.log/error/warn in frontend (use logger instead)"
  echo "$CONSOLE_LOGS" | head -5
else
  success "No console.log statements found"
fi
echo ""

# 2. Check for hardcoded secrets
echo "2️⃣ Checking for hardcoded secrets..."
SECRETS=$(grep -r "sk_live\|sk_test\|api_key.*=.*['\"]\|password.*=.*['\"]" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" || true)
if [ -n "$SECRETS" ]; then
  violation "Found potential hardcoded secrets"
  echo "$SECRETS"
else
  success "No hardcoded secrets found"
fi
echo ""

# 3. Check localStorage usage
echo "3️⃣ Checking localStorage usage..."
LOCAL_STORAGE=$(grep -r "localStorage\.\(getItem\|setItem\|removeItem\)" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "STORAGE_KEYS\|safeStorage\|node_modules" || true)
if [ -n "$LOCAL_STORAGE" ]; then
  warning "Found localStorage usage without STORAGE_KEYS (consider using safeStorage)"
  echo "$LOCAL_STORAGE" | head -5
else
  success "localStorage usage looks good"
fi
echo ""

# 4. Check for any types
echo "4️⃣ Checking for 'any' types..."
ANY_TYPES=$(grep -r ": any\|<any>\|any\[\]" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" | grep -v "\.test\." | grep -v "\.spec\." || true)
if [ -n "$ANY_TYPES" ]; then
  warning "Found 'any' types (consider using 'unknown' instead)"
  echo "$ANY_TYPES" | head -5
else
  success "No 'any' types found"
fi
echo ""

# 5. Check for relative imports
echo "5️⃣ Checking for relative imports..."
RELATIVE_IMPORTS=$(grep -r "from ['\"]\.\.\/" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" || true)
if [ -n "$RELATIVE_IMPORTS" ]; then
  warning "Found relative imports (use @/ alias instead)"
  echo "$RELATIVE_IMPORTS" | head -5
else
  success "All imports use @/ alias"
fi
echo ""

# 6. Check for default exports in components
echo "6️⃣ Checking for default exports in components..."
DEFAULT_EXPORTS=$(grep -r "export default" src/components/ --include="*.tsx" 2>/dev/null | grep -v "node_modules" || true)
if [ -n "$DEFAULT_EXPORTS" ]; then
  warning "Found default exports in components (use named exports)"
  echo "$DEFAULT_EXPORTS" | head -5
else
  success "No default exports in components"
fi
echo ""

# 7. Check for missing tenant_id in queries
echo "7️⃣ Checking for queries missing tenant_id filter..."
QUERIES=$(grep -r "\.from(" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "tenantQuery\|tenant\.id\|tenantId\|tenant_id\|node_modules" | grep -v "\.test\." | grep -v "\.spec\." || true)
if [ -n "$QUERIES" ]; then
  warning "Found queries that may need tenant_id filter (consider using tenantQuery helper)"
  echo "$QUERIES" | head -5
else
  success "All queries appear to use tenant isolation"
fi
echo ""

# 8. Check for window.location usage
echo "8️⃣ Checking for window.location usage..."
WINDOW_LOCATION=$(grep -r "window\.location" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" || true)
if [ -n "$WINDOW_LOCATION" ]; then
  warning "Found window.location usage (use useNavigate or Link instead)"
  echo "$WINDOW_LOCATION" | head -5
else
  success "No window.location usage found"
fi
echo ""

# 9. Check for <a> tags in components
echo "9️⃣ Checking for <a> tags (should use Link)..."
A_TAGS=$(grep -r "<a href=" src/components/ src/pages/ --include="*.tsx" 2>/dev/null | grep -v "node_modules" | grep -v "http://\|https://" || true)
if [ -n "$A_TAGS" ]; then
  warning "Found <a> tags for internal navigation (use Link component)"
  echo "$A_TAGS" | head -5
else
  success "No <a> tags for internal navigation"
fi
echo ""

# 10. Check Edge Functions
echo "🔟 Checking Edge Functions..."
EDGE_FUNCTIONS=$(find supabase/functions -name "index.ts" -type f | grep -v "_shared" || true)
for func in $EDGE_FUNCTIONS; do
  # Check for Zod validation
  if grep -q "req\.json()\|await req\.json()" "$func" 2>/dev/null; then
    if ! grep -q "z\.object\|RequestSchema\|safeParse\|parse\|ZodError" "$func" 2>/dev/null; then
      violation "Edge function $func uses req.json() without Zod validation"
    fi
  fi
  
  # Check for CORS handling
  if ! grep -q "OPTIONS\|corsHeaders" "$func" 2>/dev/null; then
    warning "Edge function $func may be missing CORS handling"
  fi
  
  # Check for shared deps
  if grep -q "from \"https://deno.land/std" "$func" 2>/dev/null || \
     grep -q "from 'https://deno.land/std" "$func" 2>/dev/null; then
    if ! grep -q "from '../_shared/deps.ts'" "$func" 2>/dev/null && \
       ! grep -q "from \"../_shared/deps.ts\"" "$func" 2>/dev/null; then
      warning "Edge function $func may not use shared deps.ts"
    fi
  fi
done
if [ $VIOLATIONS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  success "Edge Functions look good"
fi
echo ""

# 11. Check migrations
echo "1️⃣1️⃣ Checking migrations..."
MIGRATIONS=$(find supabase/migrations -name "*.sql" -type f || true)
for migration in $MIGRATIONS; do
  # Check for SECURITY DEFINER without search_path
  if grep -q "SECURITY DEFINER" "$migration" 2>/dev/null; then
    if ! grep -q "SET search_path = public" "$migration" 2>/dev/null; then
      violation "Migration $migration has SECURITY DEFINER without SET search_path = public"
    fi
  fi
  
  # Check for auth.users references
  if grep -q "REFERENCES auth\.users" "$migration" 2>/dev/null; then
    violation "Migration $migration references auth.users (use public.profiles instead)"
  fi
done
if [ $VIOLATIONS -eq 0 ]; then
  success "Migrations look good"
fi
echo ""

# 12. Check auto-generated files
echo "1️⃣2️⃣ Checking for edits to auto-generated files..."
AUTO_GEN_FILES=(
  "src/integrations/supabase/client.ts"
  "src/integrations/supabase/types.ts"
)
for file in "${AUTO_GEN_FILES[@]}"; do
  if [ -f "$file" ]; then
    if git diff "$file" 2>/dev/null | grep -q "^+" | grep -v "^+++"; then
      violation "Auto-generated file $file has been modified"
    else
      success "$file is not modified"
    fi
  fi
done
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ $VIOLATIONS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅ ALL CHECKS PASSED!${NC}"
  echo -e "${GREEN}Your code follows all established rules.${NC}"
  exit 0
elif [ $VIOLATIONS -eq 0 ]; then
  echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found${NC}"
  echo -e "${GREEN}✅ No critical violations${NC}"
  echo ""
  echo "Review warnings above and fix as needed."
  exit 0
else
  echo -e "${RED}❌ $VIOLATIONS violation(s) and $WARNINGS warning(s) found${NC}"
  echo ""
  echo "Please fix violations before pushing code."
  echo "See docs/ULTIMATE_RULEBOOK.md for complete rules."
  exit 1
fi

