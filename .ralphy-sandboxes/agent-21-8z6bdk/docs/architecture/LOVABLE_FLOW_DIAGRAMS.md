# Lovable Integration Flow Diagrams

## Complete User Flows for All 15 Features

---

## Feature 1: Supplier Management System

```
User Action Flow:
┌─────────────────────────────────────────────────────────────┐
│ 1. Navigate to /admin/suppliers                             │
│    ↓                                                          │
│ 2. FeatureProtectedRoute checks Professional tier           │
│    ↓                                                          │
│ 3. SupplierManagementPage loads                              │
│    ↓                                                          │
│ 4. useQuery fetches suppliers (filtered by tenant_id)        │
│    ↓                                                          │
│ 5. SupplierList renders with data                           │
│    ↓                                                          │
│ 6. User clicks "New Supplier"                                │
│    ↓                                                          │
│ 7. SupplierForm dialog opens                                │
│    ↓                                                          │
│ 8. User fills form and submits                               │
│    ↓                                                          │
│ 9. useMutation inserts into suppliers table                  │
│    ↓                                                          │
│ 10. Query invalidated → List refreshes                      │
│    ↓                                                          │
│ 11. Success toast shown                                      │
└─────────────────────────────────────────────────────────────┘

Database Flow:
INSERT INTO suppliers (tenant_id, name, email, ...)
  VALUES (current_tenant_id, ...)
  → RLS Policy checks tenant_id matches
  → Record created
  → Query cache invalidated
  → UI updates
```

---

## Feature 2: Purchase Order Management

```
User Action Flow:
┌─────────────────────────────────────────────────────────────┐
│ 1. Navigate to /admin/purchase-orders                        │
│    ↓                                                          │
│ 2. PurchaseOrdersPage loads                                  │
│    ↓                                                          │
│ 3. Fetches POs with supplier relations                       │
│    ↓                                                          │
│ 4. User clicks "New Purchase Order"                         │
│    ↓                                                          │
│ 5. Multi-step form:                                          │
│    Step 1: Select supplier                                   │
│    Step 2: Add products/items                                │
│    Step 3: Review and submit                                 │
│    ↓                                                          │
│ 6. Form submission                                           │
│    ↓                                                          │
│ 7. Edge Function: create-purchase-order                      │
│    ├─ Validates tenant access                                │
│    ├─ Calculates total amount                                │
│    ├─ INSERT purchase_orders (transaction)                    │
│    └─ INSERT purchase_order_items (transaction)              │
│    ↓                                                          │
│ 8. Success → Query invalidated → List refreshes              │
└─────────────────────────────────────────────────────────────┘

Transaction Flow:
BEGIN TRANSACTION
  INSERT INTO purchase_orders (...)
  INSERT INTO purchase_order_items (...)
COMMIT
  → Both succeed or both fail (atomicity)
```

---

## Feature 3: Returns & Refunds System

```
User Action Flow:
┌─────────────────────────────────────────────────────────────┐
│ 1. Navigate to /admin/returns                                │
│    ↓                                                          │
│ 2. ReturnsManagementPage loads                               │
│    ↓                                                          │
│ 3. Fetches return authorizations with order relations         │
│    ↓                                                          │
│ 4. User clicks "New Return"                                  │
│    ↓                                                          │
│ 5. RACreateForm opens                                        │
│    ├─ Select original order                                 │
│    ├─ Select items to return                                │
│    ├─ Enter reason code                                     │
│    └─ Set refund method                                     │
│    ↓                                                          │
│ 6. Submission creates RA and return items                    │
│    ↓                                                          │
│ 7. Status workflow:                                          │
│    pending → approved → processing → completed               │
│    ↓                                                          │
│ 8. Refund processed (if applicable)                         │
└─────────────────────────────────────────────────────────────┘

Refund Flow:
RA Status = 'approved'
  → Edge Function: process-return
  → Calculate refund amount
  → Process payment gateway refund
  → Update RA status to 'processing'
  → Update order status
  → Complete refund
  → Update RA status to 'completed'
```

---

## Feature 4: Loyalty & Rewards Program

