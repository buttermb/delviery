# Handoff Command

Preserve context before clearing or switching to a new conversation.

## Usage
Run `/handoff` when:
- Context window is getting full (>50%)
- Switching to a different feature/task
- Ending a work session

## Instructions

Create a handoff document at `.claude/handoff.md` that captures:

1. **Current Task Summary**
   - What was being worked on
   - Current status (in-progress, blocked, complete)

2. **Key Decisions Made**
   - Architecture choices
   - Trade-offs considered
   - Rejected approaches and why

3. **Files Modified**
   - List all files changed in this session
   - Brief description of changes

4. **Open Issues/Blockers**
   - Any errors or bugs encountered
   - Questions that need answering
   - Dependencies on external factors

5. **Next Steps**
   - Immediate next actions
   - Priority order

6. **Context to Preserve**
   - Key code patterns discovered
   - Important file paths
   - Relevant documentation links

## Output Format

Write the handoff document, then confirm with:
"✅ Handoff complete. Run `/clear` and paste contents of `.claude/handoff.md` in your next session."
