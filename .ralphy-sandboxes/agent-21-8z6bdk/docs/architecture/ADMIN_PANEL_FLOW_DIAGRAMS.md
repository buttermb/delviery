# 📊 Admin Panel - Complete Flow Diagrams

## 🎯 Overview

This document provides **visual flow diagrams** for all admin panel features, showing:
- User action flows
- Database transaction flows
- Edge function execution flows
- Multi-tenant isolation patterns
- Feature gating flows

---

## 📋 Table of Contents

1. [Authentication & Access Flows](#authentication--access-flows)
2. [Product Management Flows](#product-management-flows)
3. [Order Management Flows](#order-management-flows)
4. [Inventory Management Flows](#inventory-management-flows)
5. [Customer Management Flows](#customer-management-flows)
6. [Financial Management Flows](#financial-management-flows)
7. [Marketing & Automation Flows](#marketing--automation-flows)
8. [Compliance & Security Flows](#compliance--security-flows)
9. [Analytics & Reporting Flows](#analytics--reporting-flows)

---

## Authentication & Access Flows

### Tenant Admin Login Flow

```
User → Login Page
  ↓
Enter Email/Password + Tenant Slug
  ↓
Frontend: Validate Input
  ↓
API Call: POST /tenant-admin-auth?action=login
  ↓
Edge Function: tenant-admin-auth
  ├─ Verify Credentials (Supabase Auth)
  ├─ Check Tenant Status (active, trial, past_due)
  ├─ Check Subscription Tier
  ├─ Generate JWT Tokens
  └─ Set httpOnly Cookies (access_token, refresh_token)
  ↓
Response: { success: true, user, tenant }
  ↓
Frontend: Update Auth Context
  ├─ Set isAuthenticated = true
  ├─ Store user/tenant in context
  └─ Navigate to /admin/dashboard
  ↓
Dashboard Loads
  ├─ Verify Token (via cookies)
  ├─ Load Dashboard Data
  └─ Render UI
```

### Feature Access Check Flow

```
User Navigates to Feature Page
  ↓
Route: /admin/feature-name
  ↓
FeatureProtectedRoute Component
  ├─ Check Authentication (TenantAdminAuthContext)
  ├─ Get Tenant Subscription Tier
  └─ Check Feature Access (featureConfig.ts)
  ↓
Has Access?
  ├─ YES → Render Feature Page
  └─ NO → Show Upgrade Prompt
```

---

## Product Management Flows

### Create Product Flow

```
User → Products Page
  ↓
Click "Add Product"
  ↓
Product Form Opens
  ├─ Enter: Name, SKU, Category, Price, Description
  ├─ Upload: Product Image
  └─ Set: Inventory Settings
  ↓
Click "Save"
  ↓
Frontend Validation
  ├─ Required fields check
  ├─ Price format validation
  └─ Image size/format check
  ↓
API Call: POST /products
  ↓
Supabase Insert
  ├─ Insert into products table
  │   ├─ tenant_id (from context)
  │   ├─ name, sku, category, price
  │   └─ description, image_url
  ├─ Upload Image to Storage
  │   └─ product-images bucket
  └─ Update image_url in product record
  ↓
Response: { success: true, product }
  ↓
Frontend Updates
  ├─ Add product to list (optimistic update)
  ├─ Invalidate query cache
  └─ Show success toast
  ↓
Product Appears in List
```

### Edit Product Flow

```
User → Products Page
  ↓
Click Product Row
  ↓
Product Detail/Edit Modal Opens
  ├─ Load Current Product Data
  └─ Pre-fill Form Fields
  ↓
User Edits Fields
  ↓
Click "Save Changes"
  ↓
API Call: PATCH /products/:id
  ↓
Supabase Update
  ├─ Update products table
  │   └─ Only update changed fields
  └─ If image changed: Upload new image
  ↓
Response: { success: true, product }
  ↓
Frontend Updates
  ├─ Update product in list
  ├─ Invalidate query cache
  └─ Show success toast
```

### Delete Product Flow

```
User → Products Page
  ↓
Click Delete Button
  ↓
Confirm Delete Dialog
  ├─ Show warning message
  └─ "Are you sure?" confirmation
  ↓
User Confirms
  ↓
API Call: DELETE /products/:id
  ↓
Supabase Delete
  ├─ Check if product in use
  │   ├─ Check orders (if any orders → error)
  │   └─ Check menus (if in menu → warning)
  ├─ Delete product record
  └─ Delete image from storage (optional)
  ↓
Response: { success: true }
  ↓
Frontend Updates
  ├─ Remove product from list
  ├─ Invalidate query cache
  └─ Show success toast
```

---

## Order Management Flows

### Create Wholesale Order Flow

```
User → Wholesale Orders Page
  ↓
Click "New Order"
  ↓
Order Creation Wizard
  Step 1: Select Client
    ├─ Search/Select from wholesale_clients
    └─ Load client credit info
  ↓
  Step 2: Add Products
    ├─ Search products
    ├─ Add to cart (quantity, price)
    └─ Calculate subtotal
  ↓
  Step 3: Set Pricing
    ├─ Adjust item prices (if needed)
    ├─ Apply discounts
    └─ Calculate total
  ↓
  Step 4: Review & Submit
    ├─ Review order summary
    ├─ Set delivery date
    └─ Add notes
  ↓
Click "Create Order"
  ↓
API Call: POST /create-wholesale-order
  ↓
Edge Function: create-wholesale-order
  ├─ Validate Input
  ├─ Check Client Credit Limit
  ├─ Atomic Transaction:
  │   ├─ Insert wholesale_orders
  │   ├─ Insert wholesale_order_items (multiple)
  │   ├─ Update wholesale_inventory (deduct quantities)
  │   └─ Create delivery record (if delivery needed)
  ├─ Send Notification (email/SMS)
  └─ Return Order ID
  ↓
Response: { success: true, orderId }
  ↓
Frontend Updates
  ├─ Navigate to order detail page
  ├─ Invalidate query cache
  └─ Show success toast
```

### Update Order Status Flow

```
User → Order Detail Page
  ↓
Click Status Dropdown
  ↓
Select New Status (e.g., "Processing" → "Completed")
  ↓
API Call: PATCH /wholesale-orders/:id
  ↓
Supabase Update
  ├─ Update wholesale_orders.status
  ├─ Insert order_status_history record
  └─ If completed:
      ├─ Update client credit (if credit terms)
      └─ Trigger delivery completion (if applicable)
  ↓
Edge Function: update-order-status (optional)
  ├─ Send status update notification
  └─ Update related records
  ↓
Response: { success: true }
  ↓
Frontend Updates
  ├─ Update status in UI
  ├─ Invalidate query cache
  └─ Show success toast
```

---

## Inventory Management Flows

### Inventory Transfer Flow

```
User → Inventory Transfers Page
  ↓
Click "New Transfer"
  ↓
Transfer Form
  ├─ Select Source Warehouse
  ├─ Select Destination Warehouse
  ├─ Select Products
  └─ Enter Quantities
  ↓
Click "Create Transfer"
  ↓
API Call: POST /inventory-transfers
  ↓
Supabase Transaction
  ├─ Insert inventory_transfers record
  ├─ Update wholesale_inventory (source warehouse)
  │   └─ Decrease quantity
  ├─ Update wholesale_inventory (destination warehouse)
  │   └─ Increase quantity
  └─ Insert inventory_movements record (audit)
  ↓
Response: { success: true, transferId }
  ↓
Frontend Updates
  ├─ Update inventory displays
  ├─ Invalidate query cache
  └─ Show success toast
```

### Low Stock Alert Flow

```
Background Job (Cron/Edge Function)
  ↓
Query: wholesale_inventory
  ├─ Filter: quantity <= reorder_point
  └─ Group by product, warehouse
  ↓
For Each Low Stock Item:
  ├─ Check if alert already sent (today)
  ├─ If not:
  │   ├─ Insert inventory_alerts record
  │   ├─ Send notification (email/SMS)
  │   └─ Update alert_sent_at
  └─ If yes: Skip
  ↓
Admin Dashboard
  ├─ Query inventory_alerts (unresolved)
  └─ Display in alerts widget
```

---

## Customer Management Flows

### Add Wholesale Client Flow

```
User → Customers Page
  ↓
Click "Add Client"
  ↓
Client Form
  ├─ Enter: Name, Email, Phone
  ├─ Enter: Address, Tax ID
  ├─ Set: Credit Limit, Payment Terms
  └─ Upload: Documents (optional)
  ↓
Click "Save"
  ↓
API Call: POST /wholesale-clients
  ↓
Supabase Insert
  ├─ Insert wholesale_clients record
  │   ├─ tenant_id
  │   ├─ name, email, phone, address
  │   ├─ credit_limit, payment_terms
  │   └─ status: 'active'
  └─ If documents: Upload to storage
  ↓
Response: { success: true, clientId }
  ↓
Frontend Updates
  ├─ Add client to list
  ├─ Invalidate query cache
  └─ Show success toast
```

### Manage Client Credit Flow

```
User → Client Detail Page
  ↓
Click "Credit Management" Tab
  ↓
View Current Credit
  ├─ Credit Limit
  ├─ Current Balance
  ├─ Available Credit
  └─ Payment History
  ↓
Actions:
  ├─ Update Credit Limit
  │   └─ API: PATCH /wholesale-clients/:id
  │       └─ Update credit_limit
  ├─ Record Payment
  │   └─ API: POST /wholesale-payments
  │       ├─ Insert payment record
  │       └─ Update client balance
  └─ View Payment History
      └─ Query: wholesale_payments
          └─ Filter by client_id
```

---

## Financial Management Flows

### Purchase Order Creation Flow

```
User → Purchase Orders Page
  ↓
Click "New Purchase Order"
  ↓
PO Creation Wizard
  Step 1: Select Supplier
    └─ Load supplier info, payment terms
  ↓
  Step 2: Add Products
    ├─ Search products
    ├─ Enter quantities, unit prices
    └─ Calculate line totals
  ↓
  Step 3: Review
    ├─ Review PO summary
    ├─ Set delivery date
    └─ Add notes
  ↓
Click "Create PO"
  ↓
API Call: POST /create-purchase-order
  ↓
Edge Function: create-purchase-order
  ├─ Atomic Transaction:
  │   ├─ Insert purchase_orders
  │   ├─ Insert purchase_order_items (multiple)
  │   └─ Set status: 'draft' or 'sent'
  ├─ Generate PO PDF
  │   └─ Upload to storage: purchase-orders bucket
  └─ Send PO to Supplier (email)
  ↓
Response: { success: true, poId, pdfUrl }
  ↓
Frontend Updates
  ├─ Navigate to PO detail
  ├─ Invalidate query cache
  └─ Show success toast
```

### Process Return Flow

```
User → Returns Page
  ↓
Click "New Return"
  ↓
Return Form
  ├─ Select Original Order
  ├─ Select Products to Return
  ├─ Set Return Reason
  └─ Set Return Method (refund, exchange, credit)
  ↓
Click "Submit Return"
  ↓
API Call: POST /process-return
  ↓
Edge Function: process-return
  ├─ Atomic Transaction:
  │   ├─ Insert return_authorizations
  │   ├─ Insert return_items (multiple)
  │   ├─ Update wholesale_orders (link return)
  │   ├─ Update wholesale_inventory (restore quantities)
  │   └─ If refund:
  │       ├─ Insert refunds record
  │       └─ Process payment refund (Stripe)
  └─ Send Return Confirmation (email)
  ↓
Response: { success: true, returnId }
  ↓
Frontend Updates
  ├─ Navigate to return detail
  ├─ Invalidate query cache
  └─ Show success toast
```

---

## Marketing & Automation Flows

### Create Marketing Campaign Flow

```
User → Marketing Automation Page
  ↓
Click "Create Campaign"
  ↓
Campaign Builder
  Step 1: Campaign Details
    ├─ Name, Description
    ├─ Type: Email, SMS, Push
    └─ Schedule: Immediate, Scheduled
  ↓
  Step 2: Select Audience
    ├─ All Customers
    ├─ Segment (from CRM)
    └─ Custom Filter
  ↓
  Step 3: Create Content
    ├─ Email: Subject, Body, Template
    └─ SMS: Message Text
  ↓
  Step 4: Review & Launch
    ├─ Preview Content
    ├─ Review Audience Count
    └─ Set Send Time
  ↓
Click "Launch Campaign"
  ↓
API Call: POST /send-campaign
  ↓
Edge Function: send-campaign
  ├─ Insert marketing_campaigns record
  ├─ Query Audience (customers/segments)
  ├─ For Each Recipient:
  │   ├─ Insert campaign_recipients
  │   ├─ Send Email/SMS (Klaviyo/Twilio)
  │   └─ Track delivery status
  └─ Update campaign status: 'sent'
  ↓
Response: { success: true, campaignId, sentCount }
  ↓
Frontend Updates
  ├─ Show campaign in list
  ├─ Invalidate query cache
  └─ Show success toast
```

### Marketing Workflow Execution Flow

```
Workflow Trigger Event (e.g., Order Placed)
  ↓
Edge Function: execute-workflow
  ├─ Query marketing_workflows
  │   └─ Filter: trigger = event_type, enabled = true
  ├─ For Each Matching Workflow:
  │   ├─ Check Conditions
  │   │   ├─ Customer segment match?
  │   │   ├─ Order value threshold?
  │   │   └─ Time constraints?
  │   ├─ If Conditions Met:
  │   │   ├─ Execute Actions (in sequence)
  │   │   │   ├─ Send Email
  │   │   │   ├─ Send SMS
  │   │   │   ├─ Add to Segment
  │   │   │   └─ Apply Coupon
  │   │   ├─ Wait for Delay (if configured)
  │   │   └─ Continue to Next Step
  │   └─ Log Execution (workflow_runs)
  └─ Return Execution Summary
```

---

## Compliance & Security Flows

### Quality Control - COA Upload Flow

```
User → Quality Control Page
  ↓
Click "Upload COA"
  ↓
COA Upload Form
  ├─ Select Batch/Product
  ├─ Upload COA File (PDF)
  ├─ Enter Test Results:
  │   ├─ Potency (THC, CBD, etc.)
  │   ├─ Contaminants
  │   └─ Terpenes
  └─ Set Expiration Date
  ↓
Click "Upload"
  ↓
API Call: POST /quality-control/coa
  ↓
Supabase Transaction
  ├─ Upload File to Storage
  │   └─ quality-control bucket
  ├─ Insert quality_control_tests record
  │   ├─ batch_id, product_id
  │   ├─ file_url, test_results (JSONB)
  │   └─ expiration_date
  └─ If Test Fails:
      ├─ Insert quarantined_inventory record
      └─ Send Alert Notification
  ↓
Response: { success: true, testId }
  ↓
Frontend Updates
  ├─ Show COA in test results
  ├─ Invalidate query cache
  └─ Show success toast
```

### Batch Recall Flow

```
User → Batch Recall Page
  ↓
Click "Initiate Recall"
  ↓
Recall Form
  ├─ Select Batch Number
  ├─ Enter Recall Reason
  ├─ Set Recall Scope:
  │   ├─ All Products from Batch
  │   └─ Specific Products Only
  └─ Set Notification Preferences
  ↓
Click "Initiate Recall"
  ↓
API Call: POST /batch-recall
  ↓
Edge Function: notify-recall
  ├─ Insert batch_recalls record
  ├─ Query Affected Products
  │   └─ Find all products with batch_id
  ├─ Query Affected Customers
  │   └─ Find all orders with recalled products
  ├─ For Each Customer:
  │   ├─ Insert recall_notifications record
  │   ├─ Send Email Notification
  │   └─ Send SMS Notification (if enabled)
  └─ Generate Compliance Report
      └─ Upload to storage: recall-reports bucket
  ↓
Response: { success: true, recallId, notifiedCount }
  ↓
Frontend Updates
  ├─ Show recall in list
  ├─ Invalidate query cache
  └─ Show success toast
```

---

## Analytics & Reporting Flows

### Generate Custom Report Flow

```
User → Advanced Reporting Page
  ↓
Click "Create Report"
  ↓
Report Builder
  Step 1: Select Data Sources
    ├─ Orders
    ├─ Products
    ├─ Customers
    └─ Inventory
  ↓
  Step 2: Choose Metrics
    ├─ Revenue, Quantity, Count
    ├─ Averages, Percentages
    └─ Custom Calculations
  ↓
  Step 3: Set Filters
    ├─ Date Range
    ├─ Product Categories
    ├─ Customer Segments
    └─ Order Status
  ↓
  Step 4: Choose Visualization
    ├─ Table
    ├─ Chart (Bar, Line, Pie)
    └─ Summary Cards
  ↓
Click "Generate Report"
  ↓
API Call: POST /generate-report
  ↓
Edge Function: generate-report
  ├─ Query Data (with filters)
  ├─ Calculate Metrics
  ├─ Format Results
  ├─ Generate Visualization
  ├─ Save Report (optional)
  │   └─ Insert custom_reports record
  └─ Generate PDF/Excel (optional)
      └─ Upload to storage: reports bucket
  ↓
Response: { success: true, reportData, reportId }
  ↓
Frontend Updates
  ├─ Display Report
  ├─ Show Download Options
  └─ Option to Save Template
```

### Scheduled Report Delivery Flow

```
Background Job (Cron/Edge Function)
  ↓
Query: scheduled_reports
  ├─ Filter: enabled = true
  ├─ Filter: next_run_at <= NOW()
  └─ Filter: tenant_id (for multi-tenant)
  ↓
For Each Scheduled Report:
  ├─ Execute Report Generation
  │   └─ Call generate-report function
  ├─ Format Report (PDF/Excel)
  ├─ Get Recipients
  │   └─ Query report_recipients
  ├─ For Each Recipient:
  │   ├─ Send Email with Report Attachment
  │   └─ Update last_sent_at
  ├─ Update next_run_at
  │   └─ Calculate based on schedule (daily, weekly, monthly)
  └─ Log Delivery (scheduled_report_logs)
```

---

## Multi-Tenant Isolation Pattern

### All Database Queries

```
Frontend Component
  ↓
Get Tenant ID (from TenantAdminAuthContext)
  ↓
Supabase Query
  ├─ .from('table_name')
  ├─ .select('*')
  └─ .eq('tenant_id', tenant.id)  ← CRITICAL
  ↓
RLS Policy (Backend)
  ├─ Check: user's tenant_id matches row's tenant_id
  └─ If match: Allow, Else: Deny
  ↓
Return Filtered Results
```

### Edge Function Tenant Validation

```
Edge Function Receives Request
  ↓
Extract JWT Token (from cookies or header)
  ↓
Verify Token
  ├─ Decode JWT
  ├─ Get user_id and tenant_id
  └─ Validate token signature
  ↓
Create Supabase Client
  ├─ Set RLS context
  └─ Use service_role key (for admin operations)
  ↓
All Database Operations
  ├─ Filter by tenant_id
  └─ RLS policies enforce isolation
  ↓
Return Response
```

---

## Feature Gating Flow

```
User Navigates to Route
  ↓
Route Component: FeatureProtectedRoute
  ├─ Get Current User (TenantAdminAuthContext)
  ├─ Get Tenant Subscription Tier
  └─ Check Feature Config (featureConfig.ts)
  ↓
Feature Required Tier
  ├─ Starter
  ├─ Professional
  └─ Enterprise
  ↓
User's Current Tier
  ├─ Starter
  ├─ Professional
  └─ Enterprise
  ↓
Has Access?
  ├─ YES → Render Feature Page
  └─ NO → Show Upgrade Prompt
      ├─ Display required tier
      ├─ Show upgrade button
      └─ Link to billing page
```

---

**Document End** - All major flows documented with step-by-step diagrams.

