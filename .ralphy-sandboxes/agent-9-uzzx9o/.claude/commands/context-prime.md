# Context Prime Command

Prime Claude with comprehensive project understanding at the start of a session.

## Usage
Run `/context-prime` at the beginning of a work session or after context gets low.

## Instructions

Load the following files to establish project context:

### 1. Core Configuration
```bash
# Read these files
cat CLAUDE.md
cat .cursorrules
cat README.md
cat package.json
```

### 2. Project Structure
```bash
# List key directories
ls -la src/pages/admin/
ls -la src/components/
ls -la supabase/functions/
ls -la supabase/migrations/ | tail -10
```

### 3. Skills & Agents
```bash
# List available skills
ls .claude/skills/

# List available agents
ls .claude/agents/

# List available commands
ls .claude/commands/
```

### 4. Recent Changes (Optional)
```bash
# Last 5 commits
git log --oneline -5

# Current branch status
git status
```

## Output Summary

After loading context, present:

```markdown
## Context Loaded ✅

### Project: FloraIQ
Multi-tenant B2B cannabis distribution platform

### Tech Stack
- React 18 + TypeScript + Vite
- Supabase (PostgreSQL + Edge Functions)
- TanStack Query + shadcn/ui

### Available Skills (X)
[List skills by name]

### Available Agents (X)
[List agents by name]

### Available Commands (X)
[List commands by name]

### Recent Activity
- [Last 3 commits]

### Ready For
What would you like to work on?
```

## When to Use

- Starting a new work session
- After running `/clear` or `/compact`
- When context window is getting full
- When switching to a different area of the codebase
