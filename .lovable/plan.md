
# Fix 4 Build Errors

## Error 1 & 2: `useFormPersistence` destructuring mismatch (Contact.tsx, DemoRequest.tsx)

Both files destructure the hook as an array: `const [formData, setFormData, clearFormData] = useFormPersistence(...)`. But the hook returns an **object** (`{ restoreForm, clearSavedForm, hasSavedForm, lastSavedAt }`), not an array.

**Fix**: Replace the array destructuring with object destructuring and adapt the usage. Since the hook doesn't provide `formData` or `setFormData` (it auto-persists values passed to it), we need to use local `useState` for the form data and wire `useFormPersistence` as a side-effect:

```typescript
// Before (broken):
const [formData, setFormData, clearFormData] = useFormPersistence("contact_form", { ... });

// After (fixed):
const [formData, setFormData] = useState({ name: "", email: "", ... });
const { restoreForm, clearSavedForm } = useFormPersistence("contact_form", formData);
```

Add a `useEffect` to restore form data on mount, and replace `clearFormData()` calls with `clearSavedForm()`.

## Error 3: Missing `@/hooks/useAsyncAction` module (InvoicesPage.tsx)

The hook doesn't exist. It's used to wrap async mutation calls with loading/error state. 

**Fix**: Create `src/hooks/useAsyncAction.ts` -- a simple wrapper that returns an async function with `isPending` and `error` state. This will satisfy the 5 usages in InvoicesPage.

## Error 4: Missing `CartStockSummary` import (CartPage.tsx)

The component exists in `src/components/shop/CartStockWarning.tsx` as a named export, but CartPage.tsx never imports it.

**Fix**: Add the missing import to CartPage.tsx:
```typescript
import { CartStockSummary } from '@/components/shop/CartStockWarning';
```

---

## Technical Summary

| File | Change |
|------|--------|
| `src/pages/Contact.tsx` | Switch from array to object destructuring of `useFormPersistence`, add `useState` for form data, add `useEffect` for restore |
| `src/pages/DemoRequest.tsx` | Same pattern as Contact.tsx |
| `src/hooks/useAsyncAction.ts` | **New file** -- simple hook wrapping async functions with loading/error state |
| `src/pages/shop/CartPage.tsx` | Add missing import for `CartStockSummary` from `CartStockWarning` |
