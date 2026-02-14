---
name: systematic-debugging
description: Use when encountering any bug, test failure, or unexpected behavior. Follow evidence-based debugging before proposing fixes.
---

# Systematic Debugging Skill

When debugging, NEVER guess. Follow this evidence-based protocol.

## Phase 1: Gather Evidence

1. **Capture the failure**
   - Error messages verbatim
   - Stack traces
   - Console output

2. **Document the symptom**
   - What fails? (timeout, wrong value, exception)
   - When does it fail? (always, intermittently, specific conditions)

## Phase 2: Instrument

**Code reading alone is insufficient. Add instrumentation.**

```typescript
// Add at critical decision points
logger.debug('Checkpoint A', { 
  userId, 
  hasToken: !!token, 
  timestamp: Date.now() 
});

// Add before/after async operations  
logger.debug('Calling API', { endpoint, params });
const result = await api.call(params);
logger.debug('API response', { result, elapsed: Date.now() - start });
```

## Phase 3: Trace Execution

1. Run the code with instrumentation
2. Capture the output
3. Map expected path vs actual path
4. Identify the exact divergence point

```
Expected: A → B → C → D → Success
Actual:   A → B → C → [DIVERGE] → Error
```

## Phase 4: Root Cause Analysis

Only after evidence is gathered:
- Why did it diverge?
- What values differ from expectations?
- Trace backward to find root cause

## Phase 5: Fix

- Propose fix with reference to evidence
- Describe verification steps
- Explain prevention for future

## Anti-Patterns

❌ "This might be the issue" (without evidence)
❌ Proposing fixes before gathering evidence
❌ Skipping instrumentation
❌ Fixing symptoms instead of root cause

## Output Format

```markdown
## Bug Report: [Description]

### Evidence Gathered
- [Screenshot/logs showing the issue]

### Instrumentation Added
- [File:Line] Added logging for X

### Trace Analysis
- Expected: A → B → C
- Actual: A → B → [Error at X]

### Root Cause
- [Specific cause with file:line reference]

### Fix
- [Change with explanation]

### Verification
- [Steps to verify fix works]
```
