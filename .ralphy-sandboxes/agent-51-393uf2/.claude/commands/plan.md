# Plan Command

Create a structured implementation plan before coding.

## Usage
Run `/plan [feature description]` when starting a new feature or complex task.

## Instructions

### Phase 1: Research
1. **Understand the request** - What exactly needs to be built?
2. **Find related code** - Search for similar patterns in the codebase
3. **Check existing components** - What can be reused?
4. **Identify dependencies** - What tables, hooks, types exist?

### Phase 2: Architecture
1. **List files to create/modify**
2. **Define data model** (if database changes needed)
3. **Outline component hierarchy**
4. **Identify potential edge cases**

### Phase 3: Output Plan

```markdown
# Plan: [Feature Name]

## Objective
[1-2 sentence description]

## Research Findings
- Found [pattern] in [file]
- Can reuse [component/hook]
- Needs new [table/RPC/component]

## Proposed Changes

### Database (if applicable)
- [ ] Migration: `YYYYMMDDHHMMSS_description.sql`
  - New table: [name]
  - RLS policies: [description]

### Backend (if applicable)  
- [ ] Edge function: [name]
  - Purpose: [description]

### Frontend
- [ ] New component: `src/components/[path].tsx`
- [ ] Modify: `src/pages/[path].tsx`
- [ ] New hook: `src/hooks/use[Name].ts`

### Types
- [ ] Add to `src/types/[file].ts`

## Edge Cases to Handle
1. [Empty state scenario]
2. [Error scenario]
3. [Permission scenario]

## Verification Steps
1. [ ] TypeScript compiles: `npm run build`
2. [ ] Lint passes: `npm run lint`
3. [ ] Test in browser: [specific flows to test]

## Questions/Blockers
- [Any clarification needed?]
```

## After Approval
Once the user approves the plan, proceed to implementation following the checklist.
