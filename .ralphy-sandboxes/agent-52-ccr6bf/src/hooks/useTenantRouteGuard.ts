/**
 * Tenant Route Guard Hook
 * 
 * Monitors route changes and handles tenant context switches.
 * Uses React Router's location instead of window.location for better integration.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { classifyRoute, tenantSlugsMatch, RouteInfo } from '@/lib/routeUtils';
import { logger } from '@/lib/logger';

export interface TenantRouteGuardOptions {
  /** Current tenant slug from context */
  currentTenantSlug: string | null | undefined;
  /** Callback when tenant mismatch is detected */
  onTenantMismatch: (urlSlug: string, currentSlug: string) => void;
  /** Whether the guard is enabled */
  enabled?: boolean;
  /** Delay before triggering mismatch callback (ms) - allows for transitions */
  debounceMs?: number;
}

export interface TenantRouteGuardResult {
  /** Current route classification */
  routeInfo: RouteInfo;
  /** Whether current route requires tenant context */
  requiresTenant: boolean;
  /** Whether there's a tenant mismatch (URL slug ≠ context slug) */
  hasMismatch: boolean;
}

/**
 * Hook to guard tenant routes and detect tenant context mismatches
 * 
 * @example
 * ```tsx
 * const { hasMismatch, routeInfo } = useTenantRouteGuard({
 *   currentTenantSlug: tenant?.slug,
 *   onTenantMismatch: (urlSlug, currentSlug) => {
 *     // Handle mismatch - could logout, redirect, or prompt user
 *     logout();
 *   },
 *   enabled: !!tenant,
 * });
 * ```
 */
export function useTenantRouteGuard({
  currentTenantSlug,
  onTenantMismatch,
  enabled = true,
  debounceMs = 100,
}: TenantRouteGuardOptions): TenantRouteGuardResult {
  const location = useLocation();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastMismatchRef = useRef<string | null>(null);
  
  // Classify current route
  const routeInfo = classifyRoute(location.pathname);
  
  // Check for mismatch
  const hasMismatch = routeInfo.requiresTenantContext && 
    routeInfo.tenantSlug !== null && 
    currentTenantSlug !== null && 
    !tenantSlugsMatch(routeInfo.tenantSlug, currentTenantSlug);
  
  // Memoized mismatch handler
  const handleMismatch = useCallback((urlSlug: string, contextSlug: string) => {
    // Prevent duplicate triggers for same mismatch
    const mismatchKey = `${urlSlug}:${contextSlug}`;
    if (lastMismatchRef.current === mismatchKey) {
      return;
    }
    lastMismatchRef.current = mismatchKey;
    
    logger.warn('[TenantRouteGuard] Tenant mismatch detected', {
      urlSlug,
      contextSlug,
      routeType: routeInfo.type,
      pathname: location.pathname,
    });
    
    onTenantMismatch(urlSlug, contextSlug);
  }, [onTenantMismatch, routeInfo.type, location.pathname]);
  
  // Effect to handle tenant mismatch with debounce
  useEffect(() => {
    if (!enabled) return;
    
    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Only check on tenant-admin routes (not customer portal, not global routes)
    if (routeInfo.type !== 'tenant-admin') {
      // Reset mismatch tracker when navigating to non-admin routes
      lastMismatchRef.current = null;
      return;
    }
    
    // Check for mismatch with debounce
    if (hasMismatch && routeInfo.tenantSlug && currentTenantSlug) {
      debounceRef.current = setTimeout(() => {
        handleMismatch(routeInfo.tenantSlug!, currentTenantSlug);
      }, debounceMs);
    }
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [enabled, routeInfo, hasMismatch, currentTenantSlug, handleMismatch, debounceMs]);
  
  // Listen for popstate (back/forward navigation)
  useEffect(() => {
    if (!enabled) return;
    
    const handlePopState = () => {
      const newRouteInfo = classifyRoute(window.location.pathname);
      
      if (newRouteInfo.type !== 'tenant-admin') return;
      
      if (newRouteInfo.tenantSlug && currentTenantSlug && 
          !tenantSlugsMatch(newRouteInfo.tenantSlug, currentTenantSlug)) {
        handleMismatch(newRouteInfo.tenantSlug, currentTenantSlug);
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [enabled, currentTenantSlug, handleMismatch]);
  
  return {
    routeInfo,
    requiresTenant: routeInfo.requiresTenantContext,
    hasMismatch,
  };
}

