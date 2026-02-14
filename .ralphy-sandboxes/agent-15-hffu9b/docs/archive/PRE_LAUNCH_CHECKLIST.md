# 🚀 Pre-Launch Feature Verification Checklist

**Platform**: BigMike Wholesale Platform (FloraIQ)  
**Last Updated**: 2025-01-XX  
**Purpose**: Comprehensive verification checklist to ensure all features are working before launch

---

## 📊 Launch Readiness Scorecard

**Overall Progress**: [ ] 0% Complete

### Category Completion
- [ ] Infrastructure & Environment (0/7)
- [ ] Authentication & Authorization (0/16)
- [ ] Marketing & Public Pages (0/13)
- [ ] Super Admin Panel (0/18)
- [ ] Tenant Admin Features (0/150+)
- [ ] Customer Portal (0/13)
- [ ] Courier Portal (0/7)
- [ ] Big Plug CRM (0/7)
- [ ] Disposable Menu System (0/7)
- [ ] Security & Compliance (0/9)
- [ ] Edge Functions (0/100+)
- [ ] Subscription & Billing (0/8)
- [ ] Performance & Infrastructure (0/10)
- [ ] Testing & Quality (0/8)
- [ ] Documentation (0/5)

---

## 1. Infrastructure & Environment

### Environment Setup
- [ ] Environment variables configured (`.env` file)
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
  - [ ] `VITE_SENTRY_DSN` (if using)
  - [ ] `VITE_STRIPE_PUBLIC_KEY`
  - [ ] `VITE_MAPBOX_TOKEN`
  - [ ] `VITE_TWILIO_*` variables
  - [ ] `VITE_SENDGRID_*` variables
  - [ ] `VITE_JUMIO_API_*` variables

### Supabase Configuration
- [ ] Supabase connection verified
- [ ] Database migrations applied (49+ tables)
- [ ] RLS policies active on all tables
- [ ] Storage buckets configured
  - [ ] `product-images`
  - [ ] `menu-images`
  - [ ] `documents`
  - [ ] `avatars`
- [ ] Edge functions deployed (100+ functions)
- [ ] Realtime subscriptions enabled
- [ ] Database connection pooling configured

### CDN & Edge Network
- [ ] CDN configured (Vercel Edge)
- [ ] Image optimization enabled
- [ ] Static asset caching configured
- [ ] API route caching configured

---

## 2. Authentication & Authorization (3-Tier System)

### Super Admin Authentication
- [ ] Login (`/super-admin/login`)
  - [ ] Email/password validation
  - [ ] Error handling
  - [ ] Success redirect
- [ ] Logout functionality
- [ ] Password reset flow (`/super-admin/reset/:token`)
  - [ ] Email sent
  - [ ] Token validation
  - [ ] Password update
- [ ] Session management
  - [ ] JWT token storage
  - [ ] Token refresh
  - [ ] Session expiration
- [ ] Protected routes (`SuperAdminProtectedRoute`)
- [ ] Multi-factor authentication (if enabled)

### Tenant Admin Authentication
- [ ] Login with tenant slug (`/:tenantSlug/admin/login`)
  - [ ] Tenant validation
  - [ ] Email/password validation
  - [ ] Multi-tenant isolation
- [ ] Logout functionality
- [ ] Password reset (`/:tenantSlug/admin/reset/:token`)
- [ ] Session management
  - [ ] JWT token storage
  - [ ] Token refresh
  - [ ] Cross-tenant protection
- [ ] Protected routes (`TenantAdminProtectedRoute`)
- [ ] Subscription guard (`SubscriptionGuard`)
- [ ] Feature access checks (`FeatureProtectedRoute`)

### Customer Authentication
- [ ] Sign up flow (`/:tenantSlug/customer/signup`)
  - [ ] Form validation
  - [ ] Email uniqueness check
  - [ ] Age verification requirement
- [ ] Email verification (`/:tenantSlug/customer/verify-email`)
  - [ ] 6-digit code generation
  - [ ] Code validation
  - [ ] Resend functionality
- [ ] Login (`/:tenantSlug/customer/login` or `/:tenantSlug/shop/login`)
  - [ ] Email/password validation
  - [ ] Remember me option
- [ ] Logout functionality
- [ ] Password reset
  - [ ] Forgot password (`/:tenantSlug/customer/forgot-password`)
  - [ ] Reset password (`/:tenantSlug/customer/reset-password`)
- [ ] Age verification (Jumio integration)
- [ ] Protected routes (`CustomerProtectedRoute`)

### Courier Authentication
- [ ] Login (`/courier/login`)
  - [ ] Phone/email validation
  - [ ] Password/PIN entry
- [ ] Logout functionality
- [ ] Session management
- [ ] Protected routes (`ProtectedCourierRoute`)

---

## 3. Marketing & Public Pages

### Core Marketing Pages
- [ ] Landing page (`/marketing`)
  - [ ] Hero section with CTAs
  - [ ] Features showcase
  - [ ] Pricing preview
  - [ ] Testimonials
  - [ ] Footer navigation
- [ ] Features page (`/features`)
  - [ ] Feature list
  - [ ] Comparison table
  - [ ] Screenshots/demos
- [ ] Pricing page (`/pricing`)
  - [ ] Three tiers displayed
  - [ ] Feature comparison
  - [ ] CTA buttons
  - [ ] FAQ section
- [ ] About page (`/about`)
- [ ] Contact page (`/contact`)
  - [ ] Contact form
  - [ ] Email sending
- [ ] Demo request flow
  - [ ] Demo request form (`/demo`)
  - [ ] Confirmation page (`/demo/confirm`)
  - [ ] Email notifications

### Authentication & Onboarding
- [ ] Sign up page (`/signup`)
  - [ ] Step 1: Business Information
  - [ ] Step 2: Compliance
  - [ ] Step 3: Products
  - [ ] Step 4: Team
  - [ ] Form validation
  - [ ] Progress indicator
- [ ] Email verification (`/verify-email`)
  - [ ] 6-digit code input
  - [ ] Code validation
  - [ ] Resend functionality
- [ ] Welcome/Onboarding page (`/:tenantSlug/admin/welcome`)
  - [ ] Multi-step wizard
  - [ ] Data persistence

### Legal & Support Pages
- [ ] Terms of Service (`/terms`)
- [ ] Privacy Policy (`/privacy`)
- [ ] Cookie Policy (`/cookie`)
- [ ] Security page (`/security`)
- [ ] FAQ page (`/faq`)
- [ ] Support page (`/support`)
- [ ] Status page (`/status`)

### Documentation
- [ ] Docs landing (`/docs`)
- [ ] Getting Started (`/docs/getting-started`)
- [ ] API Reference (`/docs/api-reference`)
- [ ] Authentication docs (`/docs/authentication`)
- [ ] Security docs (`/docs/security`)

### Additional Pages
- [ ] Integrations page (`/integrations`)
- [ ] Careers page (`/careers`)
- [ ] Press page (`/press`)
- [ ] Blog page (`/blog`)
- [ ] Login directory (`/login`)

### Public Marketplace
- [ ] Public marketplace (`/marketplace`)
  - [ ] Listing display
  - [ ] Search & filters
  - [ ] Category navigation
- [ ] Listing detail (`/marketplace/listings/:listingId`)
  - [ ] Product details
  - [ ] Seller information
  - [ ] Contact seller

---

## 4. Super Admin Panel

