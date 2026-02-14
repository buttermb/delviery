# Review Branch Command

Comprehensive code review of the current branch against main.

## Usage
Run `/review-branch` before creating a PR or when you want a thorough review.

## Instructions

1. **Get branch diff**
   ```bash
   git diff main...HEAD --stat
   git diff main...HEAD
   ```

2. **Analyze each file** for:

### Security
- [ ] Tenant isolation: All queries filter by `tenant_id` or `store_id`
- [ ] RLS enabled on new tables
- [ ] No secrets/tokens in code
- [ ] Auth extracted from JWT, not request body
- [ ] No `dangerouslySetInnerHTML` with user content

### Code Quality
- [ ] No `console.log` (use `logger`)
- [ ] No `@ts-nocheck` or `any` types
- [ ] No hardcoded `/admin/` routes (use tenant slug)
- [ ] Named exports (no default exports)
- [ ] Props interfaces defined

### Error Handling
- [ ] Async operations wrapped in try-catch
- [ ] User-friendly error messages (not technical errors)
- [ ] Loading states on buttons during operations

### Performance
- [ ] Queries have proper indexes
- [ ] No N+1 query patterns
- [ ] useMemo/useCallback for expensive operations

### Conventions
- [ ] Follows patterns in `.claude/skills/`
- [ ] Migration naming: `YYYYMMDDHHMMSS_description.sql`
- [ ] Component naming: PascalCase

## Output Format

```markdown
## Branch Review: [branch-name]

### Summary
- X files changed
- Main changes: [brief description]

### 🔴 Critical (Must fix)
- [File:Line] Issue description

### 🟠 Warnings (Should fix)
- [File:Line] Issue description

### 🟡 Suggestions
- [File:Line] Improvement idea

### ✅ Good Patterns
- [Description of well-implemented patterns]

### Verdict: APPROVE / REQUEST_CHANGES
```
