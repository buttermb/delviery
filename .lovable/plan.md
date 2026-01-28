
# Fix Storefront Issues Plan

## Overview
Based on my thorough exploration of the storefront codebase, I've identified several issues that need to be fixed to ensure the storefront works correctly. This plan addresses infrastructure issues, typos, and ensures consistent behavior across the customer-facing storefront.

---

## Issues Identified

### 1. Critical: Stale Supabase URL in index.html
**Location**: `index.html` lines 33-34
**Impact**: Slower page loads due to unnecessary DNS prefetch/preconnect to wrong server

The preconnect and dns-prefetch hints still reference the old Supabase project URL:
```html
<link rel="preconnect" href="https://mtvwmyerntkhrcdnhahp.supabase.co" crossorigin />
<link rel="dns-prefetch" href="https://mtvwmyerntkhrcdnhahp.supabase.co" />
```

**Fix**: Update to the correct Lovable Cloud URL: `https://aejugtmhwwknrowfyzie.supabase.co`

---

### 2. Typo in CartPage.tsx
**Location**: `src/pages/shop/CartPage.tsx` line 237
**Impact**: Poor UX - button shows misspelled text

The empty cart CTA button has a typo:
```tsx
Continuue Shopping  // Should be "Continue Shopping"
```

**Fix**: Correct the spelling to "Continue Shopping"

---

### 3. MobileBottomNav Has 6 Columns But Only 5 Items Defined
**Location**: `src/components/shop/MobileBottomNav.tsx` line 44
**Impact**: Layout confusion - the nav has 5 items + 1 theme toggle button

The grid has `grid-cols-5` but there's a 6th element (theme toggle). This works but layout may be affected.

**Fix**: Change to `grid-cols-6` to accommodate the theme toggle button properly

---

### 4. LuxuryProductGridSection Uses `debouncedSearch` in Filter Logic but Wrong Variable
**Location**: `src/components/shop/sections/LuxuryProductGridSection.tsx` line 122
**Impact**: Potential inconsistency between displayed search term and filtered results

The `useMemo` dependency array references `searchQuery` but the filter uses `debouncedSearch`:
```tsx
// Line 108 uses debouncedSearch for filtering
if (debouncedSearch) { ... }
// But line 122 dependency array uses searchQuery
}, [products, searchQuery, selectedCategory, max_products]);
```

**Fix**: Update the dependency array to use `debouncedSearch` instead of `searchQuery`

---

### 5. StorefrontProductCard Missing Padding on Footer
**Location**: `src/components/shop/StorefrontProductCard.tsx` line 208
**Impact**: Minor visual issue - footer content touches card edges

The footer div has no horizontal padding but siblings do:
```tsx
<div className="pt-5 mt-2 flex items-center justify-between border-t border-neutral-50">
```

**Fix**: Add `px-5` to match the content padding above it

---

## Implementation Summary

| Priority | File | Issue | Fix |
|----------|------|-------|-----|
| 1 | `index.html` | Wrong Supabase preconnect URL | Update to correct URL |
| 2 | `CartPage.tsx` | "Continuue" typo | Fix spelling |
| 3 | `MobileBottomNav.tsx` | Grid columns mismatch | Change to `grid-cols-6` |
| 4 | `LuxuryProductGridSection.tsx` | Wrong useMemo dependency | Use `debouncedSearch` |
| 5 | `StorefrontProductCard.tsx` | Missing footer padding | Add `px-5` |

---

## Technical Details

### File: index.html
- **Lines 33-34**: Replace `mtvwmyerntkhrcdnhahp` with `aejugtmhwwknrowfyzie`

### File: src/pages/shop/CartPage.tsx
- **Line 237**: Change `Continuue Shopping` → `Continue Shopping`

### File: src/components/shop/MobileBottomNav.tsx
- **Line 44**: Change `grid-cols-5` → `grid-cols-6`

### File: src/components/shop/sections/LuxuryProductGridSection.tsx
- **Line 122**: Change dependency `searchQuery` → `debouncedSearch`

### File: src/components/shop/StorefrontProductCard.tsx
- **Line 208**: Add `px-5` class to footer div

---

## Expected Outcome
- Faster initial page loads with correct DNS prefetch
- Professional appearance with correct spelling
- Proper mobile navigation layout
- Correct search filtering behavior
- Consistent visual spacing in product cards
