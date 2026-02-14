---
name: verification-before-completion
description: Use when about to claim work is complete, fixed, or passing. Requires running verification commands and confirming output before making any success claims.
---

# Verification Before Completion

## Overview

Claiming work is complete without verification is dishonesty, not efficiency.

**Core principle:** Evidence before claims, always.

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this message, you cannot claim it passes.

## The Gate Function

```
BEFORE claiming any status:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = not verifying
```

## Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | `npm test` output: 0 failures | Previous run, "should pass" |
| Lint clean | `npm run lint`: 0 errors | Partial check |
| Build succeeds | `npm run build`: exit 0 | Lint passing |
| Bug fixed | Original symptom test passes | Code changed, assumed fixed |

## Red Flags - STOP

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Done!")
- About to commit/push/PR without verification
- Relying on partial verification
- **ANY wording implying success without verification**

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence ≠ evidence |
| "Just this once" | No exceptions |
| "Lint passed" | Lint ≠ build ≠ tests |

## Key Patterns

**Tests:**
```
✅ [Run npm test] [See: 34/34 pass] "All tests pass"
❌ "Should pass now" / "Looks correct"
```

**Build:**
```
✅ [Run npm run build] [See: exit 0] "Build passes"
❌ "Lint passed" (lint ≠ build)
```

**Requirements:**
```
✅ Re-read plan → Create checklist → Verify each → Report
❌ "Tests pass, done"
```

## When To Apply

**ALWAYS before:**
- ANY success/completion claims
- Committing, PR creation, task completion
- Moving to next task

## The Bottom Line

**No shortcuts for verification.**

Run the command. Read the output. THEN claim the result.

This is non-negotiable.
