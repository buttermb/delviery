# FloraIQ - Smart Cannabis Operations Platform

Multi-tenant B2B cannabis distribution platform with React 18, TypeScript, Supabase, and TanStack Query.

## Commands

```bash
npm run dev          # Start dev server (port 5173)
npm run build        # Production build (catches TypeScript errors)
npm run lint         # ESLint check
npm test             # Run Vitest tests
```

## Code Style

- **TypeScript strict mode** - No `any` types, use `unknown` if needed
- **Named exports only** - Never use default exports
- **Import alias** - Always use `@/` for imports
- **Logging** - Use `logger` from `@/lib/logger`, never `console.log`
- **Storage** - Use `STORAGE_KEYS` from `@/constants/storageKeys`

## Architecture

```
src/
├── pages/admin/     # Admin panel (/:tenantSlug/admin/*)
├── pages/shop/      # Storefront (/shop/:storeSlug/*)
├── components/ui/   # shadcn/ui components
├── hooks/           # Custom hooks (useXxx.ts)
├── lib/             # Utilities, queryKeys
└── contexts/        # React contexts

supabase/
├── functions/       # Edge Functions (Deno)
└── migrations/      # SQL migrations
```

## Critical Rules

### Database
- ALWAYS enable RLS on tables
- ALWAYS filter by `tenant_id` (admin) or `store_id` (storefront)
- Use `.maybeSingle()` not `.single()` for optional data
- Security definer functions MUST have `SET search_path = public`

### Admin Panel
```typescript
// ALWAYS use tenant context
const { tenant, tenantSlug } = useTenantAdminAuth();

// ALWAYS include tenant in queries
.eq('tenant_id', tenant?.id)

// ALWAYS use tenant-aware navigation
navigate(`/${tenantSlug}/admin/products`);
```

### Edge Functions
```typescript
// ALWAYS import from _shared/deps.ts
import { serve, createClient, corsHeaders } from '../_shared/deps.ts';

// ALWAYS handle OPTIONS + include CORS headers
if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

// NEVER trust client data - extract user from JWT
const { data: { user } } = await supabase.auth.getUser();
```

## Auto-Generated Files (NEVER EDIT)
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `supabase/config.toml` (project_id line)

## Key Gotchas

- Navigation: Always include tenant slug in admin routes
- Buttons: Must have loading + disabled states during async ops
- Errors: Wrap async in try-catch, use `toast.error()` for user feedback
- Queries: Use `queryKeys` factory from `@/lib/queryKeys`

See `.claude/skills/` for detailed patterns.
