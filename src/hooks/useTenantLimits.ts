/**
 * useTenantLimits Hook
 * Check if tenant can create resources based on plan limits
 */

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { checkLimit } from '@/lib/tenant';

type Resource = 'customers' | 'menus' | 'products' | 'locations' | 'users';

export function useTenantLimits() {
  const { tenant } = useTenantAdminAuth();

  const canCreate = (resource: Resource): boolean => {
    if (!tenant) return false;
    const limitCheck = checkLimit(tenant, resource);
    return limitCheck.allowed;
  };

  const getRemaining = (resource: Resource): number => {
    if (!tenant) return 0;
    const limitCheck = checkLimit(tenant, resource);
    return limitCheck.remaining;
  };

  const getCurrent = (resource: Resource): number => {
    if (!tenant) return 0;
    return tenant.usage?.[resource] || 0;
  };

  const getLimit = (resource: Resource): number => {
    if (!tenant) return 0;
    return tenant.limits?.[resource] === -1 ? Infinity : (tenant.limits?.[resource] || 0);
  };

  return {
    canCreate,
    getRemaining,
    getCurrent,
    getLimit,
    tenant,
  };
}

