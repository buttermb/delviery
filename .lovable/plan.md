

# Fix Build Errors: CheckoutPage + Storefront Checkout Edge Function

## Problem

Two separate build errors:

1. **`src/pages/shop/CheckoutPage.tsx`** -- Lines 491, 505, 511, 514, 2167 all show "Declaration or statement expected". Root cause: `case 2:` in the `validateStep` switch statement (around line 460) declares `const deliveryZones` and `const matchingZone` without wrapping the case body in block braces `{}`. TypeScript does not allow lexical declarations (`const`/`let`) in bare case clauses.

2. **`supabase/functions/storefront-checkout/index.ts`** -- Deno's type checker cannot narrow `parseResult.error` inside the `if (!parseResult.success)` block. The `SafeParseReturnType` union is not being narrowed correctly.

## Fix 1: CheckoutPage.tsx (wrap case 2 in braces)

Wrap the body of `case 2:` (lines 460-489) in curly braces so the `const` declarations are in a proper block scope:

```typescript
case 2: {
  if (!formData.fulfillmentMethod) { ... }
  if (formData.fulfillmentMethod === 'pickup') return true;
  ...
  const deliveryZones = ...;
  const matchingZone = ...;
  ...
  return true;
}
```

This is a single-character addition (`{` after `case 2:` and `}` before `case 3:`).

## Fix 2: storefront-checkout/index.ts (Zod type narrowing)

Change the error access to use a type guard pattern that Deno respects:

```typescript
if (!parseResult.success) {
  const errorResult = parseResult as z.SafeParseError<unknown>;
  return jsonResponse(
    { error: "Validation failed", details: errorResult.error.flatten().fieldErrors },
    400,
  );
}
```

## Files Changed
- `src/pages/shop/CheckoutPage.tsx` -- Add block braces around case 2 body
- `supabase/functions/storefront-checkout/index.ts` -- Fix Zod type narrowing for Deno

