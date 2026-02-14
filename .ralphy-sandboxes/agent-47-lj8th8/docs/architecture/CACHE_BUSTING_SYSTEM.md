# Automated Cache-Busting System

## Overview

The automated cache-busting system ensures users always receive the latest version of the application after deployments by detecting version changes and automatically clearing caches.

## How It Works

### 1. Build-Time Version Generation

When the app is built:
- `vite-plugins/version-generator.ts` generates `public/version.json` with the current build timestamp
- The timestamp is also injected as `__BUILD_TIME__` via Vite's `define` config
- This happens automatically on every build

### 2. Version Checking

The `useVersionCheck` hook runs in `App.tsx` and:
- Checks for version updates every 10 minutes
- Fetches `/version.json` with cache-busting query params
- Compares server version with locally stored version
- Prevents duplicate checks within 1-minute windows

### 3. Update Flow

When a new version is detected:
1. User sees a toast notification: "New version available"
2. Toast provides a "Reload Now" button for immediate update
3. If user doesn't click, auto-reloads after 10 seconds
4. Before reload, all caches are cleared:
   - Service worker registrations
   - Cache Storage API data
   - localStorage (except essential keys: `app_theme`, `app_production_logs`, `supabase.auth.token`, `sb-*`)

### 4. Essential Data Preservation

The system preserves:
- **Theme preferences** (`app_theme`)
- **Production logs** (`app_production_logs`)
- **Supabase auth tokens** (`supabase.auth.token`, `sb-*` keys)

All other data is cleared to ensure clean state.

## Files Involved

- **`src/hooks/useVersionCheck.ts`** - Version checking logic and cache clearing
- **`vite-plugins/version-generator.ts`** - Generates version.json during build
- **`public/version.json`** - Contains current build timestamp
- **`vite.config.ts`** - Injects build time and includes version generator plugin
- **`src/App.tsx`** - Activates version checking on app mount

## Configuration

```typescript
// Version check interval (default: 10 minutes)
const CHECK_INTERVAL = 10 * 60 * 1000;

// Auto-reload delay after detection (default: 10 seconds)
const AUTO_RELOAD_DELAY = 10000;

// Essential localStorage keys (preserved during cache clear)
const ESSENTIAL_KEYS = ['app_theme', 'app_production_logs', 'supabase.auth.token'];
```

## Testing

### Manual Test
1. Deploy a new version
2. Keep old version open in browser
3. Wait up to 10 minutes (or trigger check manually)
4. Toast notification should appear
5. Page should reload with new version

### Developer Test
```typescript
// In browser console:
localStorage.setItem('app_version', 'old-timestamp');
// Wait for next check cycle or refresh page
```

## Benefits

✅ **No manual cache clearing** - Users always get latest version  
✅ **Graceful updates** - 10-second warning before reload  
✅ **Data preservation** - Auth and preferences maintained  
✅ **Reduced support tickets** - Fixes deployment cache issues  
✅ **Better UX** - Clear notification of updates

## Troubleshooting

**Q: Version check not working?**  
A: Ensure `version.json` is accessible at `/version.json` in production

**Q: Too frequent reloads?**  
A: Check `CHECK_INTERVAL` value and ensure builds don't deploy too rapidly

**Q: Lost user data after update?**  
A: Add necessary keys to `ESSENTIAL_KEYS` array in `useVersionCheck.ts`

**Q: Version not detected?**  
A: Verify `versionGeneratorPlugin()` is in `vite.config.ts` plugins array
