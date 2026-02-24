

# Fix Build Errors to Restore Website

The website is not loading because the production build is completely failing. This affects all devices, not just mobile. There are 5 separate issues that need to be fixed.

---

## What Will Be Fixed

### 1. Create missing sitemap generator file
The build process tries to run `src/lib/generate-sitemap.ts` but the file doesn't exist. A minimal placeholder will be created so the build doesn't crash.

### 2. Fix LiveDeliveryMap.tsx (lines 240, 530)
Two lines have invalid TypeScript syntax where optional chaining is used incorrectly with type assertions. The complex inline expressions will be simplified into safe helper variables.

### 3. Fix ProductQRGenerator.tsx (line 44)
The type definition `Database['public']['Tables']queryKeys.products.all['Row']` is broken syntax. It will be corrected to use the proper table name.

### 4. Fix SoundAlertToggle.tsx (line 14)
The import `{ STORAGE_KEYS.SOUND_ALERTS_TOGGLES }` is invalid JavaScript. It will be changed to import `STORAGE_KEYS` and access the property where needed.

### 5. Fix GeofenceSettings.tsx (line 90)
A JSX comment `{/* ... */}` is placed as a direct child inside `.map()` before the actual element, which breaks the JSX structure. The comment will be moved inside the Card element.

---

## Technical Details

### File: `src/lib/generate-sitemap.ts`
Create a minimal file that writes an empty sitemap to `dist/sitemap.xml`.

### File: `src/components/admin/LiveDeliveryMap.tsx`
**Lines 240 and 530** -- Replace:
```typescript
(delivery as unknown as Record<string, unknown>).delivery_address as string | undefined?.split(',')[0]
```
With safe extraction:
```typescript
const rawAddr = (delivery as unknown as Record<string, unknown>).delivery_address;
const clientName = (typeof rawAddr === 'string' ? rawAddr.split(',')[0] : null) || 'Client';
```

### File: `src/components/admin/ProductQRGenerator.tsx`
**Line 44** -- Replace:
```typescript
type Product = Database['public']['Tables']queryKeys.products.all['Row'];
```
With:
```typescript
type Product = Database['public']['Tables']['products']['Row'];
```

### File: `src/components/admin/SoundAlertToggle.tsx`
**Line 14** -- Replace:
```typescript
import { STORAGE_KEYS.SOUND_ALERTS_TOGGLES } from '@/constants/storageKeys';
```
With:
```typescript
import { STORAGE_KEYS } from '@/constants/storageKeys';
```
Then use `STORAGE_KEYS.SOUND_ALERTS_TOGGLES` where the constant is referenced.

### File: `src/components/admin/disposable-menus/GeofenceSettings.tsx`
**Line 90** -- Move the comment inside the Card element or remove it, so `.map()` returns a single JSX element per iteration.

---

## Expected Outcome
After these 5 fixes, the production build will succeed and the website will load on all devices including mobile.

