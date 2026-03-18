# 🔧 Admin Panel - Complete Integration Requirements

## 🎯 Overview

This document provides **complete integration requirements** for all admin panel features, including:
- Database tables and schemas
- Edge functions specifications
- Storage bucket configurations
- RLS policies
- API endpoints
- Third-party integrations

---

## 📋 Table of Contents

1. [Database Schema](#database-schema)
2. [Edge Functions](#edge-functions)
3. [Storage Buckets](#storage-buckets)
4. [RLS Policies](#rls-policies)
5. [API Endpoints](#api-endpoints)
6. [Third-Party Integrations](#third-party-integrations)
7. [Environment Variables](#environment-variables)

---

## Database Schema

### Core Tables (Required for All Features)

#### `tenants`
```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  business_name TEXT NOT NULL,
  subscription_tier TEXT NOT NULL DEFAULT 'starter',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  white_label JSONB,
  -- ... other fields
);
```

#### `tenant_users`
```sql
CREATE TABLE tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  role TEXT NOT NULL DEFAULT 'admin',
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- ... other fields
);
```

### Feature-Specific Tables

#### Products & Inventory

**`products`**
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  price DECIMAL(10,2),
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- ... other fields
);
```

**`wholesale_inventory`**
```sql
CREATE TABLE wholesale_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id),
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  reorder_point DECIMAL(10,2),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  -- ... other fields
);
```

**`inventory_alerts`**
```sql
CREATE TABLE inventory_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  warehouse_id UUID REFERENCES warehouses(id),
  current_quantity DECIMAL(10,2),
  reorder_point DECIMAL(10,2),
  status TEXT DEFAULT 'active',
  alert_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**`inventory_transfers`**
```sql
CREATE TABLE inventory_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  source_warehouse_id UUID REFERENCES warehouses(id),
  destination_warehouse_id UUID REFERENCES warehouses(id),
  status TEXT DEFAULT 'pending',
  created_by UUID REFERENCES tenant_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

**`inventory_transfer_items`**
```sql
CREATE TABLE inventory_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID REFERENCES inventory_transfers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity DECIMAL(10,2) NOT NULL,
  -- ... other fields
);
```

#### Orders

**`wholesale_orders`**
```sql
CREATE TABLE wholesale_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES wholesale_clients(id),
  order_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending',
  total_amount DECIMAL(10,2) NOT NULL,
  payment_terms TEXT,
  delivery_method TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- ... other fields
);
```

**`wholesale_order_items`**
```sql
CREATE TABLE wholesale_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES wholesale_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  -- ... other fields
);
```

#### Customers

**`wholesale_clients`**
```sql
CREATE TABLE wholesale_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  credit_limit DECIMAL(10,2),
  current_balance DECIMAL(10,2) DEFAULT 0,
  payment_terms TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- ... other fields
);
```

#### Disposable Menus

**`disposable_menus`**
```sql
CREATE TABLE disposable_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  access_code TEXT,
  encrypted_url TEXT,
  status TEXT DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- ... other fields
);
```

**`menu_products`**
```sql
CREATE TABLE menu_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID REFERENCES disposable_menus(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  display_price DECIMAL(10,2),
  -- ... other fields
);
```

#### Suppliers & Purchase Orders

**`suppliers`**
```sql
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  payment_terms TEXT,
  contact_person TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- ... other fields
);
```

**`purchase_orders`**
```sql
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id),
  po_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'draft',
  total_amount DECIMAL(10,2),
  expected_delivery_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- ... other fields
);
```

**`purchase_order_items`**
```sql
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  -- ... other fields
);
```

#### Returns

**`return_authorizations`**
```sql
CREATE TABLE return_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES wholesale_orders(id),
  ra_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending',
  return_reason TEXT,
  return_method TEXT,
  refund_amount DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- ... other fields
);
```

**`return_items`**
```sql
CREATE TABLE return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ra_id UUID REFERENCES return_authorizations(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES wholesale_order_items(id),
  quantity DECIMAL(10,2) NOT NULL,
  reason TEXT,
  -- ... other fields
);
```

#### Loyalty Program

**`loyalty_program_config`**
```sql
CREATE TABLE loyalty_program_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  points_per_dollar DECIMAL(10,2) DEFAULT 1,
  bonus_rules JSONB,
  tier_rules JSONB,
  enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**`loyalty_rewards`**
