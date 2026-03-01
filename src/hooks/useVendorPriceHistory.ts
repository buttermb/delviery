import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';

export interface VendorPriceHistoryEntry {
  id: string;
  product_id: string;
  product_name: string;
  cost_old: number;
  cost_new: number;
  change_percent: number;
  change_reason: string | null;
  change_source: string;
  changed_at: string;
}

export interface VendorPriceAlert {
  id: string;
  tenant_id: string;
  vendor_id: string;
  product_id: string;
  pricing_history_id: string | null;
  cost_old: number;
  cost_new: number;
  change_percent: number;
  is_dismissed: boolean;
  dismissed_by: string | null;
  dismissed_at: string | null;
  created_at: string;
  product?: {
    name: string;
    sku: string | null;
  };
}

export interface VendorPriceAlertSettings {
  id: string;
  tenant_id: string;
  vendor_id: string | null;
  product_id: string | null;
  alert_threshold_percent: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Hook to fetch vendor price history
 */
export function useVendorPriceHistory(vendorId: string, productId?: string) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: [...queryKeys.vendors.detail(tenant?.id ?? '', vendorId), 'price-history', productId],
    queryFn: async () => {
      if (!tenant?.id || !vendorId) return [];

      const { data, error } = await supabase.rpc('get_vendor_price_history', {
        p_tenant_id: tenant.id,
        p_vendor_id: vendorId,
        p_product_id: productId || null,
        p_limit: 100,
      });

      if (error) {
        logger.error('Failed to fetch vendor price history', error, {
          component: 'useVendorPriceHistory',
          vendorId,
          productId,
        });
        throw error;
      }

      return (data ?? []) as unknown as VendorPriceHistoryEntry[];
    },
    enabled: !!tenant?.id && !!vendorId,
  });
}

/**
 * Hook to fetch active (undismissed) vendor price alerts
 */
export function useVendorPriceAlerts(vendorId?: string) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: [...queryKeys.vendors.all, 'price-alerts', tenant?.id, vendorId],
    queryFn: async () => {
      if (!tenant?.id) return [];

      let query = supabase
        .from('vendor_price_alerts')
        .select(`
          *,
          product:products(name, sku)
        `)
        .eq('tenant_id', tenant.id)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false });

      if (vendorId) {
        query = query.eq('vendor_id', vendorId);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch vendor price alerts', error, {
          component: 'useVendorPriceAlerts',
          vendorId,
        });
        throw error;
      }

      return (data ?? []) as VendorPriceAlert[];
    },
    enabled: !!tenant?.id,
  });
}

/**
 * Hook to dismiss a price alert
 */
export function useDismissPriceAlert() {
  const queryClient = useQueryClient();
  const { tenant, admin: user } = useTenantAdminAuth();

  return useMutation({
    mutationFn: async (alertId: string) => {
      if (!tenant?.id) throw new Error('No tenant context');

      const { error } = await supabase
        .from('vendor_price_alerts')
        .update({
          is_dismissed: true,
          dismissed_by: user?.id || null,
          dismissed_at: new Date().toISOString(),
        })
        .eq('id', alertId)
        .eq('tenant_id', tenant.id);

      if (error) {
        logger.error('Failed to dismiss price alert', error, {
          component: 'useDismissPriceAlert',
          alertId,
        });
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Price alert dismissed');
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.vendors.all, 'price-alerts'],
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to dismiss price alert'));
    },
  });
}

/**
 * Hook to manage vendor price alert settings
 */
export function useVendorPriceAlertSettings(vendorId: string) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: [...queryKeys.vendors.detail(tenant?.id ?? '', vendorId), 'alert-settings'],
    queryFn: async () => {
      if (!tenant?.id || !vendorId) return [];

      const { data, error } = await supabase
        .from('vendor_price_alert_settings')
        .select('id, tenant_id, vendor_id, product_id, alert_threshold_percent, is_enabled, created_at, updated_at')
        .eq('tenant_id', tenant.id)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch alert settings', error, {
          component: 'useVendorPriceAlertSettings',
          vendorId,
        });
        throw error;
      }

      return (data ?? []) as VendorPriceAlertSettings[];
    },
    enabled: !!tenant?.id && !!vendorId,
  });
}

