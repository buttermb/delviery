/**
 * usePricingTiers Hook
 *
 * Fetches pricing tiers from account_settings.integration_settings.pricing_tiers.
 * Used by OrganizationForm to allow selecting a pricing tier for an organization.
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface PricingTier {
  id: string;
  name: string;
  color: string;
  discount_percentage: number;
  min_order_amount: number;
  description: string;
  active: boolean;
}

const DEFAULT_TIERS: PricingTier[] = [
  {
    id: 'bronze',
    name: 'Bronze',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    discount_percentage: 0,
    min_order_amount: 0,
    description: 'Standard pricing for all new partners',
    active: true,
  },
  {
    id: 'silver',
    name: 'Silver',
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    discount_percentage: 5,
    min_order_amount: 1000,
    description: '5% discount for orders over $1,000',
    active: true,
  },
  {
    id: 'gold',
    name: 'Gold',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    discount_percentage: 10,
    min_order_amount: 5000,
    description: '10% discount for orders over $5,000',
    active: true,
  },
];

// ============================================================================
// Hook
// ============================================================================

export function usePricingTiers() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.accountSettings.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('account_settings')
        .select('integration_settings')
        .eq('account_id', tenantId)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch pricing tiers', error, {
          tenantId,
          component: 'usePricingTiers',
        });
        throw error;
      }

      return data;
    },
    enabled: !!tenantId,
    retry: 2,
    staleTime: 60000,
  });

  const allTiers: PricingTier[] =
    (data?.integration_settings as unknown as Record<string, unknown>)
      ?.pricing_tiers as PricingTier[] ?? DEFAULT_TIERS;

  const activeTiers = allTiers.filter((t) => t.active);

  return {
    tiers: allTiers,
    activeTiers,
    isLoading,
    error: error as Error | null,
  };
}