### Dashboard & Analytics
- [ ] Dashboard (`/super-admin/dashboard`)
  - [ ] Platform metrics (MRR, ARR, Churn)
  - [ ] Tenant count
  - [ ] Trial status
  - [ ] Revenue charts
- [ ] Monitoring (`/super-admin/monitoring`)
  - [ ] System health
  - [ ] API usage
  - [ ] Error tracking
- [ ] Analytics (`/super-admin/analytics`)
  - [ ] Usage analytics
  - [ ] Growth metrics
- [ ] Revenue Analytics (`/super-admin/revenue-analytics`)
- [ ] Executive Dashboard (`/super-admin/executive-dashboard`)
- [ ] Data Explorer (`/super-admin/data-explorer`)

### Tenant Management
- [ ] Tenants list (`/super-admin/tenants`)
  - [ ] Search & filters
  - [ ] Status indicators
  - [ ] Quick actions
- [ ] Create tenant (`/super-admin/tenants/new`)
  - [ ] Form validation
  - [ ] Subscription assignment
  - [ ] Feature flags
- [ ] Tenant detail (`/super-admin/tenants/:tenantId`)
  - [ ] Overview tab
  - [ ] Usage tab
  - [ ] Billing tab
  - [ ] Settings tab
  - [ ] Activity log

### System Configuration
- [ ] Feature flags (`/super-admin/feature-flags`)
  - [ ] Toggle features per tenant
  - [ ] Global feature toggles
- [ ] System config (`/super-admin/system-config`)
  - [ ] Platform settings
  - [ ] Integration configs
- [ ] Settings (`/super-admin/settings`)
  - [ ] Admin user management
  - [ ] Platform preferences

### Security & Compliance
- [ ] Security (`/super-admin/security`)
  - [ ] Security events
  - [ ] Threat detection
- [ ] Audit logs (`/super-admin/audit-logs`)
  - [ ] Action tracking
  - [ ] User activity
  - [ ] Export functionality
- [ ] API usage (`/super-admin/api-usage`)
  - [ ] Rate limiting
  - [ ] Usage tracking

### Additional Features
- [ ] Report builder (`/super-admin/report-builder`)
- [ ] Workflows (`/super-admin/workflows`)
- [ ] Communication (`/super-admin/communication`)
- [ ] Forum approvals (`/super-admin/forum-approvals`)
- [ ] Marketplace moderation (`/super-admin/marketplace/moderation`)
- [ ] Admin users (`/super-admin/admin-users`)
- [ ] Tools (`/super-admin/tools`)

---

## 5. Tenant Admin Features

### Core Features (Starter Tier - $99/mo)

#### Dashboard
- [ ] Dashboard (`/:tenantSlug/admin/dashboard`)
  - [ ] Business metrics
  - [ ] Quick stats
  - [ ] Recent activity
  - [ ] Widget customization

#### Product Management
- [ ] Products (`/:tenantSlug/admin/inventory/products`)
  - [ ] Create/edit/delete products
  - [ ] Bulk operations
  - [ ] Image upload
  - [ ] Category assignment
  - [ ] Pricing (cost, wholesale, retail)
  - [ ] Stock levels
  - [ ] THC/CBD tracking
- [ ] Categories (`/:tenantSlug/admin/catalog/categories`)
- [ ] Batches (`/:tenantSlug/admin/catalog/batches`)
- [ ] Images (`/:tenantSlug/admin/catalog/images`)

#### Inventory Management
- [ ] Inventory Dashboard (`/:tenantSlug/admin/inventory-dashboard`)
  - [ ] Stock overview
  - [ ] Low stock alerts
  - [ ] Multi-warehouse view
- [ ] Inventory Monitoring (`/:tenantSlug/admin/inventory-monitoring`)
- [ ] Generate Barcodes (`/:tenantSlug/admin/generate-barcodes`)
  - [ ] Barcode generation
  - [ ] Label printing (PDF)
  - [ ] QR code generation

#### Customer Management (Big Plug CRM)
- [ ] Clients (`/:tenantSlug/admin/big-plug-clients`)
  - [ ] Client list
  - [ ] Search & filters
  - [ ] Credit management
  - [ ] Order history
- [ ] Client Detail (`/:tenantSlug/admin/big-plug-clients/:id`)
  - [ ] Profile information
  - [ ] Credit limit
  - [ ] Payment terms
  - [ ] Order history
  - [ ] Notes & communication

#### Order Management
- [ ] Disposable Menu Orders (`/:tenantSlug/admin/disposable-menu-orders`)
  - [ ] Order list
  - [ ] Status updates
  - [ ] Filtering
- [ ] Wholesale Orders (`/:tenantSlug/admin/wholesale-orders`)
  - [ ] Order creation workflow
  - [ ] Credit checks
  - [ ] Approval process
  - [ ] Status tracking

#### Disposable Menus
- [ ] Disposable Menus (`/:tenantSlug/admin/disposable-menus`)
  - [ ] Menu creation
  - [ ] Encryption setup
  - [ ] Customer whitelisting
  - [ ] Access code generation
  - [ ] Burn & regenerate
- [ ] Menu Analytics (`/:tenantSlug/admin/menu-analytics`)
- [ ] Disposable Menu Analytics (`/:tenantSlug/admin/disposable-menu-analytics`)

#### Reports & Analytics
- [ ] Reports (`/:tenantSlug/admin/reports`)
  - [ ] Basic reports
  - [ ] Export (CSV/PDF)
  - [ ] Date range filters

#### Settings & Billing
- [ ] Settings (`/:tenantSlug/admin/settings`)
  - [ ] Business information
  - [ ] Team management
  - [ ] Preferences
- [ ] Billing (`/:tenantSlug/admin/billing`)
  - [ ] Subscription details
  - [ ] Usage meters
  - [ ] Payment methods
  - [ ] Invoice history
- [ ] Help (`/:tenantSlug/admin/help`)

### Professional Tier Features ($299/mo)

#### Advanced Inventory
- [ ] Advanced Inventory (`/:tenantSlug/admin/advanced-inventory`)
- [ ] Stock Alerts (`/:tenantSlug/admin/stock-alerts`)
- [ ] Inventory Transfers (`/:tenantSlug/admin/inventory-transfers`)
- [ ] Fronted Inventory (`/:tenantSlug/admin/fronted-inventory`)
  - [ ] Front creation
  - [ ] Sales recording
  - [ ] Payment tracking
  - [ ] Returns processing
- [ ] Dispatch Inventory (`/:tenantSlug/admin/dispatch-inventory`)
- [ ] Receiving (`/:tenantSlug/admin/operations/receiving`)
- [ ] Fronted Inventory Analytics (`/:tenantSlug/admin/fronted-inventory-analytics`)

#### Advanced Analytics
- [ ] Order Analytics (`/:tenantSlug/admin/order-analytics`)
- [ ] Sales Dashboard (`/:tenantSlug/admin/sales-dashboard`)
- [ ] Customer Insights (`/:tenantSlug/admin/customer-insights`)
- [ ] Customer Analytics (`/:tenantSlug/admin/customer-analytics`)
- [ ] Advanced Analytics (`/:tenantSlug/admin/advanced-analytics`)
- [ ] Realtime Dashboard (`/:tenantSlug/admin/realtime-dashboard`)
- [ ] Location Analytics (`/:tenantSlug/admin/location-analytics`)

