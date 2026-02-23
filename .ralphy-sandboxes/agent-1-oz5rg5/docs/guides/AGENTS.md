# Agent Instructions for BigMike Wholesale Platform

## ⚠️ CRITICAL: Always Read This File
This file MUST be read at the start of EVERY session. It contains essential context for operating effectively in this codebase.

## 🛠️ MCP Server Configurations

### Available Tools
This project is configured to work with the following MCP servers:

**ChunkHound** (Code Research)
- Semantic code search across the codebase
- Use for: Finding patterns, understanding architecture, locating implementations
- Example: "How is authentication implemented?" "Where is rate limiting configured?"

**ArguSeek** (Domain Research)
- Retrieves up-to-date documentation and best practices from the web
- Use for: Latest API docs, framework updates, security best practices
- Example: "Latest Next.js 14 patterns" "Supabase edge function best practices"

### Non-Interactive Command Modifications
When running commands in automated/agent contexts:
- Tests: `npm test -- --run` (no watch mode)
- Build: `npm run build` (already non-interactive)
- Linting: `npm run lint` (already non-interactive)

## Commands
- **Dev**: `npm run dev` (Vite dev server on port 8080)
- **Build**: `npm run build` (production build - requires 4GB heap)
- **Build Dev**: `npm run build:dev` (development mode build)
- **Lint**: `npm run lint` (ESLint)
- **Test**: `npm test` (Vitest)
- **Test Single**: `npm test -- <test-file-path>` (run specific test file)
- **Test UI**: `npm run test:ui` (Vitest UI)
- **Preview**: `npm run preview` (preview production build)

## Architecture
- **Frontend**: React 18 + TypeScript + Vite 5 + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **State**: TanStack Query for server state, React Context for auth
- **Routing**: React Router v6 (107 routes)
- **PWA**: Service Worker with Workbox
- **Mobile**: Capacitor for iOS/Android builds

### Multi-Tenant SaaS Platform
- **Product**: Cannabis/THCA wholesale distribution & delivery management
- **Customers**: Wholesale distributors (B2B) + retail customers (B2C)
- **Tiers**: Starter ($99/mo), Professional ($299/mo), Enterprise ($600/mo)
- **Users**: 3-tier auth (Super Admin → Tenant Admin → Customer + Courier)

### Key Directories
- `src/pages/` - Route pages organized by user type (admin, customer, courier, super-admin)
- `src/components/` - Reusable UI components (organized by domain)
- `src/integrations/supabase/` - Supabase client and types
- `src/hooks/` - Custom React hooks
- `src/lib/` - Utilities, constants, auth, API helpers
  - `src/lib/logger.ts` - **Production logging utility (use instead of console.log)**
  - `src/lib/queryKeys.ts` - **TanStack Query key factory**
- `src/types/` - **TypeScript type definitions**
  - `src/types/cart.ts` - Cart item types
  - `src/types/product.ts` - Product interface
  - `src/types/auth.ts` - User auth types
  - `src/types/money.ts` - Numeric handling
  - `src/types/edge-functions.ts` - Edge Function responses
- `src/contexts/` - React contexts (AuthContext, TenantContext, etc.)
- `supabase/migrations/` - Database migrations (49+ tables)
- `supabase/functions/` - Edge functions (56+ functions)

## Database Schema
**49+ tables** with Row Level Security (RLS):
- `tenants` - Multi-tenant isolation
- `products`, `wholesale_inventory`, `inventory_alerts` - Inventory management
- `wholesale_clients`, `wholesale_orders` - B2B wholesale
- `orders`, `order_items` - B2C retail
- `couriers`, `deliveries`, `courier_earnings` - Fleet management
- `disposable_menus`, `menu_products` - Temporary secure menus
- `wholesale_payments`, `loyalty_points` - Financial
- `age_verifications`, `fraud_flags`, `audit_logs` - Security & compliance

## 🏗️ Architectural Constraints

### Critical Design Principles
1. **Multi-Tenancy First**: Every database query MUST include `tenant_id` filter
2. **No Direct Auth Access**: Never query `auth.users` - use `public.profiles`
3. **Edge Functions Only**: All sensitive operations go through edge functions, not client-side
4. **Type Safety**: Zero `any` types - use proper TypeScript interfaces from `src/types/`
5. **Query Keys**: Always use the `queryKeys` factory from `@/lib/queryKeys`

### Data Flow Pattern
```
Client → TanStack Query → Edge Function → Database (with RLS)
```

Never bypass this flow for sensitive operations.

### Service Repository Pattern
- Business logic: `/src/lib/` or `/src/hooks/`
- Data access: TanStack Query hooks
- UI: Components are thin, delegate to hooks
- Edge functions: Validation + RLS-enforced database operations

