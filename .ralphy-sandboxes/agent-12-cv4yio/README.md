# 🚀 FloraIQ - Smart Cannabis Operations Platform

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/buttermb/delviery?utm_source=oss&utm_medium=github&utm_campaign=buttermb%2Fdelviery&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

## Project Overview

A comprehensive full-stack progressive web application combining premium delivery services, wholesale CRM, multi-tenant SAAS platform, and advanced inventory management.

**Status:** ✅ **100% Complete - Production Ready**

---

## 🌟 Key Features

### **1. Multi-Tenant SAAS Platform**
- Complete tenant registration and onboarding
- Subscription management with Stripe integration
- Usage tracking and limit enforcement
- White-label branding system
- Super Admin control panel
- Automated tenant management

### **2. Wholesale CRM (Big Plug)**
- Executive dashboard with real-time metrics
- B2B client relationship management
- Multi-warehouse inventory tracking
- Financial command center
- Order workflow with credit management
- Runner portal for mobile deliveries
- Fleet management with GPS tracking

### **3. Disposable Encrypted Menu System**
- OPSEC-compliant menu creation
- Encrypted URLs with access codes
- Customer whitelisting and secure invitations
- Burn & regenerate functionality
- Device fingerprinting and screenshot protection
- Comprehensive security analytics

### **4. Advanced Inventory Management**
- Batch tracking with chain of custody
- Barcode/QR code generation
- Label printing (product, package, batch, transfer)
- Mobile scanner component
- Real-time inventory updates
- Multi-location tracking

### **5. Modern Admin Panel**
- Workflow-based navigation
- Role-based access control
- Command palette (⌘K)
- Widget-based dashboard
- Comprehensive analytics
- Export functionality

### **6. Delivery & Order Management**
- Real-time order tracking
- Live courier location tracking
- Progressive Web App (PWA) with offline support
- Push notifications
- Age verification system
- Fraud detection

---

## Technology Stack

### **Frontend**
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite 5.0
- **Styling:** Tailwind CSS + shadcn/ui components
- **State Management:** TanStack Query (React Query)
- **Routing:** React Router v6
- **Forms:** React Hook Form + Zod validation

### **Backend**
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth with JWT
- **Storage:** Supabase Storage
- **Edge Functions:** Deno runtime
- **Real-time:** Supabase Realtime subscriptions

