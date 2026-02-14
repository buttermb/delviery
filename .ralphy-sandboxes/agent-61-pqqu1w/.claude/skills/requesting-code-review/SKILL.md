---
name: requesting-code-review
description: Use when completing tasks, implementing major features, or before merging to verify work meets requirements.
---

# Requesting Code Review

Request code review to catch issues before they cascade.

**Core principle:** Review early, review often.

## When to Request Review

**Mandatory:**
- After completing major features
- Before merge to main
- Before PRs

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bugs

## How to Request

### 1. Get git SHAs

```bash
BASE_SHA=$(git rev-parse origin/main)
HEAD_SHA=$(git rev-parse HEAD)
```

### 2. Prepare Review Context

```markdown
## Code Review Request

**What was implemented:** [Brief description]

**Requirements/Plan:** [Link to docs/plans/ or issue]

**Files changed:**
[List key files modified]

**Changes since:** [BASE_SHA]...[HEAD_SHA]

**Testing done:**
- [ ] npm run build passes
- [ ] npm test passes
- [ ] npm run lint passes
- [ ] Manual testing: [description]
```

### 3. Review Checklist (FloraIQ Specific)

- [ ] Tenant isolation maintained (tenant_id filters)
- [ ] No console.log (use logger)
- [ ] No @ts-nocheck
- [ ] Queries have enabled guards
- [ ] Navigation is tenant-aware
- [ ] Loading/error states handled
- [ ] RLS policies updated if needed

### 4. Act on Feedback

| Priority | Action |
|----------|--------|
| 🔴 Critical | Fix immediately before proceeding |
| 🟠 Important | Fix before merge |
| 🔵 Minor | Note for later or fix opportunistically |

## Example

```markdown
## Code Review Request

**What was implemented:** Storefront coupon system

**Requirements:** Docs/plans/2026-01-14-coupons.md

**Files changed:**
- src/pages/admin/storefront/StorefrontCoupons.tsx (new)
- supabase/migrations/20260114_coupons.sql (new)
- src/hooks/useCoupons.ts (new)

**Changes since:** a7981ec...3df7661

**Testing done:**
- [x] npm run build passes
- [x] npm test passes
- [x] Manual: Created/applied/deleted coupons
```

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues

**If reviewer is wrong:**
- Push back with technical reasoning
- Show code/tests that prove it works
