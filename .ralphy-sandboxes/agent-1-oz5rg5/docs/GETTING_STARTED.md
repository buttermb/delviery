# 🚀 Getting Started with BigMike Platform Development

## Welcome!

This guide will help you get started with error-free development on the BigMike Wholesale Platform.

## 📚 Step 1: Read the Rules

### Start Here (5 minutes)
1. **[Rules Quick Reference](./RULES_QUICK_REFERENCE.md)** - One-page cheat sheet
2. **[Ultimate Rulebook](./ULTIMATE_RULEBOOK.md)** - Complete guide (read as needed)

### Domain-Specific Guides
- **[Admin Panel Rules](./ADMIN_PANEL_RULES.md)** - If working on admin features
- **[Tenant Isolation Guide](./TENANT_ISOLATION.md)** - If working on multi-tenant features
- **[Schema & Edge Function Rules](./SCHEMA_EDGE_FUNCTION_RULES.md)** - If working on database/API

## 🛠️ Step 2: Set Up Your Environment

### Install Pre-Push Hook
```bash
bash scripts/install-hooks.sh
```

This will automatically validate your code before every push.

### Use Code Templates
When creating new files, use the templates in `docs/templates/`:
- `ComponentTemplate.tsx` - For React components
- `EdgeFunctionTemplate.ts` - For Edge Functions
- `ReactQueryHookTemplate.ts` - For data fetching hooks
- `MigrationTemplate.sql` - For database migrations

### VS Code Snippets
The `.vscode/snippets.code-snippets` file provides shortcuts:
- Type `rct` + Tab = React component template
- Type `rqh` + Tab = React Query hook template
- Type `edge` + Tab = Edge Function template
- Type `tq` + Tab = Tenant query helper
- Type `eh` + Tab = Error handler pattern

## ✅ Step 3: Validate Your Code

### Before Every Commit
```bash
# Quick check
bash scripts/check-rules-compliance.sh

# Or let pre-push hook do it automatically
git push
```

### Manual Validation
```bash
# TypeScript
npx tsc --noEmit

# Linter
npm run lint

# Build
npm run build
```

## 🎯 Step 4: Common Tasks

### Creating a New Component

1. Copy `docs/templates/ComponentTemplate.tsx`
2. Rename to your component name
3. Customize the props and logic
4. Ensure all queries use `tenantQuery()`

### Creating a New Edge Function

1. Copy `docs/templates/EdgeFunctionTemplate.ts`
2. Place in `supabase/functions/your-function/index.ts`
3. Update Zod schema
4. Add to `supabase/config.toml`
5. Implement business logic

### Creating a Database Migration

1. Copy `docs/templates/MigrationTemplate.sql`
2. Rename with timestamp: `YYYYMMDDHHMMSS_description.sql`
3. Place in `supabase/migrations/`
4. Ensure RLS policies include tenant isolation

### Creating a React Query Hook

1. Copy `docs/templates/ReactQueryHookTemplate.ts`
2. Rename to `useYourHook.ts`
3. Update query keys and table names
4. Add permission checks if needed

## 🚨 Critical Rules (Never Forget)

1. ❌ **NEVER** edit auto-generated files
2. ❌ **NEVER** use `console.log` (use `logger`)
3. ❌ **NEVER** skip `tenant_id` filter in queries
4. ❌ **NEVER** skip Zod validation in Edge Functions
5. ❌ **NEVER** create `SECURITY DEFINER` without `SET search_path = public`

## 📖 Quick Reference

### Import Pattern
```typescript
// 1. React
import { useState } from "react";

// 2. Third-party
import { useQuery } from "@tanstack/react-query";

// 3. Types
import type { Product } from "@/types";

// 4. Components
import { Button } from "@/components/ui/button";

// 5. Hooks
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";

// 6. Utilities
import { logger } from "@/lib/logger";
```

### Query Pattern
```typescript
const { tenant } = useTenantAdminAuth();
const { data } = await tenantQuery(supabase, "products", tenant.id)
  .select("*");
```

### Error Handling Pattern
```typescript
try {
  await operation();
  toast.success("Success");
} catch (error) {
  logger.error("Failed", error, { component: "MyComponent" });
  toast.error("Error");
}
```

## 🆘 Need Help?

- **Rules**: [Ultimate Rulebook](./ULTIMATE_RULEBOOK.md)
- **Quick Reference**: [Rules Quick Reference](./RULES_QUICK_REFERENCE.md)
- **Templates**: [docs/templates/](./templates/)
- **Validation**: `bash scripts/check-rules-compliance.sh`

## 🎉 You're Ready!

Follow the rules, use the templates, and validate your code. You're set for error-free development!

