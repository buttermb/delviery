

# Fix: Build failure — `updateMarkerPinColor` used before declaration in LiveMap.tsx

## Root Cause

The app shows a blank page because `LiveMap.tsx` fails to compile. The `useEffect` at line 296 references `updateMarkerPinColor` (lines 343, 347) and `getPinColor` implicitly through it, but both are `const` declarations defined later at lines 497-530. TypeScript/JavaScript `const` is not hoisted, so this is a compile error (TS2448).

The previous fix attempted to address this but the code was not actually reordered.

## Fix

Move `getPinColor` (lines 497-508) and `updateMarkerPinColor` (lines 510-530) to **before** the realtime `useEffect` at line 296. Specifically, insert them between the map style effect (line 290) and the realtime subscriptions block (line 292).

The sync effect at lines 532-546 can stay where it is since it comes after both declarations.

No other files need changes — the other build errors from the previous batch were already fixed.

