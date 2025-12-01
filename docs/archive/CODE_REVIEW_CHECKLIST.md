# ✅ Code Review Checklist

A systematic checklist for comprehensive code reviews, adapted from the AI Coding Course methodology and tailored for the BigMike Wholesale Platform.

---

## 🎯 Purpose

This checklist ensures that all code - whether human or AI-generated - meets production standards before merging. Use it as a prompt for AI reviews or as a manual review guide.

---

## 📋 Review Dimensions

### 1. ✅ Correctness

Does the code actually work and meet requirements?

#### Functional Requirements
- [ ] Solves the stated problem completely
- [ ] Handles all specified use cases
- [ ] Returns correct outputs for valid inputs
- [ ] Degrades gracefully for invalid inputs

#### Logic & Flow
- [ ] No off-by-one errors
- [ ] Conditional logic is correct
- [ ] Loops terminate properly
- [ ] Async operations handled correctly (no race conditions)

#### Edge Cases
- [ ] Empty/null/undefined inputs handled
- [ ] Boundary values tested (min, max, zero)
- [ ] Array edge cases: empty, single item, large
- [ ] String edge cases: empty, special characters, Unicode
- [ ] Number edge cases: zero, negative, infinity, NaN

---

### 2. 🔒 Security

Is the code safe from vulnerabilities?

#### Injection Attacks
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] No command injection
- [ ] User input is properly sanitized

#### Authentication & Authorization
- [ ] Auth checks are present where needed
- [ ] Role-based access control enforced
- [ ] Session management is secure
- [ ] JWT tokens validated correctly

#### Data Exposure
- [ ] No sensitive data in logs (passwords, tokens, credit cards)
- [ ] No secrets hardcoded in code
- [ ] API keys stored in environment variables
- [ ] Tenant isolation enforced (multi-tenant check)

#### Specific to This Project
- [ ] Uses `logger` instead of `console.log` (no sensitive data leaks)
- [ ] Edge functions have proper CORS headers
- [ ] Database queries filter by `tenant_id`
- [ ] RLS policies respected
- [ ] No direct `auth.users` access (uses `public.profiles`)

---

### 3. ⚡ Performance

Will this code scale and perform well?

#### Database Queries
- [ ] No N+1 query problems
- [ ] Proper indexes used
- [ ] Queries are optimized
- [ ] Use `.maybeSingle()` instead of `.single()` for optional data

#### React Performance
- [ ] No unnecessary re-renders
- [ ] Expensive computations memoized with `useMemo`
- [ ] Event handlers memoized with `useCallback`
- [ ] Large lists virtualized if needed

#### Network & Loading
- [ ] API calls minimized
- [ ] Data is cached appropriately (TanStack Query)
- [ ] Loading states shown for async operations
- [ ] Optimistic updates where appropriate

#### Memory & Resources
- [ ] No memory leaks
- [ ] Subscriptions cleaned up in `useEffect` return
- [ ] Large objects released when done
- [ ] File handles closed properly

---

### 4. 🎨 Style & Conventions

Does the code follow project standards?

#### TypeScript
- [ ] No `any` types (use `unknown` if necessary)
- [ ] Interfaces defined for component props
- [ ] Types imported from `src/types/`
- [ ] Enums or const objects used for fixed values

#### Naming
- [ ] Components: PascalCase (e.g., `ProductCard.tsx`)
- [ ] Hooks: camelCase with `use` prefix (e.g., `useLocalStorage.ts`)
- [ ] Utilities: camelCase (e.g., `formatCurrency.ts`)
- [ ] Constants: UPPER_SNAKE_CASE (e.g., `STORAGE_KEYS.ts`)
- [ ] Variables are descriptive, not cryptic

#### Imports
- [ ] Uses `@/` alias (never relative paths)
- [ ] Grouped: React → Third-party → Types → Components → Hooks → Utils
- [ ] No unused imports

