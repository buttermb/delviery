# FloraIQ — Ralph R4 Project Rules

## Stack
React 18 + TypeScript + Vite | Tailwind + shadcn/ui | TanStack Query | React Router v6 | Supabase | React Hook Form + Zod

## NEVER EDIT
- src/integrations/supabase/client.ts
- src/integrations/supabase/types.ts
- supabase/config.toml
- .env

## Coding Standards
- Use `@/` alias for ALL imports
- Use `logger` from `@/lib/logger` — NEVER console.log
- Use `queryKeys` factory from `@/lib/queryKeys` — NEVER inline query key strings
- Use `useTenantAdminAuth()` for tenant context — NEVER useAccount unless verified equivalent
- Use `toast` from `sonner` — NEVER useToast from use-toast
- Use `.maybeSingle()` not `.single()` for optional data
- ALL Supabase queries in admin pages MUST filter by tenant_id
- Realtime subscriptions MUST filter by tenant_id
- Import order: React → Third-party → Types → Components → Utils
- After mutations: `queryClient.invalidateQueries()` with proper queryKey

## Patterns
- Modals: `useState<boolean>` for open, pass data as props, onSuccess invalidates queries + shows toast
- Hub pages: lazy-loaded tabs, consistent tab pattern
- Forms: React Hook Form + Zod schema validation
- Delete actions: ConfirmDeleteDialog first
- Currency inputs: CurrencyInput component
- Mutations: useMutation + toast + isPending for loading state

## Before Each Commit
- Run: `npx tsc --noEmit 2>&1 | head -30` — fix any new errors
- No `console.log`, no `@ts-nocheck`, no `any` types (use `unknown`)
- No hardcoded `/admin/` routes — use tenantSlug
- Verify tenant_id filtering on new/modified queries

## Task Workflow
1. Read implementation_plan.md, find FIRST unchecked `- [ ]` task
2. Read the task description carefully
3. Implement the fix
4. Run `npx tsc --noEmit 2>&1 | head -30` to check for TS errors
5. Mark task `- [x]` in implementation_plan.md
6. Git commit: `fix: [short description]`
7. STOP — one task per iteration
