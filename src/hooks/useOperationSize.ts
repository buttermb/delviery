/**
 * useOperationSize Hook
 * 
 * Auto-detects operation size from tenant usage metrics
 * Supports manual override stored in sidebar_preferences
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import type { OperationSize } from '@/types/sidebar';
import { logger } from '@/lib/logger';

/**
 * Detect operation size from tenant usage metrics
 */
function detectOperationSize(tenant: {
  usage?: Record<string, number>;
  detected_operation_size?: string | null;
  monthly_orders?: number;
  team_size?: number;
}): OperationSize {
  // If tenant has detected_operation_size, use it
  const detectedSize = (tenant as any).detected_operation_size;
  if (detectedSize && 
      ['street', 'small', 'medium', 'enterprise'].includes(detectedSize)) {
    return detectedSize as OperationSize;
  }

  // Extract metrics from usage JSONB or direct columns
  const usage = tenant.usage || {};
  const monthlyOrders = (tenant as any).monthly_orders || usage.customers || 0;
  const teamSize = (tenant as any).team_size || usage.users || 1;
  const locationCount = usage.locations || 1;

  // Classification logic
  if (monthlyOrders < 50 && teamSize <= 2 && locationCount <= 1) {
    return 'street';
  }

  if (monthlyOrders < 200 && teamSize <= 5 && locationCount <= 2) {
    return 'small';
  }

  if (monthlyOrders < 1000 && teamSize <= 20 && locationCount <= 5) {
    return 'medium';
  }

  return 'enterprise';
}

/**
 * Hook to get and manage operation size
 */
export function useOperationSize() {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // Fetch user's manual override preference
  const { data: preferences, isLoading: preferencesLoading } = useQuery({
    queryKey: ['sidebar-preferences', tenant?.id, admin?.id],
    queryFn: async () => {
      if (!tenant?.id || !admin?.id) return null;

      const { data, error } = await (supabase as any)
        .from('sidebar_preferences')
        .select('operation_size')
        .eq('tenant_id', tenant.id)
        .eq('user_id', admin.id)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch sidebar preferences', error, { component: 'useOperationSize' });
        return null;
      }

      return data as any;
    },
    enabled: !!tenant?.id && !!admin?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Detect operation size
  const detectedSize = useMemo(() => {
    if (!tenant) return 'medium' as OperationSize; // Default fallback
    return detectOperationSize(tenant);
  }, [tenant]);

  // Use manual override if exists, otherwise use detected
  const operationSize: OperationSize = useMemo(() => {
    const manualSize = (preferences as any)?.operation_size;
    
    logger.debug('Operation size calculation', {
      component: 'useOperationSize',
      manualSize,
      detectedSize,
      willUse: manualSize && ['street', 'small', 'medium', 'enterprise'].includes(manualSize) ? manualSize : detectedSize,
      preferencesLoading: preferencesLoading,
      hasPreferences: !!preferences,
      tenantId: tenant?.id
    });
    
    if (manualSize && ['street', 'small', 'medium', 'enterprise'].includes(manualSize)) {
      return manualSize as OperationSize;
    }
    return detectedSize;
  }, [preferences, detectedSize, preferencesLoading, tenant?.id]);

  const isAutoDetected = !(preferences as any)?.operation_size;

  // Mutation to set manual operation size
  const setOperationSizeMutation = useMutation({
    mutationFn: async (size: OperationSize) => {
      if (!tenant?.id || !admin?.id) throw new Error('Tenant and admin required');

      const { error } = await (supabase as any)
        .from('sidebar_preferences')
        .upsert([{
          tenant_id: tenant.id,
          user_id: admin.id,
          operation_size: size,
        }], {
          onConflict: 'tenant_id,user_id',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sidebar-preferences', tenant?.id, admin?.id] });
    },
    onError: (error: unknown) => {
      logger.error('Failed to update operation size', error, { component: 'useOperationSize' });
    },
  });

  // Mutation to reset to auto-detected
  const resetToAutoMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id || !admin?.id) throw new Error('Tenant and admin required');

      const { error } = await (supabase as any)
        .from('sidebar_preferences')
        .update({ operation_size: null })
        .eq('tenant_id', tenant.id)
        .eq('user_id', admin.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sidebar-preferences', tenant?.id, admin?.id] });
    },
    onError: (error: unknown) => {
      logger.error('Failed to reset operation size', error, { component: 'useOperationSize' });
    },
  });

  const setOperationSize = (size: OperationSize) => {
    setOperationSizeMutation.mutate(size);
  };

  const resetToAuto = () => {
    resetToAutoMutation.mutate();
  };

  return {
    operationSize,
    detectedSize,
    isAutoDetected,
    setOperationSize,
    resetToAuto,
    isLoading: preferencesLoading,
  };
}