### **Additional Services**
- **Maps:** Mapbox GL JS
- **PWA:** Service Worker with Workbox
- **Payment:** Stripe (for SAAS subscriptions)
- **SMS:** Twilio integration
- **Barcodes:** jsbarcode, qrcode.react

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account (for backend services)
- Mapbox API token (optional, for maps)
- Stripe account (for SAAS billing, optional)
- Twilio account (for SMS, optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/buttermb/delviery.git
cd delviery-main

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your API keys to .env:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
# - VITE_MAPBOX_TOKEN (optional)
# - STRIPE_SECRET_KEY (optional)
# - TWILIO_ACCOUNT_SID (optional)

# Start development server
npm run dev
```

### Build for Production

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📚 Project Structure

```
src/
├── pages/
│   ├── saas/              # Multi-tenant SAAS platform
│   │   ├── SignUpPage.tsx
│   │   ├── OnboardingWizard.tsx
│   │   ├── BillingDashboard.tsx
│   │   ├── SuperAdminEnhanced.tsx
│   │   └── ...
│   ├── admin/              # Admin panel pages
│   │   ├── BigPlugExecutiveDashboard.tsx
│   │   ├── BigPlugClientManagement.tsx
│   │   ├── DisposableMenus.tsx
│   │   ├── InventoryDashboard.tsx
│   │   └── ...
│   ├── customer/           # Customer-facing pages
│   └── mobile/             # Mobile/runner pages
├── components/
│   ├── admin/              # Admin components
│   ├── shared/             # Shared components
│   └── whitelabel/         # White-label components
├── contexts/               # React contexts
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities and helpers
├── utils/                  # Helper functions
└── integrations/           # Third-party integrations

supabase/
├── migrations/             # Database migrations
└── functions/              # Edge Functions
```

---

## 🎯 Key Routes

### **SAAS Platform**
- `/` - Marketing landing page
- `/saas/signup` - Tenant registration
- `/saas/verify-email` - Email verification
- `/saas/onboarding` - Multi-step onboarding
- `/saas/billing` - Billing dashboard
- `/saas/whitelabel` - White-label settings
- `/saas/admin` - Super Admin Dashboard

### **Admin Panel**
- `/admin/dashboard` - Main dashboard
- `/admin/modern-dashboard` - Modern widget dashboard
- `/admin/big-plug-dashboard` - Wholesale executive dashboard
- `/admin/big-plug-clients` - Client management
- `/admin/big-plug-inventory` - Multi-warehouse inventory
- `/admin/disposable-menus` - Menu management
- `/admin/inventory` - Inventory dashboard
- `/admin/catalog/*` - Catalog management
- `/admin/operations/*` - Operations
- `/admin/sales/*` - Sales management
- `/admin/locations/*` - Location management

### **Customer & Mobile**
- `/m/:token` - Secure menu access
- `/driver` - Driver portal
- `/admin/runner-portal` - Runner portal

---

## 🔐 Security Features

- **Row Level Security (RLS):** Tenant isolation at database level
- **JWT Authentication:** Secure token-based auth
- **Device Fingerprinting:** Fraud prevention
- **Encrypted Menus:** OPSEC-compliant menu system
- **Screenshot Protection:** Advanced security monitoring
- **IP Tracking:** Access logging and geofencing
- **HTTPS-only:** Production security enforcement

---

## 📊 Database Architecture

### **Core Tables**
- `tenants` - Multi-tenant core
- `tenant_users` - Team members
- `subscription_events` - Audit trail
- `usage_events` - Billing tracking
- `feature_flags` - Feature rollout
- `support_tickets` - Support system

### **Business Tables**
- `products` - Product catalog
- `menus` - Disposable menus
- `customers` - Customer management
- `orders` - Order tracking
- `wholesale_clients` - B2B clients
- `wholesale_orders` - Wholesale orders
- `inventory_batches` - Batch tracking
- `inventory_packages` - Package management

---

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev          # Start dev server

# Build
npm run build        # Production build
npm run build:dev    # Development build

# Quality
npm run lint         # Run ESLint

# Preview
npm run preview      # Preview production build
```

### Database Migrations

```bash
# Apply migrations via Supabase CLI
supabase migration up

# Or via Supabase Dashboard
# Database > Migrations > Run pending migrations
```

### Edge Functions

```bash
# Deploy Edge Functions
supabase functions deploy enforce-tenant-limits
supabase functions deploy stripe-webhook
supabase functions deploy menu-burn
supabase functions deploy send-sms
```

---

## 📈 Deployment

The application is configured for deployment to:
- **Vercel** (recommended for frontend)
- **Supabase** (backend, database, edge functions)
- **Netlify** (alternative frontend hosting)

See `DEPLOYMENT_READY.md` for detailed deployment instructions.

---

## 📝 Documentation

Comprehensive documentation is available:

- `docs/INDEX.md` - **Start Here: Documentation Index**
- `docs/guides/GETTING_STARTED.md` - Getting Started Guide
- `docs/guides/DEPLOYMENT_GUIDE.md` - Deployment Guide
- `docs/architecture/COMPLETE_SYSTEM_OVERVIEW.md` - System Overview

---

## 🎉 Features Summary

### **Implemented Systems:**
✅ Multi-Tenant SAAS Platform  
✅ Super Admin Panel  
✅ Wholesale CRM (Big Plug)  
✅ Disposable Menu System  
✅ Advanced Inventory Management  
✅ Modern Admin Panel  
✅ Delivery & Order Management  

### **Statistics:**
- **64+** pages implemented
- **100+** React components
- **60+** routes configured
- **6+** database migrations
- **4** Edge Functions
- **30+** database tables with RLS

---

## 🤝 Contributing

This is a proprietary project. For inquiries or support, please contact the development team.

---

## 📄 License

Proprietary - All rights reserved

---

## 🔗 Links

- **Repository:** [github.com/buttermb/delviery](https://github.com/buttermb/delviery)
- **Documentation:** See `/docs` directory
- **Deployment Guide:** `DEPLOYMENT_READY.md`

---

## ✨ Status

**Last Updated:** November 3, 2024  
**Build Status:** ✅ Passing  
**Code Quality:** ✅ Verified  
**Deployment:** ✅ Ready

**🎉 All systems complete and operational!**