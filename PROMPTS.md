# 📝 AI Prompt Templates Library

This document contains proven prompt templates from the AI Coding Course methodology. Use these templates in Cursor to enforce rigorous, evidence-based development practices.

---

## 🎯 Planning Mode Prompt

Use this when you need the AI to think through a problem before generating code.

```markdown
# PLANNING MODE - READ ONLY

You are in PLANNING MODE. You are FORBIDDEN from generating code or implementing changes.

Your Goal: Produce a detailed, step-by-step plan to solve the user's request.

Process:

1. **Research**: List the files you need to read to understand the context.
   (Wait for me to provide them or read them if you have tool access)

2. **Architecture**: Describe the architectural pattern you will use.
   Does it match the existing AGENTS.md guidelines?

3. **Steps**: Break down the implementation into atomic steps.

4. **Verification**: For each step, define how you will verify it works
   (e.g., "Run test X", "Check output Y")

Do not output code blocks. Output a structured plan in Markdown.
```

**When to Use**: Complex features, unclear requirements, before large refactors

---

## 🔬 Evidence-Based Debugging Protocol

Use this when encountering errors or unexpected behavior.

```markdown
# EVIDENCE-BASED DEBUGGING PROTOCOL

ERROR CONTEXT:
[Paste error message, stack trace, or description of issue here]

YOUR MISSION: Use code research to analyze the error above. Do NOT guess. Do NOT propose a fix yet.

## PHASE 1: INVESTIGATE

1. Read relevant source files (src/auth/jwt.ts, etc.) and trace the code path
2. Examine the specific location of the failure in the stack trace
3. Identify the surrounding architecture and data flow

## PHASE 2: ANALYZE

4. Compare **Expected Behavior** vs **Actual Behavior**
5. Identify the **Root Cause**
6. Determine if this is an isolated incident or a systemic pattern

## PHASE 3: EXPLAIN

Provide a Root Cause Analysis with HARD EVIDENCE:
- File paths and line numbers
- Actual values from the logs (e.g., `port: 8080`)
- Specific identifiers

## PHASE 4: PROPOSE

Only AFTER the evidence is presented, propose a fix.
Explain:
- What will change
- Why it fixes the root cause
- How to verify the fix works
```

**When to Use**: Any error, unexpected behavior, failing tests

---

## ✅ Comprehensive Code Review

Use this to get thorough code reviews from the AI.

```markdown
# COMPREHENSIVE CODE REVIEW

Role: You are a Senior Software Architect.

Task: Review the following code for correctness, security, style, and maintainability.

## Review Checklist:

1. **Correctness**: Does the code meet the functional requirements? Are there logical errors?

2. **Security**: Check for:
   - Injection vulnerabilities (SQL, XSS, etc.)
   - Data exposure (logging sensitive info, etc.)
   - Improper authentication/authorization

3. **Performance**: Identify:
   - Unnecessary re-renders
   - N+1 queries
   - Memory leaks
   - Inefficient algorithms

4. **Style**: Does it adhere to:
   - The patterns defined in AGENTS.md?
   - TypeScript best practices?
   - Project conventions?

5. **Complexity**: Is the code overly complex? Can it be simplified?

6. **Edge Cases**: What edge cases are not handled?

## Output Format:

### Critical Issues (Must fix before merge)
- [File:Line] Description

### Suggestions (Improvements to consider)
- [File:Line] Description

### Good Practices (What was done well)
- Description

For each issue, cite the specific file and line number.
```

**When to Use**: Before merging, after major changes, code audits

---

## 🐛 Edge Case Discovery

Use this to proactively identify potential failure modes.

