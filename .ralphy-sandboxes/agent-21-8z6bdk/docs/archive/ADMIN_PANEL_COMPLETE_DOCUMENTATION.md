# 📚 Admin Panel - Complete Feature Documentation

## 🎯 Overview

This document provides **complete documentation** for all **56+ admin panel features**, including:
- User flows for each feature
- Integration requirements (database, edge functions, storage)
- Code references and file locations
- Feature gating and tier requirements
- Testing checklists

**Last Updated**: All features documented as of latest implementation

---

## 📋 Table of Contents

1. [Core Features (Starter Tier)](#1-core-features-starter-tier)
2. [Professional Tier Features](#2-professional-tier-features)
3. [Enterprise Tier Features](#3-enterprise-tier-features)
4. [Integration Requirements](#integration-requirements)
5. [Database Schema Reference](#database-schema-reference)
6. [Edge Functions Reference](#edge-functions-reference)
7. [Testing Checklists](#testing-checklists)

---

## 1. Core Features (Starter Tier)

### 1.1 Dashboard
**Route**: `/admin/dashboard`  
**Feature ID**: `dashboard`  
**Tier**: Starter  
**File**: `src/pages/tenant-admin/DashboardPage.tsx`

#### User Flow
1. User logs in → Redirected to dashboard
2. Dashboard loads:
   - KPI cards (Revenue, Orders, Customers, Inventory)
   - Recent activity feed
   - Quick action buttons
   - Charts (Revenue trend, Top products)
3. User can navigate to other sections via sidebar

#### Integration Requirements
- **Database Tables**:
  - `tenants` - Tenant information
  - `orders` - Order data for revenue/order counts
  - `customer_users` - Customer count
  - `wholesale_inventory` - Inventory levels
- **Edge Functions**: None required
- **Storage**: None required
- **RLS**: All queries filtered by `tenant_id`

#### Code References
```typescript
// Query keys
queryKeys.dashboard.stats()
queryKeys.dashboard.recentActivity()

// Components
<TenantAdminDashboardPage />
```

---

### 1.2 Products Management
**Route**: `/admin/inventory/products`  
**Feature ID**: `products`  
**Tier**: Starter  
**File**: `src/pages/admin/ProductManagement.tsx`

#### User Flow
1. Navigate to Products page
2. View product list (table with search/filter)
3. Actions:
   - **Create Product**: Click "Add Product" → Fill form → Save
   - **Edit Product**: Click product row → Edit form → Save
   - **Delete Product**: Click delete → Confirm
   - **View Details**: Click product → View modal/page
4. Features:
   - Search by name/SKU
   - Filter by category/status
   - Bulk operations (delete, update status)
   - Export to CSV

#### Integration Requirements
- **Database Tables**:
  - `products` - Main product table
  - `product_categories` - Categories
  - `wholesale_inventory` - Inventory levels
- **Edge Functions**: None required (direct Supabase queries)
- **Storage**: `product-images` bucket for product photos
- **RLS**: Filter by `tenant_id`

#### Code References
```typescript
// Query keys
queryKeys.products.lists()
queryKeys.products.detail(productId)
queryKeys.products.categories()

// Components
<ProductManagement />
<ProductForm />
<ProductList />
```

---

### 1.3 Disposable Menus
**Route**: `/admin/disposable-menus`  
**Feature ID**: `disposable-menus`  
**Tier**: Starter  
**File**: `src/pages/admin/DisposableMenus.tsx`

#### User Flow
1. Navigate to Disposable Menus
2. View menu list (active, expired, draft)
3. Actions:
   - **Create Menu**: Click "Create Menu" → Select products → Set expiration → Generate link
   - **Clone Menu**: Click clone → Edit → Save as new
   - **Burn Menu**: Click burn → Confirm → Menu becomes inaccessible
   - **View Analytics**: Click menu → View access stats
4. Menu Access:
   - Generate encrypted URL with access code
   - Share with customers
   - Track views and access attempts

#### Integration Requirements
- **Database Tables**:
  - `disposable_menus` - Menu records
  - `menu_products` - Products in menu
  - `menu_access_logs` - Access tracking
- **Edge Functions**:
  - `generate-menu-link` - Create encrypted menu URLs
  - `burn-menu` - Invalidate menu access
- **Storage**: None required
- **RLS**: Filter by `tenant_id`

#### Code References
```typescript
// Query keys
queryKeys.disposableMenus.lists()
queryKeys.disposableMenus.detail(menuId)
queryKeys.disposableMenus.accessLogs(menuId)

// Components
<DisposableMenus />
<CreateMenuDialog />
<CloneMenuDialog />
```

---

### 1.4 Wholesale Orders
**Route**: `/admin/wholesale-orders`  
**Feature ID**: `wholesale-orders`  
**Tier**: Starter  
**File**: `src/pages/admin/WholesaleOrders.tsx`

#### User Flow
1. Navigate to Wholesale Orders
2. View order list (pending, processing, completed, cancelled)
3. Actions:
   - **Create Order**: Click "New Order" → Select client → Add products → Set pricing → Submit
   - **View Order**: Click order → View details (items, pricing, status)
   - **Update Status**: Change status (pending → processing → completed)
   - **Print Invoice**: Generate PDF invoice
   - **Track Delivery**: View delivery status and courier info
4. Features:
   - Filter by status, client, date range
   - Search by order number
   - Bulk status updates

#### Integration Requirements
- **Database Tables**:
  - `wholesale_orders` - Order records
  - `wholesale_order_items` - Order line items
  - `wholesale_clients` - Client information
  - `deliveries` - Delivery tracking
- **Edge Functions**:
  - `create-wholesale-order` - Atomic order creation
  - `update-order-status` - Status updates with notifications
  - `generate-invoice` - PDF invoice generation
- **Storage**: `invoices` bucket for PDF storage
- **RLS**: Filter by `tenant_id`

#### Code References
```typescript
// Query keys
queryKeys.wholesaleOrders.lists()
queryKeys.wholesaleOrders.detail(orderId)
queryKeys.wholesaleOrders.byClient(clientId)

// Components
<WholesaleOrders />
<NewWholesaleOrder />
<OrderDetail />
```

---

### 1.5 Customers (Wholesale Clients)
**Route**: `/admin/big-plug-clients`  
**Feature ID**: `customers`  
**Tier**: Starter  
**File**: `src/pages/admin/WholesaleClients.tsx`

#### User Flow
1. Navigate to Customers
2. View client list (table with search/filter)
3. Actions:
   - **Add Client**: Click "Add Client" → Fill form → Save
   - **View Client**: Click client → View details (orders, credit, contact info)
   - **Edit Client**: Click edit → Update form → Save
   - **Manage Credit**: Set credit limits, view balance
   - **View Orders**: See all orders for client
4. Features:
   - Search by name/email
   - Filter by status/credit status
   - Export client list

#### Integration Requirements
- **Database Tables**:
  - `wholesale_clients` - Client records
  - `wholesale_orders` - Order history
  - `wholesale_payments` - Payment/credit tracking
- **Edge Functions**: None required
- **Storage**: None required
- **RLS**: Filter by `tenant_id`

#### Code References
```typescript
// Query keys
queryKeys.wholesaleClients.lists()
queryKeys.wholesaleClients.detail(clientId)
queryKeys.wholesaleClients.orders(clientId)

// Components
<WholesaleClients />
<ClientDetail />
<ClientForm />
```

---

### 1.6 Inventory Dashboard
**Route**: `/admin/inventory-dashboard`  
**Feature ID**: `inventory-dashboard`  
**Tier**: Starter  
**File**: `src/pages/admin/InventoryDashboard.tsx`

#### User Flow
1. Navigate to Inventory Dashboard
2. View overview:
   - Total inventory value
   - Low stock alerts
   - Recent movements
   - Warehouse breakdown
3. Actions:
   - Click product → View details
   - Click warehouse → Filter by location
   - Click alert → View low stock items

#### Integration Requirements
- **Database Tables**:
  - `wholesale_inventory` - Inventory levels
  - `inventory_alerts` - Low stock alerts
  - `inventory_movements` - Movement history
  - `warehouses` - Warehouse locations
- **Edge Functions**: None required
- **Storage**: None required
- **RLS**: Filter by `tenant_id`

---

### 1.7 Generate Barcodes
**Route**: `/admin/generate-barcodes`  
**Feature ID**: `generate-barcodes`  
**Tier**: Starter  
**File**: `src/pages/admin/GenerateBarcodes.tsx`

#### User Flow
1. Navigate to Generate Barcodes
2. Select products to generate barcodes
3. Choose barcode format (Code128, EAN-13, QR Code)
4. Generate and download:
   - Individual barcodes
   - Batch PDF with multiple barcodes
5. Print labels directly

#### Integration Requirements
- **Database Tables**: `products` (for product data)
- **Edge Functions**: None required (client-side generation)
- **Storage**: None required
- **Libraries**: `JsBarcode`, `qrcode.react`, `jsPDF`

---

### 1.8 Basic Reports
**Route**: `/admin/reports`  
**Feature ID**: `reports`  
**Tier**: Starter  
**File**: `src/pages/admin/ReportsPage.tsx`

#### User Flow
1. Navigate to Reports
2. Select report type:
   - Sales Summary
   - Order Report
   - Customer Report
   - Inventory Report
3. Set date range and filters
4. Generate report → View/Download (PDF/CSV)

#### Integration Requirements
- **Database Tables**: Various (orders, customers, inventory)
- **Edge Functions**: None required
- **Storage**: None required

---

### 1.9 Settings
**Route**: `/admin/settings`  
**Feature ID**: `settings`  
**Tier**: Starter  
**File**: `src/pages/admin/SettingsPage.tsx`

#### User Flow
1. Navigate to Settings
2. Tabs:
   - **General**: Business name, contact info
   - **Billing**: Subscription, payment method
   - **Notifications**: Email/SMS preferences
   - **Security**: Password, 2FA
   - **Integrations**: API keys, webhooks
3. Save changes → Confirmation toast

#### Integration Requirements
- **Database Tables**: `tenants`, `tenant_users`
- **Edge Functions**: `update-tenant-settings`
- **Storage**: None required

---

### 1.10 Billing
**Route**: `/admin/billing`  
**Feature ID**: `billing`  
**Tier**: Starter  
**File**: `src/pages/tenant-admin/BillingPage.tsx`

#### User Flow
1. Navigate to Billing
2. View:
   - Current plan and pricing
   - Usage limits and current usage
   - Billing history
   - Payment method
3. Actions:
   - Upgrade/Downgrade plan
   - Update payment method
   - Download invoices
   - View usage details

#### Integration Requirements
- **Database Tables**: `tenants`, `subscription_events`, `invoices`
- **Edge Functions**: `update-subscription`, `stripe-customer-portal`
- **Storage**: None required
- **Integrations**: Stripe

---

### 1.11 Suppliers
**Route**: `/admin/suppliers`  
**Feature ID**: `suppliers`  
**Tier**: Starter  
**File**: `src/pages/admin/SupplierManagementPage.tsx`

#### User Flow
1. Navigate to Suppliers
2. View supplier list
3. Actions:
   - **Add Supplier**: Click "Add Supplier" → Fill form → Save
   - **Edit Supplier**: Click supplier → Edit → Save
   - **View Details**: Contact info, payment terms, performance
   - **View POs**: See all purchase orders from supplier
4. Features:
   - Search and filter
   - Performance tracking (on-time delivery, quality)

#### Integration Requirements
- **Database Tables**:
  - `suppliers` - Supplier records
  - `purchase_orders` - Related POs
- **Edge Functions**: None required
- **Storage**: None required

---

### 1.12 Purchase Orders
**Route**: `/admin/purchase-orders`  
**Feature ID**: `purchase-orders`  
**Tier**: Starter  
**File**: `src/pages/admin/PurchaseOrdersPage.tsx`

#### User Flow
1. Navigate to Purchase Orders
2. View PO list (draft, sent, received, cancelled)
3. Actions:
   - **Create PO**: Click "New PO" → Select supplier → Add products → Review → Send
   - **View PO**: Click PO → View details, items, status
   - **Update Status**: Mark as received, update quantities
   - **Print PO**: Generate PDF
4. Features:
   - Filter by status, supplier, date
   - PO templates for recurring orders

#### Integration Requirements
- **Database Tables**:
  - `purchase_orders` - PO records
  - `purchase_order_items` - PO line items
  - `suppliers` - Supplier info
- **Edge Functions**: `create-purchase-order` (atomic creation)
- **Storage**: `purchase-orders` bucket for PDFs

---

### 1.13 Returns & Refunds
**Route**: `/admin/returns`  
**Feature ID**: `returns`  
**Tier**: Starter  
**File**: `src/pages/admin/ReturnsManagementPage.tsx`

#### User Flow
1. Navigate to Returns
2. View return list (pending, approved, rejected, refunded)
3. Actions:
   - **Create Return**: Click "New Return" → Select order → Select items → Set reason → Submit
   - **Process Return**: Approve → Issue refund → Update inventory
   - **View Details**: Return items, reason, status, refund amount
4. Features:
   - Filter by status, date range
   - Return analytics (common reasons, trends)

#### Integration Requirements
- **Database Tables**:
  - `return_authorizations` - Return records
  - `return_items` - Returned items
  - `wholesale_orders` - Original orders
  - `refunds` - Refund records
- **Edge Functions**: `process-return` (atomic return processing)
- **Storage**: None required

---

### 1.14 Loyalty Program
**Route**: `/admin/loyalty-program`  
**Feature ID**: `loyalty-program`  
**Tier**: Starter  
**File**: `src/pages/admin/LoyaltyProgramPage.tsx`

#### User Flow
1. Navigate to Loyalty Program
2. Sections:
   - **Earning Rules**: Configure points per dollar, bonus rules
   - **Reward Catalog**: Create/edit rewards (discounts, free items)
   - **Point Adjustments**: Manually add/subtract points
   - **Analytics**: View redemption rates, popular rewards
3. Actions:
   - Configure earning rates
   - Create rewards
   - Adjust customer points
   - View program performance

#### Integration Requirements
- **Database Tables**:
  - `loyalty_program_config` - Program settings
  - `loyalty_rewards` - Reward catalog
  - `loyalty_points` - Customer point balances
  - `loyalty_point_adjustments` - Manual adjustments
  - `loyalty_redemptions` - Redemption history
- **Edge Functions**: None required
- **Storage**: None required

---

### 1.15 Coupons
**Route**: `/admin/coupons`  
**Feature ID**: `coupons`  
**Tier**: Starter  
**File**: `src/pages/admin/CouponManagementPage.tsx`

#### User Flow
1. Navigate to Coupons
2. View coupon list (active, expired, disabled)
3. Actions:
   - **Create Coupon**: Click "New Coupon" → Set discount type/value → Set constraints → Set dates → Generate code
   - **Edit Coupon**: Click coupon → Edit → Save
   - **Bulk Generate**: Create multiple codes at once
   - **View Analytics**: Usage stats, redemption rate
4. Features:
   - Filter by status, date range
   - Usage tracking

#### Integration Requirements
- **Database Tables**:
  - `coupons` - Coupon records
  - `coupon_redemptions` - Redemption tracking
- **Edge Functions**: None required
- **Storage**: None required

---

## 2. Professional Tier Features

### 2.1 Quality Control
**Route**: `/admin/quality-control`  
**Feature ID**: `quality-control`  
**Tier**: Professional  
**File**: `src/pages/admin/QualityControlPage.tsx`

#### User Flow
1. Navigate to Quality Control
2. Sections:
   - **COA Upload**: Upload Certificates of Analysis
   - **Test Results**: View lab test results (potency, contaminants, terpenes)
   - **Quarantine Manager**: Manage quarantined inventory
3. Actions:
   - Upload COA files
   - Associate COAs with batches
   - View test results
   - Quarantine/Release inventory

#### Integration Requirements
- **Database Tables**:
  - `quality_control_tests` - Test records
  - `quarantined_inventory` - Quarantined items
  - `batches` - Batch tracking
- **Edge Functions**: None required
- **Storage**: `quality-control` bucket for COA files

---

### 2.2 Advanced CRM
**Route**: `/admin/customer-crm`  
**Feature ID**: `customer-crm`  
**Tier**: Professional  
**File**: `src/pages/admin/CustomerCRMPage.tsx`

#### User Flow
1. Navigate to Advanced CRM
2. Sections:
   - **Customer Segmentation**: Create segments based on criteria
   - **RFM Analysis**: Recency, Frequency, Monetary analysis
   - **Communication Timeline**: View all customer touchpoints
3. Actions:
   - Create/edit segments
   - View RFM scores
   - Track customer interactions
   - Export customer lists

#### Integration Requirements
- **Database Tables**:
  - `customer_segments` - Segment definitions
  - `customer_rfm_scores` - RFM analysis data
  - `customer_interactions` - Communication history
- **Edge Functions**: `calculate-rfm-scores` (background job)
- **Storage**: None required

---

### 2.3 Marketing Automation
**Route**: `/admin/marketing-automation`  
**Feature ID**: `marketing-automation`  
**Tier**: Professional  
**File**: `src/pages/admin/MarketingAutomationPage.tsx`

#### User Flow
1. Navigate to Marketing Automation
2. Sections:
   - **Campaign Builder**: Create email/SMS campaigns
   - **Workflow Editor**: Design automation workflows
   - **Campaign Analytics**: View performance metrics
3. Actions:
   - Create campaigns
   - Design workflows (triggers → actions → delays)
   - Schedule campaigns
   - View engagement metrics

#### Integration Requirements
- **Database Tables**:
  - `marketing_campaigns` - Campaign records
  - `marketing_workflows` - Workflow definitions
  - `campaign_recipients` - Recipient tracking
- **Edge Functions**:
  - `send-campaign` - Send email/SMS campaigns
  - `execute-workflow` - Run automation workflows
- **Storage**: None required
- **Integrations**: Klaviyo, Twilio

---

### 2.4 Appointments
**Route**: `/admin/appointments`  
**Feature ID**: `appointments`  
**Tier**: Professional  
**File**: `src/pages/admin/AppointmentSchedulerPage.tsx`

#### User Flow
1. Navigate to Appointments
2. View calendar/list of appointments
3. Actions:
   - **Create Appointment**: Click "New" → Select customer → Set date/time → Set type → Save
   - **Edit Appointment**: Click appointment → Edit → Save
   - **Cancel Appointment**: Cancel with notification
   - **View Details**: Customer info, notes, history
4. Features:
   - Calendar view
   - Filter by type, status
   - Availability settings

#### Integration Requirements
- **Database Tables**:
  - `appointments` - Appointment records
- **Edge Functions**: None required
- **Storage**: None required

---

### 2.5 Support Tickets
**Route**: `/admin/support-tickets`  
**Feature ID**: `support-tickets`  
**Tier**: Professional  
**File**: `src/pages/admin/SupportTicketsPage.tsx`

#### User Flow
1. Navigate to Support Tickets
2. View ticket list (open, in-progress, resolved, closed)
3. Actions:
   - **Create Ticket**: Click "New Ticket" → Fill form → Submit
   - **View Ticket**: Click ticket → View details, replies, history
   - **Reply**: Add reply → Send notification
   - **Update Status**: Change status, assign to team member
4. Features:
   - Filter by status, priority, assignee
   - Search tickets
   - Ticket analytics

#### Integration Requirements
- **Database Tables**:
  - `support_tickets` - Ticket records
  - `support_ticket_comments` - Replies/comments
- **Edge Functions**: None required
- **Storage**: `support-attachments` bucket for files

---

### 2.6 Batch Recall
**Route**: `/admin/batch-recall`  
**Feature ID**: `batch-recall`  
**Tier**: Professional  
**File**: `src/pages/admin/BatchRecallPage.tsx`

#### User Flow
1. Navigate to Batch Recall
2. View recall list (active, completed)
3. Actions:
   - **Initiate Recall**: Click "New Recall" → Select batch → Set reason → Set scope → Notify customers
   - **Track Recall**: View affected products, customers notified
   - **Generate Report**: Create regulatory compliance report
4. Features:
   - Traceability view
   - Customer notification tracking
   - Compliance reporting

#### Integration Requirements
- **Database Tables**:
  - `batch_recalls` - Recall records
  - `recall_notifications` - Notification tracking
  - `batches` - Batch information
- **Edge Functions**:
  - `notify-recall` - Send customer notifications
  - `generate-recall-report` - Create compliance reports
- **Storage**: `recall-reports` bucket for PDFs

---

### 2.7 Compliance Vault
**Route**: `/admin/compliance-vault`  
**Feature ID**: `compliance-vault`  
**Tier**: Professional  
**File**: `src/pages/admin/ComplianceVaultPage.tsx`

#### User Flow
1. Navigate to Compliance Vault
2. View document list (licenses, permits, certificates)
3. Actions:
   - **Upload Document**: Click "Upload" → Select file → Set type → Set expiration → Save
   - **View Document**: Click document → View details, preview, download
   - **Set Reminders**: Get notified before expiration
4. Features:
   - Filter by type, status, expiration
   - Expiration alerts
   - Audit trail

#### Integration Requirements
- **Database Tables**:
  - `compliance_documents` - Document records
- **Edge Functions**: None required
- **Storage**: `compliance-documents` bucket for files

---

### 2.8 Advanced Reporting
**Route**: `/admin/advanced-reporting`  
**Feature ID**: `advanced-reporting`  
**Tier**: Professional  
**File**: `src/pages/admin/AdvancedReportingPage.tsx`

#### User Flow
1. Navigate to Advanced Reporting
2. Sections:
   - **Report Builder**: Create custom reports
   - **Report List**: View saved reports
   - **Scheduled Reports**: Set up automated report delivery
3. Actions:
   - Build custom reports (select data sources, metrics, visualizations)
   - Save report templates
   - Schedule report delivery (email, dashboard)
   - Export reports (PDF, CSV, Excel)

#### Integration Requirements
- **Database Tables**:
  - `custom_reports` - Report definitions
  - `scheduled_reports` - Scheduled deliveries
- **Edge Functions**:
  - `generate-report` - Generate custom reports
  - `send-scheduled-report` - Deliver scheduled reports
- **Storage**: `reports` bucket for generated reports

---

### 2.9 Predictive Analytics
**Route**: `/admin/predictive-analytics`  
**Feature ID**: `predictive-analytics`  
**Tier**: Professional  
**File**: `src/pages/admin/PredictiveAnalyticsPage.tsx`

#### User Flow
1. Navigate to Predictive Analytics
2. Sections:
   - **Demand Forecast**: View predicted product demand
   - **Inventory Optimization**: Get stock level recommendations
   - **Cash Flow Projection**: View future cash flow
3. Actions:
   - View forecasts
   - Adjust forecast parameters
   - Export projections

#### Integration Requirements
- **Database Tables**: Various (orders, inventory, payments)
- **Edge Functions**: `predict-demand` (ML forecasting)
- **Storage**: None required

---

## 3. Enterprise Tier Features

### 3.1 Fleet Management
**Route**: `/admin/fleet-management`  
**Feature ID**: `fleet-management`  
**Tier**: Enterprise  
**File**: `src/pages/admin/FleetManagement.tsx`

#### User Flow
1. Navigate to Fleet Management
2. View courier/vehicle list
3. Actions:
   - **Add Courier**: Click "Add" → Fill form → Save
   - **View Courier**: Click courier → View details, earnings, delivery history
   - **Track Location**: Real-time GPS tracking
   - **Manage Vehicles**: Assign vehicles to couriers
4. Features:
   - Real-time location tracking
   - Performance metrics
   - Earnings tracking

#### Integration Requirements
- **Database Tables**:
  - `couriers` - Courier records
  - `courier_earnings` - Earnings tracking
  - `deliveries` - Delivery history
- **Edge Functions**: None required
- **Storage**: None required
- **Integrations**: GPS tracking service

---

### 3.2 Live Map Tracking
**Route**: `/admin/live-map`  
**Feature ID**: `live-map`  
**Tier**: Enterprise  
**File**: `src/pages/admin/LiveMap.tsx`

#### User Flow
1. Navigate to Live Map
2. View map with:
   - Active deliveries
   - Courier locations (real-time)
   - Delivery routes
3. Actions:
   - Click delivery → View details
   - Click courier → View info, contact
   - Replay delivery route
4. Features:
   - Real-time updates (WebSocket)
   - Route optimization visualization
   - ETA calculations

#### Integration Requirements
- **Database Tables**: `deliveries`, `couriers`
- **Edge Functions**: None required
- **Storage**: None required
- **Real-time**: Supabase Realtime subscriptions

---

### 3.3 POS System
**Route**: `/admin/pos-system`  
**Feature ID**: `pos-system`  
**Tier**: Enterprise  
**File**: `src/pages/admin/PointOfSale.tsx`

#### User Flow
1. Navigate to POS System
2. POS Interface:
   - Product grid/search
   - Cart/order builder
   - Payment processing
   - Receipt printing
3. Actions:
   - Add products to cart
   - Process payment (cash, card, digital)
   - Print receipt
   - View transaction history

#### Integration Requirements
- **Database Tables**:
  - `pos_transactions` - Transaction records
  - `pos_shifts` - Shift management
- **Edge Functions**: `process-pos-payment`
- **Storage**: None required
- **Integrations**: Payment processor

---

### 3.4 White Label
**Route**: `/admin/white-label`  
**Feature ID**: `white-label`  
**Tier**: Enterprise  
**File**: `src/pages/admin/WhiteLabel.tsx`

#### User Flow
1. Navigate to White Label
2. Configure:
   - Logo and branding
   - Color scheme
   - Email templates
   - SMS templates
3. Actions:
   - Upload logo/favicon
   - Set brand colors
   - Customize email templates
   - Preview changes

#### Integration Requirements
- **Database Tables**: `tenants` (white_label JSONB column)
- **Edge Functions**: None required
- **Storage**: `branding` bucket for logos

---

### 3.5 API Access
**Route**: `/admin/api-access`  
**Feature ID**: `api-access`  
**Tier**: Enterprise  
**File**: `src/pages/admin/APIAccessPage.tsx`

#### User Flow
1. Navigate to API Access
2. View:
   - API keys list
   - Usage statistics
   - Rate limits
   - Documentation
3. Actions:
   - Generate new API key
   - Revoke API key
   - View usage logs
   - Set rate limits

#### Integration Requirements
- **Database Tables**:
  - `api_keys` - API key records
  - `api_logs` - Usage tracking
- **Edge Functions**: None required
- **Storage**: None required

---

## Integration Requirements

### Database Tables Summary

**Core Tables** (All Features):
- `tenants` - Tenant information
- `tenant_users` - User-tenant mapping
- `products` - Product catalog
- `wholesale_inventory` - Inventory levels
- `wholesale_orders` - Order records
- `wholesale_clients` - Customer records

**Feature-Specific Tables**:
- `disposable_menus`, `menu_products` - Disposable menus
- `suppliers`, `purchase_orders`, `purchase_order_items` - Suppliers & POs
- `return_authorizations`, `return_items` - Returns
- `loyalty_program_config`, `loyalty_rewards`, `loyalty_points` - Loyalty
- `coupons`, `coupon_redemptions` - Coupons
- `quality_control_tests`, `quarantined_inventory` - Quality control
- `customer_segments`, `customer_rfm_scores` - Advanced CRM
- `marketing_campaigns`, `marketing_workflows` - Marketing
- `appointments` - Appointments
- `support_tickets`, `support_ticket_comments` - Support
- `batch_recalls`, `recall_notifications` - Batch recall
- `compliance_documents` - Compliance vault
- `custom_reports`, `scheduled_reports` - Advanced reporting
- `couriers`, `courier_earnings` - Fleet management
- `pos_transactions`, `pos_shifts` - POS system
- `api_keys`, `api_logs` - API access

### Edge Functions Summary

1. `create-wholesale-order` - Atomic order creation
2. `generate-menu-link` - Create encrypted menu URLs
3. `burn-menu` - Invalidate menu access
4. `create-purchase-order` - Atomic PO creation
5. `process-return` - Atomic return processing
6. `send-campaign` - Email/SMS campaigns
7. `execute-workflow` - Marketing automation
8. `notify-recall` - Recall notifications
9. `generate-recall-report` - Compliance reports
10. `generate-report` - Custom reports
11. `send-scheduled-report` - Scheduled report delivery
12. `predict-demand` - ML forecasting
13. `process-pos-payment` - POS payment processing
14. `update-tenant-settings` - Settings updates
15. `update-subscription` - Plan changes
16. `stripe-customer-portal` - Billing portal

### Storage Buckets Summary

1. `product-images` - Product photos
2. `invoices` - PDF invoices
3. `purchase-orders` - PO PDFs
4. `quality-control` - COA files
5. `compliance-documents` - Compliance documents
6. `recall-reports` - Recall reports
7. `reports` - Generated reports
8. `support-attachments` - Support ticket files
9. `branding` - Logos and branding assets

---

## Testing Checklists

### Feature Testing Checklist

For each feature, verify:
- [ ] Route is accessible (with correct tier)
- [ ] Data loads correctly (with tenant filtering)
- [ ] Create/Edit/Delete operations work
- [ ] Search and filters work
- [ ] Export functionality works
- [ ] Error handling is proper
- [ ] Loading states display
- [ ] Mobile responsiveness

### Integration Testing Checklist

- [ ] All database queries filter by `tenant_id`
- [ ] RLS policies are enabled on all tables
- [ ] Edge functions validate tenant context
- [ ] Feature gating works correctly
- [ ] Storage buckets have proper permissions
- [ ] Real-time subscriptions work
- [ ] Error messages are user-friendly

---

## Code References

### Key Files

**Pages**: `src/pages/admin/*.tsx`  
**Components**: `src/components/admin/*/*.tsx`  
**Routes**: `src/App.tsx` (lines 440-587)  
**Sidebar**: `src/components/tenant-admin/TenantAdminSidebar.tsx`  
**Feature Config**: `src/lib/featureConfig.ts`  
**Query Keys**: `src/lib/queryKeys.ts`

### Common Patterns

**Data Fetching**:
```typescript
const { data, isLoading } = useQuery({
  queryKey: queryKeys.featureName.lists(),
  queryFn: async () => {
    const { data, error } = await supabase
      .from('table_name')
      .select('*')
      .eq('tenant_id', tenant.id);
    if (error) throw error;
    return data;
  }
});
```

**Feature Gating**:
```typescript
<FeatureProtectedRoute featureId="feature-id">
  <FeaturePage />
</FeatureProtectedRoute>
```

**Tenant Filtering**:
```typescript
.eq('tenant_id', tenant?.id)
```

---

**Document End** - All 56+ features documented with flows and integration requirements.

