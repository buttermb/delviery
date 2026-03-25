<p align="center">
  <img src="https://img.shields.io/badge/React_18-61DAFB?style=flat&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-3FCF8E?style=flat&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white" />
</p>

# FloraIQ

**Multi-tenant cannabis operations platform** — inventory management, last-mile delivery, customer storefront, and wholesale CRM in a single application.

Built for dispensaries and delivery services that need real-time operations control without stitching together five different SaaS tools.

[Live App](https://delviery.vercel.app)

---

## What it does

| Module | Description |
|--------|-------------|
| **Tenant Platform** | Self-serve signup, onboarding wizard, subscription billing via Stripe, usage metering, white-label branding |
| **Admin Dashboard** | Widget-based dashboard, command palette (Cmd+K), role-based access, analytics, export |
| **Inventory** | Batch tracking, chain of custody, barcode/QR generation, label printing, multi-location sync |
| **Delivery** | Real-time order tracking, live courier GPS, route optimization, ETA calculations, push notifications |
| **Storefront** | Encrypted disposable menus, customer whitelisting, age verification, secure access codes |
| **Wholesale CRM** | B2B client management, multi-warehouse inventory, credit-based ordering, runner portal |

---

## Architecture

```
Frontend                     Backend                      Services
─────────────────────────    ─────────────────────────    ──────────────────
React 18 + TypeScript        Supabase (PostgreSQL)        Stripe (billing)
Vite 5                       Row-Level Security           Resend (email)
Tailwind CSS + shadcn/ui     60+ Edge Functions (Deno)    Twilio (SMS)
TanStack Query               Realtime subscriptions       Mapbox (maps)
React Router v6              Supabase Auth + JWT          Sentry (errors)
React Hook Form + Zod        Supabase Storage             PostHog (analytics)
PWA + Service Worker                                      Clarity (sessions)
```

---

## Getting started

```bash
git clone https://github.com/buttermb/delviery.git
cd delviery
npm install
cp .env.example .env    # add your Supabase keys
npm run dev
```

Requires Node 18+. See `.env.example` for all configuration options.

```bash
npm run build            # production build
npm run preview          # preview locally
npx tsc --noEmit         # type check
npm run lint             # lint
npm run test -- --run    # test suite
```

---

## Project structure

```
src/
├── pages/               # Route-level components
│   ├── tenant-admin/    # Admin panel pages
│   ├── customer/        # Customer storefront
│   ├── saas/            # Platform management
│   └── mobile/          # Driver & runner views
├── components/          # Shared UI components
├── contexts/            # Auth & tenant contexts
├── hooks/               # Custom React hooks
├── lib/                 # Core utilities
└── integrations/        # Supabase client & types

supabase/
├── migrations/          # PostgreSQL migrations
└── functions/           # 60+ Deno edge functions
```

---

## Security

- Tenant isolation via PostgreSQL Row-Level Security on every table
- JWT authentication with automatic token refresh
- Input validation at every system boundary (Zod schemas)
- Rate limiting on all public endpoints
- Device fingerprinting for fraud detection
- Encrypted menu URLs with time-limited access codes
- CSP headers, secure cookies, HTTPS enforcement

---

## Deployment

- **Frontend** — Vercel (automatic deploys from `main`)
- **Backend** — Supabase (managed PostgreSQL, Auth, Storage, Edge Functions)
- **Monitoring** — Sentry (errors), PostHog (analytics), Clarity (sessions), Better Stack (uptime)

---

## License

Proprietary. All rights reserved.
