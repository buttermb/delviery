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

### Option 1: Get Leafly API Access
1. Contact Leafly at **api@leafly.com**
2. Request API partnership for strain data
3. Update `supabase/functions/leafly-suggestions/index.ts` with API credentials
4. Enable in `getSuggestions()` by setting `useLeafly: true`

### Option 2: Use Web Scraping (Not Recommended)
- Leafly's website doesn't allow direct scraping
- Would require CORS proxy (not reliable)
- Violates Leafly's Terms of Use

### Option 3: Use Alternative APIs
Consider these cannabis data APIs:
- **Cannabis Reports API** (free, open)
- **Weedmaps API** (requires partnership)
- **Dutchie API** (for dispensaries)

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

1. Contact Leafly for API access: api@leafly.com
2. Once approved, update Edge Function with API credentials
3. Enable `useLeafly` flag in production
4. Monitor API usage and cache hit rates

## Alternative: Expand Local Database

Instead of API integration, you can:
- Manually add more strains to `popular_strains.json`
- Import from public strain databases
- Allow users to suggest additions
- Crowdsource popular strains

