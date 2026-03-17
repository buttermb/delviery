

# Fix Edge Function Build Errors

Your migration drift fix is solid — 514 migrations synced, TypeScript and Vite builds clean. The remaining build errors are all in edge functions (Deno), not the main app. Here's the fix plan:

## Errors and Fixes

### 1. `add-driver/index.ts` — Zod SafeParse narrowing (line 171)
TypeScript can't see `.error` on `SafeParseReturnType` after checking `!validation.success`.
**Fix:** Cast to `z.SafeParseError` before accessing `.error`:
```typescript
const fieldErrors = (validation as z.SafeParseError<typeof addDriverSchema>).error.flatten().fieldErrors;
```

### 2. `credit-threshold-alerts/index.ts` — Array cast (line 138)
`record.tenants` is an array but cast as `Record<string, unknown>`.
**Fix:** Cast as `unknown` first, then to target type:
```typescript
(record.tenants as unknown as Record<string, unknown>)
```
Or if it's actually an array, use `record.tenants?.[0] as Record<string, unknown>`.

### 3. `credit-warning-emails/index.ts` — 3 errors
- **Line 87:** Same array-to-Record cast issue as above
- **Line 97:** `supabase` client type mismatch in function parameter — change `sendWarningNotification` param type to `any`
- **Line 178:** `.insert()` on `notifications` typed as `never` — same root cause; fix param type to `any`

**Fix:** Change function signature `supabase: ReturnType<typeof createClient>` → `supabase: any` for `sendWarningNotification`.

### 4. `_shared/encryption.ts` — 4 errors (lines 139, 142, 145, 182)
`customer[field]` is `unknown`, passed to functions expecting `string`.
**Fix:** Add `as string` casts:
```typescript
await createSearchHash(customer.email as string);
await createSearchHash(customer.phone as string);
await createSearchHash(customer.medical_card_number as string);
await decryptData(encryptedCustomer[encryptedField] as string, password);
```

### 5. `delete-customer-account/index.ts` — SupabaseClient type mismatch (line 108)
`logPHIAccess` expects a narrow type but receives full SupabaseClient.
**Fix:** Change `logPHIAccess` param type to `any` (it's already a utility function).

### 6. `detect-fraud/index.ts` — 9 errors
- **Lines 38, 41:** `supabaseClient` type mismatch in `checkBehavior` and `checkBinRisk` params — change param types to `any`
- **Line 199:** `order` possibly null after `maybeSingle()` — already guarded by `order?.payment_method_last4` but TS doesn't narrow. Add explicit `if (!order) return { flagged: false };` before line 199.
- **Lines 212, 247-265:** `cachedBin[0].response` and `profile.*` typed as `never` because client generic is wrong — fix by typing function params as `any` and adding explicit casts on `.data`.

**Fix:** Change all helper function `supabase` params from `ReturnType<typeof createClient>` to `any`, and cast `.data` results.

## Files Changed (6 files)

| File | Changes |
|------|---------|
| `supabase/functions/add-driver/index.ts` | Cast Zod SafeParse result |
| `supabase/functions/credit-threshold-alerts/index.ts` | Fix array-to-Record cast |
| `supabase/functions/credit-warning-emails/index.ts` | Fix cast + param type to `any` |
| `supabase/functions/_shared/encryption.ts` | Add `as string` casts (4 spots) |
| `supabase/functions/delete-customer-account/index.ts` | Change `logPHIAccess` param to `any` |
| `supabase/functions/detect-fraud/index.ts` | Change helper param types to `any`, add null guards, cast data |

All fixes follow the established pattern from your memory note: "Supabase client parameters are typed as `any` in helper signatures to bypass strict generic mismatches."

