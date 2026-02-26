/**
 * useBusinessTier Hook
 * 
 * Provides business tier information and utilities for the current tenant
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  BusinessTier,
  getTierPreset,
  getTierRequirements,
  getTierColor,
  TierPreset,
} from '@/lib/presets/businessTiers';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from 'sonner';
import { TenantMetrics } from '@/types/hotbox';

import {
  calculateTierScore,
  determineTierFromScore,
  getNextTierProgress
} from '@/lib/hotbox/tierDetection';


export interface BusinessTierData {
  tier: BusinessTier;
  preset: TierPreset;
  metrics: TenantMetrics;
  nextTier: BusinessTier | null;
  nextTierRequirements: { minRevenue: number; minLocations: number; minTeam: number } | null;
  qualifiesForUpgrade: boolean;
  tierOverride: boolean;
  score: number;
  progress: number;
}

export function useBusinessTier() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // Fetch tenant tier and metrics
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.businessTier.byTenant(tenant?.id),
    queryFn: async (): Promise<BusinessTierData | null> => {
      if (!tenant?.id) return null;

      // Fetch tenant data with tier info
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('business_tier, monthly_revenue, tier_override, usage, team_size')
        .eq('id', tenant.id)
        .maybeSingle();

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
        tenantId: tenant.id,
        monthlyRevenue: Number(tenantData?.monthly_revenue ?? 0),
        revenue: Number(tenantData?.monthly_revenue ?? 0),
        locations: Number((tenantData?.usage as Record<string, unknown>)?.locations || 1),
        locationCount: Number((tenantData?.usage as Record<string, unknown>)?.locations || 1),
        teamSize: teamCount || 1,
        employeeCount: teamCount || 1,
        totalOrders: ordersCount ?? 0,
        activeCustomers: customersCount ?? 0,
        customerCount: customersCount ?? 0,
        activeOrders: 0,
        pendingOrders: 0,
        lowStockItems: 0,
        avgOrderValue: 0,
        averageOrderValue: 0,
        wholesaleRevenue: 0,
        deliveryCount: 0,
        posTransactions: 0,
        inventoryValue: 0,
      };

      const currentTier = (tenantData?.business_tier as BusinessTier) || 'street';

      // Calculate score
      const scoreData = calculateTierScore(metrics);
      const { nextTier, progress } = getNextTierProgress(scoreData.total);

      // Determine if they qualify for upgrade based on score
      const suggestedTier = determineTierFromScore(scoreData.total);
      const qualifiesForUpgrade = suggestedTier !== currentTier &&
        ['street', 'trap', 'block', 'hood', 'empire'].indexOf(suggestedTier) >
        ['street', 'trap', 'block', 'hood', 'empire'].indexOf(currentTier);

      const nextTierReq = nextTier ? getTierRequirements(nextTier) : null;

      return {
        tier: currentTier,
        preset: getTierPreset(currentTier),
        metrics,
        nextTier,
        nextTierRequirements: nextTierReq,
        qualifiesForUpgrade,
        tierOverride: Boolean(tenantData?.tier_override),
        score: scoreData.total,
        progress
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
      queryClient.invalidateQueries({ queryKey: queryKeys.businessTier.byTenant(tenant?.id) });
      toast.success('Business tier updated successfully');
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to set business tier', error, { component: 'useBusinessTier' });
      toast.error('Failed to update business tier', { description: errorMessage });
    },
  });

  // Mutation to recalculate tier
  const recalculateTierMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      const detectedTier = getSuggestedTier();

      try {
        // Try RPC first
        const { error } = await supabase.rpc('update_tenant_tier', {
          p_tenant_id: tenant.id,
          p_tier: detectedTier,
        });

        if (error) throw error;
      } catch (err) {
        logger.warn('RPC update_tenant_tier failed, falling back to direct update', err);

        // Fallback to direct update
        const { error: updateError } = await supabase
          .from('tenants')
          .update({
            business_tier: detectedTier,
            tier_detected_at: new Date().toISOString(),
            // Don't touch tier_override or monthly_revenue here as we might not have full data
          })
          .eq('id', tenant.id);

        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.businessTier.byTenant(tenant?.id) });
      toast.success('Business tier recalculated successfully');
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to recalculate business tier', error, { component: 'useBusinessTier' });
      toast.error('Failed to recalculate business tier', { description: errorMessage });
    },
  });

  // Helper to check if a feature is enabled for current tier
  // Uses tier-based feature configuration for proper gating
  const isFeatureEnabled = useCallback((featureId: string): boolean => {
    if (isLoading) return true; // Allow access during loading to prevent flicker
    if (!data) return true; // Default to enabled if no data
    
    // Tier-based feature gating: higher tiers get more features
    const tier = data.tier || 'street';
    const tierRank: Record<BusinessTier, number> = { 
      street: 0, 
      trap: 1, 
      block: 2, 
      hood: 3, 
      empire: 4 
    };
    
    // Features that require specific tiers
    const featureTierRequirements: Record<string, BusinessTier> = {
      'multi-location': 'block',
      'advanced-analytics': 'block',
      'api-access': 'empire',
      'white-label': 'empire',
      'custom-integrations': 'empire',
      'bulk-operations': 'trap',
      'team-management': 'trap',
    };
    
    const requiredTier = featureTierRequirements[featureId];
    if (!requiredTier) return true; // Feature not gated
    
    return tierRank[tier] >= tierRank[requiredTier];
  }, [data, isLoading]);

  // Helper to check if feature is hidden based on tier
  const isFeatureHidden = useCallback((featureId: string): boolean => {
    if (isLoading) return false; // Don't hide during loading
    if (!data) return false;
    
    const tier = data.tier || 'street';
    
    // Features hidden from lower tiers (not just disabled, but hidden from UI)
    const hiddenFromTiers: Record<string, BusinessTier[]> = {
      'enterprise-dashboard': ['street', 'trap'],
      'white-label-settings': ['street', 'trap', 'block'],
      'api-management': ['street', 'trap'],
    };
    
    const hiddenFrom = hiddenFromTiers[featureId];
    if (!hiddenFrom) return false;
    
    return hiddenFrom.includes(tier);
  }, [data, isLoading]);

  // Get suggested tier based on current metrics
  const getSuggestedTier = (): BusinessTier => {
    if (!data) return 'street';
    return determineTierFromScore(data.score);
  };

  // Auto-update tier if qualified and not overridden
  // We use a ref to prevent infinite loops if the update fails
  const hasAttemptedUpdate = useRef(false);

  // Memoize tier data to prevent dependency changes
  const tierData = data ? {
    score: data.score,
    tier: data.tier,
    tierOverride: data.tierOverride,
  } : null;

  useEffect(() => {
    if (!tierData) return;

    const suggestedTier = determineTierFromScore(tierData.score);
    const currentTier = tierData.tier;
    const isUpgrade = ['street', 'trap', 'block', 'hood', 'empire'].indexOf(suggestedTier) >
      ['street', 'trap', 'block', 'hood', 'empire'].indexOf(currentTier);

    // Only auto-update if:
    // 1. We qualify for a higher tier
    // 2. No manual override is set
    // 3. We haven't already tried to update in this session
    if (isUpgrade && !tierData.tierOverride && !hasAttemptedUpdate.current) {
      logger.info('Auto-updating business tier', { from: currentTier, to: suggestedTier });
      hasAttemptedUpdate.current = true;
      recalculateTierMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recalculateTierMutation is intentionally omitted to prevent infinite loops (mutation triggers data refetch which triggers this effect)
  }, [tierData]);

  return {
    // Data
    // Return suggested tier immediately if we qualify and aren't overridden
    // This gives instant UI feedback while the DB update happens
    tier: (data?.qualifiesForUpgrade && !data?.tierOverride) ? getSuggestedTier() : (data?.tier || 'street'),
    preset: (data?.qualifiesForUpgrade && !data?.tierOverride) ? getTierPreset(getSuggestedTier()) : (data?.preset || getTierPreset('street')),
    metrics: data?.metrics || null,
    nextTier: data?.nextTier || null,
    nextTierRequirements: data?.nextTierRequirements || null,
    qualifiesForUpgrade: data?.qualifiesForUpgrade ?? false,
    tierOverride: data?.tierOverride ?? false,
    score: data?.score ?? 0,
    progress: data?.progress ?? 0,

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
    getTierColor: () => getTierColor((data?.qualifiesForUpgrade && !data?.tierOverride) ? getSuggestedTier() : (data?.tier || 'street')),
  };
}

