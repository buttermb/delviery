#!/bin/bash
# Deploy and Verify Auth Edge Functions
# Project: FloraIQ (mtvwmyerntkhrcdnhahp)
#
# This script deploys all auth-related Supabase Edge Functions
# and verifies they are running correctly via health checks.
#
# Prerequisites:
#   - Supabase CLI installed (npx supabase or globally)
#   - Project linked: supabase link --project-ref mtvwmyerntkhrcdnhahp
#   - Required secrets configured:
#     - JWT_SECRET
#     - SUPABASE_SERVICE_ROLE_KEY

set -e

PROJECT_REF="mtvwmyerntkhrcdnhahp"
BASE_URL="https://${PROJECT_REF}.supabase.co/functions/v1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Auth functions to deploy
AUTH_FUNCTIONS=(
  "tenant-admin-auth"
  "super-admin-auth"
  "customer-auth"
  "revoke-all-sessions"
)

echo "============================================"
echo "FloraIQ Auth Edge Functions Deployment"
echo "Project: ${PROJECT_REF}"
echo "============================================"
echo ""

# Step 1: Link project (if not already linked)
echo -e "${YELLOW}Step 1: Ensuring project is linked...${NC}"
cd "$(dirname "$0")/../supabase"

if ! npx supabase projects list 2>/dev/null | grep -q "${PROJECT_REF}"; then
  echo "Linking to project ${PROJECT_REF}..."
  npx supabase link --project-ref "${PROJECT_REF}"
else
  echo "Project already linked."
fi
echo ""

# Step 2: Verify secrets are configured
echo -e "${YELLOW}Step 2: Checking required secrets...${NC}"
SECRETS_OUTPUT=$(npx supabase secrets list 2>/dev/null || echo "FAILED")

if echo "${SECRETS_OUTPUT}" | grep -q "JWT_SECRET"; then
  echo -e "  ${GREEN}✓${NC} JWT_SECRET is set"
else
  echo -e "  ${RED}✗${NC} JWT_SECRET is NOT set"
  echo "    Set it with: npx supabase secrets set JWT_SECRET=<your-secret>"
fi

if echo "${SECRETS_OUTPUT}" | grep -q "SUPABASE_SERVICE_ROLE_KEY"; then
  echo -e "  ${GREEN}✓${NC} SUPABASE_SERVICE_ROLE_KEY is set"
else
  echo -e "  ${RED}✗${NC} SUPABASE_SERVICE_ROLE_KEY is NOT set"
  echo "    Set it with: npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-key>"
fi
echo ""

# Step 3: Deploy each auth function
echo -e "${YELLOW}Step 3: Deploying auth functions...${NC}"
DEPLOY_FAILED=0

for fn in "${AUTH_FUNCTIONS[@]}"; do
  echo -n "  Deploying ${fn}... "
  if npx supabase functions deploy "${fn}" --no-verify-jwt 2>/dev/null; then
    echo -e "${GREEN}✓${NC}"
  else
    echo -e "${RED}✗ FAILED${NC}"
    DEPLOY_FAILED=1
  fi
done
echo ""

if [ $DEPLOY_FAILED -eq 1 ]; then
  echo -e "${RED}Some deployments failed. Check errors above.${NC}"
  exit 1
fi

# Step 4: Verify health checks
echo -e "${YELLOW}Step 4: Verifying health checks...${NC}"
HEALTH_FAILED=0

for fn in "${AUTH_FUNCTIONS[@]}"; do
  echo -n "  Health check ${fn}... "

  RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${BASE_URL}/${fn}?action=health" \
    -H "Content-Type: application/json" \
    2>/dev/null)

  HTTP_CODE=$(echo "${RESPONSE}" | tail -n1)
  BODY=$(echo "${RESPONSE}" | head -n -1)

  if [ "${HTTP_CODE}" = "200" ]; then
    STATUS=$(echo "${BODY}" | grep -o '"status":"ok"' || echo "")
    if [ -n "${STATUS}" ]; then
      echo -e "${GREEN}✓${NC} (status: ok)"
    else
      echo -e "${YELLOW}⚠${NC} (HTTP 200 but unexpected body)"
      echo "    Response: ${BODY}"
    fi
  else
    echo -e "${RED}✗${NC} (HTTP ${HTTP_CODE})"
    echo "    Response: ${BODY}"
    HEALTH_FAILED=1
  fi
done
echo ""

# Summary
echo "============================================"
if [ $HEALTH_FAILED -eq 0 ]; then
  echo -e "${GREEN}All auth functions deployed and verified!${NC}"
  echo ""
  echo "Endpoints:"
  for fn in "${AUTH_FUNCTIONS[@]}"; do
    echo "  ${BASE_URL}/${fn}"
  done
else
  echo -e "${RED}Some health checks failed.${NC}"
  echo "Verify secrets are configured and functions deployed correctly."
  exit 1
fi
echo "============================================"
