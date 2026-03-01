/**
 * useCustomerLoyalty Hook
 *
 * Points-based loyalty system for admin-side customer management.
 * Supports:
 * - Earn points on purchases (configurable rate per tenant)
 * - Redeem points for discounts on future orders
 * - Points balance display on customer detail
 * - Points history log
 * - Tier system (bronze/silver/gold based on points)
 * - Configurable tier benefits
 *
 * Connects orders, payments, and customer modules.
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

// ============================================================================
// Types
// ============================================================================

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type PointTransactionType = 'earned' | 'redeemed' | 'adjusted' | 'expired' | 'bonus';

export interface LoyaltyConfig {
  id: string;
  tenant_id: string;
  is_active: boolean;
  points_per_dollar: number;
  points_to_dollar_ratio: number; // How many points = $1
  signup_bonus_points: number;
  referral_bonus_points: number;
  birthday_bonus_points: number;
  // Tier thresholds (lifetime points)
  bronze_threshold: number;
  silver_threshold: number;
  gold_threshold: number;
  platinum_threshold: number;
  // Tier benefits (multipliers)
  bronze_multiplier: number;
  silver_multiplier: number;
  gold_multiplier: number;
  platinum_multiplier: number;
  // Expiration settings
  points_expiration_months: number | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerLoyaltyStatus {
  customer_id: string;
  current_points: number;
  lifetime_points: number;
  tier: LoyaltyTier;
  tier_multiplier: number;
  points_to_next_tier: number | null;
  next_tier: LoyaltyTier | null;
  points_expiring_soon: number;
  points_expiration_date: string | null;
}

export interface LoyaltyPointTransaction {
  id: string;
  tenant_id: string;
  customer_id: string;
  points: number;
  type: PointTransactionType;
  reference_type: string | null;
  reference_id: string | null;
  balance_after: number;
  description: string | null;
  created_at: string;
  created_by: string | null;
}

export interface AwardPointsParams {
  customerId: string;
  points: number;
  type: PointTransactionType;
  referenceType?: string;
  referenceId?: string;
  description?: string;
}

export interface RedeemPointsParams {
  customerId: string;
  points: number;
  orderId?: string;
  description?: string;
}

export interface AdjustPointsParams {
  customerId: string;
  points: number; // Can be positive or negative
  reason: string;
}

export interface LoyaltyConfigFormValues {
  is_active: boolean;
  points_per_dollar: number;
  points_to_dollar_ratio: number;
  signup_bonus_points: number;
  referral_bonus_points: number;
  birthday_bonus_points: number;
  bronze_threshold: number;
  silver_threshold: number;
  gold_threshold: number;
  platinum_threshold: number;
  bronze_multiplier: number;
  silver_multiplier: number;
  gold_multiplier: number;
  platinum_multiplier: number;
  points_expiration_months: number | null;
}

// ============================================================================
// Query Keys
// ============================================================================

export const customerLoyaltyKeys = {
  all: ['customer-loyalty'] as const,
  config: (tenantId: string) => [...customerLoyaltyKeys.all, 'config', tenantId] as const,
  status: (tenantId: string, customerId: string) =>
    [...customerLoyaltyKeys.all, 'status', tenantId, customerId] as const,
  history: (tenantId: string, customerId: string) =>
    [...customerLoyaltyKeys.all, 'history', tenantId, customerId] as const,
  analytics: (tenantId: string) =>
    [...customerLoyaltyKeys.all, 'analytics', tenantId] as const,
  leaderboard: (tenantId: string) =>
    [...customerLoyaltyKeys.all, 'leaderboard', tenantId] as const,
};

// ============================================================================
// Default Config Values
// ============================================================================

const DEFAULT_CONFIG: Omit<LoyaltyConfig, 'id' | 'tenant_id' | 'created_at' | 'updated_at'> = {
  is_active: false,
  points_per_dollar: 1,
  points_to_dollar_ratio: 100, // 100 points = $1
  signup_bonus_points: 0,
  referral_bonus_points: 0,
  birthday_bonus_points: 0,
  bronze_threshold: 0,
  silver_threshold: 500,
  gold_threshold: 2000,
  platinum_threshold: 5000,
  bronze_multiplier: 1.0,
  silver_multiplier: 1.25,
  gold_multiplier: 1.5,
  platinum_multiplier: 2.0,
  points_expiration_months: null,
};

// ============================================================================
// Tier Utility Functions
// ============================================================================

export function calculateTier(lifetimePoints: number, config: LoyaltyConfig): LoyaltyTier {
  if (lifetimePoints >= config.platinum_threshold) return 'platinum';
  if (lifetimePoints >= config.gold_threshold) return 'gold';
  if (lifetimePoints >= config.silver_threshold) return 'silver';
  return 'bronze';
}

export function getTierMultiplier(tier: LoyaltyTier, config: LoyaltyConfig): number {
  switch (tier) {
    case 'platinum':
      return config.platinum_multiplier;
    case 'gold':
      return config.gold_multiplier;
    case 'silver':
      return config.silver_multiplier;
    default:
      return config.bronze_multiplier;
  }
}

export function getNextTier(currentTier: LoyaltyTier): LoyaltyTier | null {
  switch (currentTier) {
    case 'bronze':
      return 'silver';
    case 'silver':
      return 'gold';
    case 'gold':
      return 'platinum';
    default:
      return null;
  }
}

export function getPointsToNextTier(
  lifetimePoints: number,
  currentTier: LoyaltyTier,
  config: LoyaltyConfig
): number | null {
  const nextTier = getNextTier(currentTier);
  if (!nextTier) return null;

  const thresholds: Record<LoyaltyTier, number> = {
    bronze: config.bronze_threshold,
    silver: config.silver_threshold,
    gold: config.gold_threshold,
    platinum: config.platinum_threshold,
  };

  return Math.max(0, thresholds[nextTier] - lifetimePoints);
}

export function calculatePointsToEarn(
  orderTotal: number,
  pointsPerDollar: number,
  tierMultiplier: number
): number {
  return Math.floor(orderTotal * pointsPerDollar * tierMultiplier);
}

export function calculatePointsValue(points: number, pointsToDollarRatio: number): number {
  return points / pointsToDollarRatio;
}

export const TIER_DISPLAY_INFO: Record<LoyaltyTier, { label: string; color: string; bgColor: string }> = {
  bronze: { label: 'Bronze', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  silver: { label: 'Silver', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  gold: { label: 'Gold', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  platinum: { label: 'Platinum', color: 'text-purple-600', bgColor: 'bg-purple-100' },
};

// ============================================================================
// Data Fetching Functions
// ============================================================================

async function fetchLoyaltyConfig(tenantId: string): Promise<LoyaltyConfig | null> {
  const { data, error } = await supabase
    .from('loyalty_config')
    .select('id, tenant_id, is_active, points_per_dollar, points_to_dollar_ratio, signup_bonus_points, referral_bonus_points, birthday_bonus_points, bronze_threshold, silver_threshold, gold_threshold, platinum_threshold, bronze_multiplier, silver_multiplier, gold_multiplier, platinum_multiplier, points_expiration_months, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    logger.error('Failed to fetch loyalty config', error, {
      tenantId,
      component: 'useCustomerLoyalty',
    });
    throw error;
  }

  return data as LoyaltyConfig | null;
}

async function fetchCustomerLoyaltyStatus(
  tenantId: string,
  customerId: string,
  config: LoyaltyConfig | null
): Promise<CustomerLoyaltyStatus> {
  // Get current points balance
  const { data: pointsData, error: pointsError } = await supabase
    .from('loyalty_points')
    .select('points, type, created_at')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (pointsError) {
    logger.error('Failed to fetch customer loyalty points', pointsError, {
      tenantId,
      customerId,
      component: 'useCustomerLoyalty',
    });
    throw pointsError;
  }

  const transactions = pointsData ?? [];

  // Calculate current balance and lifetime earned
  let currentPoints = 0;
  let lifetimePoints = 0;

  for (const tx of transactions) {
    currentPoints += tx.points;
    if (tx.type === 'earned' || tx.type === 'bonus') {
      lifetimePoints += tx.points;
    }
  }

  // Ensure non-negative
  currentPoints = Math.max(0, currentPoints);
  lifetimePoints = Math.max(0, lifetimePoints);

  // Use default config if none exists
  const effectiveConfig = config || (DEFAULT_CONFIG as LoyaltyConfig);

  // Calculate tier
  const tier = calculateTier(lifetimePoints, effectiveConfig);
  const tierMultiplier = getTierMultiplier(tier, effectiveConfig);
  const nextTier = getNextTier(tier);
  const pointsToNextTier = getPointsToNextTier(lifetimePoints, tier, effectiveConfig);

  // Calculate expiring points if expiration is configured
  let pointsExpiringSoon = 0;
  let pointsExpirationDate: string | null = null;

  if (effectiveConfig.points_expiration_months) {
    const expirationThreshold = new Date();
    expirationThreshold.setMonth(
      expirationThreshold.getMonth() - effectiveConfig.points_expiration_months + 1
    );

    // Points earned before the expiration threshold that haven't been redeemed
    for (const tx of transactions) {
      if (
        (tx.type === 'earned' || tx.type === 'bonus') &&
        new Date(tx.created_at) < expirationThreshold
      ) {
        pointsExpiringSoon += tx.points;
      }
    }

    if (pointsExpiringSoon > 0) {
      const expDate = new Date();
      expDate.setMonth(expDate.getMonth() + 1);
      pointsExpirationDate = expDate.toISOString();
    }
  }

  return {
    customer_id: customerId,
    current_points: currentPoints,
    lifetime_points: lifetimePoints,
    tier,
    tier_multiplier: tierMultiplier,
    points_to_next_tier: pointsToNextTier,
    next_tier: nextTier,
    points_expiring_soon: pointsExpiringSoon,
    points_expiration_date: pointsExpirationDate,
  };
}

async function fetchPointsHistory(
  tenantId: string,
  customerId: string,
  limit = 50
): Promise<LoyaltyPointTransaction[]> {
  const { data, error } = await supabase
    .from('loyalty_points')
    .select('id, tenant_id, customer_id, points, type, reference_type, reference_id, balance_after, description, created_at, created_by')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to fetch points history', error, {
      tenantId,
      customerId,
      component: 'useCustomerLoyalty',
    });
    throw error;
  }

  return (data ?? []) as unknown as LoyaltyPointTransaction[];
}

// ============================================================================
// Main Hook: useLoyaltyConfig
// ============================================================================

export interface UseLoyaltyConfigReturn {
  config: LoyaltyConfig | null;
  effectiveConfig: LoyaltyConfig;
  isLoading: boolean;
  error: Error | null;
  isActive: boolean;
  updateConfig: (data: LoyaltyConfigFormValues) => Promise<LoyaltyConfig | null>;
  isUpdating: boolean;
  refetch: () => void;
}

export function useLoyaltyConfig(): UseLoyaltyConfigReturn {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  // Fetch config
  const {
    data: config,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: customerLoyaltyKeys.config(tenantId ?? ''),
    queryFn: () => fetchLoyaltyConfig(tenantId!),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Create effective config with defaults
  const effectiveConfig = useMemo((): LoyaltyConfig => {
    if (config) return config;
    return {
      ...DEFAULT_CONFIG,
      id: '',
      tenant_id: tenantId ?? '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as LoyaltyConfig;
  }, [config, tenantId]);

  // Update/create config mutation
  const updateMutation = useMutation({
    mutationFn: async (data: LoyaltyConfigFormValues): Promise<LoyaltyConfig> => {
      if (!tenantId) throw new Error('No tenant context');

      // Check if config exists
      const existing = await fetchLoyaltyConfig(tenantId);

      if (existing) {
        // Update existing
        const { data: updated, error } = await supabase
          .from('loyalty_config')
          .update({
            ...data,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .eq('tenant_id', tenantId)
          .select()
          .maybeSingle();

        if (error) {
          logger.error('Failed to update loyalty config', error, {
            tenantId,
            component: 'useLoyaltyConfig',
          });
          throw error;
        }

        logger.info('Loyalty config updated', {
          tenantId,
          isActive: data.is_active,
          component: 'useLoyaltyConfig',
        });

        return updated as LoyaltyConfig;
      } else {
        // Create new
        const { data: created, error } = await supabase
          .from('loyalty_config')
          .insert({
            tenant_id: tenantId,
            ...data,
            created_by: admin?.userId || null,
          })
          .select()
          .maybeSingle();

        if (error) {
          logger.error('Failed to create loyalty config', error, {
            tenantId,
            component: 'useLoyaltyConfig',
          });
          throw error;
        }

        logger.info('Loyalty config created', {
          tenantId,
          isActive: data.is_active,
          component: 'useLoyaltyConfig',
        });

        return created as LoyaltyConfig;
      }
    },
    onSuccess: () => {
      toast.success('Loyalty configuration saved successfully');
      queryClient.invalidateQueries({
        queryKey: customerLoyaltyKeys.config(tenantId!),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to save loyalty configuration'));
    },
  });

  const updateConfig = useCallback(
    async (data: LoyaltyConfigFormValues): Promise<LoyaltyConfig | null> => {
      try {
        return await updateMutation.mutateAsync(data);
      } catch {
        return null;
      }
    },
    [updateMutation]
  );

  return {
    config: config ?? null,
    effectiveConfig,
    isLoading,
    error: error as Error | null,
    isActive: config?.is_active ?? false,
    updateConfig,
    isUpdating: updateMutation.isPending,
    refetch,
  };
}

// ============================================================================
// Customer Loyalty Status Hook
// ============================================================================

export interface UseCustomerLoyaltyStatusOptions {
  customerId: string | undefined;
  enabled?: boolean;
}

export interface UseCustomerLoyaltyStatusReturn {
  status: CustomerLoyaltyStatus | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useCustomerLoyaltyStatus({
  customerId,
  enabled = true,
}: UseCustomerLoyaltyStatusOptions): UseCustomerLoyaltyStatusReturn {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  // First get the config
  const { config } = useLoyaltyConfig();

  // Then get the status
  const { data: status, isLoading, error, refetch } = useQuery({
    queryKey: customerLoyaltyKeys.status(tenantId ?? '', customerId ?? ''),
    queryFn: () => fetchCustomerLoyaltyStatus(tenantId!, customerId!, config),
    enabled: enabled && !!tenantId && !!customerId,
    staleTime: 30000, // 30 seconds
  });

  return {
    status: status ?? null,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

// ============================================================================
// Points History Hook
// ============================================================================

export interface UsePointsHistoryOptions {
  customerId: string | undefined;
  limit?: number;
  enabled?: boolean;
}

export interface UsePointsHistoryReturn {
  history: LoyaltyPointTransaction[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function usePointsHistory({
  customerId,
  limit = 50,
  enabled = true,
}: UsePointsHistoryOptions): UsePointsHistoryReturn {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data: history, isLoading, error, refetch } = useQuery({
    queryKey: customerLoyaltyKeys.history(tenantId ?? '', customerId ?? ''),
    queryFn: () => fetchPointsHistory(tenantId!, customerId!, limit),
    enabled: enabled && !!tenantId && !!customerId,
    staleTime: 30000,
  });

  return {
    history: history ?? [],
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

// ============================================================================
// Points Mutations Hook
// ============================================================================

export interface UsePointsMutationsReturn {
  awardPoints: (params: AwardPointsParams) => Promise<LoyaltyPointTransaction | null>;
  redeemPoints: (params: RedeemPointsParams) => Promise<LoyaltyPointTransaction | null>;
  adjustPoints: (params: AdjustPointsParams) => Promise<LoyaltyPointTransaction | null>;
  isAwarding: boolean;
  isRedeeming: boolean;
  isAdjusting: boolean;
}

export function usePointsMutations(): UsePointsMutationsReturn {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  // Award points mutation
  const awardMutation = useMutation({
    mutationFn: async (params: AwardPointsParams): Promise<LoyaltyPointTransaction> => {
      if (!tenantId) throw new Error('No tenant context');

      // Get current balance to calculate balance_after
      const loyaltyStatus = await fetchCustomerLoyaltyStatus(tenantId, params.customerId, null);
      const currentBalance = loyaltyStatus?.current_points ?? 0;
      const newBalance = currentBalance + params.points;

      const { data, error } = await supabase
        .from('loyalty_points')
        .insert({
          tenant_id: tenantId,
          customer_id: params.customerId,
          points: params.points,
          type: params.type,
          reference_type: params.referenceType || null,
          reference_id: params.referenceId || null,
          balance_after: newBalance,
          description: params.description || null,
          created_by: admin?.userId || null,
        })
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to award loyalty points', error, {
          tenantId,
          customerId: params.customerId,
          points: params.points,
          component: 'usePointsMutations',
        });
        throw error;
      }

      logger.info('Loyalty points awarded', {
        tenantId,
        customerId: params.customerId,
        points: params.points,
        type: params.type,
        component: 'usePointsMutations',
      });

      return data as unknown as LoyaltyPointTransaction;
    },
    onSuccess: (_data, variables) => {
      toast.success('Points awarded successfully');
      queryClient.invalidateQueries({
        queryKey: customerLoyaltyKeys.status(tenantId!, variables.customerId),
      });
      queryClient.invalidateQueries({
        queryKey: customerLoyaltyKeys.history(tenantId!, variables.customerId),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to award points'));
    },
  });

  // Redeem points mutation
  const redeemMutation = useMutation({
    mutationFn: async (params: RedeemPointsParams): Promise<LoyaltyPointTransaction> => {
      if (!tenantId) throw new Error('No tenant context');

      // Get current balance
      const loyaltyStatus = await fetchCustomerLoyaltyStatus(tenantId, params.customerId, null);
      const currentBalance = loyaltyStatus?.current_points ?? 0;

      if (params.points > currentBalance) {
        throw new Error(`Insufficient points. Current balance: ${currentBalance}`);
      }

      const newBalance = currentBalance - params.points;

      const { data, error } = await supabase
        .from('loyalty_points')
        .insert({
          tenant_id: tenantId,
          customer_id: params.customerId,
          points: -params.points,
          type: 'redeemed',
          reference_type: params.orderId ? 'order' : null,
          reference_id: params.orderId || null,
          balance_after: newBalance,
          description: params.description || 'Points redeemed for order',
          created_by: admin?.userId || null,
        })
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to redeem loyalty points', error, {
          tenantId,
          customerId: params.customerId,
          points: params.points,
          component: 'usePointsMutations',
        });
        throw error;
      }

      logger.info('Loyalty points redeemed', {
        tenantId,
        customerId: params.customerId,
        points: params.points,
        orderId: params.orderId,
        component: 'usePointsMutations',
      });

      return data as LoyaltyPointTransaction;
    },
    onSuccess: (_data, variables) => {
      toast.success('Points redeemed successfully');
      queryClient.invalidateQueries({
        queryKey: customerLoyaltyKeys.status(tenantId!, variables.customerId),
      });
      queryClient.invalidateQueries({
        queryKey: customerLoyaltyKeys.history(tenantId!, variables.customerId),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to redeem points'));
    },
  });

  // Adjust points mutation (for manual adjustments)
  const adjustMutation = useMutation({
    mutationFn: async (params: AdjustPointsParams): Promise<LoyaltyPointTransaction> => {
      if (!tenantId) throw new Error('No tenant context');

      // Get current balance
      const loyaltyStatus = await fetchCustomerLoyaltyStatus(tenantId, params.customerId, null);
      const currentBalance = loyaltyStatus?.current_points ?? 0;
      const newBalance = Math.max(0, currentBalance + params.points);

      const { data, error } = await supabase
        .from('loyalty_points')
        .insert({
          tenant_id: tenantId,
          customer_id: params.customerId,
          points: params.points,
          type: 'adjusted',
          reference_type: null,
          reference_id: null,
          balance_after: newBalance,
          description: params.reason,
          created_by: admin?.userId || null,
        })
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to adjust loyalty points', error, {
          tenantId,
          customerId: params.customerId,
          points: params.points,
          component: 'usePointsMutations',
        });
        throw error;
      }

      logger.info('Loyalty points adjusted', {
        tenantId,
        customerId: params.customerId,
        points: params.points,
        reason: params.reason,
        component: 'usePointsMutations',
      });

      return data as LoyaltyPointTransaction;
    },
    onSuccess: (_data, variables) => {
      toast.success('Points adjusted successfully');
      queryClient.invalidateQueries({
        queryKey: customerLoyaltyKeys.status(tenantId!, variables.customerId),
      });
      queryClient.invalidateQueries({
        queryKey: customerLoyaltyKeys.history(tenantId!, variables.customerId),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to adjust points'));
    },
  });

  const awardPoints = useCallback(
    async (params: AwardPointsParams): Promise<LoyaltyPointTransaction | null> => {
      try {
        return await awardMutation.mutateAsync(params);
      } catch {
        return null;
      }
    },
    [awardMutation]
  );

  const redeemPoints = useCallback(
    async (params: RedeemPointsParams): Promise<LoyaltyPointTransaction | null> => {
      try {
        return await redeemMutation.mutateAsync(params);
      } catch {
        return null;
      }
    },
    [redeemMutation]
  );

  const adjustPoints = useCallback(
    async (params: AdjustPointsParams): Promise<LoyaltyPointTransaction | null> => {
      try {
        return await adjustMutation.mutateAsync(params);
      } catch {
        return null;
      }
    },
    [adjustMutation]
  );

  return {
    awardPoints,
    redeemPoints,
    adjustPoints,
    isAwarding: awardMutation.isPending,
    isRedeeming: redeemMutation.isPending,
    isAdjusting: adjustMutation.isPending,
  };
}

// ============================================================================
// Combined Hook: useCustomerLoyalty
// ============================================================================

export interface UseCustomerLoyaltyOptions {
  customerId: string | undefined;
  enabled?: boolean;
}

export interface UseCustomerLoyaltyReturn {
  // Config
  config: LoyaltyConfig | null;
  effectiveConfig: LoyaltyConfig;
  isActive: boolean;

  // Customer status
  status: CustomerLoyaltyStatus | null;
  history: LoyaltyPointTransaction[];

  // Loading states
  isLoading: boolean;
  isLoadingHistory: boolean;
  error: Error | null;

  // Mutations
  awardPoints: (params: AwardPointsParams) => Promise<LoyaltyPointTransaction | null>;
  redeemPoints: (params: RedeemPointsParams) => Promise<LoyaltyPointTransaction | null>;
  adjustPoints: (params: AdjustPointsParams) => Promise<LoyaltyPointTransaction | null>;
  updateConfig: (data: LoyaltyConfigFormValues) => Promise<LoyaltyConfig | null>;

  // Mutation states
  isAwarding: boolean;
  isRedeeming: boolean;
  isAdjusting: boolean;
  isUpdatingConfig: boolean;

  // Helpers
  calculateEarnedPoints: (orderTotal: number) => number;
  calculateRedemptionValue: (points: number) => number;
  canRedeem: (points: number) => boolean;

  // Refetch
  refetch: () => void;
  refetchHistory: () => void;
}

export function useCustomerLoyalty({
  customerId,
  enabled = true,
}: UseCustomerLoyaltyOptions): UseCustomerLoyaltyReturn {
  // Get config
  const {
    config,
    effectiveConfig,
    isActive,
    isLoading: isLoadingConfig,
    error: configError,
    updateConfig,
    isUpdating: isUpdatingConfig,
    refetch: refetchConfig,
  } = useLoyaltyConfig();

  // Get status
  const {
    status,
    isLoading: isLoadingStatus,
    error: statusError,
    refetch: refetchStatus,
  } = useCustomerLoyaltyStatus({
    customerId,
    enabled: enabled && !!customerId,
  });

  // Get history
  const {
    history,
    isLoading: isLoadingHistory,
    error: historyError,
    refetch: refetchHistory,
  } = usePointsHistory({
    customerId,
    enabled: enabled && !!customerId,
  });

  // Get mutations
  const {
    awardPoints,
    redeemPoints,
    adjustPoints,
    isAwarding,
    isRedeeming,
    isAdjusting,
  } = usePointsMutations();

  // Helper functions
  const calculateEarnedPoints = useCallback(
    (orderTotal: number): number => {
      const tierMultiplier = status?.tier_multiplier ?? 1;
      return calculatePointsToEarn(
        orderTotal,
        effectiveConfig.points_per_dollar,
        tierMultiplier
      );
    },
    [effectiveConfig.points_per_dollar, status?.tier_multiplier]
  );

  const calculateRedemptionValue = useCallback(
    (points: number): number => {
      return calculatePointsValue(points, effectiveConfig.points_to_dollar_ratio);
    },
    [effectiveConfig.points_to_dollar_ratio]
  );

  const canRedeem = useCallback(
    (points: number): boolean => {
      if (!status) return false;
      return status.current_points >= points;
    },
    [status]
  );

  const refetch = useCallback(() => {
    refetchConfig();
    refetchStatus();
  }, [refetchConfig, refetchStatus]);

  return {
    // Config
    config,
    effectiveConfig,
    isActive,

    // Customer status
    status,
    history,

    // Loading states
    isLoading: isLoadingConfig || isLoadingStatus,
    isLoadingHistory,
    error: configError || statusError || historyError,

    // Mutations
    awardPoints,
    redeemPoints,
    adjustPoints,
    updateConfig,

    // Mutation states
    isAwarding,
    isRedeeming,
    isAdjusting,
    isUpdatingConfig,

    // Helpers
    calculateEarnedPoints,
    calculateRedemptionValue,
    canRedeem,

    // Refetch
    refetch,
    refetchHistory,
  };
}

// ============================================================================
// Utility: Award points on order completion
// ============================================================================

export async function awardPointsForOrder(
  tenantId: string,
  customerId: string,
  orderId: string,
  orderTotal: number,
  userId?: string
): Promise<boolean> {
  try {
    // Get loyalty config
    const config = await fetchLoyaltyConfig(tenantId);

    if (!config?.is_active) {
      logger.debug('Loyalty program not active, skipping points award', {
        tenantId,
        component: 'awardPointsForOrder',
      });
      return false;
    }

    // Get customer status for tier multiplier
    const status = await fetchCustomerLoyaltyStatus(tenantId, customerId, config);
    const tierMultiplier = status.tier_multiplier;

    // Calculate points
    const points = calculatePointsToEarn(
      orderTotal,
      config.points_per_dollar,
      tierMultiplier
    );

    if (points <= 0) {
      return false;
    }

    // Get current balance for balance_after
    const newBalance = status.current_points + points;

    // Insert points transaction
    const { error } = await supabase.from('loyalty_points').insert({
      tenant_id: tenantId,
      customer_id: customerId,
      points,
      type: 'earned',
      reference_type: 'order',
      reference_id: orderId,
      balance_after: newBalance,
      description: `Points earned from order`,
      created_by: userId || null,
    });

    if (error) {
      logger.error('Failed to award points for order', error, {
        tenantId,
        customerId,
        orderId,
        points,
        component: 'awardPointsForOrder',
      });
      return false;
    }

    logger.info('Points awarded for order', {
      tenantId,
      customerId,
      orderId,
      points,
      tierMultiplier,
      component: 'awardPointsForOrder',
    });

    return true;
  } catch (error) {
    logger.error(
      'Error awarding points for order',
      error instanceof Error ? error : new Error(String(error)),
      {
        tenantId,
        customerId,
        orderId,
        component: 'awardPointsForOrder',
      }
    );
    return false;
  }
}
