# Complete Rules Reference - BigMike Wholesale Platform

This document contains ALL critical rules that must be followed when editing code.

## 📋 Quick Checklist

Before every push, verify:
- [ ] No edits to auto-generated files
- [ ] No `console.log` in frontend (use `logger`)
- [ ] No hardcoded secrets
- [ ] All `SECURITY DEFINER` functions have `SET search_path = public`
- [ ] All edge functions have Zod validation
- [ ] All edge functions handle OPTIONS and return CORS
- [ ] All tables have RLS enabled
- [ ] Tenant-scoped tables filter by tenant_id
- [ ] No foreign keys to `auth.users` (use `public.profiles`)
- [ ] Password hashing uses bcrypt (not SHA-256)
- [ ] localStorage uses `STORAGE_KEYS` constants
- [ ] TypeScript types from `src/types/` (not inline)
- [ ] TanStack Query uses `queryKeys` factory
- [ ] Error handling with typed errors (`error: unknown`)
- [ ] Input validation on client and server
- [ ] No `any` type (use `unknown` with type guards)

## 🔒 Security Rules

### Auto-Generated Files (NEVER EDIT)
- ❌ `src/integrations/supabase/client.ts`
- ❌ `src/integrations/supabase/types.ts`
- ❌ `supabase/config.toml` (project_id line)
- ❌ `.env`

### Logging
- ✅ Use `logger` from `@/lib/logger` in frontend
- ❌ NEVER use `console.log` in frontend
- ✅ `console.log` OK in edge functions (server-side)

### Storage
- ✅ Use `STORAGE_KEYS` from `@/constants/storageKeys`
- ✅ Wrap localStorage in try-catch (fails in incognito)
- ✅ Parse JSON safely with error handling
- ❌ NEVER store sensitive data (passwords, credit cards, SSN)

### Secrets
- ✅ Use environment variables
- ❌ NEVER hardcode API keys, tokens, passwords
- ✅ Use edge functions for sensitive operations

## ⚡ Edge Functions

### Dependencies
- ✅ Import from `_shared/deps.ts`: `serve`, `createClient`, `corsHeaders`
- ❌ NEVER use direct imports

### Validation
- ✅ ALWAYS use Zod validation for `req.json()`
- ✅ Validate environment variables before use

### CORS
- ✅ Handle OPTIONS requests
- ✅ Return CORS headers in ALL responses

### Security
- ✅ Wrap with `withZenProtection` from `_shared/zen-firewall.ts`
- ✅ Return proper Content-Type headers

## 🗄️ Database

### SECURITY DEFINER Functions
- ✅ MUST have `SET search_path = public`
- ❌ Missing search_path = privilege escalation risk

### RLS Policies
- ✅ All tables MUST have RLS enabled
- ✅ Multi-tenant tables MUST filter by tenant_id

### Foreign Keys
- ✅ Reference `public.profiles`
- ❌ NEVER reference `auth.users` directly

### Queries
- ✅ Use `.maybeSingle()` for optional data
- ✅ ALWAYS check for errors after operations
- ✅ Use transactions for multi-step operations

### Forbidden Schemas
- ❌ NEVER modify: `auth.*`, `storage.*`, `realtime.*`, `vault.*`

## 💻 Frontend

### TypeScript
- ✅ Use types from `src/types/`
- ✅ Define interfaces for component props
- ✅ Use `unknown` instead of `any`
- ✅ Use enums or const objects for fixed values

### TanStack Query
- ✅ Use `queryKeys` factory from `@/lib/queryKeys`
- ✅ Invalidate queries on mutations
- ✅ Set appropriate `staleTime` and `gcTime`

### Error Handling
- ✅ Use typed errors: `catch (error: unknown)`
- ✅ Log errors with context
- ✅ Show user-friendly messages

### React Patterns
- ✅ Memoize expensive computations with `useMemo`
- ✅ Cleanup subscriptions in `useEffect`
- ✅ Use refs instead of direct DOM access
- ✅ Use `useCallback` for event handlers

### Input Validation
- ✅ Validate on client AND server
- ✅ Sanitize strings before database insertion
- ✅ Use validation helpers from `src/lib/utils/validation.ts`

## 🚨 Security Critical

### NEVER DO THESE
1. ❌ Expose API keys in frontend
2. ❌ Trust user roles from localStorage
3. ❌ Use `dangerouslySetInnerHTML` with user content
4. ❌ Log sensitive data (passwords, tokens)
5. ❌ Use `eval()` or `Function()` constructor
6. ❌ Trust client-side data in edge functions

## 📝 Commit Messages

Use conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `docs:` - Documentation
- `style:` - Formatting
- `test:` - Tests
- `chore:` - Maintenance

Format: `type(scope): description`

## 🔍 Pre-Push Validation

The pre-push hook automatically validates:
- Auto-generated file edits
- Console.log in frontend
- Hardcoded secrets
- SECURITY DEFINER functions
- Edge function validation
- TypeScript compilation
- Linter errors
- Unsafe patterns

Install: `bash scripts/install-hooks.sh`

## 📚 Additional Resources

### Core Documentation
- [Admin Panel Rules](./ADMIN_PANEL_RULES.md) - Complete admin panel rules and best practices
- [Admin Panel Checklist](./ADMIN_PANEL_CHECKLIST.md) - Quick validation checklist
- [Schema & Edge Function Rules](./SCHEMA_EDGE_FUNCTION_RULES.md) - Database schema and edge function patterns
- [Supabase Rules](./SUPABASE_RULES.md) - Detailed Supabase rules

### Guides
- [Development Guide](../DEVELOPMENT.md) - Quick start guide
- [Leafly Integration](../src/lib/LEAFLY_INTEGRATION.md) - Leafly API integration guide

### Configuration
- [`.cursorrules`](../.cursorrules) - AI assistant rules (used by Cursor AI)
- [Pre-push Hook](../scripts/pre-push-hook.sh) - Automated validation script

