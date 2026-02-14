# Frequently Asked Questions (FAQ)

## General Questions

### Q: Where do I start?
**A:** Start with the [Getting Started Guide](./GETTING_STARTED.md). It will walk you through setup and point you to the right documentation.

### Q: What's the most important rule?
**A:** All rules are important, but the top 3 are:
1. Never edit auto-generated files
2. Always use `logger` instead of `console.log`
3. Always filter queries by `tenant_id` in multi-tenant tables

### Q: How do I know if my code follows the rules?
**A:** Run `bash scripts/check-rules-compliance.sh` - it will check everything automatically.

---

## Code Questions

### Q: Why can't I use `console.log`?
**A:** `console.log` statements are removed in production builds. Use `logger` from `@/lib/logger` instead, which works in both development and production.

### Q: Why do I need to use `tenantQuery()`?
**A:** `tenantQuery()` automatically filters by `tenant_id`, preventing data leaks between tenants. It's a security requirement for multi-tenant applications.

### Q: Why can't I use `any` type?
**A:** `any` disables TypeScript's type checking, making your code unsafe. Use `unknown` instead and add proper type guards.

### Q: Why do I need Zod validation in Edge Functions?
**A:** Client-side validation can be bypassed. Zod validation in Edge Functions ensures data integrity and prevents security issues.

### Q: Why can't I reference `auth.users` directly?
**A:** Supabase's `auth.users` table is in a reserved schema. Always reference `public.profiles` instead, which is the public-facing user table.

---

## Tenant Isolation Questions

### Q: How do I ensure tenant isolation?
**A:** 
1. Use `tenantQuery()` helper for all queries
2. Validate tenant access in Edge Functions
3. Ensure RLS policies filter by `tenant_id`
4. Always include `tenant_id` in query keys

### Q: What happens if I forget `tenant_id` filter?
**A:** The pre-push hook will warn you. In production, RLS policies should prevent data leaks, but it's better to catch it early.

### Q: Can a user access multiple tenants?
**A:** Yes, users can belong to multiple tenants via the `tenant_users` table. The system supports this.

---

## Edge Function Questions

### Q: Do all Edge Functions need authentication?
**A:** No. Public endpoints (like `track-access`) can have `verify_jwt = false` in `config.toml`. Protected endpoints must validate JWT tokens.

### Q: Why do I need `withZenProtection`?
**A:** `withZenProtection` adds security layers like rate limiting and request validation. Always use it for production Edge Functions.

### Q: Can I skip CORS handling?
**A:** No. All Edge Functions must handle OPTIONS requests and return CORS headers in all responses, or browsers will block requests.

---

## Database Questions

### Q: Why do SECURITY DEFINER functions need `SET search_path`?
**A:** Without it, functions could execute with elevated privileges in unexpected schemas, creating security vulnerabilities. Always include it.

### Q: Can I modify the `auth` schema?
**A:** No. Never modify reserved schemas: `auth.*`, `storage.*`, `realtime.*`, `vault.*`, `supabase_functions.*`

### Q: How do I know if a table needs `tenant_id`?
**A:** If the table stores data that belongs to a specific business/tenant, it needs `tenant_id`. System-wide tables (like `tenants` itself) don't need it.

---

## React Questions

### Q: Why use named exports instead of default?
**A:** Named exports make it easier to find and refactor code. They're also required by some build tools and improve tree-shaking.

### Q: When should I use `useCallback`?
**A:** Use `useCallback` for event handlers that are passed to child components, especially if those components are memoized.

### Q: When should I use `useMemo`?
**A:** Use `useMemo` for expensive calculations that don't need to run on every render. Don't overuse it - React is already optimized.

### Q: Why can't I use `window.location`?
**A:** `window.location` causes full page reloads, breaking React's SPA behavior. Use `useNavigate()` or `<Link>` instead.

---

## Validation Questions

### Q: What does the pre-push hook check?
**A:** It checks:
- No edits to auto-generated files
- No `console.log` statements
- No hardcoded secrets
- Proper `localStorage` usage
- SECURITY DEFINER functions have `SET search_path`
- Edge Functions have Zod validation
- TypeScript compiles
- Linter passes
- And more...

### Q: Can I skip the pre-push hook?
**A:** You can use `git push --no-verify`, but it's not recommended. The hook catches issues before they reach production.

### Q: What if the compliance checker finds issues?
**A:** Fix the violations (marked with ❌) first. Warnings (marked with ⚠️) should be addressed but won't block pushes.

---

## Template Questions

### Q: Can I modify the templates?
**A:** Yes! The templates are starting points. Customize them for your needs, but keep the core patterns (error handling, tenant isolation, etc.).

### Q: Do I have to use the templates?
**A:** No, but they save time and ensure you follow all rules. Highly recommended for consistency.

### Q: Where are the templates?
**A:** In `docs/templates/`:
- `ComponentTemplate.tsx`
- `EdgeFunctionTemplate.ts`
- `ReactQueryHookTemplate.ts`
- `MigrationTemplate.sql`

---

## Documentation Questions

### Q: Which guide should I read first?
**A:** 
1. [Getting Started](./GETTING_STARTED.md) - 5 minutes
2. [Rules Quick Reference](./RULES_QUICK_REFERENCE.md) - One page
3. [Ultimate Rulebook](./ULTIMATE_RULEBOOK.md) - As needed

### Q: Where do I find specific patterns?
**A:** 
- Admin features → [Admin Panel Rules](./ADMIN_PANEL_RULES.md)
- Database/API → [Schema & Edge Function Rules](./SCHEMA_EDGE_FUNCTION_RULES.md)
- Tenant features → [Tenant Isolation Guide](./TENANT_ISOLATION.md)

### Q: How do I contribute to the documentation?
**A:** Edit the markdown files in `docs/` and submit a PR. Follow the same format and style.

---

## Still Have Questions?

1. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review the [Ultimate Rulebook](./ULTIMATE_RULEBOOK.md)
3. Look at code templates for examples
4. Run the compliance checker to see what might be wrong

