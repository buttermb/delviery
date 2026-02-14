---
name: todo-management
description: Manage todo.md for complex multi-step tasks. Use when working on features requiring multiple files, migrations, or coordinated changes. Reciting objectives prevents context drift.
---

# Todo Management Skill

Use `todo.md` to track progress on complex tasks. This prevents "lost in the middle" issues by reciting objectives at the end of context.

## When to Create todo.md

- Tasks requiring 5+ file changes
- Multi-step migrations or refactors
- Features spanning frontend + backend
- Debugging sessions with multiple hypotheses

## File Location

Always create at project root: `./todo.md`

## Template

```markdown
# [Feature/Task Name]

**Started:** [timestamp]
**Status:** 🟡 In Progress | 🟢 Complete | 🔴 Blocked

## Objective
[1-2 sentence description of what we're building]

## Progress

### Phase 1: [Name]
- [x] Completed step
- [/] In progress step
- [ ] Pending step

### Phase 2: [Name]
- [ ] Step 1
- [ ] Step 2

## Files Modified
| File | Change |
|------|--------|
| `path/to/file.ts` | Added X function |

## Decisions Made
- **Choice:** [What was decided]
  - **Why:** [Reasoning]

## Blockers
- [ ] [Blocker description]

## Next Action
> [Immediate next step to take]
```

## Update Frequency

Update todo.md:
- After completing each sub-task
- When encountering blockers
- Before any `/compact` or session end
- Every 5-10 tool calls on long tasks

## Benefits

1. **Prevents context drift** - Objectives stay in recent attention
2. **Survives compaction** - Markdown files are preserved
3. **Handoff ready** - New sessions can resume from todo.md
4. **Audit trail** - Documents decisions for future reference

## Commands

- Create: "Create a todo.md for [task]"
- Update: "Update todo.md with progress"
- Review: "Show me the current todo.md status"
