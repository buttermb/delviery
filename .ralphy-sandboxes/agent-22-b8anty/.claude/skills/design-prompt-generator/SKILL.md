---
name: design-prompt-generator
description: Advanced 7-step hierarchical design prompt generator for AI web development tools (Lovable, Cursor, Bolt). Generates domain-aware, user-journey-based design prompts with emotional design considerations. Use when creating landing pages, web apps, or designing new interfaces.
---

# Design Prompt Generator

7-step framework for generating comprehensive design prompts for AI web development tools.

## 7-Step Framework

```
Step 1: Domain Research      → Industry UX patterns, competitor insights
Step 2: User Journey         → Core user flows, conversion points
Step 3: Emotional Design     → Emotion keywords, mood concept
Step 4: Identity & Goal      → Brand identity, objectives
Step 5: Design System        → Colors, typography, components
Step 6: Component Specs      → Core component definitions
Step 7: Micro-interactions   → Animations, interaction patterns
```

## Step 1: Domain Research

Analyze industry UX patterns and competitors.

**Questions to Explore:**
- What are the Top 3 apps/sites in this domain?
- What UX patterns do users expect? (e.g., dating app swipes, delivery app cards)
- What are the important trust signals? (reviews, badges, guarantees)
- What pain points haven't competitors solved?

**Domain Patterns:**

| Domain | Expected Pattern | Trust Signals | Core Action |
|--------|-----------------|---------------|-------------|
| E-commerce | Grid gallery, filters, cart | Reviews, return policy | Browse → Add → Pay |
| SaaS | Feature comparison, pricing, demo CTA | Logos, testimonials | Learn → Try → Subscribe |
| Marketplace | Seller profiles, listings, messaging | Verification, history | Search → Contact → Deal |
| Healthcare | Provider search, appointment slots | License, hospital affiliation | Find → Book → Consult |
| Fintech | Dashboard, transaction history | Encryption badges, compliance | Connect → Monitor → Execute |
| Food Delivery | Restaurant cards, real-time tracking | Ratings, delivery time | Browse → Order → Track |

## Step 2: User Journey

Map core user flows and conversion points.

```
[Entry] → [Discovery] → [Evaluation] → [Decision] → [Action] → [Retention]
```

**For each stage define:**
```
Journey Stage: [Stage Name]
├── User Goal: What they want to achieve
├── Key Info: Information needed
├── Friction: Drop-off factors
└── Solution: Design solution
```

## Step 3: Emotional Design

Define the emotions the design should evoke.

| Emotion | Visual Expression | Color Direction | Typography | Imagery |
|---------|------------------|-----------------|------------|---------|
| Trust | Clean, organized, consistent | Blue, Green | Stable serif/clean sans | Real photos, badges |
| Warmth | Soft corners, organic shapes | Warm yellow, orange | Rounded, friendly | Illustrations, smiles |
| Energy | Strong contrast, dynamic angles | Vivid red, orange | Bold, impactful | Action shots, motion |
| Calm | Whitespace, minimal | Soft blue, green, neutral | Light weight | Nature, minimal |
| Luxury | Dark backgrounds, gold accents | Black, gold, deep purple | Elegant serif | High-end photos |
| Playful | Asymmetry, animation | Bright varied palette | Quirky, custom | Illustrations, icons |
| Professional | Grid-based, structural | Navy, gray, white | Classic sans-serif | Corporate, clean |

**Define emotion ratio:** e.g., 60% Trust, 30% Warmth, 10% Energy

## Step 4: Identity & Goal

**Template:**
```
Service Name: [Name]
One-liner: [10-word description]
Category: [Domain category]
Positioning: [Differentiator from competitors]
Primary Goal: [Main conversion action]
Secondary Goal: [Secondary action]
Brand Personality: [3 adjectives]
```

## Step 5: Design System

**Color System:**
```
Primary:      #[hex] - CTAs, core actions
Secondary:    #[hex] - Supporting elements
Accent:       #[hex] - Highlights, badges
Background:   #[hex] - Base canvas
Surface:      #[hex] - Cards, elevated elements
Text Primary: #[hex] - Headings, body
Text Muted:   #[hex] - Captions, hints
Success:      #[hex] - Confirmations
Warning:      #[hex] - Warnings
Error:        #[hex] - Errors
```

**Typography:**
```
Headings: [Font] - [Weight] - [Characteristics]
Body: [Font] - [Weight] - [Line-height]
Scale: [base]px, ratio [ratio]
```

**Spacing & Layout:**
```
Base unit: [4/8]px
Border radius: [size]px
Shadow: subtle/medium/strong
Grid: [columns] columns, [gap]px gap
Container: max-width [width]px
```

## Step 6: Component Specs

**Component Template:**
```
[Component Name]
├── Purpose: Why it exists
├── Contents: Information displayed
├── States: Default, Hover, Active, Disabled, Loading
├── Variants: Different versions needed
└── Responsive: Mobile adaptation
```

## Step 7: Micro-interactions

| Type | Purpose | Example |
|------|---------|---------|
| Entrance | Draw attention to new content | Fade in, Slide up, Scale in |
| Feedback | Confirm user action | Button press, success checkmark |
| State Change | Show transition | Loading spinner, skeleton |
| Navigation | Guide between views | Page transition, drawer slide |
| Delight | Memorable moments | Confetti, bounce |

**Recommended Defaults:**
- Micro-feedback: 150-200ms, ease-out
- Transitions: 250-350ms, ease-in-out
- Entrances: 400-600ms, ease-out + stagger

## Output Format

```markdown
# [Service Name] Design Prompt

## Domain Context
[Industry insights, user expectations, competitive landscape]

## User Journey
[Stage-by-stage flow with design implications]

## Emotional Direction
[Primary emotions, visual interpretation]

## Design Specifications

### Identity
[Name, positioning, personality]

### Design System
[Full color, typography, spacing specs]

### Key Components
[Domain-specific component definitions]

### Interactions
[Animation, micro-interaction specs]

## Implementation Prompt
[Copy-paste prompt for AI tools]
```

## Quality Checklist

- [ ] Domain-specific UX patterns reflected
- [ ] User journey stages inform structure
- [ ] Emotion keywords translated to visual specs
- [ ] Color system complete (with purpose)
- [ ] Core component states defined
- [ ] Micro-interactions specified
- [ ] Mobile responsive considered
- [ ] Implementation prompt copy-pasteable
