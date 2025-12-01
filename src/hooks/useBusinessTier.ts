/**
 * useBusinessTier Hook
 * 
 * Provides business tier information and utilities for the current tenant
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useEffect } from 'react';
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
    queryKey: ['business-tier', tenant?.id],
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
        monthlyRevenue: Number(tenantData?.monthly_revenue || 0),
        revenue: Number(tenantData?.monthly_revenue || 0),
        locations: Number((tenantData as any)?.usage?.locations || 1),
        locationCount: Number((tenantData as any)?.usage?.locations || 1),
        teamSize: teamCount || 1,
        employeeCount: teamCount || 1,
        totalOrders: ordersCount || 0,
        activeCustomers: customersCount || 0,
        customerCount: customersCount || 0,
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
      queryClient.invalidateQueries({ queryKey: ['business-tier', tenant?.id] });
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
    return determineTierFromScore(data.score);
  };

  // Auto-update tier if qualified and not overridden
  // We use a ref to prevent infinite loops if the update fails
  const hasAttemptedUpdate = useRef(false);

  useEffect(() => {
    if (!data) return;

    const suggestedTier = determineTierFromScore(data.score);
    const currentTier = data.tier;
    const isUpgrade = ['street', 'trap', 'block', 'hood', 'empire'].indexOf(suggestedTier) >
      ['street', 'trap', 'block', 'hood', 'empire'].indexOf(currentTier);

    // Only auto-update if:
    // 1. We qualify for a higher tier
    // 2. No manual override is set
    // 3. We haven't already tried to update in this session
    if (isUpgrade && !data.tierOverride && !hasAttemptedUpdate.current) {
      logger.info('Auto-updating business tier', { from: currentTier, to: suggestedTier });
      hasAttemptedUpdate.current = true;
      recalculateTierMutation.mutate();
    }
  }, [data, recalculateTierMutation]);

  return {
    // Data
    // Return suggested tier immediately if we qualify and aren't overridden
    // This gives instant UI feedback while the DB update happens
    tier: (data?.qualifiesForUpgrade && !data?.tierOverride) ? getSuggestedTier() : (data?.tier || 'street'),
    preset: (data?.qualifiesForUpgrade && !data?.tierOverride) ? getTierPreset(getSuggestedTier()) : (data?.preset || getTierPreset('street')),
    metrics: data?.metrics || null,
    nextTier: data?.nextTier || null,
    nextTierRequirements: data?.nextTierRequirements || null,
    qualifiesForUpgrade: data?.qualifiesForUpgrade || false,
    tierOverride: data?.tierOverride || false,
    score: data?.score || 0,
    progress: data?.progress || 0,

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

