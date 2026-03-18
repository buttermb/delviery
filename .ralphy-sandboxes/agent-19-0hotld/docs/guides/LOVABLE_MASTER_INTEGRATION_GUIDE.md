# 🚀 FloraIQ Lovable Platform - Complete Integration Guide

**Last Updated**: November 25, 2024  
**Platform**: Lovable.dev  
**Version**: 2.0

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Platform Overview](#platform-overview)
3. [Prerequisites](#prerequisites)
4. [Initial Setup](#initial-setup)
5. [Database Configuration](#database-configuration)
6. [Edge Functions Deployment](#edge-functions-deployment)
7. [Environment Variables](#environment-variables)
8. [Feature Integration](#feature-integration)
9. [Testing & Verification](#testing--verification)
10. [Deployment](#deployment)
11. [Troubleshooting](#troubleshooting)
12. [Advanced Topics](#advanced-topics)

---

## 🎯 Quick Start

### Step 1: Clone and Install
```bash
cd /path/to/delviery-main
npm install
```

### Step 2: Configure Environment
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

### Step 3: Run Migrations
```bash
supabase migration up
```

### Step 4: Deploy Edge Functions
```bash
npm run deploy:functions
```

### Step 5: Start Development Server
```bash
npm run dev
```

---

## 🏗️ Platform Overview

FloraIQ is a comprehensive multi-tenant cannabis delivery platform built for Lovable.dev with:

- **3-Tier Authentication**: Super Admin, Tenant Admin, Customer
- **Multi-Tenant SaaS**: Full tenant isolation with RLS
- **Real-time Features**: Live orders, tracking, notifications
- **Mobile-First Design**: Optimized for iOS/Android
- **Stripe Integration**: Subscriptions, payments, billing
- **Advanced Security**: Encryption, compliance, audit logs

### Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui
- **State**: TanStack Query + React Context
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Auth**: Supabase Auth (JWT)
- **Storage**: Supabase Storage
- **Payments**: Stripe
- **Maps**: Mapbox GL
- **Real-time**: Supabase Realtime

---

## ✅ Prerequisites

### Required Accounts
- [x] Lovable.dev account
- [x] Supabase project (free tier OK)
- [x] Stripe account (test mode)
- [x] Mapbox account (free tier)
- [x] Twilio account (optional, for SMS)
- [x] SendGrid account (optional, for email)

### Required Knowledge
- React/TypeScript fundamentals
- SQL basics
- REST API concepts
- Supabase basics

---

## 🚀 Initial Setup

### 1. Lovable Project Configuration

#### Import Project
1. Go to Lovable.dev dashboard
2. Click "Import Project"
3. Connect GitHub repository or upload ZIP
4. Wait for initial analysis

#### Configure Build Settings
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "devCommand": "npm run dev"
}
```

### 2. Supabase Project Setup

#### Create Project
1. Go to supabase.com
2. Create new project
3. Wait for provisioning (2-3 minutes)
4. Note down:
   - Project URL
   - Anon Key
   - Service Role Key (keep secret!)

#### Enable Required Extensions
Run in SQL Editor:
```sql
-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
```

---

## 💾 Database Configuration

### Migration Order

Run migrations in this exact order:

```bash
# 1. Core Schema
supabase/migrations/20231101000000_initial_schema.sql

# 2. Tenant System
supabase/migrations/20231102000000_tenant_schema.sql

# 3. Admin Panel
supabase/migrations/20250122000012_admin_panel_tables.sql

# 4. Features
supabase/migrations/20231103000000_feature_schema.sql

# 5. RLS Policies
supabase/migrations/20231104000000_rls_policies.sql

# 6. Functions & Triggers
supabase/migrations/20231105000000_functions_triggers.sql
```

### Critical Tables

#### Accounts & Tenants
```sql
- accounts (Stripe integration, subscription)
- tenants (Operation size, business tier)
- tenant_users (Multi-tenant user mapping)
```

#### Core Business
```sql
- products
- orders
- customers
- wholesale_clients
- wholesale_orders
- disposable_menus
```

#### Feature Tables
```sql
- suppliers
- purchase_orders
- return_authorizations
- loyalty_program_config
- coupons
- quality_control_tests
- marketing_campaigns
- appointments
- support_tickets
- batch_recalls
- compliance_documents
```

### RLS (Row Level Security)

All tables MUST have RLS policies for tenant isolation:

```sql
-- Example RLS Policy
CREATE POLICY "Tenants can manage own data"
  ON table_name FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM tenant_users 
      WHERE user_id = auth.uid()
    )
  );
```

---

## ⚡ Edge Functions Deployment

### Required Functions

| Function | Purpose | Cron? |
|----------|---------|-------|
| `tenant-admin-auth` | Tenant admin authentication | No |
| `super-admin-auth` | Super admin authentication | No |
| `customer-auth` | Customer authentication | No |
| `create-order` | Atomic order creation | No |
| `wholesale-order-create` | Wholesale order creation | No |
| `wholesale-payment-process` | Payment processing | No |
| `menu-generate` | Disposable menu generation | No |
| `menu-access-validate` | Menu access validation | No |
| `stripe-webhook` | Stripe event handling | No |
| `create-purchase-order` | Purchase order creation | No |
| `process-return` | Return processing | No |
| `send-marketing-campaign` | Email/SMS campaigns | No |
| `notify-recall` | Batch recall notifications | No |
| `generate-custom-report` | Custom report generation | No |
| `send-scheduled-report` | Scheduled reports | Yes |
| `check-usage-limits` | Usage limit monitoring | Yes |
| `check-trial-reminders` | Trial expiration reminders | Yes |

### Deploy All Functions

```bash
# Deploy all at once
for dir in supabase/functions/*/; do
  func_name=$(basename "$dir")
  echo "Deploying $func_name..."
  supabase functions deploy "$func_name"
done
```

### Set Function Secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set TWILIO_ACCOUNT_SID=AC...
supabase secrets set TWILIO_AUTH_TOKEN=...
supabase secrets set SENDGRID_API_KEY=SG...
supabase secrets set MAPBOX_SECRET_KEY=sk...
```

---

## 🔐 Environment Variables

### `.env.local` (Development)

```env
# Supabase
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_STRIPE_SECRET_KEY=sk_test_...

# Mapbox
VITE_MAPBOX_ACCESS_TOKEN=pk.eyJ1...

# Optional: Twilio
VITE_TWILIO_ACCOUNT_SID=AC...
VITE_TWILIO_AUTH_TOKEN=...

# Optional: SendGrid
VITE_SENDGRID_API_KEY=SG...

# Optional: AI Features
VITE_OPENAI_API_KEY=sk-...
```

### Lovable Environment Variables

Add these in Lovable dashboard → Settings → Environment Variables:

| Variable | Value | Secret? |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | Your Supabase URL | No |
| `VITE_SUPABASE_ANON_KEY` | Your anon key | No |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe public key | No |
| `VITE_STRIPE_SECRET_KEY` | Stripe secret key | **Yes** |
| `VITE_MAPBOX_ACCESS_TOKEN` | Mapbox token | **Yes** |

---

## 🎨 Feature Integration

### Tier-Based Features

#### Trap Tier (Free)
- Basic dashboard
- Product catalog
- Simple menus
- Manual orders
- Basic analytics

#### Small Tier ($99/month)
- Trap features +
- Disposable menus
- Customer management
- Basic CRM
- Email notifications

#### Medium Tier ($299/month)
- Small features +
- Suppliers
- Purchase orders
- Returns management
- Loyalty program
- Coupons
- Quality control

#### Large Tier ($599/month)
- Medium features +
- Advanced CRM
- Marketing automation
- Appointments
- Support tickets
- Batch recall
- Compliance vault

#### Enterprise Tier (Custom)
- Large features +
- Predictive analytics
- Vendor portal
- Custom integrations
- White-label
- SLA support

### Feature Registry

All features are defined in `src/lib/sidebar/featureRegistry.ts`:

```typescript
'feature-id': {
  id: 'feature-id',
  name: 'Feature Name',
  icon: IconComponent,
  path: '/admin/feature-path',
  category: 'Operations',
  minOperationSize: 'small',
  minBusinessTier: 'trap',
  requiredIntegrations: ['stripe']  // optional
}
```

### Adding a New Feature

#### Step 1: Update Feature Registry
```typescript
// src/lib/sidebar/featureRegistry.ts
'new-feature': {
  id: 'new-feature',
  name: 'New Feature',
  icon: Package,
  path: '/admin/new-feature',
  category: 'Operations',
  minOperationSize: 'medium',
  minBusinessTier: 'medium'
}
```

#### Step 2: Create Page Component
```typescript
// src/pages/admin/NewFeaturePage.tsx
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

export default function NewFeaturePage() {
  const { tenant, admin } = useTenantAdminAuth();
  
  return (
    <div className="p-6">
      <h1>New Feature</h1>
      {/* Your feature UI */}
    </div>
  );
}
```

#### Step 3: Add Route
```typescript
// src/App.tsx
import NewFeaturePage from './pages/admin/NewFeaturePage';

// In routes array:
{
  path: '/admin/new-feature',
  element: <NewFeaturePage />
}
```

#### Step 4: Create Database Tables
```sql
-- supabase/migrations/YYYYMMDDHHMMSS_new_feature.sql
CREATE TABLE new_feature_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Your columns
);

-- RLS Policy
ALTER TABLE new_feature_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants manage own data"
  ON new_feature_data FOR ALL
  USING (tenant_id = (
    SELECT tenant_id FROM tenant_users 
    WHERE user_id = auth.uid()
  ));

-- Indexes
CREATE INDEX idx_new_feature_tenant ON new_feature_data(tenant_id);
CREATE INDEX idx_new_feature_created ON new_feature_data(created_at DESC);
```

---

## 🧪 Testing & Verification

### Testing Checklist

#### Authentication
- [ ] Super admin login works
- [ ] Tenant admin login works
- [ ] Customer login works
- [ ] Logout works for all user types
- [ ] Session persistence works
- [ ] Protected routes redirect correctly

#### Multi-Tenancy
- [ ] Tenants see only their data
- [ ] RLS policies block cross-tenant access
- [ ] Tenant switching works (super admin)
- [ ] Tenant creation works
- [ ] Tenant deletion cascades properly

#### Features
- [ ] All routes load without errors
- [ ] Feature gating works correctly
- [ ] Tier restrictions enforced
- [ ] Integration requirements checked
- [ ] Data fetching works
- [ ] Mutations work and invalidate queries
- [ ] Error handling works

#### UI/UX
- [ ] Mobile responsive
- [ ] Dark mode works
- [ ] Loading states shown
- [ ] Error states shown
- [ ] Empty states shown
- [ ] Toasts/notifications work

#### Billing
- [ ] Stripe checkout works
- [ ] Subscription creation works
- [ ] Subscription upgrades work
- [ ] Subscription downgrades work
- [ ] Webhook handling works
- [ ] Usage limits enforced

### Testing Commands

```bash
# Lint
npm run lint

# Type check
npm run type-check

# Build
npm run build

# Run tests (if you have any)
npm test

# E2E tests
npx playwright test
```

---

## 🚀 Deployment

### Lovable Deployment

#### Automatic Deployment
Lovable automatically deploys on git push to main branch.

#### Manual Deployment
1. Go to Lovable dashboard
2. Click "Deploy"
3. Wait for build to complete
4. Check deployment logs

### Vercel Deployment (Alternative)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Post-Deployment Checklist

- [ ] All environment variables set
- [ ] Database migrations applied
- [ ] Edge functions deployed
- [ ] Storage buckets configured
- [ ] RLS policies active
- [ ] Stripe webhooks configured
- [ ] DNS configured (if custom domain)
- [ ] SSL certificate active
- [ ] Test all critical flows
- [ ] Monitor error logs

---

## 🔧 Troubleshooting

### Common Issues

#### Build Fails
**Problem**: TypeScript errors or missing dependencies  
**Solution**:
```bash
npm install
npm run type-check
# Fix any TypeScript errors
npm run build
```

#### Database Connection Issues
**Problem**: "Could not connect to database"  
**Solution**:
- Check Supabase URL and anon key
- Verify project is not paused
- Check network connectivity

#### RLS Blocking Queries
**Problem**: Queries return empty even with data  
**Solution**:
- Verify RLS policies exist and are correct
- Check `tenant_id` is included in WHERE clause
- Verify user is authenticated

#### Feature Not Showing
**Problem**: New feature not in sidebar  
**Solution**:
- Check `featureRegistry.ts` has feature
- Verify tier requirements
- Check integration requirements
- Clear browser cache

#### Edge Function Failing
**Problem**: Edge function returns 500 error  
**Solution**:
- Check function logs in Supabase dashboard
- Verify all secrets are set
- Test locally with `supabase functions serve`
- Check function imports are correct

### Debug Tools

#### React Query Devtools
```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// In your App.tsx
<ReactQueryDevtools initialIsOpen={false} />
```

#### Sidebar Debugger
Go to Settings → Debug Sidebar to see:
- All available features
- Why features are hidden
- Current tier and integrations
- User permissions

#### Supabase Logs
1. Go to Supabase dashboard
2. Logs → Edge Functions
3. Filter by function name
4. Check error messages

---

## 🎓 Advanced Topics

### Custom Hooks

#### useFeatureAccess
```typescript
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

function MyComponent() {
  const { hasAccess, reason } = useFeatureAccess('feature-id');
  
  if (!hasAccess) {
    return <UpgradeBanner reason={reason} />;
  }
  
  return <YourFeature />;
}
```

#### useTenantSettings
```typescript
import { useTenantSettings } from '@/hooks/useTenantSettings';

function MyComponent() {
  const { settings, updateSettings } = useTenantSettings();
  
  // Access settings
  const taxRate = settings?.tax_rate || 0;
  
  // Update settings
  await updateSettings({ tax_rate: 0.08 });
}
```

### Query Key Factories

Use consistent query keys:

```typescript
// src/lib/queryKeys.ts
export const queryKeys = {
  products: {
    all: () => ['products'],
    lists: () => [...queryKeys.products.all(), 'list'],
    list: (filters) => [...queryKeys.products.lists(), filters],
    details: () => [...queryKeys.products.all(), 'detail'],
    detail: (id) => [...queryKeys.products.details(), id],
  },
  // ... other entities
};
```

### Optimistic Updates

```typescript
const mutation = useMutation({
  mutationFn: updateProduct,
  onMutate: async (newProduct) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: queryKeys.products.all() });
    
    // Snapshot previous value
    const previousProducts = queryClient.getQueryData(queryKeys.products.all());
    
    // Optimistically update
    queryClient.setQueryData(queryKeys.products.all(), old => {
      return old.map(p => p.id === newProduct.id ? newProduct : p);
    });
    
    // Return context
    return { previousProducts };
  },
  onError: (err, newProduct, context) => {
    // Rollback on error
    queryClient.setQueryData(
      queryKeys.products.all(),
      context.previousProducts
    );
  },
  onSettled: () => {
    // Always refetch after mutation
    queryClient.invalidateQueries({ queryKey: queryKeys.products.all() });
  },
});
```

### Real-time Subscriptions

```typescript
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

function useRealtimeOrders(tenantId: string) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${tenantId}`
        },
        (payload) => {
          // Invalidate queries on change
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);
}
```

---

## 📚 Additional Resources

### Documentation Files

- **Quick Reference**: `LOVABLE_QUICK_REFERENCE.md`
- **Adaptive Sidebar**: `LOVABLE_ADAPTIVE_SIDEBAR_INTEGRATION_GUIDE.md`
- **Disposable Menus**: `LOVABLE_DISPOSABLE_MENU_INTEGRATION_GUIDE.md`
- **Forum Integration**: `LOVABLE_FORUM_MENU_INTEGRATION_GUIDE.md`
- **Super Admin**: `LOVABLE_SUPER_ADMIN_INTEGRATION.md`
- **Verification Checklist**: `LOVABLE_VERIFICATION_CHECKLIST.md`

### External Links

- [Lovable Documentation](https://docs.lovable.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [TanStack Query Docs](https://tanstack.com/query/latest)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Stripe API Reference](https://stripe.com/docs/api)

---

## 🤝 Support

### Getting Help

1. **Check documentation**: Review this guide and related docs
2. **Check logs**: Supabase dashboard → Logs
3. **Check browser console**: F12 → Console tab
4. **Check React Query Devtools**: See query states
5. **Use Sidebar Debugger**: Settings → Debug Sidebar

### Common Questions

**Q: How do I add a new tenant?**  
A: Use Super Admin panel → Tenants → Create Tenant

**Q: How do I change a tenant's tier?**  
A: Super Admin → Tenants → Edit → Change business tier

**Q: How do I enable a feature for a tenant?**  
A: Ensure tenant tier meets feature requirements, or upgrade subscription

**Q: How do I test Stripe without real money?**  
A: Use Stripe test mode with test cards: https://stripe.com/docs/testing

**Q: How do I migrate from test to production?**  
A: Switch Stripe keys from test to live, update webhooks, test thoroughly

---

**🎉 You're all set!** Your FloraIQ platform is ready for Lovable deployment.
