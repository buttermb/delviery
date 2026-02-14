# Caching Strategy

## Overview
FloraIQ uses a multi-tiered caching strategy primarily driven by **TanStack Query (React Query)** to ensure a responsive user experience while maintaining data consistency.

## React Query Configuration
We define specific caching profiles based on the nature of the data.

### 1. Default Configuration
Applied to most queries unless specified otherwise.
- **Stale Time**: 5 minutes (Data is considered fresh for 5 mins)
- **GC Time**: 10 minutes (Unused data remains in memory for 10 mins)
- **Retry**: 2 attempts (with exponential backoff)
- **Network Mode**: Offline-first (suspends queries when offline)

### 2. Product Data (`PRODUCT_QUERY_CONFIG`)
For catalog data that changes infrequently.
- **Stale Time**: 15 minutes
- **GC Time**: 30 minutes
- **Refetch**: Disabled on window focus/mount

### 3. Dashboard Data (`DASHBOARD_QUERY_CONFIG`)
For high-level metrics that need to be relatively fresh.
- **Stale Time**: 2 minutes
- **GC Time**: 5 minutes
- **Auto-Refresh**: Every 60 seconds

### 4. Realtime Data (`REALTIME_QUERY_CONFIG`)
For volatile data like active orders or live tracking.
- **Stale Time**: 30 seconds
- **GC Time**: 2 minutes
- **Auto-Refresh**: Every 30 seconds

### 5. Static Data (`STATIC_QUERY_CONFIG`)
For constants, settings, or reference lists.
- **Stale Time**: 1 hour
- **GC Time**: 24 hours
- **Refetch**: Disabled on window focus/mount/reconnect

## Invalidation Strategy
- **Mutations**: Successful mutations (create/update/delete) trigger invalidation of related query keys.
- **Realtime Events**: Supabase Realtime subscriptions trigger specific invalidations when database changes occur.
- **Manual**: Users can manually refresh data via UI controls, which calls `queryClient.invalidateQueries()`.

## Service Worker
- **Assets**: Static assets (JS, CSS, Images) are cached by the browser and service worker.
- **API**: API requests are generally *not* cached by the service worker to avoid stale data issues, relying instead on React Query's in-memory cache.
