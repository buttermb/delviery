# 📘 Development Rules & Best Practices

## 🚀 Quick Start

1. **Read the Ultimate Rulebook**: [docs/ULTIMATE_RULEBOOK.md](./docs/ULTIMATE_RULEBOOK.md)
2. **Check compliance**: `bash scripts/check-rules-compliance.sh`
3. **Quick reference**: [docs/RULES_QUICK_REFERENCE.md](./docs/RULES_QUICK_REFERENCE.md)

## 📚 Documentation Structure

### ⭐ Primary Guides
- **[Ultimate Rulebook](./docs/ULTIMATE_RULEBOOK.md)** - Complete error-prevention guide (START HERE)
- **[Rules Quick Reference](./docs/RULES_QUICK_REFERENCE.md)** - One-page cheat sheet

### 🎯 Domain-Specific Guides
- [Admin Panel Rules](./docs/ADMIN_PANEL_RULES.md) - Admin-specific patterns
- [Tenant Isolation Guide](./docs/TENANT_ISOLATION.md) - Multi-tenant system
- [Schema & Edge Function Rules](./docs/SCHEMA_EDGE_FUNCTION_RULES.md) - Database patterns
- [Supabase Rules](./docs/SUPABASE_RULES.md) - Supabase-specific rules

### 🔧 Tools & Validation
- **Pre-push Hook**: `scripts/pre-push-hook.sh` - Automatic validation on push
- **Compliance Checker**: `scripts/check-rules-compliance.sh` - Manual validation
- **Issue Detector**: `scripts/find-tenant-isolation-issues.sh` - Tenant isolation issues

## ✅ Quick Validation

```bash
# Run comprehensive compliance check
bash scripts/check-rules-compliance.sh

# Or use pre-push hook (automatic)
git push  # Hook runs automatically
```

## 🚨 Critical Rules (Top 10)

1. ❌ **NEVER** edit auto-generated files
2. ❌ **NEVER** use `console.log` (use `logger`)
3. ❌ **NEVER** use `any` type (use `unknown`)
4. ❌ **NEVER** skip `tenant_id` filter in queries
5. ❌ **NEVER** skip Zod validation in Edge Functions
6. ❌ **NEVER** create `SECURITY DEFINER` without `SET search_path = public`
7. ❌ **NEVER** reference `auth.users` in foreign keys
8. ❌ **NEVER** use `window.location` (use `useNavigate`)
9. ❌ **NEVER** skip error handling
10. ❌ **NEVER** skip loading states

## 📋 Pre-Push Checklist

- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] Linter passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Compliance check passes (`bash scripts/check-rules-compliance.sh`)
- [ ] No `console.log` statements
- [ ] All queries filter by `tenant_id`
- [ ] All Edge Functions have Zod validation
- [ ] Conventional commit message

## 🔗 For Cursor AI

The `.cursorrules` file is automatically read by Cursor AI. It contains all critical rules for AI-assisted development.

## 📖 Complete Documentation

See [DEVELOPMENT.md](./DEVELOPMENT.md) for the full documentation index.