#### Order Management
- [ ] Live Orders (`/:tenantSlug/admin/live-orders`)
  - [ ] Real-time updates
  - [ ] Status changes
  - [ ] Filtering & search

#### Financial Management
- [ ] Financial Center (`/:tenantSlug/admin/financial-center`)
  - [ ] Cash flow tracking
  - [ ] P&L reports
  - [ ] Payment tracking
- [ ] Revenue Reports (`/:tenantSlug/admin/revenue-reports`)
- [ ] Commission Tracking (`/:tenantSlug/admin/commission-tracking`)
- [ ] Advanced Invoice (`/:tenantSlug/admin/advanced-invoice`)
- [ ] Customer Invoices (`/:tenantSlug/admin/invoice-management`)

#### Team Management
- [ ] Team Members (`/:tenantSlug/admin/team-members`)
  - [ ] Add/edit/remove members
  - [ ] Role assignment
  - [ ] Permission management
- [ ] Role Management (`/:tenantSlug/admin/role-management`)
- [ ] Activity Logs (`/:tenantSlug/admin/activity-logs`)
- [ ] User Management (`/:tenantSlug/admin/user-management`)
- [ ] Permissions (`/:tenantSlug/admin/permissions`)

#### Customer Management
- [ ] Customer CRM (`/:tenantSlug/admin/customer-crm`)
  - [ ] Customer lifecycle
  - [ ] RFM analysis
  - [ ] Segmentation
- [ ] Customer Details (`/:tenantSlug/admin/customer-details`)
- [ ] Customer Reports (`/:tenantSlug/admin/customer-reports`)
- [ ] Loyalty Program (`/:tenantSlug/admin/loyalty-program`)
- [ ] Coupons (`/:tenantSlug/admin/coupons`)

#### Operations
- [ ] Suppliers (`/:tenantSlug/admin/suppliers`)
- [ ] Purchase Orders (`/:tenantSlug/admin/purchase-orders`)
- [ ] Returns (`/:tenantSlug/admin/returns`)
- [ ] Quality Control (`/:tenantSlug/admin/quality-control`)
- [ ] Marketing Automation (`/:tenantSlug/admin/marketing-automation`)
- [ ] Appointments (`/:tenantSlug/admin/appointments`)
- [ ] Support Tickets (`/:tenantSlug/admin/support-tickets`)
- [ ] Batch Recall (`/:tenantSlug/admin/batch-recall`)
- [ ] Compliance Vault (`/:tenantSlug/admin/compliance-vault`)

#### Reporting
- [ ] Advanced Reporting (`/:tenantSlug/admin/advanced-reporting`)
- [ ] Custom Reports (`/:tenantSlug/admin/custom-reports`)
- [ ] Predictive Analytics (`/:tenantSlug/admin/predictive-analytics`)

#### Marketplace
- [ ] Seller Profile (`/:tenantSlug/admin/marketplace/profile`)
- [ ] Listings (`/:tenantSlug/admin/marketplace/listings`)
  - [ ] Create listing
  - [ ] Edit listing
  - [ ] Manage listings
- [ ] Marketplace Orders (`/:tenantSlug/admin/marketplace/orders`)
- [ ] Messages (`/:tenantSlug/admin/marketplace/messages`)

### Enterprise Tier Features ($799/mo)

#### Fleet & Delivery
- [ ] Fleet Management (`/:tenantSlug/admin/fleet-management`)
  - [ ] Courier management
  - [ ] Vehicle tracking
  - [ ] Performance metrics
- [ ] GPS Tracking (`/:tenantSlug/admin/gps-tracking`)
- [ ] Route Optimizer (`/:tenantSlug/admin/route-optimizer`)
- [ ] Delivery Management (`/:tenantSlug/admin/delivery-management`)
- [ ] Delivery Tracking (`/:tenantSlug/admin/delivery-tracking`)
- [ ] Delivery Analytics (`/:tenantSlug/admin/delivery-analytics`)
- [ ] Live Map (`/:tenantSlug/admin/live-map`)
- [ ] Runner Location Tracking (`/:tenantSlug/admin/gps-tracking`)
- [ ] Couriers (`/:tenantSlug/admin/couriers`)

#### Point of Sale
- [ ] POS System (`/:tenantSlug/admin/pos-system`)
- [ ] Cash Register (`/:tenantSlug/admin/cash-register`)
- [ ] POS Analytics (`/:tenantSlug/admin/pos-analytics`)
- [ ] POS Shifts (`/:tenantSlug/admin/pos-shifts`)
- [ ] Z-Reports (`/:tenantSlug/admin/z-reports`)

#### Locations
- [ ] Locations (`/:tenantSlug/admin/locations`)
- [ ] Warehouses (`/:tenantSlug/admin/locations/warehouses`)
- [ ] Runners (`/:tenantSlug/admin/locations/runners`)

#### Integrations & API
- [ ] API Access (`/:tenantSlug/admin/api-access`)
  - [ ] API key generation
  - [ ] Usage tracking
  - [ ] Rate limits
- [ ] Webhooks (`/:tenantSlug/admin/webhooks`)
  - [ ] Webhook creation
  - [ ] Event subscriptions
  - [ ] Delivery logs
- [ ] Custom Integrations (`/:tenantSlug/admin/custom-integrations`)

#### Advanced Features
- [ ] Workflow Automation (`/:tenantSlug/admin/workflow-automation`)
- [ ] Local AI (`/:tenantSlug/admin/local-ai`)
- [ ] Global Search (`/:tenantSlug/admin/global-search`)
- [ ] Bulk Operations (`/:tenantSlug/admin/bulk-operations`)
- [ ] Data Export (`/:tenantSlug/admin/data-export`)
- [ ] Audit Trail (`/:tenantSlug/admin/audit-trail`)
- [ ] Compliance (`/:tenantSlug/admin/compliance`)

#### White Label
- [ ] White Label (`/:tenantSlug/admin/white-label`)
  - [ ] Logo upload
  - [ ] Theme customization
  - [ ] Email branding
  - [ ] SMS branding
- [ ] Custom Domain (`/:tenantSlug/admin/custom-domain`)
- [ ] Priority Support (`/:tenantSlug/admin/priority-support`)

#### Additional Enterprise Features
- [ ] Risk Management (`/:tenantSlug/admin/risk-management`)
- [ ] System Settings (`/:tenantSlug/admin/system-settings`)
- [ ] Vendor Management (`/:tenantSlug/admin/vendor-management`)
- [ ] Analytics Dashboard (`/:tenantSlug/admin/analytics-dashboard`)
- [ ] Developer Tools (`/:tenantSlug/admin/developer-tools`)

### Additional Pages
- [ ] Live Chat (`/:tenantSlug/admin/live-chat`)
- [ ] Notifications (`/:tenantSlug/admin/notifications`)
- [ ] Sales Pricing (`/:tenantSlug/admin/sales/pricing`)

---

## 6. Customer Portal

### Authentication
- [ ] Login (`/:tenantSlug/customer/login` or `/:tenantSlug/shop/login`)
- [ ] Sign Up (`/:tenantSlug/customer/signup`)
- [ ] Email Verification (`/:tenantSlug/customer/verify-email`)
- [ ] Forgot Password (`/:tenantSlug/customer/forgot-password`)
- [ ] Reset Password (`/:tenantSlug/customer/reset-password`)

### Dashboard & Shopping
- [ ] Dashboard (`/:tenantSlug/shop/dashboard`)
  - [ ] Quick stats
  - [ ] Recent orders
  - [ ] Recommendations
