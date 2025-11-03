# 🚀 Complete Implementation Guide for Lovable

**Purpose:** Comprehensive guide to implement all features correctly without bugs  
**Target:** Lovable AI Coding Assistant  
**Status:** Production-Ready System

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Environment Setup](#environment-setup)
3. [Database Schema Requirements](#database-schema-requirements)
4. [Authentication System](#authentication-system)
5. [Billing & Subscription](#billing--subscription)
6. [Error Handling Patterns](#error-handling-patterns)
7. [Code Patterns & Best Practices](#code-patterns--best-practices)
8. [Common Bugs & Fixes](#common-bugs--fixes)
9. [Testing Checklist](#testing-checklist)
10. [Complete Page Reference - All Restored Pages](#complete-page-reference---all-restored-pages)
11. [Page Implementation Template](#page-implementation-template)

---

## 🏗️ System Overview

### Architecture
- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **State Management:** TanStack Query v5
- **Routing:** React Router v6
- **UI:** Radix UI + Tailwind CSS

### Key Features
- ✅ Multi-tenant SaaS platform
- ✅ Three-tier authentication (Super Admin, Tenant Admin, Customer)
- ✅ Subscription billing with Stripe integration
- ✅ 93 Admin pages with Enterprise tier features
- ✅ Graceful error handling for missing database tables
- ✅ Feature-based access control
- ✅ All 34 restored pages with complete error handling

---

## ⚙️ Environment Setup

### Required Environment Variables

#### Supabase Project Settings → Edge Functions → Secrets

```bash
# Required for Stripe integration
STRIPE_SECRET_KEY=sk_live_...  # or sk_test_... for testing

# Required for redirect URLs
SITE_URL=https://your-domain.com  # or http://localhost:5173 for dev

# Optional: For webhook verification
STRIPE_WEBHOOK_SECRET=whsec_...

# Auto-configured (don't set manually)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Frontend Environment Variables (.env.local)

```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Setting Up Environment Variables

1. **In Supabase Dashboard:**
   - Navigate to **Project Settings** → **Edge Functions** → **Secrets**
   - Click **Add new secret**
   - Enter name and value
   - Save

2. **For Local Development:**
   - Create `.env.local` file in project root
   - Add variables with `VITE_` prefix for frontend

---

## 🗄️ Database Schema Requirements

### Critical Tables

#### 1. `tenants` Table

**Required Columns:**
```sql
id UUID PRIMARY KEY
business_name TEXT
slug TEXT UNIQUE
owner_email TEXT
subscription_plan TEXT CHECK (subscription_plan IN ('starter', 'professional', 'enterprise'))
subscription_status TEXT CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled', 'suspended'))
subscription_current_period_start TIMESTAMPTZ
subscription_current_period_end TIMESTAMPTZ
stripe_customer_id TEXT
stripe_subscription_id TEXT
mrr DECIMAL(10,2)
limits JSONB DEFAULT '{}'
usage JSONB DEFAULT '{}'
features JSONB DEFAULT '{}'
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

**Optional Columns (gracefully handled if missing):**
- `onboarding_completed BOOLEAN`
- `demo_data_generated BOOLEAN`
- `trial_ends_at TIMESTAMPTZ`

#### 2. `tenant_users` Table

```sql
id UUID PRIMARY KEY
tenant_id UUID REFERENCES tenants(id)
email TEXT
name TEXT
role TEXT CHECK (role IN ('owner', 'admin', 'manager', 'viewer', 'runner', 'warehouse'))
password_hash TEXT
status TEXT DEFAULT 'active'
created_at TIMESTAMPTZ DEFAULT NOW()
```

#### 3. `invoices` Table

```sql
id UUID PRIMARY KEY
tenant_id UUID REFERENCES tenants(id)
invoice_number VARCHAR(50) UNIQUE
stripe_invoice_id VARCHAR(255)
subtotal DECIMAL(10,2)
tax DECIMAL(10,2) DEFAULT 0
total DECIMAL(10,2)
amount_due DECIMAL(10,2)
amount_paid DECIMAL(10,2) DEFAULT 0
line_items JSONB DEFAULT '[]'
billing_period_start DATE
billing_period_end DATE
issue_date DATE
due_date DATE
paid_at TIMESTAMPTZ
status VARCHAR(20) DEFAULT 'open'
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

#### 4. Optional Tables (Gracefully Handled if Missing)

**ALL RESTORED PAGES (34 pages) handle missing tables gracefully:**

These tables are optional - the code handles missing tables gracefully:

- `activity_logs` - Used by ActivityLogs page
- `audit_trail` - Used by AuditTrail page
- `api_keys` - Used by ApiAccess page
- `api_usage_logs` - Optional API usage tracking
- `automation_rules` - Used by Automation page
- `commission_transactions` - Used by CommissionTracking page (with fallback)
- `custom_reports` - Used by CustomReports page
- `custom_domains` - Used by CustomDomain page
- `custom_integrations` - Used by CustomIntegrations page
- `compliance_settings` - Used by Compliance page
- `data_exports` - Used by DataExport page
- `expenses` - Used by ExpenseTracking page
- `notification_templates` - Used by Notifications page
- `notification_logs` - Optional notification logging
- `pos_transactions` - Used by CashRegister and PosAnalytics pages
- `routes` - Used by RouteOptimization page (with fallback)
- `roles` - Used by RoleManagement page
- `role_permissions` - Used by RoleManagement page
- `support_tickets` - Used by PrioritySupport page
- `stock_alerts` - Used by StockAlerts page (with fallback)
- `webhooks` - Used by Webhooks page
- `white_label_settings` - Used by WhiteLabel page
- `inventory_transfers` - Used by InventoryTransfers page
- `inventory_transfers_enhanced` - Enhanced inventory transfers view
- `subscription_events` - Optional subscription event logging

**Pattern for Optional Tables:**
```typescript
try {
  const { data, error } = await supabase.from('table_name')...
  
  if (error && error.code === '42P01') {
    // Table doesn't exist - return empty array
    return [];
  }
  if (error) throw error;
  return data || [];
} catch (error: any) {
  if (error.code === '42P01') return [];
  throw error;
}
```

---

## 🔐 Authentication System

### Three-Tier Architecture

#### 1. Super Admin Authentication

**Edge Function:** `super-admin-auth`

**Flow:**
1. User submits email/password
2. Edge Function validates against `super_admins` table
3. Returns JWT token
4. Frontend stores token in localStorage
5. All subsequent requests include token in Authorization header

**Context:** `SuperAdminAuthContext`
**Protected Routes:** `/super-admin/*`

#### 2. Tenant Admin Authentication

**Edge Function:** `tenant-admin-auth`

**Flow:**
1. User submits email/password + tenantSlug
2. Edge Function validates against `tenant_users` table
3. Checks tenant status and user role
4. Returns JWT token + tenant data
5. Frontend stores in localStorage
6. Token includes tenant_id in claims

**Context:** `TenantAdminAuthContext`
**Protected Routes:** `/:tenantSlug/admin/*`

#### 3. Customer Authentication

**Edge Function:** `customer-auth`

**Flow:**
1. Customer submits email/password + tenantSlug
2. Edge Function validates against `customers` table
3. Returns JWT token
4. Frontend stores in localStorage

**Context:** `CustomerAuthContext`
**Protected Routes:** `/:tenantSlug/shop/*`

### Password Hashing

**IMPORTANT:** Always use `bcrypt` in Edge Functions

```typescript
// ✅ CORRECT - Use bcrypt
import { compare } from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

const isValid = await compare(password, storedHash);

// ❌ WRONG - Don't use SHA-256 or other weak hashing
```

### Token Refresh Pattern

```typescript
// In Edge Function
const refreshToken = requestBody.refresh_token;
const { data: { access_token, refresh_token } } = await refreshTokens(refreshToken);

// In Frontend
const refreshAuthToken = async () => {
  if (!refreshToken) return;
  
  const response = await fetch(`${supabaseUrl}/functions/v1/auth?action=refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  
  const data = await response.json();
  setAccessToken(data.access_token);
  setRefreshToken(data.refresh_token);
};
```

---

## 💳 Billing & Subscription

### Subscription Plans

```typescript
const PLAN_PRICES = {
  starter: 99,
  professional: 299,
  enterprise: 600,
};

const PLAN_LIMITS = {
  starter: { customers: 50, menus: 3, products: 100, locations: 1, users: 3 },
  professional: { customers: 200, menus: 10, products: 500, locations: 10, users: 10 },
  enterprise: { customers: -1, menus: -1, products: -1, locations: -1, users: -1 },
};
```

### Update Subscription Edge Function

**Location:** `supabase/functions/update-subscription/index.ts`

**Key Features:**
- ✅ Proration calculation for mid-cycle changes
- ✅ Invoice generation
- ✅ Stripe integration support
- ✅ Automatic limits/features update

**Request:**
```json
{
  "tenant_id": "uuid",
  "new_plan": "starter" | "professional" | "enterprise",
  "use_stripe": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully upgraded to professional plan",
  "tenant": {
    "subscription_plan": "professional",
    "mrr": 299
  },
  "proration": {
    "amount": 150.50,
    "details": {
      "days_remaining": 15,
      "credit_amount": 49.50,
      "charge_amount": 200.00
    }
  }
}
```

### Proration Calculation Logic

```typescript
// Calculate days
const totalDays = (periodEnd - periodStart) / (1000 * 60 * 60 * 24);
const daysRemaining = (periodEnd - now) / (1000 * 60 * 60 * 24);

// Calculate rates
const oldPlanDaily = oldPlanPrice / totalDays;
const newPlanDaily = newPlanPrice / totalDays;

// Calculate credit and charge
const credit = oldPlanDaily * daysRemaining;  // Unused portion
const charge = newPlanDaily * daysRemaining;  // Remaining days on new plan

// Proration amount
const prorationAmount = charge - credit;  // Positive = upgrade, Negative = downgrade
```

### Invoice Generation

**When:** Created automatically on plan changes

**Structure:**
```typescript
{
  tenant_id: string,
  invoice_number: `INV-${tenantId.slice(0,8)}-${timestamp}`,
  subtotal: prorationAmount || baseAmount,
  tax: subtotal * 0.08,  // 8% default
  total: subtotal + tax,
  line_items: [
    {
      description: "Credit - Unused portion of Old Plan",
      unit_price: -creditAmount,
      total: -creditAmount
    },
    {
      description: "New Plan - Prorated",
      unit_price: chargeAmount,
      total: chargeAmount
    }
  ],
  billing_period_start: currentPeriodStart,
  billing_period_end: currentPeriodEnd,
  issue_date: today,
  due_date: today + 30 days,
  status: 'open'
}
```

### Stripe Customer Portal

**Edge Function:** `stripe-customer-portal/index.ts`

**Purpose:** Payment method management

**Flow:**
1. User clicks "Add/Update Payment Method"
2. Frontend calls Edge Function with tenant_id
3. Edge Function creates Stripe Customer Portal session
4. Returns portal URL
5. User redirected to Stripe-hosted portal
6. User manages payment methods
7. Returns to billing page

**Required:** `STRIPE_SECRET_KEY` environment variable

---

## 🛡️ Error Handling Patterns

### Pattern 1: Missing Database Tables

**Use for:** Optional tables that may not exist

```typescript
const { data, error } = await supabase
  .from('optional_table')
  .select('*')
  .eq('tenant_id', tenantId);

// ✅ CORRECT - Handle table not found
if (error && error.code === '42P01') {
  // Table doesn't exist - return empty array
  return [];
}
if (error) throw error;
return data || [];

// Or with try/catch
try {
  const { data, error } = await supabase.from('optional_table')...
  if (error && error.code === '42P01') return [];
  if (error) throw error;
  return data || [];
} catch (error: any) {
  if (error.code === '42P01') return [];
  throw error;
}
```

**Error Codes:**
- `42P01` = Table does not exist
- `42703` = Column does not exist

### Pattern 2: Missing Columns

**Use for:** Optional columns in required tables

```typescript
// Safe query - only select existing columns
const { data } = await supabase
  .from('tenants')
  .select('id, business_name, subscription_plan')
  .eq('id', tenantId)
  .single();

// Provide defaults for missing columns
const usage = data?.usage || {};
const limits = data?.limits || {};
const onboardingCompleted = data?.onboarding_completed ?? false;
```

### Pattern 3: Mutation Error Handling

```typescript
const createMutation = useMutation({
  mutationFn: async (data) => {
    const { data: result, error } = await supabase
      .from('table')
      .insert(data)
      .select()
      .single();

    if (error) {
      // Handle specific errors
      if (error.code === '42P01') {
        throw new Error('Table does not exist. Please run database migrations.');
      }
      if (error.code === '23505') {  // Unique violation
        throw new Error('This record already exists.');
      }
      throw error;
    }
    return result;
  },
  onError: (error: any) => {
    toast({
      title: 'Error',
      description: error.message || 'Failed to create',
      variant: 'destructive',
    });
  },
});
```

### Pattern 4: Safe Updates

```typescript
// Only update columns that exist
const updateData: any = {
  subscription_plan: newPlan,
  mrr: price,
  updated_at: new Date().toISOString(),
};

// Don't include optional fields if they might not exist
// Instead, check first or provide defaults

const { error } = await supabase
  .from('tenants')
  .update(updateData)
  .eq('id', tenantId);

if (error) {
  // Handle gracefully - don't fail entire operation
  console.error('Update error:', error);
  // Continue with other operations
}
```

---

## 📝 Code Patterns & Best Practices

### 1. Query Pattern with TanStack Query

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['resource-name', tenantId, filter],
  queryFn: async () => {
    if (!tenantId) return [];

    try {
      const { data, error } = await supabase
        .from('table')
        .select('*')
        .eq('tenant_id', tenantId);

      if (error && error.code === '42P01') return [];
      if (error) throw error;
      return data || [];
    } catch (error: any) {
      if (error.code === '42P01') return [];
      throw error;
    }
  },
  enabled: !!tenantId,  // Only run when tenantId exists
  staleTime: 30000,     // Cache for 30 seconds
});
```

### 2. Mutation Pattern

```typescript
const createMutation = useMutation({
  mutationFn: async (formData) => {
    if (!tenantId) throw new Error('Tenant ID required');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await supabase.functions.invoke('function-name', {
      body: { tenant_id: tenantId, ...formData },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (response.error) throw response.error;
    
    let result;
    if (response.data instanceof Response) {
      result = await response.data.json();
    } else if (typeof response.data === 'string') {
      result = JSON.parse(response.data);
    } else {
      result = response.data;
    }

    if (!result || !result.success) {
      throw new Error(result?.error || 'Operation failed');
    }
    return result;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['resource-name', tenantId] });
    toast({ title: 'Success', description: 'Operation completed successfully' });
  },
  onError: (error: any) => {
    toast({
      title: 'Error',
      description: error.message || 'Operation failed',
      variant: 'destructive',
    });
  },
});
```

### 3. Edge Function Pattern

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { tenant_id, ...otherParams } = await req.json();

    // Validate input
    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: 'Missing tenant_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify permissions
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('email', user.email)
      .maybeSingle();

    if (!tenantUser || (tenantUser.role !== 'owner' && tenantUser.role !== 'admin')) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Your logic here
    // ...

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### 4. Component Pattern with Error Handling

```typescript
export default function FeaturePage() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query with error handling
  const { data: items, isLoading } = useQuery({
    queryKey: ['items', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .eq('tenant_id', tenantId);

        if (error && error.code === '42P01') {
          // Table doesn't exist
          return [];
        }
        if (error) throw error;
        return data || [];
      } catch (error: any) {
        if (error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  // Mutation with error handling
  const createMutation = useMutation({
    mutationFn: async (itemData) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('items')
        .insert({ ...itemData, tenant_id: tenantId })
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Items table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', tenantId] });
      toast({ title: 'Success', description: 'Item created successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create item',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {/* Your component UI */}
    </div>
  );
}
```

---

## 🐛 Common Bugs & Fixes

### Bug 1: "Table does not exist" Errors

**Symptom:** `error.code === '42P01'` when querying optional tables

**Fix:** Always wrap queries in try/catch with error code check

```typescript
// ✅ CORRECT
try {
  const { data, error } = await supabase.from('optional_table')...
  if (error && error.code === '42P01') return [];
  if (error) throw error;
  return data || [];
} catch (error: any) {
  if (error.code === '42P01') return [];
  throw error;
}

// ❌ WRONG - Will crash if table doesn't exist
const { data } = await supabase.from('optional_table')...
```

### Bug 2: Missing Column Errors

**Symptom:** `error.code === '42703'` when selecting non-existent columns

**Fix:** Only select required columns, provide defaults for optional ones

```typescript
// ✅ CORRECT
const { data } = await supabase
  .from('tenants')
  .select('id, business_name, subscription_plan')
  .eq('id', tenantId)
  .single();

const usage = data?.usage || {};  // Default if missing
const limits = data?.limits || {};  // Default if missing

// ❌ WRONG - Will fail if column doesn't exist
const { data } = await supabase
  .from('tenants')
  .select('*')  // Includes optional columns
  .single();
```

### Bug 3: Async/Await in useEffect

**Symptom:** "await expressions in non-async function"

**Fix:** Use IIFE or separate async function

```typescript
// ✅ CORRECT
useEffect(() => {
  (async () => {
    const result = await someAsyncOperation();
    // Use result
  })();
}, []);

// Or
useEffect(() => {
  const fetchData = async () => {
    const result = await someAsyncOperation();
    // Use result
  };
  fetchData();
}, []);

// ❌ WRONG
useEffect(async () => {
  const result = await someAsyncOperation();  // Error!
}, []);
```

### Bug 4: TypeScript "Excessively Deep" Errors

**Symptom:** Type instantiation errors with dynamic table names

**Fix:** Use type assertions for dynamic Supabase queries

```typescript
// ✅ CORRECT
const { data, error } = await supabase
  .from(table as any)
  .select(column)
  .limit(0);

// ❌ WRONG - TypeScript can't infer dynamic table names
const { data, error } = await supabase
  .from(table)  // Error: Type instantiation is excessively deep
  .select(column);
```

### Bug 5: Missing Import Errors

**Symptom:** "X is not defined" runtime errors

**Fix:** Always import components before using in routes

```typescript
// ✅ CORRECT
const MyPage = lazy(() => import("./pages/admin/MyPage"));

// In routes
<Route path="my-page" element={<MyPage />} />

// ❌ WRONG
// Using MyPage in route without importing
```

### Bug 6: Duplicate Route Definitions

**Symptom:** React Router warnings about duplicate routes

**Fix:** Only define each route once, use FeatureProtectedRoute consistently

```typescript
// ✅ CORRECT - Single route definition
<Route 
  path="dashboard" 
  element={
    <FeatureProtectedRoute featureId="dashboard">
      <DashboardPage />
    </FeatureProtectedRoute>
  } 
/>

// ❌ WRONG - Duplicate routes
<Route path="dashboard" element={<DashboardPage />} />
<Route path="dashboard" element={<FeatureProtectedRoute>...</FeatureProtectedRoute>} />
```

### Bug 7: Stripe Integration Not Working

**Symptom:** "Stripe not configured" errors

**Fix:** Set STRIPE_SECRET_KEY in Supabase environment variables

1. Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Add `STRIPE_SECRET_KEY` with your Stripe secret key
3. Restart Edge Functions (if needed)

### Bug 8: Token Refresh Failures

**Symptom:** 401 errors after token expiration

**Fix:** Implement automatic token refresh

```typescript
// ✅ CORRECT - Auto-refresh on 401
const refreshAuthToken = async () => {
  if (!refreshToken) return;
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/auth?action=refresh`, {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    
    if (!response.ok) throw new Error('Refresh failed');
    
    const data = await response.json();
    setAccessToken(data.access_token);
    setRefreshToken(data.refresh_token);
    localStorage.setItem('access_token', data.access_token);
  } catch (error) {
    // Logout on refresh failure
    logout();
  }
};
```

---

## ✅ Testing Checklist

### Authentication Tests

- [ ] Super Admin can log in
- [ ] Tenant Admin can log in with tenant slug
- [ ] Customer can log in
- [ ] Invalid credentials show error
- [ ] Token refresh works on 401
- [ ] Logout clears all tokens

### Billing Tests

- [ ] View current plan
- [ ] Upgrade from Starter to Professional
- [ ] Upgrade from Professional to Enterprise
- [ ] Downgrade from Enterprise to Professional
- [ ] Downgrade from Professional to Starter
- [ ] Proration calculated correctly for mid-cycle changes
- [ ] Invoice generated on plan change
- [ ] Payment method button opens Stripe Customer Portal (if Stripe configured)

### Feature Access Tests

- [ ] Starter tier sees only starter features
- [ ] Professional tier sees professional + starter features
- [ ] Enterprise tier sees all features
- [ ] Locked features show "Upgrade" message
- [ ] Navigation filtered by subscription tier

### Error Handling Tests

- [ ] Pages load even if optional tables don't exist
- [ ] Empty states shown when no data
- [ ] Error messages are user-friendly
- [ ] No crashes when database columns missing

### Edge Function Tests

- [ ] `update-subscription` calculates proration correctly
- [ ] `update-subscription` generates invoices
- [ ] `stripe-customer-portal` creates portal session
- [ ] `tenant-admin-auth` returns correct token
- [ ] `customer-auth` works correctly

---

## 📚 Key Files Reference

### Core Files

- `src/App.tsx` - All routes configuration
- `src/lib/constants/navigation.ts` - Sidebar navigation
- `src/lib/featureConfig.ts` - Feature definitions and tier mapping
- `src/pages/tenant-admin/BillingPage.tsx` - Billing UI
- `supabase/functions/update-subscription/index.ts` - Subscription management
- `supabase/functions/stripe-customer-portal/index.ts` - Payment method management

### Contexts

- `src/contexts/TenantAdminAuthContext.tsx` - Tenant admin auth state
- `src/contexts/SuperAdminAuthContext.tsx` - Super admin auth state
- `src/contexts/CustomerAuthContext.tsx` - Customer auth state

### Components

- `src/components/tenant-admin/FeatureProtectedRoute.tsx` - Feature-based route protection
- `src/hooks/useFeatureAccess.ts` - Feature access checking hook

---

## 🎯 Implementation Priority

### Phase 1: Core Setup (Critical)
1. ✅ Environment variables configured
2. ✅ Database tables created (at minimum: tenants, tenant_users, invoices)
3. ✅ Authentication Edge Functions deployed
4. ✅ Frontend builds successfully

### Phase 2: Billing (Important)
1. ✅ Stripe Secret Key set (for payment processing)
2. ✅ Subscription update function deployed
3. ✅ Billing page functional
4. ✅ Invoice generation working

### Phase 3: Enterprise Features (Optional)
1. ✅ Enterprise pages load with graceful degradation
2. ✅ Optional tables created as needed
3. ✅ Features work once tables exist

---

## 📝 Quick Start Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Deploy Edge Functions (using Supabase CLI)
supabase functions deploy update-subscription
supabase functions deploy stripe-customer-portal
supabase functions deploy stripe-webhook

# Set environment variables
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set SITE_URL=https://your-domain.com
```

---

## 🔍 Debugging Tips

### Check Edge Function Logs

```bash
# View logs in Supabase Dashboard
# Project Settings → Edge Functions → Logs

# Or via CLI
supabase functions logs update-subscription
```

### Common Issues

1. **"Missing authorization header"**
   - Ensure token is sent in request headers
   - Check localStorage for token

2. **"Table does not exist"**
   - Table is optional - code handles this gracefully
   - Or create the table via migration

3. **"Stripe not configured"**
   - Set STRIPE_SECRET_KEY in Supabase secrets
   - Check key format (should start with sk_)

4. **"Insufficient permissions"**
   - User must be 'owner' or 'admin' role
   - Check tenant_users table for role

---

## ✨ Best Practices Summary

1. ✅ **Always check for error.code === '42P01'** (table not found)
2. ✅ **Provide defaults for optional columns** (usage, limits, etc.)
3. ✅ **Use FeatureProtectedRoute** for tier-based access
4. ✅ **Handle Stripe errors gracefully** (check if configured)
5. ✅ **Implement token refresh** for 401 errors
6. ✅ **Use type assertions** for dynamic Supabase queries
7. ✅ **Wrap async operations** in useEffect correctly
8. ✅ **Validate input** in Edge Functions
9. ✅ **Check permissions** before operations
10. ✅ **Log errors** for debugging but show user-friendly messages

---

## 📞 Support Reference

### Error Codes
- `42P01` = Table does not exist (handle gracefully)
- `42703` = Column does not exist (provide defaults)
- `23505` = Unique constraint violation
- `23503` = Foreign key constraint violation

### Stripe Error Handling
```typescript
try {
  // Stripe operation
} catch (stripeError: any) {
  if (stripeError.type === 'StripeCardError') {
    // Card declined
    error.message = 'Your card was declined';
  } else if (stripeError.type === 'StripeRateLimitError') {
    // Too many requests
    error.message = 'Rate limit exceeded. Please try again later';
  }
  throw error;
}
```

---

## 📄 Complete Page Reference - All Restored Pages

### Overview

**Status:** ✅ All 34 pages restored with complete error handling  
**Total Admin Pages:** 93  
**Pages with Graceful Degradation:** 100%

### Phase 2: Professional Tier (8 pages)

#### OrderAnalytics (`/admin/order-analytics`)
```typescript
// Key Features:
- Order volume analytics
- Revenue trends
- Daily/weekly/monthly views
- Charts: Bar chart (orders by day)

// Database Tables:
- orders (required)
- order_items (optional)
- products (optional)

// Error Handling:
- Returns empty arrays if tables missing
- Shows "No order data available" message
```

#### CustomerAnalytics (`/admin/customer-analytics`)
```typescript
// Key Features:
- Customer segmentation
- Revenue by customer
- Customer distribution charts

// Database Tables:
- customers (required)
- orders (optional, for revenue calculation)

// Error Handling:
- Graceful degradation for missing tables
- Pie chart with customer segments
```

#### SalesDashboard (`/admin/sales-dashboard`)
```typescript
// Key Features:
- Real-time sales metrics
- Revenue and order trends
- Multiple chart types (Line, Bar)

// Database Tables:
- orders (required)
- order_items (optional)

// Error Handling:
- Empty states with helpful messages
```

#### CommissionTracking (`/admin/commission-tracking`)
```typescript
// Key Features:
- Commission calculation
- Pending/paid tracking
- Fallback to orders (2% default)

// Database Tables:
- commission_transactions (preferred, fallback to orders)
- orders (fallback calculation)

// Special Error Handling:
if (error?.code === '42P01') {
  // Calculate from orders: total * 0.02
  return orders.map(order => ({
    amount: order.total * 0.02
  }));
}
```

#### ActivityLogs (`/admin/activity-logs`)
```typescript
// Key Features:
- System activity tracking
- User action logging
- Timeline view

// Database Tables:
- activity_logs (optional)

// Error Handling:
- Returns empty array if table missing
- Shows helpful message about table creation
```

#### StockAlerts (`/admin/stock-alerts`)
```typescript
// Key Features:
- Low stock warnings
- Critical alerts
- Threshold monitoring

// Database Tables:
- stock_alerts (preferred)
- wholesale_inventory (fallback calculation)
- products (for product names)

// Special Error Handling:
// Falls back to calculating alerts from inventory if table missing
```

#### RevenueReports (`/admin/revenue-reports`)
```typescript
// Key Features:
- Monthly revenue analysis
- Revenue trends
- Export capabilities

// Database Tables:
- orders (required)

// Error Handling:
- Standard graceful degradation pattern
```

#### ExpenseTracking (`/admin/expense-tracking`)
```typescript
// Key Features:
- Expense categorization
- Monthly summaries
- Expense history

// Database Tables:
- expenses (optional)

// Error Handling:
- Empty state with table creation message
```

### Phase 3: Professional Tier (5 pages)

#### RoleManagement (`/admin/role-management`)
```typescript
// Key Features:
- CRUD operations for roles
- Permission assignment
- Role templates

// Database Tables:
- roles (required)
- role_permissions (required)

// Error Handling:
- Both tables checked separately
- User-friendly error messages
```

#### InventoryTransfers (`/admin/inventory-transfers`)
```typescript
// Key Features:
- Transfer creation
- Status tracking
- Warehouse management

// Database Tables:
- inventory_transfers (required)
- wholesale_inventory (for product lookup)

// Error Handling:
- Standard pattern with clear messages
```

#### CustomerInsights (`/admin/customer-insights/:id`)
```typescript
// Key Features:
- Individual customer analytics
- Purchase history
- Customer metrics

// Route Parameter:
- :id - Customer ID from route

// Database Tables:
- customers (required)
- orders (for purchase history)

// Error Handling:
- Checks for customer existence
- Graceful degradation for orders
```

#### BulkOperations (`/admin/bulk-operations`)
```typescript
// Key Features:
- Bulk updates
- CSV import/export
- Operation templates

// Database Tables:
- products (for item counts)
- Various tables based on operation type

// Error Handling:
- Handles multiple table scenarios
```

#### Notifications (`/admin/notifications`)
```typescript
// Key Features:
- Template CRUD
- Trigger configuration
- Enable/disable toggles

// Database Tables:
- notification_templates (required)

// Error Handling:
- Standard pattern
- Update mutations included
```

### Phase 4: Enterprise Tier (7 pages)

#### RouteOptimization (`/admin/route-optimization`)
```typescript
// Key Features:
- Route generation
- Stop management
- Distance calculation

// Database Tables:
- routes (preferred)
- deliveries (fallback)

// Error Handling:
- Falls back to deliveries if routes table missing
```

#### DeliveryAnalytics (`/admin/delivery-analytics`)
```typescript
// Key Features:
- Delivery performance metrics
- Success rate tracking
- Trend analysis

// Database Tables:
- deliveries (required)

// Error Handling:
- Standard graceful degradation
```

#### CashRegister (`/admin/cash-register`)
```typescript
// Key Features:
- POS transactions
- Cart management
- Payment processing

// Database Tables:
- pos_transactions (optional)

// Error Handling:
- Empty state for transactions
- UI still functional without data
```

#### ApiAccess (`/admin/api-access`)
```typescript
// Key Features:
- API key generation
- Key management
- Permission configuration

// Database Tables:
- api_keys (optional)

// Error Handling:
- Create/update mutations with error handling
```

#### Webhooks (`/admin/webhooks`)
```typescript
// Key Features:
- Webhook CRUD
- Event configuration
- Secret management

// Database Tables:
- webhooks (optional)

// Error Handling:
- Full CRUD with error handling
- Update mutations included
```

#### AdvancedAnalytics (`/admin/advanced-analytics`)
```typescript
// Key Features:
- Multi-tab analytics
- Revenue trends
- Customer segments
- Product performance

// Database Tables:
- orders (required)
- customers (optional)

// Error Handling:
- Tabbed interface handles missing data
```

#### RealtimeDashboard (`/admin/realtime-dashboard`)
```typescript
// Key Features:
- Real-time updates
- Live metrics
- Supabase channel subscriptions

// Database Tables:
- orders (with real-time subscription)
- customers (for stats)

// Special Implementation:
useEffect(() => {
  const channel = supabase.channel('realtime-dashboard')
    .on('postgres_changes', { table: 'orders' }, handleUpdate)
    .subscribe();
  return () => supabase.removeChannel(channel);
}, [tenantId]);
```

### Phase 5: Enterprise Tier (5 pages)

#### CustomReports (`/admin/custom-reports`)
```typescript
// Key Features:
- SQL query builder
- Report scheduling
- Export formats (CSV, JSON, Excel)

// Database Tables:
- custom_reports (optional)

// Error Handling:
- Full CRUD operations
- Update mutations included
```

#### DataExport (`/admin/data-export`)
```typescript
// Key Features:
- Data type selection
- Format selection (CSV, JSON, Excel)
- Export history

// Database Tables:
- data_exports (optional, for history)

// Error Handling:
- Works without history table
```

#### LocationAnalytics (`/admin/location-analytics`)
```typescript
// Key Features:
- Location performance
- Revenue by location
- Location comparison

// Database Tables:
- locations (required)
- orders (for revenue calculation)

// Error Handling:
- Standard pattern
```

#### UserManagement (`/admin/user-management`)
```typescript
// Key Features:
- Team member listing
- Role display
- Status management

// Database Tables:
- tenant_users (required)

// Error Handling:
- Standard graceful degradation
```

#### Permissions (`/admin/permissions`)
```typescript
// Key Features:
- Permission matrix
- Role permission display
- Compliance checking

// Database Tables:
- roles (required)
- role_permissions (required)

// Error Handling:
- Handles missing tables gracefully
```

### Phase 6: Enterprise Tier (9 pages)

#### Automation (`/admin/automation`)
```typescript
// Key Features:
- Rule CRUD
- Trigger/action configuration
- Enable/disable toggles

// Database Tables:
- automation_rules (optional)

// Error Handling:
- Full CRUD with error handling
- Update mutations included
```

#### WhiteLabel (`/admin/white-label`)
```typescript
// Key Features:
- Brand customization
- Logo upload
- Color scheme
- Custom CSS

// Database Tables:
- white_label_settings (optional)

// Error Handling:
- Upsert pattern (create or update)
```

#### CustomDomain (`/admin/custom-domain`)
```typescript
// Key Features:
- Domain management
- DNS configuration guide
- Status tracking

// Database Tables:
- custom_domains (optional)

// Error Handling:
- Create mutations with validation
```

#### PosAnalytics (`/admin/pos-analytics`)
```typescript
// Key Features:
- POS transaction analytics
- Sales trends
- Transaction volume

// Database Tables:
- pos_transactions (optional)

// Error Handling:
- Standard graceful degradation
```

#### CustomIntegrations (`/admin/custom-integrations`)
```typescript
// Key Features:
- Integration CRUD
- API key/secret management
- Integration types

// Database Tables:
- custom_integrations (optional)

// Error Handling:
- Full CRUD operations
```

#### AuditTrail (`/admin/audit-trail`)
```typescript
// Key Features:
- Activity logging
- Search functionality
- Timeline view

// Database Tables:
- audit_trail (optional)

// Error Handling:
- Search works with empty results
```

#### Compliance (`/admin/compliance`)
```typescript
// Key Features:
- Compliance checklist
- Status tracking
- Percentage calculation

// Database Tables:
- compliance_settings (optional)

// Error Handling:
- Works without settings table
```

#### PrioritySupport (`/admin/priority-support`)
```typescript
// Key Features:
- Ticket CRUD
- Priority levels
- Status tracking

// Database Tables:
- support_tickets (optional)

// Error Handling:
- Full CRUD operations
```

---

## 🔄 Page Implementation Template

Use this template when creating new admin pages:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function YourPage() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query with error handling
  const { data, isLoading } = useQuery({
    queryKey: ['resource-name', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('your_table')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        // ✅ ALWAYS check for missing table
        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data || [];
      } catch (error: any) {
        // ✅ ALWAYS check in catch block too
        if (error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  // Mutation with error handling
  const createMutation = useMutation({
    mutationFn: async (formData) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('your_table')
        .insert({ tenant_id: tenantId, ...formData })
        .select()
        .single();

      // ✅ ALWAYS check for missing table
      if (error?.code === '42P01') {
        throw new Error('Table does not exist. Please run database migrations.');
      }
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource-name', tenantId] });
      toast({ title: 'Success', description: 'Operation completed' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Operation failed',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return <div className="p-6"><div className="text-center">Loading...</div></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Your Page</h1>
        <p className="text-muted-foreground">Description</p>
      </div>

      {data && data.length > 0 ? (
        // Render your data
        <div>Your content here</div>
      ) : (
        // ✅ ALWAYS include empty state
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <Icon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No data available. Feature will appear here once table is created.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

---

**Last Updated:** November 2, 2025  
**Version:** 1.1.0  
**Status:** ✅ Production Ready - All 34 Pages Restored

