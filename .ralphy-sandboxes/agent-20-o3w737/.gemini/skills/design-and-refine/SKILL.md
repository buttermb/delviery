---
name: design-and-refine
description: Generate multiple UI variations, compare side-by-side, iterate with feedback until confident
---

# Design and Refine

Generate multiple distinct UI variations for any component or page, compare them side-by-side in the browser, collect feedback, and synthesize a refined version.

## When to Use

- Starting a new component or page
- Redesigning existing UI
- Stuck on a design direction
- Getting stakeholder buy-in
- Learning what works in your codebase

## Workflow

### 1. Preflight Detection

Detect the project's framework and styling:

```bash
# Check for framework
ls package.json next.config.* vite.config.* 2>/dev/null

# Check package.json for dependencies
cat package.json | grep -E "(next|vite|react|tailwind|mui|chakra)"
```

Supported:
- **Frameworks**: Next.js, Vite, Remix, Astro, CRA
- **Styling**: Tailwind CSS, CSS Modules, MUI, Chakra, Ant Design, styled-components, Emotion

### 2. Style Inference

Read existing design tokens:

```bash
# Tailwind config
cat tailwind.config.js tailwind.config.ts 2>/dev/null

# CSS variables
grep -r "var(--" src/index.css src/globals.css 2>/dev/null | head -50

# Theme files
cat src/theme.ts src/lib/theme.ts 2>/dev/null
```

### 3. Interview Questions

Before generating variations, ask about:

1. **What are you designing?**
   - Component vs full page
   - New design vs redesign
   - Target file path

2. **Pain points** (if redesign)
   - What's wrong with current design?
   - What should improve?

3. **Inspiration**
   - Any products to reference? (e.g., "Linear's density", "Stripe's clarity")
   - Visual style preferences

4. **Target user & key tasks**
   - Who uses this?
   - What's the primary action?

### 4. Generate 5 Variations

Create `.claude-design/` directory with variants exploring:

| Dimension | Options |
|-----------|---------|
| Information hierarchy | Progressive disclosure, flat, tabbed |
| Layout model | Cards, lists, tables, split-pane, grid |
| Density | Compact, comfortable, spacious |
| Interaction | Modal, inline, drawer, accordion |
| Visual expression | Minimal, decorative, bold |

**File structure:**
```
.claude-design/
├── variant-1.tsx
├── variant-2.tsx
├── variant-3.tsx
├── variant-4.tsx
├── variant-5.tsx
└── design-brief.md
```

### 5. Create Comparison Route

**For Next.js App Router:**
```tsx
// app/__design_lab/page.tsx
import Variant1 from '@/.claude-design/variant-1';
import Variant2 from '@/.claude-design/variant-2';
// ... etc

export default function DesignLab() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 p-8">
      <div className="border rounded-lg p-4">
        <h2 className="font-bold mb-4">Variant 1: [Name]</h2>
        <Variant1 />
      </div>
      {/* ... repeat for all variants */}
    </div>
  );
}
```

**For Vite/CRA:**
```tsx
// src/pages/__design_lab.tsx or add route to router
```

### 6. Review & Feedback Loop

Direct user to: `http://localhost:3000/__design_lab` (or their dev port)

Collect feedback:
- **"I like variant 3"** → Select it, offer minor tweaks
- **"I like the header from 1 and the layout from 4"** → Synthesize a new version combining those elements
- **"None of these work"** → Ask what's missing, generate new batch

### 7. Finalize

When user is confident:

1. **Clean up temporary files:**
   ```bash
   rm -rf .claude-design/
   rm -rf app/__design_lab/ pages/__design_lab.tsx src/pages/__design_lab.tsx
   ```

2. **Generate DESIGN_PLAN.md:**
   ```markdown
   # Design Plan: [Component Name]
   
   ## Chosen Direction
   [Description of final design]
   
   ## Implementation Steps
   1. ...
   2. ...
   
   ## Component API
   ```tsx
   interface Props {
     // ...
   }
   ```
   
   ## Accessibility Checklist
   - [ ] Keyboard navigation
   - [ ] ARIA labels
   - [ ] Color contrast
   - [ ] Focus management
   
   ## Testing Guidance
   - Unit tests for...
   - E2E tests for...
   ```

3. **Apply to target file** or provide code for user to integrate

## Commands

### Start Session
```
/design-and-refine LoginPage
```

### Cleanup (if aborted)
```bash
rm -rf .claude-design/ app/__design_lab/ pages/__design_lab.tsx
```

## Tips

- **Be specific in interview** — pain points, users, inspiration = better variations
- **Reference products** — "Like Linear's density" gives concrete direction
- **Iterate** — synthesis step is where magic happens
- **Keep dev server running** — user should have `npm run dev` in another terminal

## Example Session

```
User: /design-and-refine ProfileCard

Agent: I'll help you design the ProfileCard. Let me ask a few questions:

1. Is this a new component or redesign of an existing one?
2. What's the primary user action on this card?
3. Any products with profile cards you admire?

User: Redesign. Current one is too dense. Users mainly click to view full profile. I like how Linear shows user info.

Agent: Great! I'm generating 5 variations exploring:
- V1: Minimal - just avatar, name, role
- V2: Expanded - includes status, last activity
- V3: Interactive - hover reveals actions
- V4: Card grid - optimized for list view
- V5: Split - avatar left, info right, actions bottom

Open http://localhost:3000/__design_lab to compare.
Which elements resonate with you?
```
