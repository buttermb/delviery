# FloraIQ - Smart Cannabis Operations Platform

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/buttermb/delviery?utm_source=oss&utm_medium=github&utm_campaign=buttermb%2Fdelviery&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

## Project Overview

A full-stack multi-tenant SaaS platform for cannabis distribution operations — combining wholesale CRM, storefront commerce, delivery logistics, inventory management, and encrypted menu systems in a single progressive web application.

## Key Features

### Multi-Tenant SaaS Platform
- Tenant registration, onboarding wizard, and subscription billing via Stripe
- Usage tracking with limit enforcement and feature flags
- White-label branding per tenant
- Super Admin control panel for platform-wide management

### Wholesale CRM
- Executive dashboard with real-time revenue and order metrics
- B2B client management with credit tracking
- Multi-warehouse inventory across locations
- Financial center with invoicing, partial payments, and credit notes
- Runner/courier portal for mobile deliveries with GPS tracking

### Storefront & Marketplace
- Per-tenant online storefronts with customizable themes
- Product catalog with categories, bundles, and coupons
- Customer checkout with delivery zone validation and Stripe payments
- Real-time order status via Supabase Realtime
- Customer accounts with order history and loyalty program

### Disposable Encrypted Menu System
- OPSEC-compliant menu creation with encrypted URLs and access codes
- Customer whitelisting and secure invitation links
- Burn and regenerate functionality
- Device fingerprinting and screenshot protection
- Static HTML menu page generation for sharing

### Inventory Management
- Batch tracking with chain of custody
- Barcode and QR code generation and scanning
- Label printing (product, package, batch, transfer labels)
- Real-time stock sync across storefront and admin
- Purchase order management and receiving workflows
- Quality control and returns processing

### Delivery & Fleet Operations
- Real-time courier location tracking via Mapbox
- Route optimization and ETA calculation
- Geofencing with anomaly detection
- Driver onboarding with invite emails and PIN auth
- Delivery zone management with fee configuration
- Collection mode for in-person handoffs

### Admin Panel
- Tenant-aware routing with role-based access control
- Command palette (Cmd+K) for quick navigation
- Widget-based dashboard with drag-and-drop
- Comprehensive analytics and custom report builder
- Audit trail and activity logging
- Data export (CSV, Excel, PDF)
- Team management with role permissions

## Technology Stack

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | React 18.3 + TypeScript 5.8 |
| Build | Vite 5.4 |
| Styling | Tailwind CSS 3.4 + shadcn/ui (Radix) |
| State | TanStack Query 5.83 + Zustand 5.0 |
| Routing | React Router 6.30 |
| Forms | React Hook Form 7.61 + Zod 3.25 |
| Animation | Framer Motion 12.23 |
| Maps | Mapbox GL 3.15 + React Map GL 8.1 |
| Mobile | Capacitor 7.4 (iOS + Android) |

### Backend
| Layer | Technology |
|-------|-----------|
| Database | Supabase (PostgreSQL) with RLS |
| Auth | Supabase Auth with JWT |
| Real-time | Supabase Realtime subscriptions |
| Edge Functions | 232 Deno-based edge functions |
| Storage | Supabase Storage |
| Payments | Stripe (subscriptions + checkout) |
| SMS | Twilio |
| Email | Resend + SendGrid |

### Testing
| Layer | Technology |
|-------|-----------|
| Unit/Integration | Vitest 4.0 + Testing Library |
| E2E | Playwright 1.40 |
| Test files | 1,230 |

## Codebase Statistics

| Metric | Count |
|--------|-------|
| Page files | 486 |
| Components | 1,383 |
| Custom hooks | 307 |
| Context providers | 15 |
| Routes | 382 |
| Edge functions | 232 |
| Database migrations | 531 |
| Database tables | 366 |
| Test files | 1,230 |

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase project (database + auth + edge functions)

### Installation

```bash
git clone https://github.com/buttermb/delviery.git
cd delviery

npm install

cp .env.example .env
# Required:
#   VITE_SUPABASE_URL
#   VITE_SUPABASE_ANON_KEY
# Optional:
#   VITE_MAPBOX_TOKEN
#   STRIPE_SECRET_KEY
#   TWILIO_ACCOUNT_SID
#   RESEND_API_KEY

npm run dev
```

### Build

```bash
npm run build        # Production build
npm run preview      # Preview production build
```

### Testing

```bash
npm run test              # Unit + integration (Vitest)
npm run test:coverage     # With coverage report
npm run test:e2e          # E2E (Playwright)
npm run test:e2e:ui       # E2E with UI
```