```sql
CREATE TABLE loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  points_required INTEGER NOT NULL,
  reward_type TEXT,
  reward_value DECIMAL(10,2),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**`loyalty_points`**
```sql
CREATE TABLE loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES wholesale_clients(id),
  balance INTEGER DEFAULT 0,
  lifetime_earned INTEGER DEFAULT 0,
  lifetime_redeemed INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Coupons

**`coupons`**
```sql
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,
  start_date DATE,
  end_date DATE,
  never_expires BOOLEAN DEFAULT false,
  min_purchase DECIMAL(10,2),
  max_redemptions INTEGER,
  current_redemptions INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Quality Control

**`quality_control_tests`**
```sql
CREATE TABLE quality_control_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id),
  product_id UUID REFERENCES products(id),
  file_url TEXT,
  test_results JSONB,
  expiration_date DATE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**`quarantined_inventory`**
```sql
CREATE TABLE quarantined_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  batch_id UUID REFERENCES batches(id),
  quantity DECIMAL(10,2),
  reason TEXT,
  status TEXT DEFAULT 'quarantined',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  released_at TIMESTAMPTZ
);
```

#### Marketing

**`marketing_campaigns`**
```sql
CREATE TABLE marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  recipient_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**`marketing_workflows`**
```sql
CREATE TABLE marketing_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  conditions JSONB,
  actions JSONB,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Support

**`support_tickets`**
```sql
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES wholesale_clients(id),
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  assigned_to UUID REFERENCES tenant_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Compliance

**`compliance_documents`**
```sql
CREATE TABLE compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  file_url TEXT,
  expiration_date DATE,
  status TEXT DEFAULT 'active',
  created_by UUID REFERENCES tenant_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**`batch_recalls`**
```sql
CREATE TABLE batch_recalls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id),
  recall_reason TEXT NOT NULL,
  scope TEXT,
  status TEXT DEFAULT 'active',
  initiated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Reporting

**`custom_reports`**
```sql
CREATE TABLE custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data_sources JSONB,
  metrics JSONB,
  filters JSONB,
  visualization_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**`scheduled_reports`**