## ⚠️ Common Pitfalls

### Dependency Warnings
- **React Router**: We use v6 - routes are defined in `App.tsx`
- **Supabase Client**: Auto-generated types in `src/integrations/supabase/types.ts` - NEVER edit
- **TanStack Query**: v5 syntax (not v4) - uses `queryClient.invalidateQueries({ queryKey })`
- **Vite**: Build requires 4GB heap (configured in package.json)

### Known Issues
- Build fails if you use `console.log` in frontend code (use `logger` instead)
- LocalStorage fails in incognito mode (always wrap in try-catch)
- Supabase types regenerate on schema changes (don't import from other files)

## Environment Variables

### Required for Development
```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Required for Edge Functions
```bash
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Optional
- `VITE_STRIPE_PUBLISHABLE_KEY` - For subscription features
- `VITE_GOOGLE_MAPS_API_KEY` - For delivery mapping

**Never commit these to git** - they're in `.env` which is gitignored.

## Code Style

### Logging (IMPORTANT)
**ALWAYS use logger utility instead of console.log:**
```typescript
import { logger } from '@/lib/logger';

// Development only - removed in production
logger.debug('Debug info', { data });
logger.info('Info message', { context });

// Always logged
logger.warn('Warning', { details });
logger.error('Error occurred', error, { component: 'MyComponent' });

// ❌ NEVER use directly:
console.log('...'); // Will be removed
console.error('...'); // Use logger.error instead
```

### TypeScript Types
**Use defined types from `src/types/`:**
```typescript
import type { Product } from '@/types/product';
import type { DbCartItem, RenderCartItem } from '@/types/cart';
import type { AppUser } from '@/types/auth';
import type { EdgeFunctionResponse } from '@/types/edge-functions';

// Edge Function calls
const { data, error } = await supabase.functions.invoke<OrderCreateResponse>('create-order', {
  body: { ... }
});
```

### TanStack Query
**Use query key factory for consistency:**
```typescript
import { queryKeys } from '@/lib/queryKeys';

const { data } = useQuery({
  queryKey: queryKeys.products.detail(productId),
  queryFn: async () => { /* fetch */ }
});

const mutation = useMutation({
  mutationFn: async (data) => { /* update */ },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
  }
});
```

### Error Handling
**Standardized pattern:**
```typescript
catch (error: unknown) {
  logger.error('Operation failed', error, { component: 'MyComponent' });
  toast.error(error instanceof Error ? error.message : 'Operation failed');
}
```

### Imports
- Use `@/` alias for all src imports (e.g., `import { Button } from "@/components/ui/button"`)
- Group imports: React → Third-party → Types → Local components → Utilities

### Components
- Functional components with TypeScript
- PascalCase filenames
- Define interfaces for component props
- Use React Hook Form + Zod for forms
- Tailwind CSS classes, use `cn()` from `@/lib/utils` for conditional classes

### Authentication
**Check user type before rendering:**
```typescript
import { getCurrentUserType } from '@/lib/utils/authHelpers';

const userType = getCurrentUserType(); // 'super_admin' | 'tenant_admin' | 'customer' | 'courier' | null
```

### Feature Gating
**Wrap premium features:**
```typescript
<FeatureProtectedRoute featureId="advanced-analytics">
  <AdvancedAnalyticsPage />
</FeatureProtectedRoute>
```

## Important Notes
- Build requires 4GB heap (already configured in package.json)
- All routes respect tenant context and RLS policies
- Database queries use Supabase client from `@/integrations/supabase/client`
- Real-time subscriptions via Supabase Realtime
- Multi-tenant: Every table has `tenant_id`, enforced by RLS
- Three subscription tiers with different feature access
- Mobile-first design with PWA support

## Core Features
1. **Big Plug CRM** - Disposable encrypted menus for wholesale clients
2. **Wholesale Management** - B2B orders, client CRM, credit management
3. **Inventory System** - Multi-warehouse tracking, alerts, movements
4. **Fleet Management** - Courier tracking, GPS, route optimization
5. **Financial Center** - Cash flow, P&L, payment tracking
6. **Customer Portal** - B2C e-commerce with age verification
7. **Super Admin** - Platform monitoring, tenant management, analytics

## Security
- RLS policies on all tables
- JWT authentication with refresh
- Age verification required
- Fraud detection system
- Device fingerprinting
- Audit logging
- No secrets in code (use env vars)

## Performance
- Query result caching (staleTime: 60s)
- Code splitting via React.lazy
- PWA with offline support
- CDN via Vercel Edge
- Database connection pooling
- Optimistic updates where possible
