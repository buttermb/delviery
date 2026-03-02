

# Fix: Static Menu Page Showing Raw HTML String

## Problem

The `StaticMenuPage` React component (line 69) calls `supabase.functions.invoke('serve-menu-page')` but has two bugs:
1. It never passes the `token` parameter to the edge function
2. The edge function returns **HTML** (Content-Type: `text/html`), not JSON -- so `supabase.functions.invoke()` returns the raw HTML string as `data`
3. The component then tries to render this HTML string as if it were structured `MenuData`

## Fix

### File: `src/pages/public/StaticMenuPage.tsx`

Remove the edge function call entirely and go straight to `loadMenuDirect(token)`, which queries the database directly and already works correctly. The edge function was designed to serve standalone HTML pages (accessed via direct URL), not to provide JSON data to a React component.

**Change the `fetchMenu` function** (lines 66-103) to simply call `loadMenuDirect(token)`:

```typescript
const fetchMenu = async () => {
  try {
    const result = await loadMenuDirect(token);
    if (cancelled) return;
    if (result) {
      setMenu(result);
      setState('ready');
    } else {
      setState('not_found');
    }
  } catch {
    if (cancelled) return;
    setState('error');
  }
};
```

This removes the unnecessary edge function round-trip and uses the direct database query that returns properly structured data.

## Result

The menu page will load correctly with structured product data rendered by React, instead of showing a raw HTML string.