```markdown
# EDGE CASE DISCOVERY

Target: [Function/Feature Name]

Task: Identify potential edge cases that could break this implementation.

## Categories to Explore:

1. **Input Extremes**:
   - Empty strings, null, undefined
   - Maximum integers, negative numbers, zero
   - Special characters, Unicode
   - Arrays: empty, single item, very large

2. **State Conflicts**:
   - Race conditions (rapid-fire requests)
   - Network timeouts or failures
   - Concurrent modifications
   - Stale data

3. **User Behavior**:
   - Malicious inputs (injection attempts)
   - Unexpected workflow sequences
   - Browser back/forward navigation
   - Page refresh during operation

4. **System Limits**:
   - Database connection pool exhaustion
   - Memory constraints
   - API rate limits
   - Storage quotas

## Output:

List 5-10 specific test cases we should write to guard against these failures.

Format:
- **Test**: "Should handle empty array"
- **Setup**: Empty products array
- **Expected**: Returns default message "No products found"
```

**When to Use**: After implementing features, during security audits, before prod deployment

---

## 🚀 Context Bootstrapping

Use this to have the AI generate its own AGENTS.md file.

```markdown
# CONTEXT BOOTSTRAPPING

Generate AGENTS.md for this project.

## Phase 1: Research

Use the code research tool to learn:
1. Project architecture (frontend/backend frameworks, design patterns)
2. Tech stack (languages, libraries, versions)
3. Authentication patterns (how users log in, session management)
4. Testing conventions (test framework, coverage requirements)
5. Coding style (formatting, naming conventions)
6. Deployment process (build commands, environment setup)

Use ArguSeek to fetch:
- Best practices for this specific tech stack
- Latest security guidelines
- Framework-specific conventions

## Phase 2: Synthesize

Create a concise file (≤500 lines) with sections:

1. **Tech Stack**: List the frameworks, versions
2. **Development Commands**: How to dev, test, build, deploy
3. **Architecture**: High-level system design
4. **Coding Conventions**: Style rules, patterns
5. **Critical Constraints**: Things agents must never do
6. **Common Pitfalls**: Known issues, gotchas

## Phase 3: Optimize

DO NOT duplicate information from README.md.

Focus ONLY on what YOU (the agent) need to know to operate effectively.

Make it machine-readable, not human-friendly.
```

**When to Use**: New projects, onboarding to existing projects

---

## 📐 Exact Planning Template

Use this when you know exactly what needs to be done.