/**
 * Hook to update/create vendor price alert settings
 */
export function useUpdatePriceAlertSettings() {
  const queryClient = useQueryClient();
  const { tenant } = useTenantAdminAuth();

  return useMutation({
    mutationFn: async (settings: {
      vendorId: string;
      productId?: string;
      thresholdPercent: number;
      isEnabled: boolean;
    }) => {
      if (!tenant?.id) throw new Error('No tenant context');

      const { error } = await supabase
        .from('vendor_price_alert_settings')
        .upsert(
          {
            tenant_id: tenant.id,
            vendor_id: settings.vendorId,
            product_id: settings.productId || null,
            alert_threshold_percent: settings.thresholdPercent,
            is_enabled: settings.isEnabled,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'tenant_id,vendor_id,product_id',
          }
        );

      if (error) {
        logger.error('Failed to update alert settings', error, {
          component: 'useUpdatePriceAlertSettings',
          settings,
        });
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      toast.success('Alert settings updated successfully');
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.vendors.detail(tenant?.id ?? '', variables.vendorId), 'alert-settings'],
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to update alert settings'));
    },
  });
}

/**
 * Hook to log a vendor price change (called when PO is created with different cost)
 */
export function useLogVendorPriceChange() {
  const queryClient = useQueryClient();
  const { tenant, admin: user } = useTenantAdminAuth();

  return useMutation({
    mutationFn: async (params: {
      productId: string;
      vendorId: string;
      costOld: number;
      costNew: number;
      reason?: string;
      source?: string;
    }) => {
      if (!tenant?.id) throw new Error('No tenant context');

      // Skip if no actual change
      if (params.costOld === params.costNew) return null;

      const { data, error } = await supabase.rpc('log_vendor_price_change', {
        p_product_id: params.productId,
        p_tenant_id: tenant.id,
        p_vendor_id: params.vendorId,
        p_cost_old: params.costOld,
        p_cost_new: params.costNew,
        p_changed_by: user?.id || null,
        p_reason: params.reason || null,
        p_source: params.source || 'purchase_order',
      });

      if (error) {
        logger.error('Failed to log vendor price change', error, {
          component: 'useLogVendorPriceChange',
          params,
        });
        throw error;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      toast.success('Price change logged successfully');
      // Invalidate price history queries
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.vendors.detail(tenant?.id ?? '', variables.vendorId), 'price-history'],
      });
      // Invalidate alerts
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.vendors.all, 'price-alerts'],
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to log price change'));
    },
  });
}

/**
 * Hook to get product price trend data for charts
 */
export function useProductPriceTrend(vendorId: string, productId: string) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: [...queryKeys.vendors.detail(tenant?.id ?? '', vendorId), 'price-trend', productId],
    queryFn: async () => {
      if (!tenant?.id || !vendorId || !productId) return [];

      const { data, error } = await supabase
        .from('pricing_history')
        .select('id, cost_per_unit_new, created_at')
        .eq('tenant_id', tenant.id)
        .eq('vendor_id', vendorId)
        .eq('product_id', productId)
        .not('cost_per_unit_new', 'is', null)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) {
        logger.error('Failed to fetch product price trend', error, {
          component: 'useProductPriceTrend',
          vendorId,
          productId,
        });
        throw error;
      }

      return (data ?? []).map((item: { created_at: string; cost_per_unit_new: number }) => ({
        date: item.created_at,
        cost: item.cost_per_unit_new,
      }));
    },
    enabled: !!tenant?.id && !!vendorId && !!productId,
  });
}
