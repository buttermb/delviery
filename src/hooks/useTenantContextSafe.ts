/**
 * Safe Tenant Context Hook
 *
 * Provides safe access to tenant context with explicit loading and error states.
 * Use this hook when you need to validate tenant context before performing operations.
 */

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';

interface TenantContextResult {
  /** The tenant ID, null if not ready */
  tenantId: string | null;
  /** The tenant slug for navigation, null if not ready */
  tenantSlug: string | null;
  /** Full tenant object if needed */
  tenant: ReturnType<typeof useTenantAdminAuth>['tenant'];
  /** Whether the context is fully loaded and valid */
  isReady: boolean;
  /** Whether the context is still loading */
  isLoading: boolean;
  /** Error message if context is not available */
  error: string | null;
}

/**
 * Hook for safe access to tenant context.
 *
 * @example
 * ```tsx
 * const { tenantId, isReady, isLoading, error } = useTenantContextSafe();
 *
 * if (isLoading) return <Spinner />;
 * if (!isReady) return <Alert>{error}</Alert>;
 *
 * // Safe to use tenantId here
 * ```
 */
export function useTenantContextSafe(): TenantContextResult {
  const { tenant, loading } = useTenantAdminAuth();

  if (loading) {
    return {
      tenantId: null,
      tenantSlug: null,
      tenant: null,
      isReady: false,
      isLoading: true,
      error: null,
    };
  }

  if (!tenant?.id) {
    logger.warn('[useTenantContextSafe] Tenant context not available', {
      component: 'useTenantContextSafe',
      hasTenant: !!tenant,
      tenantId: tenant?.id,
    });

    return {
      tenantId: null,
      tenantSlug: null,
      tenant: null,
      isReady: false,
      isLoading: false,
      error: 'Tenant context not available. Please try refreshing the page.',
    };
  }

  if (!tenant.slug) {
    logger.warn('[useTenantContextSafe] Tenant slug not available', {
      component: 'useTenantContextSafe',
      tenantId: tenant.id,
    });

    return {
      tenantId: tenant.id,
      tenantSlug: null,
      tenant,
      isReady: false,
      isLoading: false,
      error: 'Tenant configuration incomplete. Please contact support.',
    };
  }

  return {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    tenant,
    isReady: true,
    isLoading: false,
    error: null,
  };
}

/**
 * Hook that returns account ID safely (alias for backward compatibility with useAccountIdSafe pattern)
 */
export function useAccountIdSafe(): string | null {
  const { tenantId, isReady } = useTenantContextSafe();
  return isReady ? tenantId : null;
}
