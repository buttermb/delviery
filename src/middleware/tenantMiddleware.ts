/**
 * Tenant Middleware
 * Enforces usage limits and tracks usage events
 */

import { trackUsage, checkLimit } from '@/lib/tenant';
import { supabase } from '@/integrations/supabase/client';
import type { Tenant } from '@/lib/tenant';

interface UsageCheck {
  resource: 'customers' | 'menus' | 'products' | 'locations' | 'users';
  action: 'create' | 'update' | 'delete';
}

/**
 * Check if tenant can perform action (enforce limits)
 */
export async function checkTenantLimit(
  tenant: Tenant,
  resource: UsageCheck['resource'],
  action: UsageCheck['action'] = 'create'
): Promise<{ allowed: boolean; reason?: string }> {
  if (action !== 'create') {
    // Updates and deletes don't count against limits
    return { allowed: true };
  }

  const limitCheck = checkLimit(tenant, resource);

  if (!limitCheck.allowed) {
    return {
      allowed: false,
      reason: `Limit reached: ${limitCheck.current}/${limitCheck.limit} ${resource}. Please upgrade your plan.`,
    };
  }

  return { allowed: true };
}

/**
 * Track usage event automatically
 */
export async function trackResourceUsage(
  tenantId: string,
  resource: UsageCheck['resource'],
  quantity: number = 1
): Promise<void> {
  await trackUsage(tenantId, `${resource}_created`, quantity);
}

/**
 * Update tenant usage count
 */
export async function updateTenantUsage(
  tenantId: string,
  resource: UsageCheck['resource'],
  delta: number
): Promise<void> {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('usage')
    .eq('id', tenantId)
    .single();

  if (!tenant) return;

  const currentUsage = tenant.usage || {};
  const newCount = Math.max(0, (currentUsage[resource] || 0) + delta);

  await supabase
    .from('tenants')
    .update({
      usage: {
        ...currentUsage,
        [resource]: newCount,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId);
}


