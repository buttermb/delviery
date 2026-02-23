# Development Guide - BigMike Wholesale Platform

## Quick Start

1. **Install Git Hooks** (validates code before push):
   ```bash
   bash scripts/install-hooks.sh
   ```

2. **Development Commands**:
   ```bash
   npm run dev          # Start dev server (port 8080)
   npm run build        # Production build (requires 4GB heap)
   npm run lint         # Run ESLint
   npm test            # Run tests
   ```

## Code Quality Rules

### Before Every Push

Run the pre-push hook automatically validates:
- ✅ No edits to auto-generated files
- ✅ No console.log statements
- ✅ No hardcoded secrets
- ✅ SECURITY DEFINER functions have proper SET search_path
- ✅ Edge functions use Zod validation & CORS
- ✅ TypeScript compiles
- ✅ Linter passes

### Manual Checks

```bash
# 1. Build passes
npm run build

# 2. No TypeScript errors
npx tsc --noEmit

# 3. Lint passes
npm run lint

# 4. No console.log statements
grep -r "console.log" src/

# 5. No hardcoded secrets
grep -r "sk_live\|api_key" src/
```

## File Structure

```
src/
├── pages/           # Route pages (organized by user type)
│   ├── admin/      # Tenant admin pages
│   ├── customer/   # Customer portal
│   ├── courier/    # Courier app
│   └── super-admin/ # Platform admin
├── components/     # Reusable UI components
├── lib/            # Utilities, constants, APIs
├── types/          # TypeScript type definitions
├── hooks/          # Custom React hooks
└── contexts/       # React contexts
```

## Critical Rules

### Auto-Generated Files (NEVER EDIT)
- ❌ `src/integrations/supabase/client.ts`
- ❌ `src/integrations/supabase/types.ts`
- ❌ `supabase/config.toml` (project_id line)
- ❌ `.env`

### Logging
- ✅ Use `logger` from `@/lib/logger`
- ❌ NEVER use `console.log`

### Edge Functions
- ✅ Import from `_shared/deps.ts`
- ✅ ALWAYS use Zod validation
- ✅ ALWAYS handle OPTIONS requests
- ✅ ALWAYS return CORS headers

### Database
- ✅ SECURITY DEFINER functions MUST have `SET search_path = public`
- ✅ All tables MUST have RLS enabled
- ✅ Multi-tenant tables MUST filter by tenant_id

## Commit Message Format

Use conventional commits:

```
feat: Add product search functionality
fix: Resolve cart calculation bug
refactor: Extract authentication logic
docs: Update API documentation
```

Types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `perf`, `ci`, `build`, `revert`

## Documentation

### ⭐ Getting Started
- [**Getting Started Guide**](./docs/GETTING_STARTED.md) - 🚀 **NEW DEVELOPER? START HERE!**
- [**Ultimate Rulebook**](./docs/ULTIMATE_RULEBOOK.md) - **COMPLETE ERROR-PREVENTION GUIDE**

### Core Rules & Best Practices
- [Admin Panel Rules](./docs/ADMIN_PANEL_RULES.md) - Complete admin panel rules and best practices
- [Admin Panel Checklist](./docs/ADMIN_PANEL_CHECKLIST.md) - Quick validation checklist
- [Schema & Edge Function Rules](./docs/SCHEMA_EDGE_FUNCTION_RULES.md) - Database schema and edge function patterns
- [Supabase Rules](./docs/SUPABASE_RULES.md) - Detailed Supabase rules
- [Complete Rules Reference](./docs/COMPLETE_RULES_REFERENCE.md) - All rules in one place

### Tenant Isolation
- [Tenant Isolation Quick Start](./docs/TENANT_ISOLATION_QUICK_START.md) - Get started in 5 minutes
- [Tenant Isolation Guide](./docs/TENANT_ISOLATION.md) - Complete tenant isolation system documentation
- [Tenant Isolation Migration Guide](./docs/TENANT_ISOLATION_MIGRATION_GUIDE.md) - How to migrate existing code
- [Tenant Isolation Rules Compliance](./docs/TENANT_ISOLATION_RULES_COMPLIANCE.md) - Rules verification

### Integration Guides
- [API Integration Guide](./API_INTEGRATION_AUDIT.md) - API integration patterns
- [Leafly Integration](./src/lib/LEAFLY_INTEGRATION.md) - Leafly API integration guide

### Code Templates
- [Component Template](./docs/templates/ComponentTemplate.tsx) - React component template
- [Edge Function Template](./docs/templates/EdgeFunctionTemplate.ts) - Edge function template
- [React Query Hook Template](./docs/templates/ReactQueryHookTemplate.ts) - Query hook template
- [Migration Template](./docs/templates/MigrationTemplate.sql) - Database migration template
- [VS Code Snippets](./.vscode/snippets.code-snippets) - Code snippets for faster development

### Help & Support
- [Documentation Index](./docs/INDEX.md) - Complete navigation guide
- [Troubleshooting Guide](./docs/TROUBLESHOOTING.md) - Common issues and solutions
- [FAQ](./docs/FAQ.md) - Frequently asked questions

## Getting Help

- **Start here**: [Ultimate Rulebook](./docs/ULTIMATE_RULEBOOK.md) - Complete error-prevention guide
- **Quick reference**: [Rules Quick Reference](./docs/RULES_QUICK_REFERENCE.md) - One-page cheat sheet
- **Check compliance**: `bash scripts/check-rules-compliance.sh` - Automated validation
- **AI assistant**: `.cursorrules` - Auto-read by Cursor AI
- **Database rules**: `docs/SUPABASE_RULES.md` - Supabase-specific patterns
- Run `npm run lint` to see code style issues
- Check pre-push hook output for validation errors