```markdown
# EXACT PLANNING

Add rate limiting to `/api/*` endpoints using Redis.

## Requirements:
- Pattern: Follow `src/middleware/auth.ts`
- Limits: 1000 req/hour for authenticated users, 100 req/hour for anonymous
- Return 429 status when exceeded
- Include `Retry-After` header

## Implementation:
1. Create `src/middleware/rateLimit.ts`
2. Use `ioredis` for Redis connection
3. Key format: `ratelimit:{userId|ip}:{endpoint}`
4. TTL: 1 hour (3600 seconds)

## Files to Modify:
- `src/middleware/rateLimit.ts` (create)
- `src/server.ts` (add middleware)
- `package.json` (add ioredis dependency)

## Verification:
- Unit test: `npm test src/middleware/rateLimit.test.ts`
- Manual test: Make 101 requests to `/api/products` and verify 429 on 101st

Execute this plan.
```

**When to Use**: Clear requirements, well-defined scope, time-sensitive tasks

---

## 🔍 Exploration Planning Template

Use this when the path forward is unclear.

```markdown
# EXPLORATION PLANNING

Investigate why the rate limiter is failing under high load.

## Investigation Areas:

1. **Redis Connection Pool**:
   - Check current pool size
   - Review timeout settings
   - Look for connection leaks

2. **Key Expiration**:
   - Verify TTL is being set correctly
   - Check for key collisions
   - Review eviction policy

3. **Race Conditions**:
   - Analyze increment logic
   - Check for atomic operations
   - Review error handling

## Deliverables:

1. Root Cause Analysis (with evidence)
2. 3 Proposed Solutions (with tradeoffs)
3. Recommended approach
4. Implementation plan

Take your time. This is exploratory, not time-sensitive.
```

**When to Use**: Debugging complex issues, performance problems, unclear requirements

---

## 🧪 Test Generation Prompt

Use this to generate comprehensive tests.

```markdown
# TEST GENERATION

Generate tests for: [Component/Function Name]

## Test Coverage Requirements:

1. **Happy Path**: Normal, expected usage
2. **Edge Cases**: Empty inputs, null, undefined, extremes
3. **Error Cases**: Network failures, validation errors, exceptions
4. **Integration**: Interactions with other components

## Test Structure:

Use the project's test framework (check AGENTS.md).

Follow the Arrange-Act-Assert pattern:
```typescript
it('should handle empty product list', () => {
  // Arrange
  const products = [];
  
  // Act
  const result = calculateTotal(products);
  
  // Assert
  expect(result).toBe(0);
});
```

## Coverage Goal:

Aim for 80%+ line coverage on critical paths.

Generate tests now.
```

**When to Use**: After implementing features, TDD, CI/CD setup

---

## 🎨 Refactoring Prompt

Use this for safe, systematic refactoring.

```markdown
# REFACTORING PLAN

Target: [File/Function to Refactor]

Goal: [Improve readability / performance / testability]

## Phase 1: Understand Current State

1. Read the current implementation
2. Identify all callers/dependencies
3. Document current behavior (with examples)

## Phase 2: Design Improvements

1. Propose new structure
2. Explain benefits
3. List risks/tradeoffs

## Phase 3: Incremental Steps

Break refactoring into safe, atomic commits:
1. Step 1 (e.g., "Extract helper function")
2. Step 2 (e.g., "Replace conditional with polymorphism")
3. Step 3 (e.g., "Update tests")

Each step should:
- Be independently verifiable
- Not break existing tests
- Be reversible

## Phase 4: Validation

After each step:
- Run tests: `npm test`
- Check types: `npm run type-check`
- Verify behavior unchanged

Do NOT proceed to next step until current step is verified.
```

**When to Use**: Technical debt reduction, performance optimization, code cleanup

---

## 🔄 Migration Planning

Use this for database or API migrations.

```markdown
# MIGRATION PLANNING

Migrating from [Old System] to [New System]

## Risk Assessment:

1. **Data Loss Risk**: [Low/Medium/High]
2. **Downtime Required**: [None/Minutes/Hours]
3. **Rollback Complexity**: [Easy/Medium/Hard]

## Migration Strategy:

Choose one:
- **Big Bang**: Switch all at once (high risk, fast)
- **Strangler Pattern**: Gradual replacement (low risk, slow)
- **Parallel Run**: Run both systems simultaneously (safest, expensive)

## Steps:

1. **Preparation**:
   - Backup current data
   - Set up new system
   - Write migration scripts

2. **Migration**:
   - Execute scripts
   - Verify data integrity
   - Update application code

3. **Validation**:
   - Compare old vs new outputs
   - Run smoke tests
   - Monitor for errors

4. **Rollback Plan** (if needed):
   - Restore from backup
   - Revert code changes
   - Verify system operational

## Timeline:

- Preparation: [X days]
- Migration: [X hours]
- Validation: [X days]

Proceed with detailed planning?
```

**When to Use**: Schema changes, API version updates, tech stack upgrades

---

## 💡 Usage Tips

1. **Copy-Paste Templates**: Copy these templates directly into Cursor chat
2. **Customize**: Replace `[placeholders]` with your specific context
3. **Combine**: Use multiple templates in sequence (Plan → Execute → Review)
4. **Iterate**: If results aren't good, add more context and regenerate
5. **Save Favorites**: Keep your most-used templates in a scratch file

---

## 🔗 Related Files

- `.cursorrules` - AI agent persona and operational rules
- `AGENTS.md` - Project-specific context
- `AI_WORKFLOW_GUIDE.md` - Detailed workflow explanation
- `CODE_REVIEW_CHECKLIST.md` - Review standards

---

**Created**: November 21, 2024  
**Source**: AI Coding Course Methodology  
**Status**: Production Ready ✅