```
User Action Flow:
┌─────────────────────────────────────────────────────────────┐
│ 1. Navigate to /admin/loyalty-program                        │
│    ↓                                                          │
│ 2. LoyaltyProgramPage loads with 3 tabs:                    │
│    ├─ Earning Rules Config                                  │
│    ├─ Reward Catalog                                        │
│    └─ Point Adjustments                                     │
│    ↓                                                          │
│ 3. Earning Rules Tab:                                        │
│    ├─ Configure points per dollar                           │
│    ├─ Set bonus multipliers                                 │
│    └─ Enable tier system                                    │
│    ↓                                                          │
│ 4. Reward Catalog Tab:                                       │
│    ├─ Create reward (discount/product/cash)                │
│    ├─ Set points required                                   │
│    └─ Set status (active/inactive)                          │
│    ↓                                                          │
│ 5. Point Adjustments Tab:                                    │
│    ├─ Search customer                                        │
│    ├─ Add/subtract points                                   │
│    └─ Enter reason                                          │
│    ↓                                                          │
│ 6. Points calculated on order completion                    │
└─────────────────────────────────────────────────────────────┘

Points Calculation Flow (on order completion):
Order Status = 'completed'
  → Edge Function: calculate-loyalty-points
  → Fetch loyalty_program_config
  → Calculate: order_total * points_per_dollar
  → Apply bonus multipliers (if applicable)
  → INSERT loyalty_point_adjustments
  → UPDATE customer_users.loyalty_points
  → Check tier upgrade (if enabled)
```

---

## Feature 5: Coupon & Promotion Manager

```
User Action Flow:
┌─────────────────────────────────────────────────────────────┐
│ 1. Navigate to /admin/coupons                                │
│    ↓                                                          │
│ 2. CouponManagementPage loads                                │
│    ↓                                                          │
│ 3. Fetches all coupons                                       │
│    ↓                                                          │
│ 4. User clicks "New Coupon"                                 │
│    ↓                                                          │
│ 5. CouponCreateForm opens                                    │
│    ├─ Code (auto-generate or manual)                        │
│    ├─ Discount type (percentage/fixed)                      │
│    ├─ Value, dates, constraints                             │
│    └─ Usage limits                                          │
│    ↓                                                          │
│ 6. Validation:                                               │
│    ├─ Code uniqueness (tenant_id + code)                     │
│    ├─ Percentage ≤ 100%                                     │
│    └─ Start date < End date                                 │
│    ↓                                                          │
│ 7. INSERT into coupons table                                │
│    ↓                                                          │
│ 8. List shows usage statistics                               │
└─────────────────────────────────────────────────────────────┘

Coupon Validation Flow (at checkout):
Customer applies coupon code
  → Edge Function: validate-coupon
  → Check: tenant_id, code exists
  → Check: not expired (end_date > now)
  → Check: usage_count < usage_limit
  → Check: order_total >= min_purchase
  → Calculate discount
  → Apply max_discount (if percentage)
  → Return validated coupon
  → Increment usage_count on order completion
```

---

## Feature 6: Quality Control & Lab Testing

```
User Action Flow:
┌─────────────────────────────────────────────────────────────┐
│ 1. Navigate to /admin/quality-control                         │
│    ↓                                                          │
│ 2. QualityControlPage loads with 3 tabs:                     │
│    ├─ COA Upload                                            │
│    ├─ Test Results                                          │
│    └─ Quarantine Manager                                     │
│    ↓                                                          │
│ 3. COA Upload Tab:                                           │
│    ├─ Select batch                                          │
│    ├─ Upload COA file                                       │
│    ├─ Enter lab name, test date                             │
│    └─ Enter test results (JSONB)                            │
│    ↓                                                          │
│ 4. File uploaded to Storage: quality-control bucket          │
│    ↓                                                          │
│ 5. INSERT into quality_control_tests                         │
│    ↓                                                          │
│ 6. If test failed → Quarantine batch                        │
│    ↓                                                          │
│ 7. Quarantine Manager shows quarantined batches              │
│    ↓                                                          │
│ 8. User can release or dispose                               │
└─────────────────────────────────────────────────────────────┘

COA Upload Flow:
User uploads file
  → Supabase Storage: upload to quality-control/{tenant_id}/{timestamp}.pdf
  → Get public URL
  → Parse test results (manual or OCR)
  → INSERT quality_control_tests
  → If status = 'failed'
    → INSERT quarantined_inventory
    → UPDATE inventory_batches.status = 'quarantined'
```