- [ ] Shopping Cart (`/:tenantSlug/shop/cart`)
  - [ ] Add/remove items
  - [ ] Quantity updates
  - [ ] Price calculations
- [ ] Checkout (`/:tenantSlug/shop/checkout`)
  - [ ] Address selection
  - [ ] Payment method
  - [ ] Order review
  - [ ] Age verification
  - [ ] Order confirmation

### Order Management
- [ ] Orders List (`/:tenantSlug/shop/orders`)
  - [ ] Order history
  - [ ] Status filters
  - [ ] Search
- [ ] Order Tracking (`/:tenantSlug/shop/orders/:orderId`)
  - [ ] Real-time status
  - [ ] Delivery tracking
  - [ ] Estimated delivery time

### Retail Shopping
- [ ] Business Finder (`/:tenantSlug/shop/retail/businesses`)
  - [ ] Location search
  - [ ] Map view
  - [ ] Business listings
- [ ] Business Menu (`/:tenantSlug/shop/retail/businesses/:businessSlug/menu`)
  - [ ] Product browsing
  - [ ] Add to cart
  - [ ] Menu navigation

### Wholesale Marketplace
- [ ] Wholesale Marketplace (`/:tenantSlug/shop/wholesale`)
  - [ ] Product listings
  - [ ] Search & filters
  - [ ] Seller profiles
- [ ] Wholesale Cart (`/:tenantSlug/shop/wholesale/cart`)
- [ ] Wholesale Checkout (`/:tenantSlug/shop/wholesale/checkout`)
- [ ] Wholesale Orders (`/:tenantSlug/shop/wholesale/orders`)
- [ ] Wholesale Order Detail (`/:tenantSlug/shop/wholesale/orders/:orderId`)

### Settings
- [ ] Settings (`/:tenantSlug/shop/settings`)
  - [ ] Profile management
  - [ ] Address book
  - [ ] Payment methods
  - [ ] Notification preferences

### Secure Menu Access
- [ ] Secure Menu Access (`/m/:token`)
  - [ ] Access code entry
  - [ ] Device validation
  - [ ] Security checks
- [ ] Secure Menu View (`/m/:token/view`)
  - [ ] Product display
  - [ ] Add to cart
  - [ ] Order placement

---

## 7. Courier Portal

### Authentication
- [ ] Login (`/courier/login`)
- [ ] Session management

### Dashboard & Delivery
- [ ] Dashboard (`/courier/dashboard`)
  - [ ] Active deliveries
  - [ ] Earnings summary
  - [ ] Performance metrics
- [ ] Active Delivery (`/courier/delivery/:id`)
  - [ ] Order details
  - [ ] Customer information
  - [ ] Navigation/GPS
  - [ ] Status updates
  - [ ] Photo proof upload
- [ ] Active Order (`/courier/order/:orderId`)

### Earnings & History
- [ ] Earnings (`/courier/earnings`)
  - [ ] Earnings breakdown
  - [ ] Payment history
  - [ ] Tax information
- [ ] History (`/courier/history`)
  - [ ] Past deliveries
  - [ ] Performance stats
  - [ ] Ratings & reviews

### Settings
- [ ] Settings (`/courier/settings`)
  - [ ] Profile management
  - [ ] Vehicle information
  - [ ] Notification preferences
  - [ ] Availability settings

### GPS & Location
- [ ] GPS location updates
  - [ ] Real-time tracking
  - [ ] Location sharing
  - [ ] Route optimization

---

## 8. Big Plug CRM (Wholesale)

### Executive Dashboard
- [ ] Executive Dashboard (`/:tenantSlug/admin/dashboard`)
  - [ ] Real-time metrics
  - [ ] Revenue tracking
  - [ ] Client alerts
  - [ ] Inventory status

### Client Management
- [ ] Client Management (`/:tenantSlug/admin/big-plug-clients`)
  - [ ] Client database
  - [ ] Credit management
  - [ ] Payment terms
  - [ ] Communication history

### Inventory
- [ ] Multi-Warehouse Inventory (`/:tenantSlug/admin/inventory-dashboard`)
  - [ ] Stock levels
  - [ ] Location tracking
  - [ ] Alerts

### Financial Center
- [ ] Financial Center (`/:tenantSlug/admin/financial-center`)
  - [ ] Cash flow
  - [ ] P&L reports
  - [ ] Credit tracking
  - [ ] Payment processing

### Order Workflow
- [ ] Wholesale Order Workflow (`/:tenantSlug/admin/wholesale-orders`)
  - [ ] Order creation
  - [ ] Credit checks
  - [ ] Approval process
  - [ ] Fulfillment tracking

### Credit Management
- [ ] Credit limit enforcement
- [ ] Payment terms
- [ ] Outstanding balance tracking
- [ ] Credit history

### Disposable Menu System
- [ ] Menu creation & encryption
- [ ] Client whitelisting
- [ ] Access management

---

## 9. Disposable Menu System

### Menu Creation
- [ ] Create Menu (`/:tenantSlug/admin/disposable-menus`)
  - [ ] Product selection
  - [ ] Pricing setup
  - [ ] Encryption configuration
  - [ ] Access code generation

### Security Features
- [ ] Encryption (`create-encrypted-menu` edge function)
- [ ] Access code validation
- [ ] Device fingerprinting
- [ ] Screenshot protection
- [ ] Geofencing
- [ ] Time-based access

### Customer Whitelisting
- [ ] Add customers to whitelist
- [ ] Remove access
- [ ] Bulk operations

### Menu Operations
- [ ] Burn menu (`menu-burn` edge function)
- [ ] Regenerate menu
- [ ] Access tracking (`track-access` edge function)
- [ ] Menu validation (`menu-access-validate` edge function)

### Analytics
- [ ] Menu Analytics (`/:tenantSlug/admin/menu-analytics`)
  - [ ] Access statistics
  - [ ] Security events
  - [ ] Customer engagement
- [ ] Disposable Menu Analytics (`/:tenantSlug/admin/disposable-menu-analytics`)

### Order Placement
- [ ] Menu order placement (`menu-order-place` edge function)
- [ ] Order notifications

---

## 10. Security & Compliance

### Age Verification
- [ ] Jumio integration (`verify-age-jumio` edge function)
- [ ] Age verification flow
- [ ] Document validation
- [ ] Compliance logging

### Fraud Detection
- [ ] Fraud detection (`detect-fraud` edge function)
- [ ] Order fraud checks (`check-order-fraud` edge function)
- [ ] Risk assessment (`assess-risk` edge function)
- [ ] Fraud flags in database

### Device Fingerprinting
- [ ] Device tracking
- [ ] Browser fingerprinting
- [ ] Device validation
- [ ] Suspicious device alerts

### Audit Logging
- [ ] Security event logging (`log-security-event` edge function)
- [ ] Audit trail (`/:tenantSlug/admin/audit-trail`)
- [ ] Activity logs (`/:tenantSlug/admin/activity-logs`)
- [ ] Super admin audit logs (`/super-admin/audit-logs`)

### GDPR Compliance
- [ ] GDPR export (`gdpr-export` edge function)
- [ ] GDPR erase (`gdpr-erase` edge function)
- [ ] GDPR portability (`gdpr-portability` edge function)
- [ ] Customer data export (`export-customer-data` edge function)
- [ ] Account deletion (`delete-customer-account` edge function)

