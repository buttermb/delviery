/**
 * Hook for tracking and managing abandoned shopping carts
 * Integrates with storefront cart data to track abandonment
 */

import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';

export interface AbandonedCartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  selected_weight?: string | null;
  image_url?: string | null;
}

export interface AbandonedCart {
  id: string;
  tenant_id: string;
  session_id: string;
  customer_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  menu_id: string | null;
  storefront_id: string | null;
  cart_items: AbandonedCartItem[];
  total_value: number;
  created_at: string;
  updated_at: string;
  recovered: boolean;
  recovered_order_id: string | null;
  recovered_at: string | null;
  source: 'menu' | 'storefront' | 'unknown';
}

export interface AbandonedCartStats {
  total_abandoned: number;
  total_value: number;
  recovered_count: number;
  recovery_rate: number;
  avg_cart_value: number;
  abandonment_by_menu: Record<string, number>;
}

interface UseAbandonedCartsOptions {
  tenantId?: string;
  enabled?: boolean;
  limit?: number;
  includeRecovered?: boolean;
}

/**
 * Hook to fetch and manage abandoned carts for a tenant
 */
export function useAbandonedCarts({
  tenantId,
  enabled = true,
  limit = 50,
  includeRecovered = false,
}: UseAbandonedCartsOptions = {}) {
  const queryClient = useQueryClient();

  // Fetch abandoned carts
  const {
    data: abandonedCarts,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.abandonedCarts.list(tenantId, { limit, includeRecovered }),
    queryFn: async () => {
      if (!tenantId) return [];

      let query = (supabase as any)
        .from('abandoned_carts')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!includeRecovered) {
        query = query.eq('recovered', false);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching abandoned carts', error, 'useAbandonedCarts');
        throw error;
      }

      return (data || []) as AbandonedCart[];
    },
    enabled: !!tenantId && enabled,
    staleTime: 30000, // 30 seconds
  });

  // Fetch abandonment stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.abandonedCarts.stats(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;

      // Get total abandoned carts
      const { count: totalAbandoned, error: countError } = await (supabase as any)
        .from('abandoned_carts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      if (countError) {
        logger.error('Error counting abandoned carts', countError, 'useAbandonedCarts');
        throw countError;
      }

      // Get recovered count
      const { count: recoveredCount, error: recoveredError } = await (supabase as any)
        .from('abandoned_carts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('recovered', true);

      if (recoveredError) {
        logger.error('Error counting recovered carts', recoveredError, 'useAbandonedCarts');
        throw recoveredError;
      }

      // Get total value of abandoned carts
      const { data: valueData, error: valueError } = await (supabase as any)
        .from('abandoned_carts')
        .select('total_value, menu_id')
        .eq('tenant_id', tenantId)
        .eq('recovered', false);

      if (valueError) {
        logger.error('Error fetching cart values', valueError, 'useAbandonedCarts');
        throw valueError;
      }

      const totalValue = valueData?.reduce((sum, cart) => sum + (cart.total_value || 0), 0) || 0;
      const avgCartValue = valueData && valueData.length > 0 ? totalValue / valueData.length : 0;

      // Calculate abandonment by menu
      const abandonmentByMenu: Record<string, number> = {};
      valueData?.forEach((cart) => {
        if (cart.menu_id) {
          abandonmentByMenu[cart.menu_id] = (abandonmentByMenu[cart.menu_id] || 0) + 1;
        }
      });

      const total = totalAbandoned || 0;
      const recovered = recoveredCount || 0;

      return {
        total_abandoned: total,
        total_value: totalValue,
        recovered_count: recovered,
        recovery_rate: total > 0 ? (recovered / total) * 100 : 0,
        avg_cart_value: avgCartValue,
        abandonment_by_menu: abandonmentByMenu,
      } as AbandonedCartStats;
    },
    enabled: !!tenantId && enabled,
    staleTime: 60000, // 1 minute
  });

  // Mark cart as recovered
  const markAsRecoveredMutation = useMutation({
    mutationFn: async ({
      cartId,
      orderId,
    }: {
      cartId: string;
      orderId: string;
    }) => {
      if (!tenantId) throw new Error('No tenant context');

      const { error } = await (supabase as any)
        .from('abandoned_carts')
        .update({
          recovered: true,
          recovered_order_id: orderId,
          recovered_at: new Date().toISOString(),
        })
        .eq('id', cartId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.abandonedCarts.all });
      toast.success('The abandoned cart has been marked as recovered.');
    },
    onError: (error) => {
      logger.error('Failed to mark cart as recovered', error, 'useAbandonedCarts');
      toast.error('Failed to mark cart as recovered.');
    },
  });

  // Record a new abandoned cart
  const recordAbandonedCartMutation = useMutation({
    mutationFn: async (cartData: Omit<AbandonedCart, 'id' | 'created_at' | 'updated_at' | 'recovered' | 'recovered_order_id' | 'recovered_at'>) => {
      if (!tenantId) throw new Error('No tenant context');

      // Check if there's already an abandoned cart for this session
      const { data: existing } = await (supabase as any)
        .from('abandoned_carts')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('session_id', cartData.session_id)
        .eq('recovered', false)
        .maybeSingle();

      if (existing) {
        // Update existing abandoned cart
        const { error } = await (supabase as any)
          .from('abandoned_carts')
          .update({
            cart_items: cartData.cart_items,
            total_value: cartData.total_value,
            customer_id: cartData.customer_id,
            customer_email: cartData.customer_email,
            customer_name: cartData.customer_name,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .eq('tenant_id', tenantId);

        if (error) throw error;
      } else {
        // Create new abandoned cart
        const { error } = await (supabase as any)
          .from('abandoned_carts')
          .insert([{
            ...cartData,
            tenant_id: tenantId,
            recovered: false,
          }]);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.abandonedCarts.all });
      logger.info('Abandoned cart recorded', undefined, 'useAbandonedCarts');
    },
    onError: (error) => {
      logger.error('Failed to record abandoned cart', error, 'useAbandonedCarts');
    },
  });

  // Delete an abandoned cart record
  const deleteAbandonedCartMutation = useMutation({
    mutationFn: async (cartId: string) => {
      if (!tenantId) throw new Error('No tenant context');

      const { error } = await (supabase as any)
        .from('abandoned_carts')
        .delete()
        .eq('id', cartId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.abandonedCarts.all });
      toast.success('The abandoned cart record has been deleted.');
    },
    onError: (error) => {
      logger.error('Failed to delete abandoned cart', error, 'useAbandonedCarts');
      toast.error('Failed to delete abandoned cart.');
    },
  });

  // Set up real-time subscription for new abandoned carts
  useEffect(() => {
    if (!tenantId || !enabled) return;

    const channel = supabase
      .channel(`abandoned-carts-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'abandoned_carts',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          logger.info('Abandoned cart update:', payload, 'useAbandonedCarts');
          queryClient.invalidateQueries({ queryKey: queryKeys.abandonedCarts.all });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, enabled, queryClient]);

  // Helper to generate follow-up suggestions for identified customers
  const getFollowUpSuggestions = useCallback((cart: AbandonedCart) => {
    const suggestions: string[] = [];

    if (cart.customer_email) {
      suggestions.push(`Send recovery email to ${cart.customer_email}`);
    }

    if (cart.total_value > 100) {
      suggestions.push('Consider offering a discount code');
    }

    const hoursSinceAbandonment = (Date.now() - new Date(cart.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursSinceAbandonment < 24) {
      suggestions.push('Send reminder within 24 hours for best recovery chance');
    } else if (hoursSinceAbandonment < 72) {
      suggestions.push('Send follow-up with incentive offer');
    }

    return suggestions;
  }, []);

  return {
    abandonedCarts: abandonedCarts || [],
    stats,
    isLoading,
    statsLoading,
    error,
    refetch,
    markAsRecovered: markAsRecoveredMutation.mutate,
    recordAbandonedCart: recordAbandonedCartMutation.mutate,
    deleteAbandonedCart: deleteAbandonedCartMutation.mutate,
    getFollowUpSuggestions,
    isRecovering: markAsRecoveredMutation.isPending,
    isRecording: recordAbandonedCartMutation.isPending,
    isDeleting: deleteAbandonedCartMutation.isPending,
  };
}

/**
 * Hook to calculate abandonment rate by menu
 */
export function useAbandonmentRate(tenantId?: string, menuId?: string) {
  return useQuery({
    queryKey: queryKeys.abandonedCarts.abandonmentRate(tenantId, menuId),
    queryFn: async () => {
      if (!tenantId) return null;

      // Get total carts (abandoned + completed orders) for this menu
      let abandonedQuery = (supabase as any)
        .from('abandoned_carts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      let ordersQuery = supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      if (menuId) {
        abandonedQuery = (abandonedQuery as any).eq('menu_id', menuId);
        ordersQuery = (ordersQuery as any).eq('menu_id', menuId);
      }

      const [abandonedResult, ordersResult] = await Promise.all([
        abandonedQuery,
        ordersQuery,
      ]);

      if (abandonedResult.error) throw abandonedResult.error;
      if (ordersResult.error) throw ordersResult.error;

      const abandonedCount = abandonedResult.count || 0;
      const completedCount = ordersResult.count || 0;
      const totalCarts = abandonedCount + completedCount;

      return {
        abandonedCount,
        completedCount,
        totalCarts,
        abandonmentRate: totalCarts > 0 ? (abandonedCount / totalCarts) * 100 : 0,
      };
    },
    enabled: !!tenantId,
    staleTime: 60000, // 1 minute
  });
}