---

## Feature 7: Advanced CRM & Customer Insights

```
User Action Flow:
┌─────────────────────────────────────────────────────────────┐
│ 1. Navigate to /admin/customer-crm                           │
│    ↓                                                          │
│ 2. CustomerCRMPage loads with 3 tabs:                        │
│    ├─ Customer Segmentation                                 │
│    ├─ RFM Analysis                                          │
│    └─ Communication Timeline                                │
│    ↓                                                          │
│ 3. Segmentation Tab:                                         │
│    ├─ Create dynamic segments                               │
│    ├─ Set filters (orders, spend, recency)                  │
│    └─ View segment members                                  │
│    ↓                                                          │
│ 4. RFM Analysis Tab:                                         │
│    ├─ Calculate Recency (days since last order)            │
│    ├─ Calculate Frequency (order count)                      │
│    ├─ Calculate Monetary (total spent)                      │
│    └─ Display RFM scores and segments                       │
│    ↓                                                          │
│ 5. Communication Timeline Tab:                              │
│    ├─ Select customer                                       │
│    ├─ Fetch orders, emails, SMS, calls                      │
│    └─ Display chronological timeline                        │
└─────────────────────────────────────────────────────────────┘

RFM Calculation Flow:
User views RFM Analysis
  → Query all completed orders for tenant
  → Group by customer_id
  → For each customer:
    ├─ Recency = days since last order
    ├─ Frequency = order count
    └─ Monetary = sum(total_amount)
  → Score each dimension (1-5 scale)
  → Combine into RFM score (e.g., "555" = best customer)
  → Display in table/chart
```

---

## Feature 8: Marketing Automation Center

```
User Action Flow:
┌─────────────────────────────────────────────────────────────┐
│ 1. Navigate to /admin/marketing-automation                    │
│    ↓                                                          │
│ 2. MarketingAutomationPage loads with 3 tabs:               │
│    ├─ Campaigns                                             │
│    ├─ Workflows                                             │
│    └─ Analytics                                             │
│    ↓                                                          │
│ 3. Campaigns Tab:                                            │
│    ├─ User clicks "New Campaign"                            │
│    ├─ Select type (email/SMS)                               │
│    ├─ Enter subject, content                                │
│    ├─ Select audience                                       │
│    ├─ Schedule (optional)                                   │
│    └─ Submit                                                │
│    ↓                                                          │
│ 4. Campaign created in database                             │
│    ↓                                                          │
│ 5. If scheduled → Wait for scheduled_at                      │
│    If immediate → Trigger send-campaign edge function        │
│    ↓                                                          │
│ 6. Edge Function sends via Klaviyo                          │
│    ↓                                                          │
│ 7. Update campaign status and counts                        │
└─────────────────────────────────────────────────────────────┘

Campaign Send Flow:
Campaign status = 'scheduled' AND scheduled_at <= now
  → Edge Function: send-campaign
  → Fetch campaign details
  → Get audience list based on filters:
    ├─ All customers
    ├─ Active customers
    ├─ At-risk customers
    └─ Custom segment
  → For each customer:
    ├─ Send via Klaviyo API (email/SMS)
    └─ Track sent_count
  → Update campaign status to 'sent'
  → Track opens/clicks via webhooks
```

---

## Feature 9: Appointment Scheduling System

```
User Action Flow:
┌─────────────────────────────────────────────────────────────┐
│ 1. Navigate to /admin/appointments                           │
│    ↓                                                          │
│ 2. AppointmentSchedulerPage loads with 2 tabs:              │
│    ├─ Calendar View                                         │
│    └─ List View                                             │
│    ↓                                                          │
│ 3. Calendar View:                                           │
│    ├─ Displays month view                                   │
│    ├─ Highlights dates with appointments                    │
│    └─ Shows today's appointments                            │
│    ↓                                                          │
│ 4. User clicks date → Opens AppointmentForm                  │
│    ↓                                                          │
│ 5. Form:                                                    │
│    ├─ Select customer                                       │
│    ├─ Set date & time                                       │
│    ├─ Set duration                                          │
│    ├─ Select type                                           │
│    └─ Add notes                                            │
│    ↓                                                          │
│ 6. INSERT into appointments                                 │
│    ↓                                                          │
│ 7. Calendar updates with new appointment                    │
│    ↓                                                          │
│ 8. Optional: Send reminder (SMS/email)                      │
└─────────────────────────────────────────────────────────────┘

Appointment Reminder Flow (if implemented):
Cron job runs daily
  → Query appointments where:
    ├─ scheduled_at = tomorrow
    └─ status = 'scheduled' or 'confirmed'
  → For each appointment:
    ├─ Edge Function: send-appointment-reminder
    ├─ Send SMS/email to customer
    └─ Log reminder sent
```

