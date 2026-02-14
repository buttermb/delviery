#!/bin/bash

# Script to find potential tenant isolation issues in the codebase
# Usage: bash scripts/find-tenant-isolation-issues.sh

echo "🔍 Scanning for tenant isolation issues..."
echo ""

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

ISSUES_FOUND=0

# 1. Find .from() calls without tenant_id filter
echo "1️⃣ Checking for queries missing tenant_id filter..."
QUERIES=$(grep -r "\.from(" src/ --include="*.ts" --include="*.tsx" | \
  grep -v "tenantQuery\|tenant\.id\|tenantId\|tenant_id" | \
  grep -v "node_modules" | \
  grep -v "\.test\." | \
  grep -v "\.spec\." | \
  grep -v "tenantQueries\.ts" || true)

if [ -n "$QUERIES" ]; then
  echo -e "${YELLOW}⚠️  Found queries that may need tenant_id filter:${NC}"
  echo "$QUERIES" | head -20
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
  echo -e "${GREEN}✅ No queries found without tenant context${NC}"
fi

echo ""

# 2. Find Edge Functions without tenant validation
echo "2️⃣ Checking Edge Functions for tenant validation..."
EDGE_FUNCTIONS=$(find supabase/functions -name "index.ts" -type f | grep -v "_shared" || true)

for func in $EDGE_FUNCTIONS; do
  # Skip if it's a public endpoint (no auth required)
  if grep -q "verify_jwt = false" supabase/config.toml 2>/dev/null; then
    continue
  fi
  
  # Check if it validates tenant access
  if ! grep -q "tenant_users\|tenant_id\|validateTenantAccess" "$func" 2>/dev/null; then
    if grep -q "\.from(" "$func" 2>/dev/null; then
      echo -e "${YELLOW}⚠️  $func may need tenant validation${NC}"
      ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
  fi
done

if [ $ISSUES_FOUND -eq 0 ]; then
  echo -e "${GREEN}✅ All Edge Functions appear to validate tenant access${NC}"
fi

echo ""

# 3. Find routes without TenantAdminProtectedRoute
echo "3️⃣ Checking admin routes for protection..."
ROUTES=$(grep -r "path=.*admin" src/ --include="*.tsx" | \
  grep -v "TenantAdminProtectedRoute" | \
  grep -v "node_modules" || true)

if [ -n "$ROUTES" ]; then
  echo -e "${YELLOW}⚠️  Found admin routes that may need TenantAdminProtectedRoute:${NC}"
  echo "$ROUTES" | head -10
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
  echo -e "${GREEN}✅ All admin routes appear to be protected${NC}"
fi

echo ""

# 4. Find React Query keys without tenant_id
echo "4️⃣ Checking React Query keys for tenant_id..."
QUERY_KEYS=$(grep -r "queryKey:" src/ --include="*.ts" --include="*.tsx" | \
  grep -v "tenant\.id\|tenantId\|queryKeys\." | \
  grep -v "node_modules" | \
  grep -v "\.test\." | \
  grep -v "\.spec\." || true)

if [ -n "$QUERY_KEYS" ]; then
  echo -e "${YELLOW}⚠️  Found query keys that may need tenant_id:${NC}"
  echo "$QUERY_KEYS" | head -10
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
  echo -e "${GREEN}✅ All query keys appear to include tenant context${NC}"
fi

echo ""

# 5. Find direct localStorage tenant access
echo "5️⃣ Checking for direct localStorage tenant access..."
LOCAL_STORAGE=$(grep -r "localStorage.*tenant" src/ --include="*.ts" --include="*.tsx" | \
  grep -v "STORAGE_KEYS\|useTenantAdminAuth" | \
  grep -v "node_modules" || true)

if [ -n "$LOCAL_STORAGE" ]; then
  echo -e "${YELLOW}⚠️  Found direct localStorage tenant access (use useTenantAdminAuth instead):${NC}"
  echo "$LOCAL_STORAGE" | head -5
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
  echo -e "${GREEN}✅ No direct localStorage tenant access found${NC}"
fi

echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ISSUES_FOUND -eq 0 ]; then
  echo -e "${GREEN}✅ No tenant isolation issues found!${NC}"
  exit 0
else
  echo -e "${RED}❌ Found $ISSUES_FOUND potential tenant isolation issue(s)${NC}"
  echo ""
  echo "📚 See docs/TENANT_ISOLATION_MIGRATION_GUIDE.md for migration help"
  exit 1
fi

