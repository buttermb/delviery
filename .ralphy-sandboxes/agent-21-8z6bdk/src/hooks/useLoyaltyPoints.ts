/**
 * Loyalty Points Hook
 * Provides loyalty points functionality for storefront checkout
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { SETTINGS_QUERY_CONFIG } from '@/lib/react-query-config';
import { logger } from '@/lib/logger';

interface LoyaltyConfig {
  is_active: boolean;
  points_per_dollar: number;
  points_to_dollar_ratio: number;
  signup_bonus_points: number;
}

interface CustomerLoyalty {
  customer_id: string;
  loyalty_points: number;
  lifetime_points: number;
  points_to_dollar_ratio: number;
}

interface RedemptionResult {
  success: boolean;
  new_balance: number;
  discount_amount: number;
  error_message: string | null;
}

/**
 * Hook to get loyalty configuration for a store
 */
export function useLoyaltyConfig(storeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.loyalty.config(storeId ?? ''),
    queryFn: async () => {
      if (!storeId) return null;

      const { data, error } = await supabase
        .from('marketplace_loyalty_config')
        .select('is_active, points_per_dollar, points_to_dollar_ratio, signup_bonus_points')
        .eq('store_id', storeId)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch loyalty config', error, { component: 'useLoyaltyConfig' });
        return null;
      }

      return data as LoyaltyConfig | null;
    },
    enabled: !!storeId,
    ...SETTINGS_QUERY_CONFIG,
  });
}

/**
 * Hook to get customer loyalty points
 */
export function useCustomerLoyalty(storeId: string | undefined, customerEmail: string | undefined) {
  return useQuery({
    queryKey: queryKeys.loyalty.customer(customerEmail ?? ''),
    queryFn: async () => {
      if (!storeId || !customerEmail) return null;

      const { data, error } = await supabase.rpc('get_marketplace_customer_loyalty', {
        p_store_id: storeId,
        p_email: customerEmail,
      });

      if (error) {
        logger.error('Failed to fetch customer loyalty', error, { component: 'useCustomerLoyalty' });
        return null;
      }

      // RPC returns array, get first result
      const result = Array.isArray(data) ? data[0] : data;
      return result as unknown as CustomerLoyalty | null;
    },
    enabled: !!storeId && !!customerEmail,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to redeem loyalty points
 */
export function useRedeemLoyaltyPoints() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      storeId,
      customerEmail,
      pointsToRedeem,
      orderId,
    }: {
      storeId: string;
      customerEmail: string;
      pointsToRedeem: number;
      orderId?: string;
    }) => {
      const { data, error } = await supabase.rpc('redeem_marketplace_loyalty_points', {
        p_store_id: storeId,
        p_customer_email: customerEmail,
        p_points_to_redeem: pointsToRedeem,
        p_order_id: orderId || null,
      });

      if (error) {
        logger.error('Failed to redeem loyalty points', error, { component: 'useRedeemLoyaltyPoints' });
        throw new Error(error.message);
      }

      // RPC returns array, get first result
      const result = Array.isArray(data) ? data[0] : data;
      const typedResult = result as unknown as RedemptionResult;

      if (!typedResult?.success) {
        throw new Error(typedResult?.error_message || 'Failed to redeem points');
      }

      return typedResult;
    },
    onSuccess: (_, variables) => {
      // Invalidate customer loyalty cache
      queryClient.invalidateQueries({
        queryKey: queryKeys.loyalty.customer(variables.customerEmail),
      });
    },
  });
}

/**
 * Calculate points that will be earned for an order
 */
export function calculatePointsToEarn(orderTotal: number, pointsPerDollar: number): number {
  return Math.floor(orderTotal * pointsPerDollar);
}

/**
 * Calculate dollar value of points
 */
export function calculatePointsValue(points: number, pointsToDollarRatio: number): number {
  return points / pointsToDollarRatio;
}

/**
 * Combined hook for checkout loyalty functionality
 */
export function useCheckoutLoyalty(
  storeId: string | undefined,
  customerEmail: string | undefined,
  orderSubtotal: number
) {
  const { data: config, isLoading: configLoading } = useLoyaltyConfig(storeId);
  const { data: customerLoyalty, isLoading: loyaltyLoading } = useCustomerLoyalty(storeId, customerEmail);
  const redeemMutation = useRedeemLoyaltyPoints();

  const isActive = config?.is_active ?? false;
  const pointsPerDollar = config?.points_per_dollar ?? 1;
  const pointsToDollarRatio = customerLoyalty?.points_to_dollar_ratio ?? config?.points_to_dollar_ratio ?? 100;
  const currentPoints = customerLoyalty?.loyalty_points ?? 0;
  const lifetimePoints = customerLoyalty?.lifetime_points ?? 0;

  // Calculate points that will be earned from this order
  const pointsToEarn = calculatePointsToEarn(orderSubtotal, pointsPerDollar);

  // Calculate the dollar value of current points
  const pointsValueInDollars = calculatePointsValue(currentPoints, pointsToDollarRatio);

  // Maximum discount is limited to order subtotal
  const maxRedeemablePoints = Math.min(currentPoints, Math.floor(orderSubtotal * pointsToDollarRatio));
  const maxDiscount = Math.min(pointsValueInDollars, orderSubtotal);

  return {
    // Loading states
    isLoading: configLoading || loyaltyLoading,

    // Config
    isActive,
    pointsPerDollar,
    pointsToDollarRatio,

    // Customer data
    currentPoints,
    lifetimePoints,
    pointsValueInDollars,

    // Order-specific calculations
    pointsToEarn,
    maxRedeemablePoints,
    maxDiscount,

    // Actions
    redeemPoints: redeemMutation.mutate,
    redeemPointsAsync: redeemMutation.mutateAsync,
    isRedeeming: redeemMutation.isPending,
    redemptionError: redeemMutation.error,
  };
}