---

## Feature 10: Support Ticket Management

```
User Action Flow:
┌─────────────────────────────────────────────────────────────┐
│ 1. Navigate to /admin/support-tickets                        │
│    ↓                                                          │
│ 2. SupportTicketsPage loads                                  │
│    ↓                                                          │
│ 3. Tabs: All, Open, In Progress, Resolved                   │
│    ↓                                                          │
│ 4. Search bar filters by subject/description                 │
│    ↓                                                          │
│ 5. User clicks "New Ticket"                                 │
│    ↓                                                          │
│ 6. TicketForm opens                                         │
│    ├─ Enter subject                                         │
│    ├─ Enter description                                     │
│    ├─ Set priority                                          │
│    └─ Set status                                            │
│    ↓                                                          │
│ 7. INSERT into support_tickets                               │
│    ↓                                                          │
│ 8. User clicks ticket → TicketDetail view                    │
│    ├─ Shows full details                                    │
│    ├─ Shows comments                                        │
│    └─ Actions: update status, add comment                   │
│    ↓                                                          │
│ 9. Status updates trigger notifications (optional)           │
└─────────────────────────────────────────────────────────────┘

Ticket Comment Flow:
User adds comment
  → INSERT into support_ticket_comments
  → If is_internal = false
    → Edge Function: notify-ticket-update
    → Send email to customer
  → Refresh ticket detail view
```

---

## Feature 11: Batch Recall & Traceability

```
User Action Flow:
┌─────────────────────────────────────────────────────────────┐
│ 1. Navigate to /admin/batch-recall                           │
│    ↓                                                          │
│ 2. BatchRecallPage loads with 2 tabs:                       │
│    ├─ Recalls                                               │
│    └─ Traceability                                          │
│    ↓                                                          │
│ 3. Recalls Tab:                                             │
│    ├─ User clicks "New Recall"                              │
│    ├─ Enter batch number                                    │
│    ├─ Enter reason                                          │
│    ├─ Set severity                                          │
│    └─ Enter notification message                            │
│    ↓                                                          │
│ 4. Calculate affected customers from traceability           │
│    ↓                                                          │
│ 5. INSERT into batch_recalls                                 │
│    ↓                                                          │
│ 6. User clicks "Notify Customers"                          │
│    ↓                                                          │
│ 7. Edge Function: notify-recall                             │
│    ├─ Get affected customers                                │
│    ├─ Send notifications                                    │
│    └─ Create notification records                           │
│    ↓                                                          │
│ 8. User clicks "Generate Report"                            │
│    ↓                                                          │
│ 9. Edge Function: generate-recall-report                    │
│    └─ Creates regulatory PDF                                │
└─────────────────────────────────────────────────────────────┘

Traceability Flow:
User searches batch number
  → Query orders with items from that batch:
    ├─ JOIN orders → order_items
    ├─ JOIN order_items → products
    └─ WHERE products.batch_number = searched_batch
  → For each order:
    ├─ Show customer info
    ├─ Show order date
    └─ Show items from batch
  → Display full product flow: Batch → Order → Customer
```

---

## Feature 12: Compliance Document Vault

