# TypeScript 'any' Type Fixes - Summary

## Overview
Successfully fixed all TypeScript 'any' types in the requested files by adding proper type definitions from `@/types/cart`, `@/types/product`, and `@/types/auth`.

## Files Fixed (8 files)

### 1. ✅ src/components/CheckoutUpsells.tsx
**Changes:**
- Added imports: `RenderCartItem`, `Product`
- Fixed `cartItems: any[]` → `cartItems: RenderCartItem[]`
- Fixed `product: any` → `product: Product` in `handleAddUpsell`
- Fixed `product: any` → `product: Product` in `getProductPrice`
- Fixed `error: any` → `error: unknown` with proper type guard
- Added type parameter to `useQuery<Product[]>`

**Impact:** Fully typed cart items and products with proper error handling

---

### 2. ✅ src/components/CustomerLocationSharing.tsx
**Changes:**
- Fixed `error: any` → `error: unknown` in geolocation error handler
- Added type guard: `error instanceof Error` with fallback to `String(error)`

**Impact:** Proper error handling for geolocation failures

---

### 3. ✅ src/components/ExpressCheckoutButtons.tsx
**Changes:**
- Replaced `(window as any).ApplePaySession` with typed interface
- Added `WindowWithApplePay` interface extending `Window`
- Properly typed `ApplePaySession` optional properties

**Impact:** Type-safe Apple Pay detection

---

### 4. ✅ src/components/FraudCheckWrapper.tsx
**Changes:**
- Fixed `error: any` → `error: unknown` in fraud check error handler
- Added conditional logging: `error instanceof Error ? error.message : error`

**Impact:** Type-safe error logging for fraud detection

---

### 5. ✅ src/components/IDVerificationUpload.tsx
**Changes:**
- Fixed `error: any` → `error: unknown` in verification upload
- Added type guard for error logging

**Impact:** Proper error handling for ID upload failures

---

### 6. ✅ src/components/Navigation.tsx
**Changes:**
- Added imports: `DbCartItem`, `Numeric`
- Fixed `item: any` → `item: DbCartItem` in `getItemPrice`
- Added type parameter to `useQuery<DbCartItem[]>`
- Added return type annotation: `getItemPrice(item: DbCartItem): number`

**Impact:** Fully typed cart operations in navigation

---

### 7. ✅ src/components/ProductCard.tsx
**Changes:**
- Added import: `Product`
- Fixed `product: any` → `product: Product` in interface
- Fixed `error: any` → `error: unknown` with type guard

**Impact:** Type-safe product card rendering and cart operations

---

### 8. ✅ src/components/ProductDetailModal.tsx
**Changes:**
- Added import: `Product`
- Created `Review` interface for review data structure
- Fixed `product: any` → `product: Product` in interface
- Added type parameter to `useQuery<Review[]>`

**Impact:** Fully typed product details and reviews

---

## Pattern Summary

### Error Handling Pattern (Applied Everywhere)
```typescript
// Before
catch (error: any) {
  console.error(error.message);
  toast.error(error.message);
}

// After
catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : "Default message";
  console.error("Context:", error instanceof Error ? error.message : error);
  toast.error(errorMessage);
}
```

### Product Type Usage
All product parameters now use `Product` from `@/types/product` which includes:
- `id: string`
- `name: string`
- `image_url?: string | null`
- `price?: Numeric | null`
- `prices?: Record<string, Numeric> | null`
- `category?: string | null`
- `in_stock?: boolean | null`

### Cart Type Usage
Cart items now use proper types:
- `DbCartItem` - Database cart items with joined product data
- `RenderCartItem` - Union type for rendering (DB or guest cart)
- `GuestCartItem` - Guest cart entries from localStorage

---

## TypeScript Diagnostics
✅ **No TypeScript errors** in any of the fixed files
- All 'any' types successfully replaced
- All type guards properly implemented
- All imports correctly added

## Notes
- Only CSS styling warnings remain (unrelated to TypeScript)
- All error handlers now use `error: unknown` as recommended by TypeScript best practices
- Type guards ensure safe access to error messages
- Product and cart types are properly imported from centralized type definitions
