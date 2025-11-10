# Leafly Integration Guide

## Overview

This document explains how to integrate Leafly's comprehensive strain database into the autocomplete system.

## Current Status

The integration is **prepared but not active** by default. Leafly's API requires partnership access (contact api@leafly.com).

## Architecture

### 1. Edge Function (`supabase/functions/leafly-suggestions/`)
- Handles API requests to Leafly
- Provides CORS headers
- Returns strain suggestions

### 2. API Client (`src/lib/leaflyApi.ts`)
- Fetches suggestions from Edge Function
- Implements 24-hour caching
- Falls back gracefully if API fails

### 3. Hybrid Suggestion System (`src/lib/getSuggestions.ts`)
- **Primary**: Local database (200+ strains, 60+ brands)
- **Secondary**: Leafly API (when enabled and available)
- Combines results intelligently

## How to Enable Leafly Integration

### Option 1: Get Leafly API Access (Recommended)
1. Contact Leafly at **api@leafly.com**
2. Request API partnership for strain data
3. Update `supabase/functions/leafly-suggestions/index.ts` with API credentials
4. Enable in `getSuggestions()` by setting `useLeafly: true`

### Option 2: Use Alternative APIs
Consider these cannabis data APIs:
- **Cannabis Reports API** (free, open)
- **Weedmaps API** (requires partnership)
- **Dutchie API** (for dispensaries)

### Option 3: Manual Data Sync
Since Leafly doesn't have a public API:
1. Visit https://www.leafly.com/strains
2. Manually curate popular strains
3. Add to `popular_strains.json`
4. Use `updateStrainsFromLeafly.ts` utility to merge lists

## Implementation Details

### Current Behavior
- Uses local database only (fast, reliable, offline-capable)
- 200+ popular strains included
- Fuzzy matching with relevance scoring
- Recent selections cached in localStorage

### Future Enhancement (When Leafly API Available)
```typescript
// In getSuggestions.ts
const suggestions = await getSuggestions(query, "strain", true); // Enable Leafly
```

### Caching Strategy
- **Local Database**: Always available, instant results
- **Leafly API**: 24-hour cache, reduces API calls
- **Recent Selections**: Persistent in localStorage

## Benefits of Current Approach

1. **Fast**: No network latency
2. **Reliable**: Works offline
3. **Comprehensive**: 200+ popular strains
4. **Extensible**: Ready for Leafly when available

## Next Steps

1. **Contact Leafly for API access**: api@leafly.com
2. Once approved, update Edge Function with API credentials
3. Enable `useLeafly` flag in production
4. Monitor API usage and cache hit rates

## Manual Data Sync

Since Leafly doesn't have a public API, you can:

1. **Visit Leafly's strain directory**: https://www.leafly.com/strains
2. **Manually curate** the most popular strains
3. **Add to** `popular_strains.json`
4. **Use** `mergeLeaflyStrains()` function to combine lists

## Current Database Status

- **200+ strains** in local database
- **60+ brands** in local database
- **Fuzzy matching** for intelligent search
- **Recent selections** for quick access
- **Ready for Leafly API** when partnership is obtained
