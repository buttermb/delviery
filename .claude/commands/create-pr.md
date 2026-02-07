# Create PR Command

Streamline pull request creation with proper formatting and conventions.

## Usage
Run `/create-pr` after your changes are committed and pushed.

## Instructions

### 1. Get Current State

```bash
# Current branch name
git branch --show-current

# Commits not in main
git log main..HEAD --oneline

# Files changed
git diff main --stat
```

### 2. Generate PR Content

**Title Format**: `type(scope): description`
- Same as commit message conventions
- Use imperative mood
- Under 72 characters

**Body Template**:
```markdown
## Summary
[1-2 sentence description of what this PR does]

## Changes
- [Bullet point for each logical change]
- [Group related changes together]

## Testing
- [ ] TypeScript compiles: `npm run build`
- [ ] Lint passes: `npm run lint`
- [ ] Manual testing: [describe what was tested]

## Screenshots (if UI changes)
[Embed any relevant screenshots]

## Related Issues
Closes #[issue_number]
```

### 3. Create the PR

```bash
# Using GitHub CLI
gh pr create --title "type(scope): description" --body "..."

# Or with interactive mode
gh pr create --web
```

### 4. PR Checklist (Automated Review)

Before creating, verify:
- [ ] All commits follow conventional format
- [ ] Branch is rebased on latest main
- [ ] No console.log statements
- [ ] No @ts-nocheck directives
- [ ] Tenant-aware queries use tenant_id filter
- [ ] New routes wrapped in TenantAdminProtectedRoute

## Output

Present the PR creation command:
```bash
gh pr create \
  --title "feat(storefront): add coupon system" \
  --body "## Summary
Adds discount coupon functionality to the storefront checkout.

## Changes
- Add StorefrontCoupons.tsx admin page
- Create storefront_coupons migration
- Add apply_coupon RPC

## Testing
- [x] npm run build passes
- [x] Tested coupon application in checkout

Closes #123"
```