```
User Action Flow:
┌─────────────────────────────────────────────────────────────┐
│ 1. Navigate to /admin/compliance-vault                       │
│    ↓                                                          │
│ 2. ComplianceVaultPage loads                                 │
│    ├─ Stats: Total, Expiring Soon, Expired, Active         │
│    └─ Tabs: All, Licenses, Permits, Certificates, Expiring │
│    ↓                                                          │
│ 3. User clicks "Upload Document"                            │
│    ↓                                                          │
│ 4. DocumentUpload form opens                                │
│    ├─ Enter name                                            │
│    ├─ Select type                                           │
│    ├─ Upload file                                           │
│    └─ Set expiration date (optional)                       │
│    ↓                                                          │
│ 5. File uploaded to Storage: compliance-documents           │
│    ↓                                                          │
│ 6. INSERT into compliance_documents                          │
│    ↓                                                          │
│ 7. Trigger function updates status based on expiration      │
│    ↓                                                          │
│ 8. User clicks document → DocumentDetail view                │
│    ├─ Shows details                                         │
│    ├─ Download button                                       │
│    └─ Audit trail (coming soon)                             │
└─────────────────────────────────────────────────────────────┘

Status Update Flow (Trigger):
INSERT/UPDATE compliance_documents
  → Trigger: update_compliance_document_status
  → Check expiration_date:
    ├─ If expiration_date < today → status = 'expired'
    ├─ If expiration_date <= today + 30 days → status = 'expiring_soon'
    └─ Else → status = 'active'
  → Return updated record
```

---

## Feature 13: Advanced Reporting & BI

```
User Action Flow:
┌─────────────────────────────────────────────────────────────┐
│ 1. Navigate to /admin/advanced-reporting                     │
│    ↓                                                          │
│ 2. AdvancedReportingPage loads with 4 tabs:                │
│    ├─ Builder                                               │
│    ├─ My Reports                                            │
│    ├─ Scheduled                                             │
│    └─ Templates                                             │
│    ↓                                                          │
│ 3. Builder Tab:                                             │
│    ├─ User clicks "New Report"                              │
│    ├─ Enter name, description                               │
│    ├─ Select report type                                    │
│    ├─ Set date range                                        │
│    └─ Configure metrics/dimensions (coming soon)            │
│    ↓                                                          │
│ 4. INSERT into custom_reports                                │
│    ↓                                                          │
│ 5. My Reports Tab:                                          │
│    ├─ List of saved reports                                 │
│    ├─ Click to view                                         │
│    └─ Download (PDF/CSV/Excel)                             │
│    ↓                                                          │
│ 6. Scheduled Tab:                                           │
│    ├─ Set up automated delivery                             │
│    ├─ Daily/Weekly/Monthly                                  │
│    └─ Email recipients                                      │
│    ↓                                                          │
│ 7. Templates Tab:                                           │
│    └─ Use pre-built templates                               │
└─────────────────────────────────────────────────────────────┘

Scheduled Report Flow (Cron):
Cron job runs (daily at 2 AM)
  → Query scheduled_reports where next_run_at <= now
  → For each report:
    ├─ Edge Function: generate-report
    ├─ Execute queries based on report config
    ├─ Format output (PDF/CSV/Excel)
    ├─ Email to recipients
    ├─ Update last_run_at
    └─ Calculate next_run_at
```

---

## Feature 14: Vendor/Supplier Portal

```
Vendor User Flow:
┌─────────────────────────────────────────────────────────────┐
│ 1. Vendor navigates to /vendor/login                         │
│    ↓                                                          │
│ 2. VendorLoginPage loads                                     │
│    ├─ Enter email/password                                  │
│    └─ Submit                                                │
│    ↓                                                          │
│ 3. Edge Function: vendor-auth                                │
│    ├─ Validate credentials                                  │
│    ├─ Check vendor_users table                              │
│    └─ Return vendor session                                 │
│    ↓                                                          │
│ 4. Redirect to /vendor/dashboard                             │
│    ↓                                                          │
│ 5. VendorDashboardPage loads                                 │
│    ├─ Stats: Active POs, Pending Payment, Revenue           │
│    └─ Recent Purchase Orders list                           │
│    ↓                                                          │
│ 6. Vendor clicks PO → View details                           │
│    ├─ See PO items                                          │
│    ├─ See delivery dates                                    │
│    └─ Upload invoice (coming soon)                         │
│    ↓                                                          │
│ 7. Vendor can track payments                                │
└─────────────────────────────────────────────────────────────┘

Vendor Authentication Flow:
POST /vendor/login
  → Edge Function: vendor-auth (action: 'login')
  → Query vendor_users WHERE email = input.email
  → Verify password_hash
  → Create session token
  → Return: { vendor, token, supplier_id }
  → Frontend stores token (httpOnly cookie)
  → All subsequent requests include token
```

---

## Feature 15: Predictive Analytics & Forecasting

