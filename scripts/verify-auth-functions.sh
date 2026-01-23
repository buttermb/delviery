#!/bin/bash
# Verify Auth Edge Functions Health
# Quick health check for all auth edge functions without deploying.
#
# Usage:
#   ./scripts/verify-auth-functions.sh
#   ./scripts/verify-auth-functions.sh <project-ref>

PROJECT_REF="${1:-mtvwmyerntkhrcdnhahp}"
BASE_URL="https://${PROJECT_REF}.supabase.co/functions/v1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

AUTH_FUNCTIONS=(
  "tenant-admin-auth"
  "super-admin-auth"
  "customer-auth"
  "revoke-all-sessions"
)

echo "Verifying auth functions at: ${BASE_URL}"
echo "-------------------------------------------"

FAILED=0
PASSED=0

for fn in "${AUTH_FUNCTIONS[@]}"; do
  echo -n "  ${fn}: "

  RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${BASE_URL}/${fn}?action=health" \
    -H "Content-Type: application/json" \
    --max-time 10 \
    2>/dev/null)

  HTTP_CODE=$(echo "${RESPONSE}" | tail -n1)
  BODY=$(echo "${RESPONSE}" | head -n -1)

  if [ "${HTTP_CODE}" = "200" ]; then
    # Parse env status from response
    SUPABASE_URL=$(echo "${BODY}" | grep -o '"SUPABASE_URL":true' || echo "")
    SERVICE_KEY=$(echo "${BODY}" | grep -o '"SUPABASE_SERVICE_ROLE_KEY":true' || echo "")
    JWT=$(echo "${BODY}" | grep -o '"JWT_SECRET":true' || echo "")

    MISSING=""
    if [ -z "${SUPABASE_URL}" ]; then MISSING="${MISSING} SUPABASE_URL"; fi
    if [ -z "${SERVICE_KEY}" ]; then MISSING="${MISSING} SUPABASE_SERVICE_ROLE_KEY"; fi

    if [ -z "${MISSING}" ]; then
      echo -e "${GREEN}OK${NC}"
      PASSED=$((PASSED + 1))
    else
      echo -e "${YELLOW}WARN${NC} - missing env:${MISSING}"
      PASSED=$((PASSED + 1))
    fi
  elif [ "${HTTP_CODE}" = "000" ]; then
    echo -e "${RED}TIMEOUT${NC} (no response)"
    FAILED=$((FAILED + 1))
  else
    echo -e "${RED}FAIL${NC} (HTTP ${HTTP_CODE})"
    FAILED=$((FAILED + 1))
  fi
done

echo "-------------------------------------------"
echo "Results: ${PASSED} passed, ${FAILED} failed"

if [ $FAILED -gt 0 ]; then
  exit 1
fi
