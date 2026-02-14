---
name: git-worktrees
description: Use when setting up an isolated workspace for parallel development. Creates git worktrees for working on multiple branches simultaneously.
---

# Using Git Worktrees

## Overview

Git worktrees create isolated workspaces sharing the same repository, allowing work on multiple branches simultaneously without switching.

**Core principle:** Systematic directory selection + safety verification = reliable isolation.

## When to Use

- Working on a feature while fixing a bug in parallel
- Testing changes without disturbing your current branch
- Reviewing PRs while keeping your work intact
- Creating a clean environment for experiments

## Creating a Worktree

### Step 1: Create Branch and Worktree

```bash
# Create a new branch with worktree
git worktree add ../floraiq-feature-name -b feature/feature-name

# Or use existing branch
git worktree add ../floraiq-bugfix bugfix/issue-123
```

### Step 2: Navigate and Setup

```bash
cd ../floraiq-feature-name

# Install dependencies
npm install

# Verify clean baseline
npm run build
npm test
```

### Step 3: Work in Isolation

Now you have a completely separate directory with its own branch. Changes here don't affect your main working directory.

## Directory Structure

```
~/Projects/
├── delviery-main/           # Main working directory (main branch)
├── floraiq-feature-auth/    # Worktree (feature/auth branch)
└── floraiq-bugfix-123/      # Worktree (bugfix/123 branch)
```

## Quick Reference

| Command | Purpose |
|---------|---------|
| `git worktree list` | Show all worktrees |
| `git worktree add <path> <branch>` | Create worktree |
| `git worktree add <path> -b <new-branch>` | Create with new branch |
| `git worktree remove <path>` | Remove worktree |
| `git worktree prune` | Clean up stale references |

## Common Workflow

```bash
# 1. Create worktree for feature
git worktree add ../floraiq-new-feature -b feature/new-feature

# 2. Work in worktree
cd ../floraiq-new-feature
npm install
# ... make changes ...

# 3. When done, merge to main
git push -u origin feature/new-feature
# Create PR

# 4. Clean up after merge
cd ../delviery-main
git worktree remove ../floraiq-new-feature
```

## Safety Notes

- Always verify `npm run build` passes before starting work
- Each worktree has its own node_modules (run `npm install`)
- Don't delete worktree directories manually - use `git worktree remove`
