/**
 * useBusinessTier Hook
 * 
 * Provides business tier information and utilities for the current tenant
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { 
  BusinessTier, 
  getTierPreset, 
  getNextTier, 
  getTierRequirements,
  qualifiesForTier,
  detectBestTier,
  getTierColor,
  TierPreset,
} from '@/lib/presets/businessTiers';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

export interface TenantMetrics {
  monthlyRevenue: number;
  revenue: number;
  locations: number;
  teamSize: number;
  ordersThisMonth: number;
  customersCount: number;
}

export interface BusinessTierData {
  tier: BusinessTier;
  preset: TierPreset;
  metrics: TenantMetrics;
  nextTier: BusinessTier | null;
  nextTierRequirements: { minRevenue: number; minLocations: number; minTeam: number } | null;
  qualifiesForUpgrade: boolean;
  tierOverride: boolean;
}

export function useBusinessTier() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // Fetch tenant tier and metrics
  const { data, isLoading, error } = useQuery({
    queryKey: ['business-tier', tenant?.id],
    queryFn: async (): Promise<BusinessTierData | null> => {
      if (!tenant?.id) return null;

      // Fetch tenant data with tier info
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('business_tier, monthly_revenue, tier_override, usage, team_size')
        .eq('id', tenant.id)
        .single();

      if (tenantError) {
        logger.error('Failed to fetch tenant tier', tenantError, { component: 'useBusinessTier' });
        throw tenantError;
      }

      // Get team size
      const { count: teamCount } = await supabase
        .from('tenant_users')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('status', 'active');

      // Get orders this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: ordersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .gte('created_at', startOfMonth.toISOString());

      // Get customers count
      const { count: customersCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);

      const metrics: TenantMetrics = {
        monthlyRevenue: Number(tenantData?.monthly_revenue || 0),
        revenue: Number(tenantData?.monthly_revenue || 0),
        locations: Number((tenantData as any)?.usage?.locations || 1),
        teamSize: teamCount || 1,
        ordersThisMonth: ordersCount || 0,
        customersCount: customersCount || 0,
      };

      const currentTier = (tenantData?.business_tier as BusinessTier) || 'street';
      const nextTier = getNextTier(currentTier);
      const nextTierReq = nextTier ? getTierRequirements(nextTier) : null;

      return {
        tier: currentTier,
        preset: getTierPreset(currentTier),
        metrics,
        nextTier,
        nextTierRequirements: nextTierReq,
        qualifiesForUpgrade: nextTier ? qualifiesForTier(nextTier, metrics) : false,
        tierOverride: Boolean(tenantData?.tier_override),
      };
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation to manually set tier
  const setTierMutation = useMutation({
    mutationFn: async ({ tier, override = true }: { tier: BusinessTier; override?: boolean }) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { error } = await supabase
        .from('tenants')
        .update({ 
          business_tier: tier, 
          tier_override: override,
          tier_detected_at: new Date().toISOString(),
        })
        .eq('id', tenant.id);

      if (error) throw error;
      return tier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-tier', tenant?.id] });
    },
  });

  // Mutation to recalculate tier
  const recalculateTierMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      // Call the database function to recalculate
      const detectedTier = getSuggestedTier();
      const { error } = await supabase.rpc('update_tenant_tier', {
        p_tenant_id: tenant.id,
        p_tier: detectedTier,
        p_override: false,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-tier', tenant?.id] });
    },
  });

  // Helper to check if a feature is enabled for current tier
  const isFeatureEnabled = (featureId: string): boolean => {
    if (!data) return false;
    const { preset } = data;
    
    // 'all' means everything enabled
    if (preset.enabledFeatures.includes('all')) return true;
    
    // Check if feature is in enabled list
    if (preset.enabledFeatures.includes(featureId)) return true;
    
    // Check if feature is in hidden list
    if (preset.hiddenFeatures.includes(featureId)) return false;
    
    // Default to enabled
    return true;
  };

  // Helper to check if feature is hidden
  const isFeatureHidden = (featureId: string): boolean => {
    if (!data) return false;
    return data.preset.hiddenFeatures.includes(featureId);
  };

  // Get suggested tier based on current metrics
  const getSuggestedTier = (): BusinessTier => {
    if (!data) return 'street';
    return detectBestTier(data.metrics);
  };

  return {
    // Data
    tier: data?.tier || 'street',
    preset: data?.preset || getTierPreset('street'),
    metrics: data?.metrics || null,
    nextTier: data?.nextTier || null,
    nextTierRequirements: data?.nextTierRequirements || null,
    qualifiesForUpgrade: data?.qualifiesForUpgrade || false,
    tierOverride: data?.tierOverride || false,
    
    // State
    isLoading,
    error,
    
    // Actions
    setTier: setTierMutation.mutate,
    recalculateTier: recalculateTierMutation.mutate,
    isSettingTier: setTierMutation.isPending,
    isRecalculating: recalculateTierMutation.isPending,
    
    // Helpers
    isFeatureEnabled,
    isFeatureHidden,
    getSuggestedTier,
    getTierColor: () => getTierColor(data?.tier || 'street'),
  };
}