```
User Action Flow:
┌─────────────────────────────────────────────────────────────┐
│ 1. Navigate to /admin/predictive-analytics                   │
│    ↓                                                          │
│ 2. PredictiveAnalyticsPage loads with 3 tabs:               │
│    ├─ Demand Forecast                                       │
│    ├─ Inventory Optimization                                │
│    └─ Cash Flow                                             │
│    ↓                                                          │
│ 3. Demand Forecast Tab:                                     │
│    ├─ Select product (optional)                             │
│    ├─ Set forecast period (30/60/90 days)                  │
│    └─ View predictions                                     │
│    ↓                                                          │
│ 4. Edge Function: predict-demand                            │
│    ├─ Fetch historical sales data                            │
│    ├─ Run ML model (or call external API)                    │
│    └─ Return predictions                                    │
│    ↓                                                          │
│ 5. Inventory Optimization Tab:                              │
│    ├─ View recommended stock levels                         │
│    ├─ Based on demand forecast                               │
│    └─ Consider lead times                                   │
│    ↓                                                          │
│ 6. Cash Flow Tab:                                           │
│    ├─ 30/60/90 day projections                              │
│    ├─ Based on orders, payments, expenses                   │
│    └─ Visual chart                                          │
└─────────────────────────────────────────────────────────────┘

Demand Forecasting Flow:
User requests forecast
  → Edge Function: predict-demand
  → Fetch historical data:
    ├─ Orders (last 12 months)
    ├─ Product sales by day/week/month
    └─ Seasonal patterns
  → Run ML model:
    ├─ Time series analysis
    ├─ Trend detection
    └─ Seasonality adjustment
  → Return predictions:
    ├─ Expected demand per day/week
    ├─ Confidence intervals
    └─ Recommendations
```

---

## Complete Integration Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    INTEGRATION PHASES                         │
└─────────────────────────────────────────────────────────────┘

Phase 1: Database Setup
  ├─ Create all 20+ tables
  ├─ Add RLS policies
  ├─ Create indexes
  ├─ Add triggers
  └─ Test tenant isolation

Phase 2: Storage Setup
  ├─ Create compliance-documents bucket
  ├─ Create quality-control bucket
  ├─ Set bucket policies
  └─ Test file uploads

Phase 3: Edge Functions
  ├─ Create 9 edge functions
  ├─ Deploy functions
  ├─ Test each function
  └─ Set up cron jobs

Phase 4: Frontend Verification
  ├─ Verify routes in App.tsx
  ├─ Test feature gating
  ├─ Verify query keys
  ├─ Test error handling
  └─ Test mobile responsiveness

Phase 5: Testing
  ├─ Run complete checklist
  ├─ Test multi-tenant isolation
  ├─ Test feature restrictions
  ├─ Test error scenarios
  └─ Performance testing

Phase 6: Production
  ├─ Run migrations
  ├─ Deploy functions
  ├─ Set up monitoring
  └─ Go live
```

---

## Multi-Tenant Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│              TENANT ISOLATION PATTERN                         │
└─────────────────────────────────────────────────────────────┘

Every Query:
  SELECT * FROM table_name
  WHERE tenant_id = current_tenant_id
    ↓
  RLS Policy checks:
    tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
    ↓
  Only returns data for current tenant
    ↓
  UI displays tenant-specific data

Every Insert:
  INSERT INTO table_name (tenant_id, ...)
  VALUES (current_tenant_id, ...)
    ↓
  RLS Policy checks:
    tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
    ↓
  Record created with correct tenant_id
    ↓
  Data isolated to tenant
```

---

## Feature Gating Flow

```
┌─────────────────────────────────────────────────────────────┐
│              FEATURE ACCESS CONTROL                           │
└─────────────────────────────────────────────────────────────┘

User navigates to /admin/feature-name
  ↓
FeatureProtectedRoute component
  ↓
useFeatureAccess() hook
  ├─ Gets current subscription tier
  ├─ Checks featureConfig for required tier
  └─ Compares: current_tier >= required_tier
    ↓
If access granted:
  → Render feature page
If access denied:
  → Show UpgradeModal
  → Redirect to billing/upgrade
```

---

**For complete details, see**: `LOVABLE_COMPLETE_INTEGRATION_GUIDE.md`