#### Code Organization
- [ ] Functions are small and focused
- [ ] Components are thin (delegate to hooks)
- [ ] Business logic in hooks or utilities
- [ ] No duplicated code

#### Project-Specific
- [ ] Uses `queryKeys` factory from `@/lib/queryKeys`
- [ ] Uses `logger` instead of `console.log`
- [ ] Follows patterns from `AGENTS.md`
- [ ] Uses named exports (not default exports for components)

---

### 5. 🧩 Complexity

Is the code simple and maintainable?

#### Cognitive Load
- [ ] Functions are easy to understand at a glance
- [ ] Nesting depth is reasonable (max 3-4 levels)
- [ ] No overly clever code
- [ ] Logic is straightforward

#### Maintainability
- [ ] Future devs can easily modify this
- [ ] Clear separation of concerns
- [ ] Not overly abstracted
- [ ] Not overly coupled

#### Documentation
- [ ] Complex logic has comments explaining "why"
- [ ] Public APIs have JSDoc comments
- [ ] Non-obvious behavior is documented
- [ ] No commented-out code (use git history instead)

---

### 6. 🧪 Testability & Tests

Can this code be tested? Is it tested?

#### Test Coverage
- [ ] Critical paths have tests
- [ ] Edge cases are tested
- [ ] Error scenarios are tested
- [ ] Integration points are tested

#### Test Quality
- [ ] Tests are readable
- [ ] Tests follow Arrange-Act-Assert pattern
- [ ] Tests are isolated (no shared state)
- [ ] Tests are deterministic (no flakiness)

#### Testability
- [ ] Functions are pure where possible
- [ ] Dependencies are injectable
- [ ] Side effects are isolated
- [ ] Easy to mock external dependencies

---

### 7. 🚨 Error Handling

Does the code handle errors gracefully?

#### Error Catching
- [ ] Try-catch blocks around async operations
- [ ] Errors are typed (`error: unknown`)
- [ ] All error paths lead somewhere (no silent failures)

#### Error Reporting
- [ ] Errors logged with `logger.error()` with context
- [ ] User-friendly error messages shown (toast notifications)
- [ ] Stack traces captured for debugging
- [ ] No technical jargon shown to end users

#### Recovery
- [ ] Graceful degradation when services unavailable
- [ ] Retry logic for transient failures
- [ ] Fallback values where appropriate
- [ ] User can recover from error state

---

### 8. ♿ Accessibility & UX

Is the code user-friendly?

#### Accessibility
- [ ] Semantic HTML used
- [ ] Keyboard navigation works
- [ ] ARIA labels where needed
- [ ] Color contrast sufficient

#### User Experience
- [ ] Loading states shown
- [ ] Success/error feedback provided
- [ ] Buttons disabled during operations
- [ ] Forms validate before submission

#### Mobile
- [ ] Responsive design
- [ ] Touch targets large enough (44x44px min)
- [ ] No horizontal scrolling on mobile
- [ ] Works on different screen sizes

---

### 9. 🗃️ Database & State Management

Is data handled correctly?

#### Database Operations
- [ ] Uses TanStack Query for data fetching
- [ ] Queries invalidated after mutations
- [ ] Proper staleTime and gcTime set
- [ ] No direct fetch() calls

#### State Management
- [ ] State is in the right place (local vs global)
- [ ] No unnecessary state
- [ ] State updates are batched when possible
- [ ] React Context used appropriately

#### Multi-Tenancy
- [ ] All queries filter by `tenant_id`
- [ ] RLS policies enforced
- [ ] No cross-tenant data leakage
- [ ] Tenant isolation verified

---

### 10. 🚀 Deployment & Operations

Is this production-ready?

#### Configuration
- [ ] No hardcoded URLs or values
- [ ] Environment variables used correctly
- [ ] No secrets in code
- [ ] Feature flags used if needed

#### Monitoring
- [ ] Important operations are logged
- [ ] Performance metrics captured if critical
- [ ] Errors are trackable