### Data Encryption
- [ ] Data encryption at rest
- [ ] Encryption for sensitive fields
- [ ] Encryption verification (`verify-encryption` script)
- [ ] Weekly encryption reports (`weekly-encryption-report` edge function)

### RLS Enforcement
- [ ] Row Level Security on all tables
- [ ] Tenant isolation
- [ ] User role checks
- [ ] Policy testing

### Rate Limiting
- [ ] API rate limiting (`rateLimiting` shared module)
- [ ] Request throttling
- [ ] DDoS protection

### Security Event Logging
- [ ] Security event tracking
- [ ] Alert system
- [ ] Incident response

---

## 11. Edge Functions (100+ Functions)

### Authentication Functions
- [ ] `super-admin-auth` - Super admin authentication
- [ ] `tenant-admin-auth` - Tenant admin authentication
- [ ] `customer-auth` - Customer authentication
- [ ] `create-super-admin` - Create super admin user
- [ ] `create-admin-user` - Create tenant admin
- [ ] `create-user-profile` - Create user profile
- [ ] `request-password-reset` - Password reset request
- [ ] `reset-password` - Password reset
- [ ] `verify-email-code` - Email verification
- [ ] `send-verification-email` - Send verification email
- [ ] `validate-email` - Email validation
- [ ] `validate-phone` - Phone validation
- [ ] `send-otp` - OTP generation & sending

### Order Processing
- [ ] `create-order` - Create retail order
- [ ] `wholesale-order-create` - Create wholesale order
- [ ] `create-marketplace-order` - Create marketplace order
- [ ] `update-order-status` - Update order status
- [ ] `notify-order-placed` - Order notification
- [ ] `process-return` - Process returns

### Payment Processing
- [ ] `process-payment` - Process payment
- [ ] `wholesale-payment-process` - Wholesale payment
- [ ] `stripe-webhook` - Stripe webhook handler
- [ ] `stripe-customer-portal` - Stripe portal
- [ ] `billing` - Billing operations
- [ ] `update-subscription` - Subscription updates

### Notification Functions
- [ ] `send-notification` - General notifications
- [ ] `send-sms` - SMS sending
- [ ] `send-push-notification` - Push notifications
- [ ] `send-klaviyo-email` - Klaviyo email
- [ ] `send-klaviyo-sms` - Klaviyo SMS
- [ ] `send-marketing-campaign` - Marketing campaigns
- [ ] `send-invitation-email` - Invitation emails
- [ ] `send-menu-access-link` - Menu access links
- [ ] `send-trial-expiration-notice` - Trial expiration
- [ ] `send-trial-expired-notice` - Trial expired
- [ ] `notify-recall` - Recall notifications

### Menu Operations
- [ ] `create-encrypted-menu` - Create encrypted menu
- [ ] `access-encrypted-menu` - Access encrypted menu
- [ ] `menu-generate` - Generate menu
- [ ] `menu-burn` - Burn menu
- [ ] `menu-access-validate` - Validate menu access
- [ ] `menu-whitelist-manage` - Manage whitelist
- [ ] `sync-product-to-menu` - Sync products to menu

### Inventory Operations
- [ ] `generate-product-barcode` - Generate barcodes
- [ ] `generate-product-images` - Generate product images
- [ ] `process-product-image` - Process product images
- [ ] `create-purchase-order` - Create PO
- [ ] `receive-purchase-order` - Receive PO
- [ ] `update-all-products` - Bulk product update

### Analytics & Reporting
- [ ] `generate-report` - Generate reports
- [ ] `generate-custom-report` - Custom reports
- [ ] `send-scheduled-report` - Scheduled reports
- [ ] `collect-metrics` - Collect metrics
- [ ] `predict-revenue` - Revenue prediction
- [ ] `track-access` - Track access

### Delivery & Fleet
- [ ] `assign-courier` - Assign courier
- [ ] `add-courier` - Add courier
- [ ] `calculate-eta` - Calculate ETA
- [ ] `optimize-route` - Route optimization
- [ ] `runner-location-update` - Update runner location
- [ ] `realtime-tracking` - Real-time tracking
- [ ] `process-delivery-notifications` - Delivery notifications
- [ ] `wholesale-delivery-assign` - Assign wholesale delivery
- [ ] `wholesale-delivery-update` - Update wholesale delivery
- [ ] `check-geofence` - Geofence checking

### Compliance Functions
- [ ] `compliance-report` - Compliance reports
- [ ] `verify-age-jumio` - Age verification
- [ ] `gdpr-export` - GDPR export
- [ ] `gdpr-erase` - GDPR erase
- [ ] `gdpr-portability` - GDPR portability

### Admin Operations
- [ ] `admin-actions` - Admin actions
- [ ] `admin-api-operations` - Admin API operations
- [ ] `admin-dashboard` - Admin dashboard data
- [ ] `admin-database-backup` - Database backup
- [ ] `admin-database-maintenance` - Database maintenance
- [ ] `impersonate-tenant` - Tenant impersonation
- [ ] `get-active-sessions` - Get active sessions
- [ ] `revoke-all-sessions` - Revoke sessions

### System Functions
- [ ] `check-usage-limits` - Check usage limits
- [ ] `enforce-tenant-limits` - Enforce limits
- [ ] `check-expired-trials` - Check expired trials
- [ ] `validate-tenant` - Validate tenant
- [ ] `check-sendgrid-config` - SendGrid config check
- [ ] `check-stripe-config` - Stripe config check
- [ ] `check-twilio-config` - Twilio config check
- [ ] `uptime-checker` - Uptime checking

### Marketing & Automation
- [ ] `execute-marketing-workflow` - Execute workflows
- [ ] `workflow-executor` - Workflow execution
- [ ] `redeem-loyalty-reward` - Loyalty redemption

### Additional Functions
- [ ] `courier-app` - Courier app API
- [ ] `customer-chat` - Customer chat
- [ ] `encrypted-operations` - Encrypted operations
- [ ] `encrypt-all-data` - Encrypt all data
- [ ] `forum-approvals` - Forum approvals
- [ ] `invoice-management` - Invoice management
- [ ] `leafly-suggestions` - Leafly suggestions
- [ ] `panic-reset` - Panic reset
- [ ] `staff-management` - Staff management
- [ ] `tenant-invite` - Tenant invitation
- [ ] `tenant-signup` - Tenant signup
- [ ] `create-marketplace-profile` - Create marketplace profile

---

## 12. Subscription & Billing

### Plan Management
- [ ] Plan selection (Starter/Professional/Enterprise)
- [ ] Plan upgrade flow
- [ ] Plan downgrade flow
- [ ] Plan comparison display

### Usage Tracking
- [ ] Customer count tracking
- [ ] Menu count tracking
- [ ] Product count tracking
- [ ] Team member count tracking
- [ ] Storage usage tracking
- [ ] API call tracking
- [ ] Usage meters in billing dashboard

### Limit Enforcement
- [ ] Limit checking (`check-usage-limits` edge function)
- [ ] Limit enforcement (`enforce-tenant-limits` edge function)
- [ ] Upgrade prompts when limits reached
- [ ] Feature blocking at limits

### Stripe Integration
- [ ] Stripe customer creation
- [ ] Payment method management
- [ ] Subscription creation
- [ ] Subscription updates
- [ ] Invoice generation
- [ ] Payment processing
- [ ] Webhook handling (`stripe-webhook`)
- [ ] Customer portal (`stripe-customer-portal`)

