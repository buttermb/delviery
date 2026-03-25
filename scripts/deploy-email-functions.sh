#!/bin/bash

# FloraIQ Email Verification Functions Deployment Script
# This script deploys the required edge functions for email verification

set -e  # Exit on error

echo "=================================="
echo "FloraIQ Email Functions Deployment"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}ERROR: Supabase CLI is not installed${NC}"
    echo "Install it with:"
    echo "  npm install -g supabase"
    echo "  or"
    echo "  brew install supabase/tap/supabase"
    exit 1
fi

echo -e "${GREEN}✓ Supabase CLI is installed${NC}"

# Check if project is linked
if [ ! -f ".supabase/config.toml" ]; then
    echo -e "${YELLOW}⚠ Project not linked to Supabase${NC}"
    echo "Link your project with:"
    echo "  supabase link --project-ref mtvwmyerntkhrcdnhahp"
    exit 1
fi

echo -e "${GREEN}✓ Project is linked${NC}"
echo ""

# Deploy send-klaviyo-email first (dependency)
echo "Deploying send-klaviyo-email function..."
if supabase functions deploy send-klaviyo-email --no-verify-jwt; then
    echo -e "${GREEN}✓ send-klaviyo-email deployed successfully${NC}"
else
    echo -e "${RED}✗ Failed to deploy send-klaviyo-email${NC}"
    exit 1
fi
echo ""

# Deploy resend-admin-verification
echo "Deploying resend-admin-verification function..."
if supabase functions deploy resend-admin-verification --no-verify-jwt; then
    echo -e "${GREEN}✓ resend-admin-verification deployed successfully${NC}"
else
    echo -e "${RED}✗ Failed to deploy resend-admin-verification${NC}"
    exit 1
fi
echo ""

# Deploy auth-verify-email
echo "Deploying auth-verify-email function..."
if supabase functions deploy auth-verify-email --no-verify-jwt; then
    echo -e "${GREEN}✓ auth-verify-email deployed successfully${NC}"
else
    echo -e "${RED}✗ Failed to deploy auth-verify-email${NC}"
    exit 1
fi
echo ""

echo "=================================="
echo -e "${GREEN}All functions deployed successfully!${NC}"
echo "=================================="
echo ""

# Check environment variables
echo "Checking environment variables..."
echo ""
echo -e "${YELLOW}⚠ Verify these secrets are set in Supabase Dashboard:${NC}"
echo "  → Project Settings → Edge Functions → Secrets"
echo ""
echo "Required secrets:"
echo "  • RESEND_API_KEY    (from https://resend.com/api-keys)"
echo "  • SITE_URL          (e.g., https://yourdomain.com)"
echo ""
echo "To set them via CLI:"
echo "  supabase secrets set RESEND_API_KEY=re_xxxxx..."
echo "  supabase secrets set SITE_URL=https://yourdomain.com"
echo ""

# Offer to view logs
echo "=================================="
echo "Next steps:"
echo "=================================="
echo ""
echo "1. Set environment variables (see above)"
echo "2. Test the verification flow in your app"
echo "3. View logs with:"
echo "   supabase functions logs resend-admin-verification --tail"
echo ""
echo "For troubleshooting, see:"
echo "   scripts/verify-email-troubleshooting.md"
echo ""