#### Rollback Safety
- [ ] Changes are backward compatible
- [ ] Database migrations are reversible
- [ ] Feature can be toggled off if needed

---

## 🤖 AI Review Prompt

Use this prompt to get an AI code review:

```markdown
# COMPREHENSIVE CODE REVIEW

Role: You are a Senior Software Architect reviewing code for the BigMike Wholesale Platform.

Task: Review the following code using the checklist in CODE_REVIEW_CHECKLIST.md.

Focus on:
1. Correctness (functional requirements, logic, edge cases)
2. Security (injection, auth, data exposure, multi-tenancy)
3. Performance (queries, React renders, memory)
4. Style (TypeScript, naming, imports, organization per AGENTS.md)
5. Complexity (maintainability, cognitive load)
6. Tests (coverage, quality, testability)
7. Error Handling (catching, reporting, recovery)
8. Accessibility & UX
9. Database & State Management
10. Deployment readiness

Output Format:

## Critical Issues (Must fix before merge)
- [File:Line] Description + Why it's critical

## Suggestions (Improvements to consider)
- [File:Line] Description + Expected benefit

## Good Practices (What was done well)
- Description

For each issue, cite specific file paths and line numbers.
```

---

## 📊 Review Severity Levels

### 🔴 Critical (Blocker)
- Security vulnerabilities
- Data loss risks
- Breaking changes
- Violates architecture constraints

**Action**: Must fix before merge

### 🟡 Major (Important)
- Performance issues
- Missing error handling
- Poor test coverage
- Complexity issues

**Action**: Should fix before merge, but can be accepted with plan

### 🟢 Minor (Nice-to-have)
- Style inconsistencies
- Missing comments
- Code could be simpler
- Minor performance improvements

**Action**: Optional, can be addressed in follow-up

---

## 💡 Review Tips

### For Reviewers

1. **Start with Correctness** - Does it work? Everything else is secondary.
2. **Think Like an Attacker** - How could this be exploited?
3. **Question Complexity** - If it's hard to understand, it's wrong.
4. **Verify Edge Cases** - The AI often forgets them.
5. **Check Against Mental Model** - Does it fit the architecture?

### For Code Authors

1. **Self-Review First** - Catch obvious issues before submitting
2. **Provide Context** - Explain "why" in PR description
3. **Link to Tickets** - Connect code to requirements
4. **Add Tests** - Makes review easier and faster
5. **Small PRs** - Easier to review thoroughly

---

## 🔄 Continuous Improvement

After each review, ask:

1. **What patterns cause frequent issues?** → Add to `.cursorrules`
2. **What context is often missing?** → Add to `AGENTS.md`
3. **What edge cases are repeatedly forgotten?** → Add to this checklist
4. **What prompts work well?** → Add to `PROMPTS.md`

This creates a self-improving system.

---

## 📚 Related Files

- **.cursorrules** - AI agent rules (enforces many checklist items)
- **AGENTS.md** - Project context (defines architectural constraints)
- **PROMPTS.md** - Prompt templates (includes review prompts)
- **AI_WORKFLOW_GUIDE.md** - Workflow methodology

---

## ✅ Quick Reference

Before approving any code, ask yourself:

1. ✅ **Works?** (Correctness)
2. ✅ **Safe?** (Security)
3. ✅ **Fast?** (Performance)
4. ✅ **Clean?** (Style)
5. ✅ **Simple?** (Complexity)
6. ✅ **Tested?** (Tests)
7. ✅ **Handles errors?** (Error Handling)
8. ✅ **User-friendly?** (UX)
9. ✅ **Data correct?** (State Management)
10. ✅ **Production-ready?** (Deployment)

If all 10 are "yes" → Approve ✅  
If any critical issues → Request changes 🔴  

---

**Created**: November 21, 2024  
**Source**: AI Coding Course Methodology + Project Standards  
**Status**: Production Ready ✅