### Invoice Management
- [ ] Invoice generation
- [ ] Invoice history
- [ ] Invoice download (PDF)
- [ ] Payment tracking
- [ ] Advanced invoice (`/:tenantSlug/admin/advanced-invoice`)

### Trial Management
- [ ] Trial period tracking
- [ ] Trial expiration checks (`check-expired-trials`)
- [ ] Trial expiration notices (`send-trial-expiration-notice`, `send-trial-expired-notice`)
- [ ] Trial expired page (`/:tenantSlug/admin/trial-expired`)

### Billing Dashboard
- [ ] Billing dashboard (`/:tenantSlug/admin/billing`)
  - [ ] Current plan display
  - [ ] Usage meters
  - [ ] Payment methods
  - [ ] Invoice history
  - [ ] Upgrade/downgrade options

---

## 13. Performance & Infrastructure

### PWA Functionality
- [ ] Service worker registration
- [ ] Offline support
- [ ] Install prompt
- [ ] App manifest
- [ ] Caching strategies
- [ ] Background sync

### Code Optimization
- [ ] Code splitting (React.lazy)
- [ ] Route-based code splitting
- [ ] Bundle size optimization
- [ ] Tree shaking
- [ ] Minification

### Image Optimization
- [ ] Image compression
- [ ] Lazy loading
- [ ] Responsive images
- [ ] CDN delivery
- [ ] Format optimization (WebP)

### Caching Strategies
- [ ] Browser caching
- [ ] API response caching
- [ ] TanStack Query caching (staleTime: 60s)
- [ ] Static asset caching
- [ ] CDN caching

### Database Optimization
- [ ] Query optimization
- [ ] Index optimization
- [ ] Connection pooling
- [ ] Query result caching
- [ ] Real-time subscription optimization

### Real-time Features
- [ ] Supabase Realtime subscriptions
- [ ] Live order updates
- [ ] Real-time inventory
- [ ] Live courier tracking
- [ ] Real-time notifications

### Error Handling
- [ ] Global error boundary
- [ ] Error logging (`logger` utility)
- [ ] User-friendly error messages
- [ ] Error recovery
- [ ] Sentry integration (if enabled)

### Loading States
- [ ] Loading skeletons
- [ ] Progress indicators
- [ ] Suspense fallbacks
- [ ] NProgress integration
- [ ] Optimistic updates

### Performance Monitoring
- [ ] Performance metrics
- [ ] Core Web Vitals
- [ ] Load time tracking
- [ ] API response time tracking

---

## 14. Testing & Quality

### Unit Tests
- [ ] Utility function tests
- [ ] Hook tests
- [ ] Component tests
- [ ] Test coverage > 80%

### Integration Tests
- [ ] API integration tests
- [ ] Database integration tests
- [ ] Authentication flow tests
- [ ] Order flow tests

### E2E Critical Paths
- [ ] User signup flow
- [ ] Tenant admin login → dashboard
- [ ] Product creation → order placement
- [ ] Wholesale order workflow
- [ ] Payment processing
- [ ] Delivery assignment → completion

### Browser Compatibility
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

### Mobile Responsiveness
- [ ] Mobile layout (< 768px)
- [ ] Tablet layout (768px - 1024px)
- [ ] Desktop layout (> 1024px)
- [ ] Touch interactions
- [ ] Mobile navigation
- [ ] PWA mobile experience

### Accessibility (WCAG)
- [ ] Keyboard navigation
- [ ] Screen reader compatibility
- [ ] ARIA labels
- [ ] Color contrast
- [ ] Focus indicators
- [ ] Skip to content links

### Performance Benchmarks
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3.5s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Cumulative Layout Shift < 0.1
- [ ] Bundle size < 500KB (gzipped)

### Security Audit
- [ ] Dependency vulnerability scan
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Authentication security
- [ ] Data encryption verification

---

## 15. Documentation

### API Documentation
- [ ] API endpoint documentation
- [ ] Authentication documentation
- [ ] Request/response examples
- [ ] Error code reference
- [ ] Rate limiting documentation

### User Guides
- [ ] Getting started guide
- [ ] Feature tutorials
- [ ] Video tutorials (if available)
- [ ] FAQ updates

### Admin Documentation
- [ ] Admin panel guide
- [ ] Feature configuration
- [ ] Best practices
- [ ] Troubleshooting

### Deployment Guides
- [ ] Production deployment
- [ ] Environment setup
- [ ] Database migration guide
- [ ] Edge function deployment

### Troubleshooting Guides
- [ ] Common issues
- [ ] Error resolution
- [ ] Support contact information

---

## Quick Reference: All Routes

### Marketing & Public
- `/` - Smart root redirect
- `/marketing` - Marketing homepage
- `/features` - Features page
- `/pricing` - Pricing page
- `/about` - About page
- `/contact` - Contact page
- `/demo` - Demo request
- `/demo/confirm` - Demo confirmation
- `/signup` - Sign up (4-step)
- `/saas/login` - SaaS login
- `/verify-email` - Email verification
- `/login` - Login directory
- `/marketplace` - Public marketplace
- `/marketplace/listings/:listingId` - Listing detail
- `/m/:token` - Secure menu access
- `/m/:token/view` - Secure menu view
- `/menu/:token` - Menu access
- `/invite/:token` - Invitation acceptance

### Super Admin
- `/super-admin/login` - Login
- `/super-admin/reset/:token` - Password reset
- `/super-admin/dashboard` - Dashboard
- `/super-admin/tenants` - Tenants list
- `/super-admin/tenants/new` - Create tenant
- `/super-admin/tenants/:tenantId` - Tenant detail
- `/super-admin/monitoring` - Monitoring
- `/super-admin/analytics` - Analytics
- `/super-admin/revenue-analytics` - Revenue analytics
- `/super-admin/executive-dashboard` - Executive dashboard
- `/super-admin/data-explorer` - Data explorer
- `/super-admin/api-usage` - API usage
- `/super-admin/audit-logs` - Audit logs
- `/super-admin/report-builder` - Report builder
- `/super-admin/workflows` - Workflows
- `/super-admin/communication` - Communication
- `/super-admin/feature-flags` - Feature flags
- `/super-admin/system-config` - System config
- `/super-admin/security` - Security
- `/super-admin/forum-approvals` - Forum approvals
- `/super-admin/admin-users` - Admin users
- `/super-admin/tools` - Tools
- `/super-admin/marketplace/moderation` - Marketplace moderation
- `/super-admin/settings` - Settings

### Tenant Admin (100+ routes)
Base path: `/:tenantSlug/admin/*`

**Core:**
- `/:tenantSlug/admin/login` - Login
- `/:tenantSlug/admin/reset/:token` - Password reset
- `/:tenantSlug/admin/welcome` - Welcome page
- `/:tenantSlug/admin/trial-expired` - Trial expired
- `/:tenantSlug/admin/help` - Help
- `/:tenantSlug/admin/dashboard` - Dashboard
- `/:tenantSlug/admin/settings` - Settings
- `/:tenantSlug/admin/billing` - Billing