```sql
CREATE TABLE scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  report_id UUID REFERENCES custom_reports(id),
  schedule_type TEXT NOT NULL,
  schedule_config JSONB,
  next_run_at TIMESTAMPTZ,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Edge Functions

### 1. `create-wholesale-order`

**Purpose**: Atomic creation of wholesale orders with inventory updates

**Input**:
```typescript
{
  client_id: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
  }>;
  payment_terms: string;
  delivery_method: string;
  notes?: string;
}
```

**Process**:
1. Validate input
2. Check client credit limit
3. Atomic transaction:
   - Insert `wholesale_orders`
   - Insert `wholesale_order_items`
   - Update `wholesale_inventory` (deduct quantities)
   - Create `deliveries` record (if needed)
4. Send notification (email/SMS)
5. Return order ID

**Output**:
```typescript
{
  success: true;
  order_id: string;
  order_number: string;
}
```

---

### 2. `create-purchase-order`

**Purpose**: Atomic creation of purchase orders

**Input**:
```typescript
{
  supplier_id: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
  }>;
  expected_delivery_date: string;
  notes?: string;
}
```

**Process**:
1. Validate input
2. Atomic transaction:
   - Insert `purchase_orders`
   - Insert `purchase_order_items`
3. Generate PO PDF
4. Upload PDF to storage
5. Send PO to supplier (email)
6. Return PO ID

**Output**:
```typescript
{
  success: true;
  po_id: string;
  po_number: string;
  pdf_url: string;
}
```

---

### 3. `process-return`

**Purpose**: Atomic processing of returns with inventory restoration

**Input**:
```typescript
{
  order_id: string;
  items: Array<{
    order_item_id: string;
    quantity: number;
    reason: string;
  }>;
  return_method: 'refund' | 'exchange' | 'credit';
}
```

**Process**:
1. Validate input
2. Atomic transaction:
   - Insert `return_authorizations`
   - Insert `return_items`
   - Update `wholesale_orders` (link return)
   - Update `wholesale_inventory` (restore quantities)
   - If refund: Insert `refunds` and process payment
3. Send return confirmation
4. Return return ID

**Output**:
```typescript
{
  success: true;
  return_id: string;
  ra_number: string;
}
```

---

### 4. `send-campaign`

**Purpose**: Send marketing campaigns (email/SMS)

**Input**:
```typescript
{
  campaign_id: string;
  type: 'email' | 'sms';
  audience: {
    type: 'all' | 'segment' | 'custom';
    segment_id?: string;
    filters?: Record<string, any>;
  };
  content: {
    subject?: string;
    body: string;
    template?: string;
  };
  schedule?: string; // ISO date string
}
```

**Process**:
1. Insert `marketing_campaigns` record
2. Query audience (customers/segments)
3. For each recipient:
   - Insert `campaign_recipients`
   - Send email/SMS (Klaviyo/Twilio)
   - Track delivery status
4. Update campaign status
5. Return campaign summary

**Output**:
```typescript
{
  success: true;
  campaign_id: string;
  sent_count: number;
  failed_count: number;
}
```

---

### 5. `execute-workflow`

**Purpose**: Execute marketing automation workflows

**Input**:
```typescript
{
  workflow_id: string;
  trigger_event: string;
  event_data: Record<string, any>;
}
```

**Process**:
1. Query `marketing_workflows` (matching trigger)
2. For each workflow:
   - Check conditions
   - If conditions met:
     - Execute actions (in sequence)
     - Wait for delays (if configured)
   - Log execution
3. Return execution summary

**Output**:
```typescript
{
  success: true;
  workflows_executed: number;
  actions_taken: number;
}
```

---

### 6. `notify-recall`

**Purpose**: Send batch recall notifications

**Input**:
```typescript
{
  recall_id: string;
  batch_id: string;
  recall_reason: string;
  scope: 'all' | 'specific';
  product_ids?: string[];
}
```

**Process**:
1. Insert `batch_recalls` record
2. Query affected products
3. Query affected customers (orders with recalled products)
4. For each customer:
   - Insert `recall_notifications`
   - Send email notification
   - Send SMS notification (if enabled)
5. Generate compliance report
6. Upload report to storage
7. Return notification summary

**Output**:
```typescript
{
  success: true;
  recall_id: string;
  notified_count: number;
  report_url: string;
}
```

---

### 7. `generate-report`

**Purpose**: Generate custom reports

**Input**:
```typescript
{
  report_id?: string;
  data_sources: string[];
  metrics: string[];
  filters: Record<string, any>;
  visualization_type: 'table' | 'chart' | 'summary';
  format?: 'json' | 'pdf' | 'excel';
}
```

**Process**:
1. Query data (with filters)
2. Calculate metrics
3. Format results
4. Generate visualization
5. If format specified: Generate PDF/Excel
6. If save: Insert `custom_reports` record
7. Return report data

**Output**:
```typescript
{
  success: true;
  report_data: any;
  report_id?: string;
  file_url?: string;
}
```

---

### 8. `send-scheduled-report`

**Purpose**: Deliver scheduled reports

**Input**:
```typescript
{
  scheduled_report_id: string;
}
```

**Process**:
1. Query `scheduled_reports` record
2. Execute report generation
3. Format report (PDF/Excel)
4. Get recipients (`report_recipients`)
5. For each recipient:
   - Send email with attachment
   - Update `last_sent_at`
6. Update `next_run_at` (based on schedule)
7. Log delivery

**Output**:
```typescript
{
  success: true;
  delivered_count: number;
  next_run_at: string;
}
```

---

## Storage Buckets

### 1. `product-images`
- **Purpose**: Store product photos
- **Public**: Yes (for display)
- **Max File Size**: 5MB
- **Allowed Types**: image/jpeg, image/png, image/webp

### 2. `invoices`
- **Purpose**: Store PDF invoices
- **Public**: No (authenticated access only)
- **Max File Size**: 10MB
- **Allowed Types**: application/pdf

### 3. `purchase-orders`
- **Purpose**: Store PO PDFs
- **Public**: No
- **Max File Size**: 10MB
- **Allowed Types**: application/pdf

### 4. `quality-control`
- **Purpose**: Store COA files
- **Public**: No
- **Max File Size**: 20MB
- **Allowed Types**: application/pdf

### 5. `compliance-documents`
- **Purpose**: Store compliance documents
- **Public**: No
- **Max File Size**: 20MB
- **Allowed Types**: application/pdf, image/jpeg, image/png

### 6. `recall-reports`
- **Purpose**: Store recall compliance reports
- **Public**: No
- **Max File Size**: 10MB
- **Allowed Types**: application/pdf

### 7. `reports`
- **Purpose**: Store generated reports
- **Public**: No
- **Max File Size**: 50MB
- **Allowed Types**: application/pdf, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet

### 8. `support-attachments`
- **Purpose**: Store support ticket attachments
- **Public**: No
- **Max File Size**: 10MB
- **Allowed Types**: application/pdf, image/*, text/*

### 9. `branding`
- **Purpose**: Store logos and branding assets
- **Public**: Yes (for white-label)
- **Max File Size**: 2MB
- **Allowed Types**: image/jpeg, image/png, image/svg+xml

---

## RLS Policies

### Pattern for All Tables

```sql
-- Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their tenant's data
CREATE POLICY "tenant_isolation" ON table_name
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid()
    )
  );
