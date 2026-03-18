/**
 * useCustomerNotificationPreferences Hook
 *
 * Provides CRUD operations for customer notification preferences.
 * Works in two contexts:
 * 1. Admin context: admin managing a specific customer's preferences (uses useTenantAdminAuth)
 * 2. Storefront context: customer managing their own preferences (uses useCustomerAuth)
 *
 * All queries filter by tenant_id for proper multi-tenant isolation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomerNotificationPreferences {
  id: string;
  tenant_id: string;
  customer_id: string;
  email_enabled: boolean;
  email_order_updates: boolean;
  email_promotions: boolean;
  email_delivery_updates: boolean;
  sms_enabled: boolean;
  sms_order_updates: boolean;
  sms_delivery_updates: boolean;
  push_enabled: boolean;
  push_order_updates: boolean;
  push_promotions: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerNotificationPreferencesUpdate {
  email_enabled?: boolean;
  email_order_updates?: boolean;
  email_promotions?: boolean;
  email_delivery_updates?: boolean;
  sms_enabled?: boolean;
  sms_order_updates?: boolean;
  sms_delivery_updates?: boolean;
  push_enabled?: boolean;
  push_order_updates?: boolean;
  push_promotions?: boolean;
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<
  CustomerNotificationPreferences,
  'id' | 'tenant_id' | 'customer_id' | 'created_at' | 'updated_at'
> = {
  email_enabled: true,
  email_order_updates: true,
  email_promotions: true,
  email_delivery_updates: true,
  sms_enabled: false,
  sms_order_updates: false,
  sms_delivery_updates: false,
  push_enabled: true,
  push_order_updates: true,
  push_promotions: false,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
};

// ─── Fetch function (shared by hook and direct usage) ─────────────────────────

export async function fetchCustomerNotificationPreferences(
  tenantId: string,
  customerId: string
): Promise<CustomerNotificationPreferences | null> {
  const { data, error } = await supabase
    .from('customer_notification_preferences')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .maybeSingle();

  if (error) {
    logger.error('Failed to fetch customer notification preferences', error, {
      component: 'useCustomerNotificationPreferences',
      tenantId,
      customerId,
    });
    throw error;
  }

  return data as CustomerNotificationPreferences | null;
}

// ─── Upsert function (shared) ─────────────────────────────────────────────────

export async function upsertCustomerNotificationPreferences(
  tenantId: string,
  customerId: string,
  updates: CustomerNotificationPreferencesUpdate
): Promise<CustomerNotificationPreferences> {
  const { data, error } = await supabase
    .rpc('upsert_customer_notification_preferences', {
      p_tenant_id: tenantId,
      p_customer_id: customerId,
      p_email_enabled: updates.email_enabled ?? null,
      p_email_order_updates: updates.email_order_updates ?? null,
      p_email_promotions: updates.email_promotions ?? null,
      p_email_delivery_updates: updates.email_delivery_updates ?? null,
      p_sms_enabled: updates.sms_enabled ?? null,
      p_sms_order_updates: updates.sms_order_updates ?? null,
      p_sms_delivery_updates: updates.sms_delivery_updates ?? null,
      p_push_enabled: updates.push_enabled ?? null,
      p_push_order_updates: updates.push_order_updates ?? null,
      p_push_promotions: updates.push_promotions ?? null,
      p_quiet_hours_enabled: updates.quiet_hours_enabled ?? null,
      p_quiet_hours_start: updates.quiet_hours_start ?? null,
      p_quiet_hours_end: updates.quiet_hours_end ?? null,
    });

  if (error) {
    logger.error('Failed to upsert customer notification preferences', error, {
      component: 'useCustomerNotificationPreferences',
      tenantId,
      customerId,
    });
    throw error;
  }

  return data as unknown as CustomerNotificationPreferences;
}

// ─── Invalidation helper ──────────────────────────────────────────────────────

export function invalidateCustomerNotificationPreferences(
  queryClient: QueryClient,
  tenantId: string,
  customerId: string
): void {
  queryClient.invalidateQueries({
    queryKey: queryKeys.customerNotificationPreferences.byCustomer(tenantId, customerId),
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseCustomerNotificationPreferencesOptions {
  tenantId: string | undefined;
  customerId: string | undefined;
  enabled?: boolean;
}

export function useCustomerNotificationPreferences({
  tenantId,
  customerId,
  enabled = true,
}: UseCustomerNotificationPreferencesOptions) {
  const queryClient = useQueryClient();

  const {
    data: preferences,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.customerNotificationPreferences.byCustomer(tenantId, customerId),
    queryFn: () => fetchCustomerNotificationPreferences(tenantId!, customerId!),
    enabled: enabled && !!tenantId && !!customerId,
    staleTime: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: (updates: CustomerNotificationPreferencesUpdate) => {
      if (!tenantId || !customerId) {
        throw new Error('Tenant ID and Customer ID are required');
      }
      return upsertCustomerNotificationPreferences(tenantId, customerId, updates);
    },
    onSuccess: () => {
      if (tenantId && customerId) {
        invalidateCustomerNotificationPreferences(queryClient, tenantId, customerId);
      }
      toast.success('Notification preferences updated');
    },
    onError: (err) => {
      logger.error('Failed to update notification preferences', err, {
        component: 'useCustomerNotificationPreferences',
      });
      toast.error('Failed to update notification preferences');
    },
  });

  // Merge fetched preferences with defaults for display
  const effectivePreferences: typeof DEFAULT_NOTIFICATION_PREFERENCES = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(preferences
      ? {
          email_enabled: preferences.email_enabled,
          email_order_updates: preferences.email_order_updates,
          email_promotions: preferences.email_promotions,
          email_delivery_updates: preferences.email_delivery_updates,
          sms_enabled: preferences.sms_enabled,
          sms_order_updates: preferences.sms_order_updates,
          sms_delivery_updates: preferences.sms_delivery_updates,
          push_enabled: preferences.push_enabled,
          push_order_updates: preferences.push_order_updates,
          push_promotions: preferences.push_promotions,
          quiet_hours_enabled: preferences.quiet_hours_enabled,
          quiet_hours_start: preferences.quiet_hours_start,
          quiet_hours_end: preferences.quiet_hours_end,
        }
      : {}),
  };

  return {
    /** Raw preferences from DB (null if never saved) */
    preferences,
    /** Preferences merged with defaults — always safe to read */
    effectivePreferences,
    isLoading,
    error,
    refetch,
    /** Upsert one or more fields */
    updatePreferences: updateMutation.mutate,
    updatePreferencesAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}