**Products & Inventory:**
- `/:tenantSlug/admin/inventory/products` - Products
- `/:tenantSlug/admin/inventory-dashboard` - Inventory dashboard
- `/:tenantSlug/admin/inventory-monitoring` - Inventory monitoring
- `/:tenantSlug/admin/advanced-inventory` - Advanced inventory
- `/:tenantSlug/admin/fronted-inventory` - Fronted inventory
- `/:tenantSlug/admin/dispatch-inventory` - Dispatch inventory
- `/:tenantSlug/admin/stock-alerts` - Stock alerts
- `/:tenantSlug/admin/inventory-transfers` - Inventory transfers
- `/:tenantSlug/admin/generate-barcodes` - Generate barcodes
- `/:tenantSlug/admin/catalog/images` - Images
- `/:tenantSlug/admin/catalog/batches` - Batches
- `/:tenantSlug/admin/catalog/categories` - Categories
- `/:tenantSlug/admin/operations/receiving` - Receiving

**Orders:**
- `/:tenantSlug/admin/disposable-menu-orders` - Disposable menu orders
- `/:tenantSlug/admin/wholesale-orders` - Wholesale orders
- `/:tenantSlug/admin/live-orders` - Live orders
- `/:tenantSlug/admin/order-analytics` - Order analytics

**Menus:**
- `/:tenantSlug/admin/disposable-menus` - Disposable menus
- `/:tenantSlug/admin/menu-analytics` - Menu analytics
- `/:tenantSlug/admin/disposable-menu-analytics` - Disposable menu analytics

**Customers:**
- `/:tenantSlug/admin/big-plug-clients` - Big Plug clients
- `/:tenantSlug/admin/big-plug-clients/:id` - Client detail
- `/:tenantSlug/admin/customer-details` - Customer details
- `/:tenantSlug/admin/customer-reports` - Customer reports
- `/:tenantSlug/admin/customer-crm` - Customer CRM
- `/:tenantSlug/admin/customer-insights` - Customer insights
- `/:tenantSlug/admin/customer-analytics` - Customer analytics

**Financial:**
- `/:tenantSlug/admin/financial-center` - Financial center
- `/:tenantSlug/admin/revenue-reports` - Revenue reports
- `/:tenantSlug/admin/commission-tracking` - Commission tracking
- `/:tenantSlug/admin/advanced-invoice` - Advanced invoice
- `/:tenantSlug/admin/invoice-management` - Invoice management

**Fleet & Delivery:**
- `/:tenantSlug/admin/fleet-management` - Fleet management
- `/:tenantSlug/admin/delivery-management` - Delivery management
- `/:tenantSlug/admin/delivery-tracking` - Delivery tracking
- `/:tenantSlug/admin/delivery-analytics` - Delivery analytics
- `/:tenantSlug/admin/gps-tracking` - GPS tracking
- `/:tenantSlug/admin/live-map` - Live map
- `/:tenantSlug/admin/route-optimizer` - Route optimizer
- `/:tenantSlug/admin/couriers` - Couriers

**POS:**
- `/:tenantSlug/admin/pos-system` - POS system
- `/:tenantSlug/admin/cash-register` - Cash register
- `/:tenantSlug/admin/pos-analytics` - POS analytics
- `/:tenantSlug/admin/pos-shifts` - POS shifts
- `/:tenantSlug/admin/z-reports` - Z-reports

**Locations:**
- `/:tenantSlug/admin/locations` - Locations
- `/:tenantSlug/admin/locations/warehouses` - Warehouses
- `/:tenantSlug/admin/locations/runners` - Runners
- `/:tenantSlug/admin/location-analytics` - Location analytics

**Team:**
- `/:tenantSlug/admin/team-members` - Team members
- `/:tenantSlug/admin/staff-management` - Staff management
- `/:tenantSlug/admin/role-management` - Role management
- `/:tenantSlug/admin/permissions` - Permissions
- `/:tenantSlug/admin/user-management` - User management
- `/:tenantSlug/admin/activity-logs` - Activity logs

**Analytics & Reports:**
- `/:tenantSlug/admin/reports` - Reports
- `/:tenantSlug/admin/advanced-reporting` - Advanced reporting
- `/:tenantSlug/admin/custom-reports` - Custom reports
- `/:tenantSlug/admin/sales-dashboard` - Sales dashboard
- `/:tenantSlug/admin/advanced-analytics` - Advanced analytics
- `/:tenantSlug/admin/realtime-dashboard` - Realtime dashboard
- `/:tenantSlug/admin/predictive-analytics` - Predictive analytics
- `/:tenantSlug/admin/analytics-dashboard` - Analytics dashboard

**Marketplace:**
- `/:tenantSlug/admin/marketplace/profile` - Seller profile
- `/:tenantSlug/admin/marketplace/listings` - Listings
- `/:tenantSlug/admin/marketplace/listings/new` - New listing
- `/:tenantSlug/admin/marketplace/listings/:listingId` - Listing detail
- `/:tenantSlug/admin/marketplace/listings/:listingId/edit` - Edit listing
- `/:tenantSlug/admin/marketplace/orders` - Marketplace orders
- `/:tenantSlug/admin/marketplace/orders/:orderId` - Order detail
- `/:tenantSlug/admin/marketplace/messages` - Messages

**Operations:**
- `/:tenantSlug/admin/suppliers` - Suppliers
- `/:tenantSlug/admin/purchase-orders` - Purchase orders
- `/:tenantSlug/admin/returns` - Returns
- `/:tenantSlug/admin/quality-control` - Quality control
- `/:tenantSlug/admin/batch-recall` - Batch recall
- `/:tenantSlug/admin/compliance-vault` - Compliance vault
- `/:tenantSlug/admin/compliance` - Compliance

**Marketing & Sales:**
- `/:tenantSlug/admin/marketing-automation` - Marketing automation
- `/:tenantSlug/admin/loyalty-program` - Loyalty program
- `/:tenantSlug/admin/coupons` - Coupons
- `/:tenantSlug/admin/appointments` - Appointments
- `/:tenantSlug/admin/support-tickets` - Support tickets

**Integrations:**
- `/:tenantSlug/admin/api-access` - API access
- `/:tenantSlug/admin/webhooks` - Webhooks
- `/:tenantSlug/admin/custom-integrations` - Custom integrations
- `/:tenantSlug/admin/workflow-automation` - Workflow automation
- `/:tenantSlug/admin/local-ai` - Local AI

**Enterprise:**
- `/:tenantSlug/admin/white-label` - White label
- `/:tenantSlug/admin/custom-domain` - Custom domain
- `/:tenantSlug/admin/priority-support` - Priority support
- `/:tenantSlug/admin/data-export` - Data export
- `/:tenantSlug/admin/audit-trail` - Audit trail
- `/:tenantSlug/admin/bulk-operations` - Bulk operations
- `/:tenantSlug/admin/global-search` - Global search
- `/:tenantSlug/admin/system-settings` - System settings
- `/:tenantSlug/admin/vendor-management` - Vendor management
- `/:tenantSlug/admin/risk-management` - Risk management
- `/:tenantSlug/admin/developer-tools` - Developer tools

**Additional:**
- `/:tenantSlug/admin/live-chat` - Live chat
- `/:tenantSlug/admin/notifications` - Notifications
- `/:tenantSlug/admin/sales/pricing` - Sales pricing
- `/:tenantSlug/admin/fronted-inventory-analytics` - Fronted inventory analytics

### Customer Portal
Base path: `/:tenantSlug/shop/*` or `/:tenantSlug/customer/*`