## Project Structure

```
src/
  pages/
    admin/             # 118 admin panel pages
    customer/          # Customer-facing (menu, cart, checkout)
    courier/           # Driver portal and delivery views
    marketplace/       # Marketplace storefront pages
    saas/              # Tenant signup, onboarding, billing
    super-admin/       # Platform-wide admin
    vendor/            # Vendor/supplier pages
    auth/              # Login, signup, password reset
    shop/              # Storefront shopping experience
    ...                # Marketing, docs, public pages
  components/          # 101 component directories
  hooks/               # 307 custom hooks
  contexts/            # 15 React context providers
  lib/                 # Utilities, query keys, navigation, logger
  integrations/        # Supabase client + generated types

supabase/
  migrations/          # 531 SQL migration files
  functions/           # 232 edge functions
    _shared/           # Shared deps, CORS, secure headers
```

## Key Routes

### SaaS Platform
- `/saas/signup` - Tenant registration
- `/saas/onboarding` - Multi-step onboarding wizard
- `/saas/billing` - Subscription management

### Admin Panel (tenant-scoped: `/:slug/admin/...`)
- `/dashboard` - Main dashboard
- `/orders` - Order management
- `/products` - Product catalog
- `/customers` - Customer CRM
- `/inventory` - Inventory dashboard
- `/invoices` - Invoice management
- `/delivery` - Delivery management
- `/couriers` - Fleet management
- `/menus` - Disposable menu system
- `/storefront/*` - Storefront builder and settings
- `/settings` - Tenant settings

### Storefront
- `/shop/:slug` - Public storefront
- `/m/:token` - Encrypted menu access
- `/page/:token` - Static menu page

### Courier
- `/courier` - Driver portal with deliveries, earnings, profile

## Security

- **Row Level Security (RLS)** on all tables for tenant isolation
- **JWT authentication** via Supabase Auth
- **CSRF protection** on all mutation forms
- **Zod validation** on all edge function inputs and form submissions
- **Encrypted menu URLs** with access codes and device fingerprinting
- **Tenant-scoped queries** enforced across all admin pages
- **DOMPurify sanitization** for user-generated content
- **PBKDF2 PIN hashing** for courier authentication
- **Audit logging** with partitioned tables

## Database Architecture

Core schemas include:

- **Tenants** - `tenants`, `tenant_users`, `accounts`, `account_settings`
- **Products** - `products`, `product_categories`, `inventory_batches`, `inventory_packages`
- **Orders** - `orders`, `order_items`, `marketplace_orders`, `storefront_orders` (view)
- **Customers** - `customers`, `marketplace_customers`, `customer_notes`
- **Delivery** - `couriers`, `courier_earnings`, `delivery_ratings`, `delivery_zones`
- **CRM** - `wholesale_clients`, `wholesale_orders`, `crm_invoices`
- **Menus** - `menus`, `menu_items`, `menu_access_logs`
- **Marketplace** - `marketplace_stores`, `marketplace_customers`, `marketplace_orders`
- **Billing** - `subscription_events`, `usage_events`, `feature_flags`
- **Audit** - `audit_events` (partitioned monthly)

All tables enforce tenant isolation via RLS policies.

## Integrations

| Service | Purpose |
|---------|---------|
| Stripe | SaaS subscriptions + storefront checkout |
| Twilio | SMS notifications and 2FA |
| Resend | Transactional emails (driver invites, order confirmations) |
| SendGrid | Email campaigns and marketing automation |
| Mapbox | Maps, geocoding, route optimization |
| Supabase Realtime | Live order updates, inventory sync, courier tracking |
| Capacitor | Native iOS + Android builds |

## Documentation

- `docs/INDEX.md` - Documentation index
- `docs/GETTING_STARTED.md` - Setup guide
- `docs/guides/` - Deployment, migration safety, Capacitor setup
- `docs/architecture/` - System overview and design decisions

## Deployment

Configured for:
- **Vercel** - Frontend hosting (vercel.json included)
- **Supabase** - Database, auth, edge functions, storage, realtime
- **Capacitor** - iOS and Android native builds

## License

**All Rights Reserved.**

FloraIQ is proprietary software wholly owned by its author. No part of this codebase — including but not limited to source code, database schemas, edge functions, UI components, business logic, and documentation — may be copied, modified, distributed, sublicensed, or used in any form without explicit written permission from the owner.

Unauthorized use, reproduction, or distribution of this software is strictly prohibited and may result in legal action.

**For licensing inquiries, partnership opportunities, or permission requests, contact the owner directly.**

---

Last updated: March 2026
