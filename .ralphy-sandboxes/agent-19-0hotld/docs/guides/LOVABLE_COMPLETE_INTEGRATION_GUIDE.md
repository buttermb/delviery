# Complete Lovable Integration Guide - 15 High-Value Business Admin Features

## Table of Contents
1. [Overview](#overview)
2. [Architecture & Flow](#architecture--flow)
3. [Database Schema Requirements](#database-schema-requirements)
4. [Feature-by-Feature Integration](#feature-by-feature-integration)
5. [Edge Functions Required](#edge-functions-required)
6. [Testing Checklist](#testing-checklist)
7. [Code References](#code-references)

---

## Overview

This guide covers the integration of 15 high-value features for the Business Admin Panel. All features are:
- **Tier**: Professional (except where noted)
- **Status**: UI Complete, Backend Integration Required
- **Location**: `src/pages/admin/` and `src/components/admin/`

### Features Implemented

1. **Supplier Management System** (`/admin/suppliers`)
2. **Purchase Order (PO) Management** (`/admin/purchase-orders`)
3. **Returns & Refunds System** (`/admin/returns`)
4. **Loyalty & Rewards Program Manager** (`/admin/loyalty-program`)
5. **Coupon & Promotion Manager** (`/admin/coupons`)
6. **Quality Control & Lab Testing Hub** (`/admin/quality-control`)
7. **Advanced CRM & Customer Insights** (`/admin/customer-crm`)
8. **Marketing Automation Center** (`/admin/marketing-automation`)
9. **Appointment Scheduling System** (`/admin/appointments`)
10. **Support Ticket Management** (`/admin/support-tickets`)
11. **Batch Recall & Traceability System** (`/admin/batch-recall`)
12. **Compliance Document Vault** (`/admin/compliance-vault`)
13. **Advanced Reporting & Business Intelligence** (`/admin/advanced-reporting`)
14. **Vendor/Supplier Portal** (`/vendor/dashboard`) - External Access
15. **Predictive Analytics & Forecasting** (`/admin/predictive-analytics`)

---

## Architecture & Flow

### Authentication Flow

All admin features use the existing `TenantAdminAuthContext`:

```typescript
// Location: src/contexts/TenantAdminAuthContext.tsx
// Usage in all feature pages:
const { tenant, admin } = useTenantAdminAuth();
```

**Flow:**
1. User logs in via `/saas/login` or `/:tenantSlug/admin/login`
2. `TenantAdminAuthContext` verifies token via `tenant-admin-auth` edge function
3. Token stored in httpOnly cookies (secure)
4. All API calls automatically include cookies via `credentials: 'include'`
5. Features check `tenant.id` for multi-tenant isolation

### Feature Gating Flow

All features are protected by `FeatureProtectedRoute`:

```typescript
// Location: src/components/tenant-admin/FeatureProtectedRoute.tsx
// Usage in App.tsx:
<Route 
  path="suppliers" 
  element={
    <FeatureProtectedRoute featureId="suppliers">
      <SupplierManagementPage />
    </FeatureProtectedRoute>
  } 
/>
```

**Flow:**
1. `FeatureProtectedRoute` checks user's subscription tier
2. Verifies feature access via `useFeatureAccess()` hook
3. Redirects to upgrade page if tier insufficient
4. Renders feature if access granted

### Data Fetching Flow

All features use TanStack Query with query key factory:

```typescript
// Location: src/lib/queryKeys.ts
// Usage in feature pages:
const { data, isLoading } = useQuery({
  queryKey: queryKeys.suppliers.all(),
  queryFn: async () => {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("tenant_id", tenant.id);
    if (error) throw error;
    return data;
  },
  enabled: !!tenant?.id,
});
```

**Flow:**
1. Component mounts → Query enabled when `tenant.id` exists
2. TanStack Query fetches from Supabase
3. Data cached with 60s staleTime
4. Mutations invalidate queries to refresh data
5. Loading states shown during fetch

---

## Database Schema Requirements

### 1. Suppliers Table

```sql
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  payment_terms TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS Policies
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their suppliers"
  ON suppliers FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Tenants can insert their suppliers"
  ON suppliers FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Tenants can update their suppliers"
  ON suppliers FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Tenants can delete their suppliers"
  ON suppliers FOR DELETE
  USING (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX idx_suppliers_tenant_id ON suppliers(tenant_id);
CREATE INDEX idx_suppliers_status ON suppliers(status);
```

### 2. Purchase Orders Table

```sql
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  po_number TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'ordered', 'received', 'cancelled')),
  total_amount NUMERIC(10,2) DEFAULT 0,
  expected_delivery_date DATE,
  received_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(tenant_id, po_number)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies (similar pattern for both tables)
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Policies for purchase_orders
CREATE POLICY "Tenants can manage their purchase orders"
  ON purchase_orders FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Policies for purchase_order_items
CREATE POLICY "Tenants can manage their PO items"
  ON purchase_order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_items.purchase_order_id
      AND po.tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
    )
  );

-- Indexes
CREATE INDEX idx_purchase_orders_tenant_id ON purchase_orders(tenant_id);
CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_po_items_po_id ON purchase_order_items(purchase_order_id);
```

### 3. Returns & Refunds Table

```sql
CREATE TABLE IF NOT EXISTS return_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  ra_number TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'completed', 'cancelled')),
  reason_code TEXT,
  reason_description TEXT,
  refund_amount NUMERIC(10,2) DEFAULT 0,
  refund_method TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(tenant_id, ra_number)
);

CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_authorization_id UUID REFERENCES return_authorizations(id) ON DELETE CASCADE NOT NULL,
  order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  return_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies (similar pattern)
ALTER TABLE return_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_return_authorizations_tenant_id ON return_authorizations(tenant_id);
CREATE INDEX idx_return_authorizations_order_id ON return_authorizations(order_id);
CREATE INDEX idx_return_authorizations_status ON return_authorizations(status);
```

### 4. Loyalty Program Tables

```sql
CREATE TABLE IF NOT EXISTS loyalty_program_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL UNIQUE,
  points_per_dollar NUMERIC(5,2) DEFAULT 1.0,
  bonus_points_enabled BOOLEAN DEFAULT false,
  bonus_points_multiplier NUMERIC(5,2) DEFAULT 1.0,
  tier_system_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  points_required INTEGER NOT NULL,
  reward_type TEXT CHECK (reward_type IN ('discount', 'product', 'cash', 'other')),
  reward_value NUMERIC(10,2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalty_point_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customer_users(id) ON DELETE CASCADE NOT NULL,
  points INTEGER NOT NULL,
  adjustment_type TEXT CHECK (adjustment_type IN ('earned', 'redeemed', 'expired', 'manual', 'refund')),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS Policies
ALTER TABLE loyalty_program_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_point_adjustments ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_loyalty_rewards_tenant_id ON loyalty_rewards(tenant_id);
CREATE INDEX idx_loyalty_adjustments_tenant_id ON loyalty_point_adjustments(tenant_id);
CREATE INDEX idx_loyalty_adjustments_customer_id ON loyalty_point_adjustments(customer_id);
```

### 5. Coupons Table

```sql
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  never_expires BOOLEAN DEFAULT false,
  min_purchase NUMERIC(10,2),
  max_discount NUMERIC(10,2),
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  auto_apply BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(tenant_id, code)
);

-- RLS Policies
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage their coupons"
  ON coupons FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX idx_coupons_tenant_id ON coupons(tenant_id);
CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_status ON coupons(status);
```

### 6. Quality Control Tables

```sql
CREATE TABLE IF NOT EXISTS quality_control_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  test_type TEXT NOT NULL,
  test_date DATE NOT NULL,
  lab_name TEXT,
  coa_url TEXT,
  test_results JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed', 'quarantined')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS quarantined_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  batch_id UUID REFERENCES inventory_batches(id) ON DELETE CASCADE NOT NULL,
  reason TEXT NOT NULL,
  quantity_lbs NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'quarantined' CHECK (status IN ('quarantined', 'released', 'disposed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS Policies
ALTER TABLE quality_control_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarantined_inventory ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_qc_tests_tenant_id ON quality_control_tests(tenant_id);
CREATE INDEX idx_qc_tests_batch_id ON quality_control_tests(batch_id);
CREATE INDEX idx_quarantined_tenant_id ON quarantined_inventory(tenant_id);
CREATE INDEX idx_quarantined_batch_id ON quarantined_inventory(batch_id);
```

### 7. Marketing Campaigns Table

```sql
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  subject TEXT,
  content TEXT NOT NULL,
  audience TEXT DEFAULT 'all',
  scheduled_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused')),
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS marketing_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_conditions JSONB DEFAULT '{}',
  actions JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS Policies
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_workflows ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_marketing_campaigns_tenant_id ON marketing_campaigns(tenant_id);
CREATE INDEX idx_marketing_campaigns_status ON marketing_campaigns(status);
CREATE INDEX idx_marketing_workflows_tenant_id ON marketing_workflows(tenant_id);
```

### 8. Appointments Table

```sql
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customer_users(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  type TEXT DEFAULT 'consultation' CHECK (type IN ('consultation', 'delivery', 'pickup', 'follow-up')),
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no-show')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS Policies
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage their appointments"
  ON appointments FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX idx_appointments_tenant_id ON appointments(tenant_id);
CREATE INDEX idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX idx_appointments_scheduled_at ON appointments(scheduled_at);
CREATE INDEX idx_appointments_status ON appointments(status);
```

### 9. Support Tickets Table

```sql
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customer_users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS support_ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
  comment TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS Policies
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_comments ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_support_tickets_tenant_id ON support_tickets(tenant_id);
CREATE INDEX idx_support_tickets_customer_id ON support_tickets(customer_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX idx_ticket_comments_ticket_id ON support_ticket_comments(ticket_id);
```

### 10. Batch Recalls Table

```sql
CREATE TABLE IF NOT EXISTS batch_recalls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
  batch_number TEXT NOT NULL,
  reason TEXT NOT NULL,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'resolved', 'closed')),
  affected_customers_count INTEGER DEFAULT 0,
  notification_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS recall_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recall_id UUID REFERENCES batch_recalls(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customer_users(id) ON DELETE CASCADE NOT NULL,
  notification_sent_at TIMESTAMPTZ,
  notification_method TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE batch_recalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE recall_notifications ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_batch_recalls_tenant_id ON batch_recalls(tenant_id);
CREATE INDEX idx_batch_recalls_batch_id ON batch_recalls(batch_id);
CREATE INDEX idx_batch_recalls_status ON batch_recalls(status);
CREATE INDEX idx_recall_notifications_recall_id ON recall_notifications(recall_id);
```

### 11. Compliance Documents Table

```sql
CREATE TABLE IF NOT EXISTS compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('license', 'permit', 'certificate', 'insurance', 'other')),
  file_url TEXT NOT NULL,
  expiration_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expiring_soon', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS Policies
ALTER TABLE compliance_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage their compliance documents"
  ON compliance_documents FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX idx_compliance_documents_tenant_id ON compliance_documents(tenant_id);
CREATE INDEX idx_compliance_documents_type ON compliance_documents(document_type);
CREATE INDEX idx_compliance_documents_expiration_date ON compliance_documents(expiration_date);
CREATE INDEX idx_compliance_documents_status ON compliance_documents(status);

-- Function to update status based on expiration_date
CREATE OR REPLACE FUNCTION update_compliance_document_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expiration_date IS NOT NULL THEN
    IF NEW.expiration_date < CURRENT_DATE THEN
      NEW.status = 'expired';
    ELSIF NEW.expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN
      NEW.status = 'expiring_soon';
    ELSE
      NEW.status = 'active';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_compliance_document_status_trigger
  BEFORE INSERT OR UPDATE ON compliance_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_compliance_document_status();
```

### 12. Custom Reports Table

```sql
CREATE TABLE IF NOT EXISTS custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  report_id UUID REFERENCES custom_reports(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly')),
  schedule_day INTEGER,
  schedule_time TIME,
  recipients TEXT[],
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE custom_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_custom_reports_tenant_id ON custom_reports(tenant_id);
CREATE INDEX idx_scheduled_reports_tenant_id ON scheduled_reports(tenant_id);
CREATE INDEX idx_scheduled_reports_next_run_at ON scheduled_reports(next_run_at);
```

### 13. Vendor Portal Tables

```sql
-- Note: Vendors use existing suppliers table
-- Vendor authentication would use a separate vendor_users table or extend suppliers

CREATE TABLE IF NOT EXISTS vendor_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'vendor',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE vendor_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view their own data"
  ON vendor_users FOR SELECT
  USING (id = auth.uid() OR supplier_id IN (
    SELECT id FROM suppliers WHERE tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  ));
```

---

## Feature-by-Feature Integration

### Feature 1: Supplier Management System

**Page**: `src/pages/admin/SupplierManagementPage.tsx`  
**Components**: 
- `src/components/admin/suppliers/SupplierForm.tsx`
- `src/components/admin/suppliers/SupplierList.tsx`
- `src/components/admin/suppliers/SupplierDetail.tsx`

**Flow:**
1. User navigates to `/admin/suppliers`
2. `FeatureProtectedRoute` checks Professional tier access
3. Page loads → `useQuery` fetches suppliers filtered by `tenant_id`
4. User clicks "New Supplier" → Opens `SupplierForm` dialog
5. Form submission → `useMutation` inserts into `suppliers` table
6. On success → Query invalidated → List refreshes
7. User clicks supplier → Shows `SupplierDetail` with full info

**Key Code References:**
```typescript
// Query Key: src/lib/queryKeys.ts
queryKeys.suppliers.all()

// Data Fetching: src/pages/admin/SupplierManagementPage.tsx
const { data: suppliers, isLoading } = useQuery({
  queryKey: queryKeys.suppliers.all(),
  queryFn: async () => {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
  enabled: !!tenant?.id,
});

// Mutation: src/components/admin/suppliers/SupplierForm.tsx
const createMutation = useMutation({
  mutationFn: async (formData) => {
    const { error } = await supabase.from("suppliers").insert([{
      tenant_id: tenant.id,
      ...formData,
      created_by: admin?.id || null,
    }]);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all() });
  },
});
```

**Database Requirements:**
- `suppliers` table (see schema above)
- RLS policies for tenant isolation
- Indexes on `tenant_id` and `status`

**Edge Functions:**
- None required (direct Supabase queries)

---

### Feature 2: Purchase Order Management

**Page**: `src/pages/admin/PurchaseOrdersPage.tsx`  
**Components**:
- `src/components/admin/purchase-orders/POCreateForm.tsx`
- `src/components/admin/purchase-orders/POList.tsx`
- `src/components/admin/purchase-orders/PODetail.tsx`

**Flow:**
1. User navigates to `/admin/purchase-orders`
2. Page loads → Fetches POs with related supplier data
3. User clicks "New PO" → Multi-step form:
   - Step 1: Select supplier
   - Step 2: Add products/items
   - Step 3: Review and submit
4. Form submission → Creates PO and PO items in transaction
5. User can view PO details → Shows items, status, delivery dates

**Key Code References:**
```typescript
// Query Keys: src/lib/queryKeys.ts
queryKeys.purchaseOrders.all()
queryKeys.purchaseOrders.detail(id)

// Data Fetching with Relations:
const { data: purchaseOrders } = useQuery({
  queryKey: queryKeys.purchaseOrders.all(),
  queryFn: async () => {
    const { data, error } = await supabase
      .from("purchase_orders")
      .select(`
        *,
        supplier:suppliers(*),
        items:purchase_order_items(*)
      `)
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

// Transaction-like Insert (should use edge function for true transaction):
const createPOMutation = useMutation({
  mutationFn: async ({ po, items }) => {
    // Insert PO
    const { data: newPO, error: poError } = await supabase
      .from("purchase_orders")
      .insert([{ tenant_id: tenant.id, ...po }])
      .select()
      .single();
    
    if (poError) throw poError;
    
    // Insert items
    const { error: itemsError } = await supabase
      .from("purchase_order_items")
      .insert(
        items.map(item => ({ purchase_order_id: newPO.id, ...item }))
      );
    
    if (itemsError) throw itemsError;
  },
});
```

**Database Requirements:**
- `purchase_orders` table
- `purchase_order_items` table
- Foreign key to `suppliers`
- RLS policies

**Edge Functions:**
- Recommended: `create-purchase-order` for atomic transaction
- Location: `supabase/functions/create-purchase-order/index.ts`

---

### Feature 3: Returns & Refunds System

**Page**: `src/pages/admin/ReturnsManagementPage.tsx`  
**Components**:
- `src/components/admin/returns/RACreateForm.tsx`
- `src/components/admin/returns/RAList.tsx`
- `src/components/admin/returns/RADetail.tsx`

**Flow:**
1. User navigates to `/admin/returns`
2. Page loads → Fetches return authorizations
3. User clicks "New Return" → Form to:
   - Select original order
   - Select items to return
   - Enter reason code
   - Set refund method
4. Submission → Creates RA and return items
5. Status workflow: pending → approved → processing → completed

**Key Code References:**
```typescript
// Query: src/pages/admin/ReturnsManagementPage.tsx
const { data: returns } = useQuery({
  queryKey: queryKeys.returns.all(),
  queryFn: async () => {
    const { data, error } = await supabase
      .from("return_authorizations")
      .select(`
        *,
        order:orders(*),
        items:return_items(*)
      `)
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});
```

**Database Requirements:**
- `return_authorizations` table
- `return_items` table
- Foreign key to `orders`

**Edge Functions:**
- Recommended: `process-return` for refund processing
- Should integrate with payment gateway for actual refunds

---

### Feature 4: Loyalty & Rewards Program

**Page**: `src/pages/admin/LoyaltyProgramPage.tsx`  
**Components**:
- `src/components/admin/loyalty/EarningRulesConfig.tsx`
- `src/components/admin/loyalty/RewardCatalog.tsx`
- `src/components/admin/loyalty/PointAdjustments.tsx`

**Flow:**
1. User navigates to `/admin/loyalty-program`
2. Tabs: Earning Rules, Reward Catalog, Point Adjustments
3. **Earning Rules**: Configure points per dollar, bonuses, tiers
4. **Reward Catalog**: Create/edit rewards (discounts, products, cash)
5. **Point Adjustments**: Manually add/subtract points for customers

**Key Code References:**
```typescript
// Config Query: src/components/admin/loyalty/EarningRulesConfig.tsx
const { data: config } = useQuery({
  queryKey: queryKeys.loyalty.config(),
  queryFn: async () => {
    const { data, error } = await supabase
      .from("loyalty_program_config")
      .select("*")
      .eq("tenant_id", tenant.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
});

// Update Config Mutation:
const updateConfigMutation = useMutation({
  mutationFn: async (newConfig) => {
    const { data, error } = await supabase
      .from("loyalty_program_config")
      .upsert({
        tenant_id: tenant.id,
        ...newConfig,
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
  },
});
```

**Database Requirements:**
- `loyalty_program_config` table (one per tenant)
- `loyalty_rewards` table
- `loyalty_point_adjustments` table
- Integration with `customer_users` table (add `loyalty_points` and `loyalty_tier` columns if not exists)

**Edge Functions:**
- Recommended: `calculate-loyalty-points` for order processing
- Should be called when orders are completed

---

### Feature 5: Coupon & Promotion Manager

**Page**: `src/pages/admin/CouponManagementPage.tsx`  
**Components**:
- `src/components/admin/coupons/CouponCreateForm.tsx`
- `src/components/admin/coupons/CouponList.tsx`

**Flow:**
1. User navigates to `/admin/coupons`
2. Page loads → Fetches all coupons
3. User clicks "New Coupon" → Form with:
   - Code (auto-generate option)
   - Discount type (percentage/fixed)
   - Value, dates, constraints
4. Submission → Creates coupon
5. List shows usage statistics

**Key Code References:**
```typescript
// Query: src/pages/admin/CouponManagementPage.tsx
const { data: coupons } = useQuery({
  queryKey: queryKeys.coupons.all(),
  queryFn: async () => {
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

// Validation in form:
const validateCoupon = (coupon) => {
  if (coupon.discount_type === 'percentage' && coupon.discount_value > 100) {
    throw new Error('Percentage discount cannot exceed 100%');
  }
  if (coupon.start_date && coupon.end_date && coupon.start_date > coupon.end_date) {
    throw new Error('Start date must be before end date');
  }
};
```

**Database Requirements:**
- `coupons` table
- Unique constraint on `(tenant_id, code)`

**Edge Functions:**
- Recommended: `validate-coupon` for checkout validation
- Should check expiration, usage limits, min purchase

---

### Feature 6: Quality Control & Lab Testing

**Page**: `src/pages/admin/QualityControlPage.tsx`  
**Components**:
- `src/components/admin/quality/COAUpload.tsx`
- `src/components/admin/quality/TestResultsViewer.tsx`
- `src/components/admin/quality/QuarantineManager.tsx`

**Flow:**
1. User navigates to `/admin/quality-control`
2. Tabs: COA Upload, Test Results, Quarantine
3. **COA Upload**: Upload certificate, associate with batch
4. **Test Results**: View detailed lab results (potency, contaminants, terpenes)
5. **Quarantine**: Manage batches that failed QC

**Key Code References:**
```typescript
// COA Upload: src/components/admin/quality/COAUpload.tsx
const uploadMutation = useMutation({
  mutationFn: async ({ file, batchId, testResults }) => {
    // Upload file to Supabase Storage
    const fileExt = file.name.split(".").pop();
    const fileName = `${tenant.id}/coas/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("quality-control")
      .upload(fileName, file);
    
    if (uploadError) throw uploadError;
    
    const { data: urlData } = supabase.storage
      .from("quality-control")
      .getPublicUrl(fileName);
    
    // Save test record
    const { error } = await supabase
      .from("quality_control_tests")
      .insert([{
        tenant_id: tenant.id,
        batch_id: batchId,
        coa_url: urlData.publicUrl,
        test_results: testResults,
        status: 'passed',
      }]);
    
    if (error) throw error;
  },
});
```

**Database Requirements:**
- `quality_control_tests` table
- `quarantined_inventory` table
- Supabase Storage bucket: `quality-control`

**Edge Functions:**
- None required (direct Supabase queries)

---

### Feature 7: Advanced CRM & Customer Insights

**Page**: `src/pages/admin/CustomerCRMPage.tsx`  
**Components**:
- `src/components/admin/crm/CustomerSegmentation.tsx`
- `src/components/admin/crm/RFMAnalysis.tsx`
- `src/components/admin/crm/CommunicationTimeline.tsx`

**Flow:**
1. User navigates to `/admin/customer-crm`
2. Tabs: Segmentation, RFM Analysis, Communication Timeline
3. **Segmentation**: Create dynamic customer segments
4. **RFM Analysis**: View Recency, Frequency, Monetary scores
5. **Timeline**: See all customer touchpoints chronologically

**Key Code References:**
```typescript
// RFM Analysis: src/components/admin/crm/RFMAnalysis.tsx
const { data: rfmData } = useQuery({
  queryKey: queryKeys.crm.rfm(),
  queryFn: async () => {
    // Calculate RFM scores from orders
    const { data: orders } = await supabase
      .from("orders")
      .select("customer_id, created_at, total_amount, status")
      .eq("tenant_id", tenant.id)
      .eq("status", "completed");
    
    // Process into RFM segments
    const rfm = calculateRFMScores(orders);
    return rfm;
  },
});

function calculateRFMScores(orders) {
  // Group by customer
  const customerData = {};
  orders.forEach(order => {
    if (!customerData[order.customer_id]) {
      customerData[order.customer_id] = {
        orders: [],
        totalSpent: 0,
      };
    }
    customerData[order.customer_id].orders.push(order);
    customerData[order.customer_id].totalSpent += order.total_amount;
  });
  
  // Calculate scores (simplified)
  return Object.entries(customerData).map(([customerId, data]) => {
    const lastOrder = data.orders.sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    )[0];
    const recency = daysSince(lastOrder.created_at);
    const frequency = data.orders.length;
    const monetary = data.totalSpent;
    
    return {
      customer_id: customerId,
      recency,
      frequency,
      monetary,
      rfm_score: `${getRecencyScore(recency)}${getFrequencyScore(frequency)}${getMonetaryScore(monetary)}`,
    };
  });
}
```

**Database Requirements:**
- Uses existing `customer_users` and `orders` tables
- May need `customer_segments` table for saved segments

**Edge Functions:**
- Recommended: `calculate-rfm` for performance (heavy calculation)

---

### Feature 8: Marketing Automation Center

**Page**: `src/pages/admin/MarketingAutomationPage.tsx`  
**Components**:
- `src/components/admin/marketing/CampaignBuilder.tsx`
- `src/components/admin/marketing/WorkflowEditor.tsx`
- `src/components/admin/marketing/CampaignAnalytics.tsx`

**Flow:**
1. User navigates to `/admin/marketing-automation`
2. Tabs: Campaigns, Workflows, Analytics
3. **Campaigns**: Create email/SMS campaigns, schedule sends
4. **Workflows**: Set up automated sequences (welcome, win-back, etc.)
5. **Analytics**: View open rates, click rates, conversions

**Key Code References:**
```typescript
// Campaign Creation: src/components/admin/marketing/CampaignBuilder.tsx
const createMutation = useMutation({
  mutationFn: async (campaignData) => {
    const { error } = await supabase
      .from("marketing_campaigns")
      .insert([{
        tenant_id: tenant.id,
        ...campaignData,
        created_by: admin?.id || null,
      }]);
    if (error) throw error;
  },
  onSuccess: () => {
    // Trigger campaign send via edge function
    supabase.functions.invoke('send-campaign', {
      body: { campaignId: newCampaign.id },
    });
  },
});
```

**Database Requirements:**
- `marketing_campaigns` table
- `marketing_workflows` table
- Integration with Klaviyo or email service

**Edge Functions:**
- Required: `send-campaign` - Sends emails/SMS via Klaviyo
- Required: `execute-workflow` - Runs automated workflows
- Location: `supabase/functions/send-campaign/index.ts`

---

### Feature 9: Appointment Scheduling System

**Page**: `src/pages/admin/AppointmentSchedulerPage.tsx`  
**Components**:
- `src/components/admin/appointments/AppointmentCalendar.tsx`
- `src/components/admin/appointments/AppointmentList.tsx`
- `src/components/admin/appointments/AppointmentForm.tsx`

**Flow:**
1. User navigates to `/admin/appointments`
2. Tabs: Calendar View, List View
3. Calendar shows appointments with visual indicators
4. User clicks date → Opens form to create appointment
5. Form: Select customer, time, duration, type, notes
6. Submission → Creates appointment
7. List view shows all appointments with filters

**Key Code References:**
```typescript
// Calendar Query: src/components/admin/appointments/AppointmentCalendar.tsx
const { data: appointments } = useQuery({
  queryKey: queryKeys.appointments.all(),
  queryFn: async () => {
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("tenant_id", tenant.id)
      .gte("scheduled_at", startOfMonth(new Date()).toISOString())
      .lte("scheduled_at", endOfMonth(new Date()).toISOString());
    if (error) throw error;
    return data;
  },
});

// Date Selection Handler:
const handleDateSelect = (date: Date) => {
  setSelectedDate(date);
  setIsFormOpen(true);
};
```

**Database Requirements:**
- `appointments` table
- Index on `scheduled_at` for calendar queries

**Edge Functions:**
- Optional: `send-appointment-reminder` - Sends SMS/email reminders
- Should run on schedule (cron job)

---

### Feature 10: Support Ticket Management

**Page**: `src/pages/admin/SupportTicketsPage.tsx`  
**Components**:
- `src/components/admin/support/TicketList.tsx`
- `src/components/admin/support/TicketForm.tsx`
- `src/components/admin/support/TicketDetail.tsx`

**Flow:**
1. User navigates to `/admin/support-tickets`
2. Tabs: All, Open, In Progress, Resolved
3. Search bar filters tickets by subject/description
4. User clicks ticket → Shows detail view with comments
5. User can update status, priority, assign to team member
6. Comments section for internal/external notes

**Key Code References:**
```typescript
// Ticket Query with Filters: src/pages/admin/SupportTicketsPage.tsx
const filteredTickets = tickets?.filter((ticket) => {
  const matchesTab =
    activeTab === "all" ||
    ticket.status === activeTab;
  const matchesSearch =
    !searchTerm ||
    ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.description.toLowerCase().includes(searchTerm.toLowerCase());
  return matchesTab && matchesSearch;
}) || [];
```

**Database Requirements:**
- `support_tickets` table
- `support_ticket_comments` table
- Indexes on `status` and `priority`

**Edge Functions:**
- Optional: `notify-ticket-update` - Sends email to customer on status change

---

### Feature 11: Batch Recall & Traceability

**Page**: `src/pages/admin/BatchRecallPage.tsx`  
**Components**:
- `src/components/admin/recall/RecallList.tsx`
- `src/components/admin/recall/RecallForm.tsx`
- `src/components/admin/recall/RecallDetail.tsx`
- `src/components/admin/recall/TraceabilityView.tsx`

**Flow:**
1. User navigates to `/admin/batch-recall`
2. Tabs: Recalls, Traceability
3. **Recalls**: Create recall for batch, set severity, notification message
4. **Traceability**: Search batch → See full product flow to customers
5. Recall detail shows affected customers count
6. Actions: Generate report, Notify customers

**Key Code References:**
```typescript
// Recall Creation: src/components/admin/recall/RecallForm.tsx
const createMutation = useMutation({
  mutationFn: async (recallData) => {
    // Calculate affected customers from traceability
    const affectedCustomers = await calculateAffectedCustomers(
      recallData.batch_number,
      tenant.id
    );
    
    const { error } = await supabase
      .from("batch_recalls")
      .insert([{
        tenant_id: tenant.id,
        ...recallData,
        affected_customers_count: affectedCustomers.length,
      }]);
    if (error) throw error;
  },
});

// Traceability Query:
async function getBatchTraceability(batchNumber: string, tenantId: string) {
  // Get all orders that included products from this batch
  const { data: orders } = await supabase
    .from("orders")
    .select(`
      *,
      items:order_items(
        *,
        product:products(batch_number)
      ),
      customer:customer_users(*)
    `)
    .eq("tenant_id", tenantId)
    .contains("items.product.batch_number", batchNumber);
  
  return orders;
}
```

**Database Requirements:**
- `batch_recalls` table
- `recall_notifications` table
- Integration with `inventory_batches`, `orders`, `order_items`

**Edge Functions:**
- Required: `notify-recall` - Sends notifications to affected customers
- Required: `generate-recall-report` - Creates regulatory report

---

### Feature 12: Compliance Document Vault

**Page**: `src/pages/admin/ComplianceVaultPage.tsx`  
**Components**:
- `src/components/admin/compliance/DocumentList.tsx`
- `src/components/admin/compliance/DocumentUpload.tsx`
- `src/components/admin/compliance/DocumentDetail.tsx`

**Flow:**
1. User navigates to `/admin/compliance-vault`
2. Stats cards show: Total, Expiring Soon, Expired, Active
3. Tabs: All, Licenses, Permits, Certificates, Expiring
4. User clicks "Upload Document" → Form with file upload
5. File uploaded to Supabase Storage
6. Document record created with expiration tracking
7. Status auto-updates based on expiration date

**Key Code References:**
```typescript
// Document Upload: src/components/admin/compliance/DocumentUpload.tsx
const uploadMutation = useMutation({
  mutationFn: async ({ name, document_type, expiration_date, file }) => {
    // Upload to Storage
    const fileExt = file.name.split(".").pop();
    const fileName = `${tenant.id}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("compliance-documents")
      .upload(fileName, file);
    
    if (uploadError) throw uploadError;
    
    const { data: urlData } = supabase.storage
      .from("compliance-documents")
      .getPublicUrl(fileName);
    
    // Save record
    const { error } = await supabase
      .from("compliance_documents")
      .insert([{
        tenant_id: tenant.id,
        name,
        document_type,
        file_url: urlData.publicUrl,
        expiration_date: expiration_date || null,
        status: 'active',
      }]);
    
    if (error) throw error;
  },
});
```

**Database Requirements:**
- `compliance_documents` table
- Supabase Storage bucket: `compliance-documents`
- Trigger function to update status based on expiration

**Edge Functions:**
- Optional: `notify-document-expiring` - Sends alerts 30 days before expiration

---

### Feature 13: Advanced Reporting & BI

**Page**: `src/pages/admin/AdvancedReportingPage.tsx`  
**Components**:
- `src/components/admin/reporting/ReportBuilder.tsx`
- `src/components/admin/reporting/ReportList.tsx`
- `src/components/admin/reporting/ScheduledReports.tsx`
- `src/components/admin/reporting/ReportTemplates.tsx`

**Flow:**
1. User navigates to `/admin/advanced-reporting`
2. Tabs: Builder, My Reports, Scheduled, Templates
3. **Builder**: Create custom reports with drag-and-drop (coming soon)
4. **My Reports**: List of saved reports, view/download
5. **Scheduled**: Set up automated report delivery
6. **Templates**: Use pre-built report templates

**Key Code References:**
```typescript
// Report Creation: src/components/admin/reporting/ReportBuilder.tsx
const createMutation = useMutation({
  mutationFn: async (reportData) => {
    const { error } = await supabase
      .from("custom_reports")
      .insert([{
        tenant_id: tenant.id,
        ...reportData,
        created_by: admin?.id || null,
      }]);
    if (error) throw error;
  },
});

// Scheduled Report Setup:
const scheduleMutation = useMutation({
  mutationFn: async ({ reportId, schedule }) => {
    const nextRun = calculateNextRun(schedule);
    const { error } = await supabase
      .from("scheduled_reports")
      .insert([{
        tenant_id: tenant.id,
        report_id: reportId,
        ...schedule,
        next_run_at: nextRun,
      }]);
    if (error) throw error;
  },
});
```

**Database Requirements:**
- `custom_reports` table
- `scheduled_reports` table

**Edge Functions:**
- Required: `generate-report` - Executes report query and formats output
- Required: `send-scheduled-report` - Cron job to send scheduled reports

---

### Feature 14: Vendor/Supplier Portal (External)

**Pages**: 
- `src/pages/vendor/VendorLoginPage.tsx`
- `src/pages/vendor/VendorDashboardPage.tsx`

**Flow:**
1. Vendor navigates to `/vendor/login`
2. Authenticates with vendor credentials
3. Redirects to `/vendor/dashboard`
4. Dashboard shows:
   - Active purchase orders
   - Pending payments
   - Total revenue
   - Product catalog
5. Vendor can view PO details, upload invoices

**Key Code References:**
```typescript
// Vendor Dashboard: src/pages/vendor/VendorDashboardPage.tsx
const { data: purchaseOrders } = useQuery({
  queryKey: queryKeys.vendor.purchaseOrders(vendorId),
  queryFn: async () => {
    const { data, error } = await supabase
      .from("purchase_orders")
      .select("*")
      .eq("supplier_id", vendorId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});
```

**Database Requirements:**
- `vendor_users` table (or extend `suppliers` with auth)
- Vendor authentication system

**Edge Functions:**
- Required: `vendor-auth` - Handles vendor login/authentication
- Location: `supabase/functions/vendor-auth/index.ts`

---

### Feature 15: Predictive Analytics & Forecasting

**Page**: `src/pages/admin/PredictiveAnalyticsPage.tsx`  
**Components**:
- `src/components/admin/predictive/DemandForecast.tsx`
- `src/components/admin/predictive/InventoryOptimization.tsx`
- `src/components/admin/predictive/CashFlowProjection.tsx`

**Flow:**
1. User navigates to `/admin/predictive-analytics`
2. Tabs: Demand Forecast, Inventory Optimization, Cash Flow
3. **Demand Forecast**: AI predictions based on historical sales
4. **Inventory Optimization**: Recommended stock levels
5. **Cash Flow**: 30/60/90 day projections

**Key Code References:**
```typescript
// Demand Forecast (placeholder - requires ML model):
const { data: forecast } = useQuery({
  queryKey: queryKeys.predictive.demand(),
  queryFn: async () => {
    // This would call an edge function with ML model
    const { data, error } = await supabase.functions.invoke('predict-demand', {
      body: { tenantId: tenant.id, productId: selectedProductId },
    });
    if (error) throw error;
    return data;
  },
});
```

**Database Requirements:**
- Uses existing `orders`, `products`, `inventory_batches` tables
- May need `forecast_cache` table for storing predictions

**Edge Functions:**
- Required: `predict-demand` - ML model for demand forecasting
- Required: `optimize-inventory` - Calculates optimal stock levels
- Required: `project-cashflow` - Financial projections

---

## Edge Functions Required

### 1. create-purchase-order
**Location**: `supabase/functions/create-purchase-order/index.ts`  
**Purpose**: Atomic transaction to create PO and items  
**Input**:
```typescript
{
  supplier_id: string;
  po_number: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
  }>;
  expected_delivery_date?: string;
  notes?: string;
}
```
**Flow**:
1. Validate tenant access
2. Calculate total amount
3. Insert PO
4. Insert all items
5. Return created PO with items

### 2. send-campaign
**Location**: `supabase/functions/send-campaign/index.ts`  
**Purpose**: Send email/SMS campaigns via Klaviyo  
**Input**:
```typescript
{
  campaign_id: string;
}
```
**Flow**:
1. Fetch campaign from database
2. Get audience list based on filters
3. Send via Klaviyo API
4. Update campaign status and counts

### 3. execute-workflow
**Location**: `supabase/functions/execute-workflow/index.ts`  
**Purpose**: Execute automated marketing workflows  
**Input**:
```typescript
{
  workflow_id: string;
  trigger_event: string;
  customer_id: string;
}
```
**Flow**:
1. Check trigger conditions
2. Execute workflow actions
3. Log execution

### 4. notify-recall
**Location**: `supabase/functions/notify-recall/index.ts`  
**Purpose**: Notify customers of product recalls  
**Input**:
```typescript
{
  recall_id: string;
}
```
**Flow**:
1. Fetch recall details
2. Get affected customers from traceability
3. Send notifications (email/SMS)
4. Create notification records

### 5. generate-recall-report
**Location**: `supabase/functions/generate-recall-report/index.ts`  
**Purpose**: Generate regulatory recall report  
**Input**:
```typescript
{
  recall_id: string;
  format: 'pdf' | 'csv';
}
```
**Flow**:
1. Gather all recall data
2. Format according to regulatory requirements
3. Generate PDF or CSV
4. Return download URL

### 6. vendor-auth
**Location**: `supabase/functions/vendor-auth/index.ts`  
**Purpose**: Authenticate vendor users  
**Input**:
```typescript
{
  action: 'login' | 'verify' | 'logout';
  email?: string;
  password?: string;
}
```
**Flow**:
1. Validate credentials against `vendor_users`
2. Create session token
3. Return vendor info and token

### 7. predict-demand
**Location**: `supabase/functions/predict-demand/index.ts`  
**Purpose**: ML-based demand forecasting  
**Input**:
```typescript
{
  tenant_id: string;
  product_id?: string;
  forecast_period: number; // days
}
```
**Flow**:
1. Fetch historical sales data
2. Run ML model (or call external API)
3. Return predictions

### 8. generate-report
**Location**: `supabase/functions/generate-report/index.ts`  
**Purpose**: Execute and format custom reports  
**Input**:
```typescript
{
  report_id: string;
  format: 'pdf' | 'csv' | 'excel';
}
```
**Flow**:
1. Fetch report configuration
2. Execute queries based on filters
3. Format output
4. Return download URL

### 9. send-scheduled-report
**Location**: `supabase/functions/send-scheduled-report/index.ts`  
**Purpose**: Cron job to send scheduled reports  
**Trigger**: Scheduled (daily/weekly/monthly)  
**Flow**:
1. Query `scheduled_reports` for due reports
2. Generate each report
3. Email to recipients
4. Update `last_run_at` and `next_run_at`

---

## Testing Checklist

### Feature 1: Supplier Management
- [ ] Create new supplier
- [ ] Edit supplier details
- [ ] Delete supplier
- [ ] Search suppliers
- [ ] Filter by status
- [ ] Verify RLS (tenant isolation)

### Feature 2: Purchase Orders
- [ ] Create PO with multiple items
- [ ] View PO details
- [ ] Update PO status
- [ ] Filter by supplier
- [ ] Verify transaction atomicity

### Feature 3: Returns & Refunds
- [ ] Create return authorization
- [ ] Add return items
- [ ] Process refund
- [ ] Update return status
- [ ] View return analytics

### Feature 4: Loyalty Program
- [ ] Configure earning rules
- [ ] Create reward
- [ ] Adjust customer points
- [ ] Verify points calculation on order

### Feature 5: Coupons
- [ ] Create coupon
- [ ] Validate coupon code
- [ ] Check expiration
- [ ] Track usage count
- [ ] Test constraints (min purchase, max discount)

### Feature 6: Quality Control
- [ ] Upload COA
- [ ] Associate with batch
- [ ] View test results
- [ ] Quarantine batch
- [ ] Release from quarantine

### Feature 7: Advanced CRM
- [ ] Create customer segment
- [ ] View RFM analysis
- [ ] View communication timeline
- [ ] Filter by segment

### Feature 8: Marketing Automation
- [ ] Create email campaign
- [ ] Create SMS campaign
- [ ] Schedule campaign
- [ ] View campaign analytics
- [ ] Create workflow

### Feature 9: Appointments
- [ ] Create appointment
- [ ] View calendar
- [ ] Filter by date
- [ ] Update appointment status
- [ ] Send reminder (if implemented)

### Feature 10: Support Tickets
- [ ] Create ticket
- [ ] Update status
- [ ] Add comment
- [ ] Search tickets
- [ ] Filter by status/priority

### Feature 11: Batch Recall
- [ ] Create recall
- [ ] View traceability
- [ ] Generate report
- [ ] Notify customers

### Feature 12: Compliance Vault
- [ ] Upload document
- [ ] Set expiration date
- [ ] View expiring documents
- [ ] Download document
- [ ] Verify status auto-update

### Feature 13: Advanced Reporting
- [ ] Create custom report
- [ ] Save report
- [ ] Schedule report
- [ ] Use template
- [ ] Download report

### Feature 14: Vendor Portal
- [ ] Vendor login
- [ ] View POs
- [ ] Upload invoice
- [ ] Track payments

### Feature 15: Predictive Analytics
- [ ] View demand forecast
- [ ] View inventory optimization
- [ ] View cash flow projection
- [ ] Verify ML model integration

---

## Code References

### Key Files

**Pages:**
- `src/pages/admin/SupplierManagementPage.tsx`
- `src/pages/admin/PurchaseOrdersPage.tsx`
- `src/pages/admin/ReturnsManagementPage.tsx`
- `src/pages/admin/LoyaltyProgramPage.tsx`
- `src/pages/admin/CouponManagementPage.tsx`
- `src/pages/admin/QualityControlPage.tsx`
- `src/pages/admin/CustomerCRMPage.tsx`
- `src/pages/admin/MarketingAutomationPage.tsx`
- `src/pages/admin/AppointmentSchedulerPage.tsx`
- `src/pages/admin/SupportTicketsPage.tsx`
- `src/pages/admin/BatchRecallPage.tsx`
- `src/pages/admin/ComplianceVaultPage.tsx`
- `src/pages/admin/AdvancedReportingPage.tsx`
- `src/pages/vendor/VendorDashboardPage.tsx`
- `src/pages/admin/PredictiveAnalyticsPage.tsx`

**Components:**
- All components in `src/components/admin/` organized by feature folder

**Configuration:**
- `src/lib/featureConfig.ts` - Feature definitions and tier gating
- `src/lib/queryKeys.ts` - TanStack Query key factory
- `src/App.tsx` - Routes and feature protection
- `src/components/tenant-admin/TenantAdminSidebar.tsx` - Menu items

**Context:**
- `src/contexts/TenantAdminAuthContext.tsx` - Authentication and tenant context

---

## Integration Steps for Lovable

### Step 1: Database Setup
1. Run all SQL migrations in order
2. Verify RLS policies are enabled
3. Test tenant isolation with sample data

### Step 2: Storage Buckets
1. Create `compliance-documents` bucket
2. Create `quality-control` bucket
3. Set up bucket policies for tenant isolation

### Step 3: Edge Functions
1. Create all required edge functions (see list above)
2. Deploy functions
3. Test each function independently

### Step 4: Frontend Integration
1. Verify all routes are in `App.tsx`
2. Test feature gating works correctly
3. Verify query keys are properly used
4. Test error handling

### Step 5: Testing
1. Run through complete testing checklist
2. Test multi-tenant isolation
3. Test feature tier restrictions
4. Test error scenarios

### Step 6: Production Deployment
1. Run database migrations in production
2. Deploy edge functions
3. Set up storage buckets
4. Monitor for errors

---

## Important Notes

1. **Multi-Tenant Isolation**: All queries MUST filter by `tenant_id`. Never query without tenant filter.

2. **RLS Policies**: All tables MUST have RLS enabled with proper policies.

3. **Feature Gating**: All features check subscription tier before rendering.

4. **Error Handling**: All mutations have proper error handling and user feedback.

5. **Type Safety**: All TypeScript types are properly defined (no `any` types).

6. **Logging**: Use `logger` from `@/lib/logger` instead of `console.log`.

7. **Query Keys**: Always use `queryKeys` factory for consistency.

8. **Mobile Responsive**: All components are mobile-first with touch-friendly UI.

---

## Support

For questions or issues during integration:
1. Check code references in feature pages
2. Review database schema requirements
3. Verify edge function implementations
4. Test with sample data first

All features are production-ready once database tables and edge functions are implemented.