- `/:tenantSlug/customer/login` - Login
- `/:tenantSlug/customer/signup` - Sign up
- `/:tenantSlug/customer/verify-email` - Verify email
- `/:tenantSlug/customer/forgot-password` - Forgot password
- `/:tenantSlug/customer/reset-password` - Reset password
- `/:tenantSlug/shop/login` - Shop login
- `/:tenantSlug/shop/reset/:token` - Password reset
- `/:tenantSlug/shop` - Portal (redirects to dashboard)
- `/:tenantSlug/shop/dashboard` - Dashboard
- `/:tenantSlug/shop/cart` - Shopping cart
- `/:tenantSlug/shop/checkout` - Checkout
- `/:tenantSlug/shop/orders` - Orders list
- `/:tenantSlug/shop/orders/:orderId` - Order tracking
- `/:tenantSlug/shop/orders/retail/:orderId` - Retail order tracking
- `/:tenantSlug/shop/settings` - Settings
- `/:tenantSlug/shop/retail/businesses` - Business finder
- `/:tenantSlug/shop/retail/businesses/:businessSlug/menu` - Business menu
- `/:tenantSlug/shop/wholesale` - Wholesale marketplace
- `/:tenantSlug/shop/wholesale/cart` - Wholesale cart
- `/:tenantSlug/shop/wholesale/checkout` - Wholesale checkout
- `/:tenantSlug/shop/wholesale/orders` - Wholesale orders
- `/:tenantSlug/shop/wholesale/orders/:orderId` - Wholesale order detail

### Courier Portal
- `/courier/login` - Login
- `/courier/dashboard` - Dashboard
- `/courier/earnings` - Earnings
- `/courier/history` - History
- `/courier/settings` - Settings
- `/courier/order/:orderId` - Active order
- `/courier/delivery/:id` - Active delivery

### Vendor Portal
- `/vendor/login` - Login
- `/vendor/dashboard` - Dashboard

### Community Forum
- `/community/auth` - Community auth
- `/community` - Forum home
- `/community/c/:categorySlug` - Category
- `/community/post/:postId` - Post detail
- `/community/create` - Create post
- `/community/u/:username` - User profile
- `/community/search` - Search
- `/community/approval` - Approval

---

## Feature Tier Mapping

### Starter Tier ($99/mo) - 28 Features
- dashboard
- products
- disposable-menus
- customers
- basic-orders
- settings
- billing
- suppliers
- purchase-orders
- returns
- loyalty-program
- coupons
- help
- generate-barcodes
- wholesale-orders
- reports
- inventory-dashboard
- catalog (images, batches, categories)

### Professional Tier ($299/mo) - 31 Features Total
Includes all Starter features plus:
- menu-analytics
- disposable-menu-analytics
- live-orders
- order-analytics
- customer-analytics
- sales-dashboard
- marketplace
- commission-tracking
- team-members
- role-management
- activity-logs
- advanced-inventory
- stock-alerts
- inventory-transfers
- fronted-inventory
- operations
- revenue-reports
- invoice-management
- customer-insights
- quality-control
- customer-crm
- marketing-automation
- appointments
- support-tickets
- batch-recall
- compliance-vault
- advanced-reporting
- vendor-portal
- predictive-analytics

### Enterprise Tier ($799/mo) - 56 Features Total
Includes all Professional features plus:
- fleet-management
- delivery-management
- delivery-tracking
- delivery-analytics
- route-optimization
- live-map
- couriers
- pos-system
- cash-register
- pos-analytics
- pos-shifts
- z-reports
- locations
- api-access
- webhooks
- custom-integrations
- workflow-automation
- ai
- global-search
- bulk-operations
- data-export
- audit-trail
- compliance
- white-label
- custom-domain
- priority-support
- risk-management
- system-settings
- vendor-management
- analytics-dashboard
- developer-tools

---

## Critical Path Testing Scenarios

### Scenario 1: New Tenant Signup Flow
1. [ ] Visit `/marketing`
2. [ ] Click "Sign Up"
3. [ ] Complete 4-step signup form
4. [ ] Verify email with 6-digit code
5. [ ] Complete onboarding wizard
6. [ ] Access dashboard
7. [ ] Verify trial period active
8. [ ] Check usage limits displayed

### Scenario 2: Product → Order → Delivery
1. [ ] Tenant admin logs in
2. [ ] Create product (`/admin/inventory/products`)
3. [ ] Generate barcode (`/admin/generate-barcodes`)
4. [ ] Create disposable menu (`/admin/disposable-menus`)
5. [ ] Customer accesses menu (`/m/:token`)
6. [ ] Customer adds items to cart
7. [ ] Customer completes checkout
8. [ ] Order appears in live orders (`/admin/live-orders`)
9. [ ] Assign courier to delivery
10. [ ] Courier accepts delivery
11. [ ] Courier updates location (GPS)
12. [ ] Customer tracks order
13. [ ] Courier marks delivered
14. [ ] Order status updates to completed

### Scenario 3: Wholesale Order Workflow
1. [ ] Tenant admin creates wholesale client (`/admin/big-plug-clients`)
2. [ ] Set credit limit and payment terms
3. [ ] Client accesses wholesale marketplace (`/shop/wholesale`)
4. [ ] Client adds products to wholesale cart
5. [ ] Client submits wholesale order
6. [ ] Credit check runs automatically
7. [ ] Order requires approval (if credit limit exceeded)
8. [ ] Tenant admin approves order
9. [ ] Order fulfillment begins
10. [ ] Invoice generated
11. [ ] Payment processed
12. [ ] Order marked as paid

### Scenario 4: Subscription Upgrade Flow
1. [ ] Starter tier tenant logs in
2. [ ] Navigate to billing (`/admin/billing`)
3. [ ] View usage meters (approaching limits)
4. [ ] Click "Upgrade" button
5. [ ] Select Professional tier
6. [ ] Complete Stripe checkout
7. [ ] Subscription updates
8. [ ] New features unlock automatically
9. [ ] Usage limits increase
10. [ ] Invoice generated

### Scenario 5: Multi-User Team Management
1. [ ] Tenant admin adds team member (`/admin/team-members`)
2. [ ] Assign role with permissions
3. [ ] Team member receives invitation email
4. [ ] Team member accepts invitation
5. [ ] Team member logs in
6. [ ] Verify role-based access (can only access permitted features)
7. [ ] Activity logged in activity logs
8. [ ] Tenant admin can revoke access

---

## Known Issues & Limitations

### Current Limitations
- [ ] Document any known bugs
- [ ] Document feature gaps
- [ ] Document performance issues
- [ ] Document browser compatibility issues
- [ ] Document mobile-specific issues

### Workarounds
- [ ] Document temporary workarounds
- [ ] Document manual processes
- [ ] Document configuration requirements

---

## Launch Readiness Checklist

### Pre-Launch Requirements
- [ ] All critical paths tested
- [ ] Security audit completed
- [ ] Performance benchmarks met
- [ ] Browser compatibility verified
- [ ] Mobile responsiveness verified
- [ ] Documentation complete
- [ ] Error handling tested
- [ ] Backup & recovery tested
- [ ] Monitoring & alerting configured
- [ ] Support system ready

### Launch Day Checklist
- [ ] Database backups verified
- [ ] Environment variables set
- [ ] CDN configured
- [ ] Monitoring active
- [ ] Support team ready
- [ ] Communication plan ready
- [ ] Rollback plan ready

---

## Notes

Use this section to track:
- Testing progress
- Issues found during testing
- Feature completion status
- Performance metrics
- User feedback
- Launch blockers

---

**Last Updated**: [Date]  
**Next Review**: [Date]  
**Status**: Pre-Launch Verification

