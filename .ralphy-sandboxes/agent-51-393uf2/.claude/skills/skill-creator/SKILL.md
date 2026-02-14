---
name: skill-creator
description: Use when creating new skills to extend Claude's capabilities. Guides skill structure, content, and best practices.
---

# Skill Creator

Guide for creating new agent skills that extend Claude's capabilities.

## Core Principles

### Concise is Key
The context window is a public good. Only add context Claude doesn't already have.

**Default assumption: Claude is already very smart.** Challenge each piece of information:
- "Does Claude really need this explanation?"
- "Does this paragraph justify its token cost?"

Prefer concise examples over verbose explanations.

### Set Appropriate Degrees of Freedom

| Freedom Level | When to Use | Example |
|---------------|-------------|---------|
| **High** | Multiple valid approaches | "Write tests for this component" |
| **Medium** | Preferred pattern exists | Pseudocode with parameters |
| **Low** | Operations are fragile | Specific scripts, exact commands |

## Anatomy of a Skill

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description)
│   └── Markdown instructions
└── Optional Resources
    ├── scripts/      - Executable code
    ├── references/   - Detailed documentation
    └── assets/       - Templates, images
```

### SKILL.md Structure

```markdown
---
name: skill-name
description: When to use this skill and what it does. Be specific and comprehensive.
---

# Skill Title

## Overview
Brief description of what this skill enables.

## When to Use
Trigger conditions for this skill.

## The Process
Step-by-step instructions.

## Examples
Concrete, working examples.

## Common Mistakes
What to avoid.
```

## Skill Creation Process

### Step 1: Define the Skill
- What problem does it solve?
- When should Claude use it?
- What's the expected output?

### Step 2: Write the Description
The `description` field in frontmatter is critical - it determines when the skill triggers.

```yaml
---
name: database-migration
description: Use when creating Supabase database migrations. Ensures proper RLS, tenant isolation, naming conventions.
---
```

### Step 3: Write Instructions
- Keep SKILL.md lean (essential info only)
- Use examples over explanations
- Move detailed reference material to `references/`

### Step 4: Test and Iterate
- Use the skill in real scenarios
- Note where Claude struggles
- Add clarifying instructions

## What NOT to Include

❌ README.md, INSTALLATION_GUIDE.md, CHANGELOG.md
❌ User-facing documentation
❌ Setup and testing procedures
❌ Information Claude already knows

## FloraIQ Skill Location

Save new skills to: `.claude/skills/<skill-name>/SKILL.md`
