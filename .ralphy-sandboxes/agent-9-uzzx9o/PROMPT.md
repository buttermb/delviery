# FloraIQ Interconnectivity Build — Ralph Wiggum Loop

You are building FloraIQ, a multi-tenant cannabis wholesale SaaS platform.

## Tech Stack
- React 18 + TypeScript + Vite 5.0
- Tailwind CSS + shadcn/ui
- TanStack Query (React Query)
- Supabase (PostgreSQL + Auth + Edge Functions)
- React Router v6 with tenant-aware routing

## Critical Rules — ALWAYS FOLLOW
- ALWAYS use `logger` from `@/lib/logger` — NEVER use `console.log`
- ALWAYS use `@/` alias for all imports
- ALWAYS filter database queries by `tenant_id`
- ALWAYS use `useTenantAdminAuth()` for tenant context in admin components
- ALWAYS include tenant slug in admin routes: `navigate(\`/\${tenantSlug}/admin/...\`)`
- NEVER edit auto-generated files in `src/integrations/supabase/`
- Use `.maybeSingle()` instead of `.single()` for optional data
- All tables MUST have RLS enabled with tenant_id filtering
- NEVER use `any` type — use `unknown` if necessary
- Import order: React → Third-party → Types → Components → Utils
- All async operations need loading states and error handling
- Use React Hook Form + Zod for forms

## Project Structure
```
src/
├── pages/admin/          # Admin panel pages
├── components/admin/     # Admin components
├── components/shop/      # Storefront components
├── components/ui/        # shadcn/ui + custom
├── hooks/                # Custom hooks (useXxx.ts)
├── lib/                  # Utilities
├── contexts/             # React contexts
├── types/                # TypeScript interfaces
supabase/
├── functions/            # Edge Functions
└── migrations/           # Database migrations
```

## Your Task

1. Read `prd.json` and find the FIRST task where `"passes": false`
2. Implement that task completely following all rules above
3. After implementation, verify:
   - No TypeScript errors
   - No `console.log` statements
   - All queries filter by `tenant_id`
   - Loading and error states included
   - Proper imports with `@/` alias
4. Mark the task as `"passes": true` in `prd.json`
5. Append what you learned to `progress.txt`
6. Commit your changes with message: `feat: [task title]`

ONLY WORK ON ONE TASK PER ITERATION.

If all tasks have `"passes": true`, output <promise>COMPLETE</promise>
