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
    
    const limit = tenant.limits?.[resource];
    
    // -1 means unlimited
    if (limit === -1) return Infinity;
    
    // If limit is undefined or 0, check if enterprise/professional plan (should be unlimited)
    if (limit === undefined || limit === 0) {
      const isEnterprise = tenant.subscription_plan === 'enterprise';
      const isProfessional = tenant.subscription_plan === 'professional';
      
      // Enterprise plans are unlimited for all resources
      if (isEnterprise) {
        return Infinity;
      }
      
      // Professional plans are unlimited for menus and products
      if (isProfessional && (resource === 'menus' || resource === 'products')) {
        return Infinity;
      }
      
      return 0;
    }
    
    return limit;
  };

  return {
    canCreate,
    getRemaining,
    getCurrent,
    getLimit,
    tenant,
  };
}