```

### Example: Products Table

```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_products" ON products
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "tenant_insert_products" ON products
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid()
    )
  );
```

---

## API Endpoints

### Frontend API Calls (via Supabase Client)

All features use direct Supabase client calls with RLS:

```typescript
// Example: Fetch products
const { data, error } = await supabase
  .from('products')
  .select('*')
  .eq('tenant_id', tenant.id);
```

### Edge Function Endpoints

All edge functions follow pattern:
- **URL**: `https://[project].supabase.co/functions/v1/[function-name]`
- **Method**: POST
- **Headers**: `Authorization: Bearer [token]`
- **Body**: JSON

---

## Third-Party Integrations

### 1. Stripe
- **Purpose**: Payment processing, subscriptions
- **Environment Variables**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Used In**: Billing, refunds, subscription management

### 2. Klaviyo
- **Purpose**: Email marketing campaigns
- **Environment Variables**: `KLAVIYO_API_KEY`
- **Used In**: Marketing automation, email campaigns

### 3. Twilio
- **Purpose**: SMS notifications
- **Environment Variables**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- **Used In**: SMS campaigns, order notifications

### 4. Cloudflare Turnstile
- **Purpose**: CAPTCHA verification
- **Environment Variables**: `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`
- **Used In**: Signup, login forms

### 5. Upstash Redis
- **Purpose**: Rate limiting
- **Environment Variables**: `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`
- **Used In**: Rate limiting for API endpoints

---

## Environment Variables

### Required for All Features

```env
# Supabase
SUPABASE_URL=https://[project].supabase.co
SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]

# Auth
JWT_SECRET=[jwt-secret]
```

### Feature-Specific

```env
# Stripe (Billing)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Klaviyo (Marketing)
KLAVIYO_API_KEY=pk_...

# Twilio (SMS)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

# Cloudflare Turnstile (CAPTCHA)
TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...

# Upstash Redis (Rate Limiting)
UPSTASH_REDIS_URL=https://...
UPSTASH_REDIS_TOKEN=...
```

---

**Document End** - All integration requirements documented.

