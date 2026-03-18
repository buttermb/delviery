---
name: frontend-code-review
description: Review frontend files (.tsx, .ts, .js) for code quality, performance, and FloraIQ-specific patterns. Use when requesting code review of React components or hooks.
---

# Frontend Code Review Skill

Review frontend code for quality, performance, and FloraIQ conventions.

## When to Use
- User requests a review of frontend files
- Before creating a PR
- After completing a feature

## Review Modes

1. **Pending-change review** - Review staged files before commit
2. **File-targeted review** - Review specific files user names

## Checklist

### Code Quality
- [ ] No `console.log` (use `logger` from `@/lib/logger`)
- [ ] No `@ts-nocheck` or `any` types
- [ ] Props interface defined for components
- [ ] Named exports only (no default exports)
- [ ] Import order: React → Third-party → Types → Components → Utils

### Performance
- [ ] useMemo for expensive computations
- [ ] useCallback for handlers passed to children
- [ ] Queries have `enabled` guard for conditional fetching
- [ ] No inline object/array creation in JSX props

### FloraIQ Patterns
- [ ] Uses `useTenantAdminAuth()` for tenant context
- [ ] Queries filter by `tenant_id`
- [ ] Navigation includes tenant slug: `/${tenantSlug}/admin/...`
- [ ] Uses `queryKeys` factory from `@/lib/queryKeys`
- [ ] Loading/error states handled

### Security
- [ ] No sensitive data in localStorage (use secure methods)
- [ ] User input validated before use
- [ ] No dangerouslySetInnerHTML with user content

## Output Template

### Template A (Issues Found)
```markdown
# Code Review

Found <N> urgent issues:

## 1. <brief description>
**File**: `path/to/file.tsx` line <line>
```tsx
<relevant code snippet>
```

### Suggested Fix
<description of fix>

---

Found <M> suggestions:

## 1. <brief description>
**File**: `path/to/file.tsx` line <line>

### Suggested Fix
<description>

---
```

If issues require code changes, ask:
> "Would you like me to apply these fixes?"

### Template B (No Issues)
```markdown
# Code Review
✅ No issues found.
```

## Priority Levels

| Level | Description | Action |
|-------|-------------|--------|
| 🔴 Urgent | Breaks functionality, security risk | Must fix before merge |
| 🟡 Warning | Code smell, maintainability | Should fix |
| 🔵 Suggestion | Enhancement, readability | Nice to have |

## Example Review

```markdown
# Code Review

Found 2 urgent issues:

## 1. 🔴 Missing tenant_id filter
**File**: `src/hooks/useProducts.ts` line 15
```typescript
const { data } = useQuery({
  queryKey: ['products'],
  queryFn: () => supabase.from('products').select('*'),
});
```

### Suggested Fix
Add tenant filter:
```typescript
.eq('tenant_id', tenant?.id)
```

---

## 2. 🔴 Console.log in production code
**File**: `src/pages/admin/Products.tsx` line 42

### Suggested Fix
Replace with logger:
```typescript
import { logger } from '@/lib/logger';
logger.debug('Products loaded', { count: data.length });
```

---

Found 1 suggestion:

## 1. 🔵 Missing useMemo for filtered products
**File**: `src/pages/admin/Products.tsx` line 28

### Suggested Fix
Wrap in useMemo to prevent recalculation:
```typescript
const filteredProducts = useMemo(() => 
  products?.filter(p => p.active),
  [products]
);
```

Would you like me to apply these fixes?
```
