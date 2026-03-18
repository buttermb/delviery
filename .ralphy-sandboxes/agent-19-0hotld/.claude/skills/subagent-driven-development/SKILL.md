---
name: subagent-driven-development
description: Execute implementation plans by dispatching fresh subagent per task, with two-stage review after each - spec compliance review first, then code quality review. Core principle: Fresh subagent per task + two-stage review = high quality, fast iteration.
---

# Subagent-Driven Development

Execute plan by dispatching fresh subagent per task, with two-stage review after each.

**Core principle:** Fresh subagent per task + two-stage review (spec then quality) = high quality, fast iteration

## When to Use

- Have an implementation plan
- Tasks are mostly independent
- Want to stay in the same session
- Want faster iteration (no human-in-loop between tasks)

**vs. Executing Plans:** Same session, fresh subagent per task, two-stage review, faster iteration.

## The Process

1. **Read plan** - Extract all tasks with full text, note context
2. **Create TodoWrite** - Track all tasks
3. **For each task:**
   - Dispatch implementer subagent with full task text + context
   - Answer any questions from implementer
   - Implementer implements, tests, commits, self-reviews
   - Dispatch spec reviewer subagent → confirms code matches spec
   - If spec issues: implementer fixes → spec reviewer reviews again
   - Dispatch code quality reviewer subagent → approves code
   - If quality issues: implementer fixes → quality reviewer reviews again
   - Mark task complete
4. **After all tasks** - Dispatch final code reviewer
5. **Use finishing-a-development-branch skill**

## Prompt Templates

### Implementer Subagent

Include:
- Full task text from plan
- Context (why this task matters)
- File paths involved
- Dependencies on other tasks
- Clear expected output

### Spec Reviewer Subagent

- Review code against the original spec
- Check: all requirements met?
- Check: nothing extra added (YAGNI)?
- Return: ✅ Spec compliant OR ❌ Issues list

### Code Quality Reviewer Subagent

- Review for code quality (clean code, tests, patterns)
- Return: Strengths, Issues by severity, Approved/Not

## Advantages

**vs. Manual execution:**
- Subagents follow TDD naturally
- Fresh context per task (no confusion)
- Parallel-safe

**Quality gates:**
- Self-review catches issues before handoff
- Two-stage review: spec compliance, then code quality
- Review loops ensure fixes actually work

## Red Flags

**Never:**
- Skip reviews (spec compliance OR code quality)
- Proceed with unfixed issues
- Dispatch multiple implementation subagents in parallel (conflicts)
- Make subagent read plan file (provide full text instead)
- Start code quality review before spec compliance is ✅
- Move to next task while either review has open issues

**If subagent asks questions:**
- Answer clearly and completely
- Don't rush them into implementation

**If reviewer finds issues:**
- Implementer fixes them
- Reviewer reviews again
- Repeat until approved

## Integration

**Pairs with:**
- `writing-plans` - Creates the plan to execute
- `finishing-a-development-branch` - Called when all tasks complete
