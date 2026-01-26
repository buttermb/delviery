

# Scrolling Issue Analysis: Marketing Page

## Root Cause Identified

The marketing page (`/marketing`) cannot scroll due to **conflicting CSS overflow and positioning rules** combined with **the current build errors** preventing proper compilation.

---

## Primary Issues

### 1. Build Errors Blocking Compilation
The app currently has **50+ TypeScript build errors** that must be resolved before the page can function correctly. These errors are preventing the JavaScript from compiling and executing properly, which can cause the page to render in a broken state where scroll handlers don't attach.

### 2. CSS Conflict: Mobile Overflow Rules
In `src/index.css` (lines 94-100), there's a problematic combination:

```css
@media (max-width: 1024px) {
  html,
  body {
    overflow-x: hidden;
    position: relative;  /* ← This can break scrolling */
    width: 100%;
    max-width: 100vw;
  }
}
```

The `position: relative` on `body` combined with `overflow-x: hidden` on both `html` and `body` can create scroll context issues on iOS Safari and some Android browsers.

### 3. Viewport Meta Tag
In `index.html` (line 10):
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
```

The `user-scalable=no` and `maximum-scale=1` can cause scrolling issues on iOS 10+ and some browsers.

---

## Solution Plan

### Phase 1: Fix Build Errors (Required First)
Before addressing the CSS issues, the ~50+ build errors must be resolved. The app cannot function correctly while failing to compile.

**Key error categories to fix:**
- Test file mock type mismatches (`useCreditGatedAction.test.tsx`)
- Database schema mismatches (missing columns in queries)
- Missing type definitions (`FreeAction`, sanitize functions)
- Component property errors

### Phase 2: Fix CSS Scroll Blocking

**File: `src/index.css`**

1. Remove `position: relative` from the mobile media query for body
2. Ensure `overflow-y: auto` is explicitly set on body

```css
/* Before (problematic) */
@media (max-width: 1024px) {
  html, body {
    overflow-x: hidden;
    position: relative;  /* REMOVE THIS */
    width: 100%;
    max-width: 100vw;
  }
}

/* After (fixed) */
@media (max-width: 1024px) {
  html {
    overflow-x: hidden;
    max-width: 100vw;
  }
  body {
    overflow-x: hidden;
    overflow-y: auto;  /* Explicitly allow vertical scroll */
    width: 100%;
  }
}
```

### Phase 3: Update Viewport Meta (Optional)

**File: `index.html`**

Modernize the viewport meta tag to be more scroll-friendly:

```html
<!-- Before -->
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />

<!-- After -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

---

## Recommended Approach

1. **First**: Continue fixing the remaining build errors (I've already fixed many, but ~50+ remain)
2. **Second**: Apply the CSS fix to `src/index.css`
3. **Third**: Optionally update the viewport meta tag

---

## Technical Notes

- The `ForceLightMode` wrapper and `SectionTransition` components are working correctly
- The `ScrollProgressIndicator` is properly positioned with `fixed` and high z-index
- The framer-motion animations use `will-change: transform` which is appropriate
- The heavy blur effects are correctly disabled on mobile via CSS media queries

