/**
 * useTenantLimits Hook
 * Check if tenant can create resources based on plan limits
 * Uses checkLimit as single source of truth to prevent inconsistencies
 */

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { checkLimit, type Tenant } from '@/lib/tenant';

type Resource = 'customers' | 'menus' | 'products' | 'locations' | 'users';

export function useTenantLimits() {
  const { tenant, loading } = useTenantAdminAuth();

  // Use checkLimit as single source of truth for all limit checks
  const getLimitCheck = (resource: Resource) => {
    if (!tenant || loading) {
      return {
        allowed: false,
        current: 0,
        limit: 0,
        remaining: 0,
      };
    }
    return checkLimit(tenant as Tenant, resource);
  };

  const canCreate = (resource: Resource): boolean => {
    if (!tenant || loading) return false;
    const limitCheck = getLimitCheck(resource);
    return limitCheck.allowed;
  };

  const getRemaining = (resource: Resource): number => {
    if (!tenant || loading) return 0;
    const limitCheck = getLimitCheck(resource);
    return limitCheck.remaining;
  };

  const getCurrent = (resource: Resource): number => {
    if (!tenant || loading) return 0;
    const limitCheck = getLimitCheck(resource);
    return limitCheck.current;
  };

  const getLimit = (resource: Resource): number => {
    if (!tenant || loading) return 0;
    const limitCheck = getLimitCheck(resource);
    return limitCheck.limit;
  };

  return {
    canCreate,
    getRemaining,
    getCurrent,
    getLimit,
    tenant,
    loading,
  };
}

