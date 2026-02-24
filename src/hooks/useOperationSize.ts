import { logger } from '@/lib/logger';
/**
 * useOperationSize Hook
 * 
 * Auto-detects operation size from tenant usage metrics
 * Supports manual override stored in sidebar_preferences
 */

import { useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import type { OperationSize } from '@/types/sidebar';

import { useBusinessTier } from './useBusinessTier';

/**
 * Detect operation size from tenant usage metrics and business tier
 */
function detectOperationSize(tenant: {
  usage?: Record<string, number>;
  detected_operation_size?: string | null;
  monthly_orders?: number;
  team_size?: number;
}, businessTier?: string): OperationSize {
  // 1. If business tier is available, it takes precedence for auto-detection
  if (businessTier) {
    switch (businessTier) {
      case 'street': return 'street';
      case 'trap': return 'small';
      case 'block': return 'medium';
      case 'hood': return 'medium';
      case 'empire': return 'enterprise';
    }
  }

  // 2. If tenant has detected_operation_size (legacy), use it
  const tenantRecord = tenant as Record<string, unknown>;
  const detectedSize = tenantRecord.detected_operation_size as string | undefined;
  if (detectedSize &&
    ['street', 'small', 'medium', 'enterprise'].includes(detectedSize)) {
    return detectedSize as OperationSize;
  }

  // 3. Fallback to metrics-based detection
  const usage = tenant.usage || {};
  const monthlyOrders = (tenantRecord.monthly_orders as number) || usage.customers || 0;
  const teamSize = (tenantRecord.team_size as number) || usage.users || 1;
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
  const { tier: businessTier } = useBusinessTier();


  // Fetch user's manual override preference
  const { data: preferences, isLoading: preferencesLoading } = useQuery({
    queryKey: ['sidebar-preferences', tenant?.id, admin?.userId],
    queryFn: async () => {
      if (!tenant?.id || !admin?.userId) return null;

      const { data, error } = await (supabase as any)
        .from('sidebar_preferences')
        .select('operation_size')
        .eq('tenant_id', tenant.id)
        .eq('user_id', admin.userId)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch sidebar preferences', error, { component: 'useOperationSize' });
        return null;
      }

      return data as { operation_size: string | null } | null;
    },
    enabled: !!tenant?.id && !!admin?.userId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Detect operation size
  const detectedSize = useMemo(() => {
    if (!tenant) return 'medium' as OperationSize; // Default fallback
    return detectOperationSize(tenant, businessTier);
  }, [tenant, businessTier]);

  // Track last logged values to prevent spam
  const lastLogRef = useRef<string>('');

  // Use manual override if exists, otherwise use detected
  const operationSize: OperationSize = useMemo(() => {
    const manualSize = preferences?.operation_size;
    const result = manualSize && ['street', 'small', 'medium', 'enterprise'].includes(manualSize)
      ? manualSize as OperationSize
      : detectedSize;

    // Only log when values actually change
    const logKey = `${manualSize}-${detectedSize}-${businessTier}`;
    if (lastLogRef.current !== logKey && !preferencesLoading) {
      lastLogRef.current = logKey;
      logger.debug('Operation size determined', {
        component: 'useOperationSize',
        result,
        manualOverride: !!manualSize,
      });
    }

    return result;
  }, [preferences, detectedSize, preferencesLoading, businessTier]);

  const isAutoDetected = !preferences?.operation_size;

  // Mutation to set manual operation size
  const setOperationSizeMutation = useMutation({
    mutationFn: async (size: OperationSize) => {
      if (!tenant?.id || !admin?.userId) throw new Error('Tenant and admin required');

      const { error } = await (supabase as any)
        .from('sidebar_preferences')
        .upsert([{
          tenant_id: tenant.id,
          user_id: admin.userId,
          operation_size: size,
        }], {
          onConflict: 'tenant_id,user_id',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sidebar-preferences', tenant?.id, admin?.userId] });
    },
    onError: (error: unknown) => {
      logger.error('Failed to update operation size', error, { component: 'useOperationSize' });
    },
  });

  // Mutation to reset to auto-detected
  const resetToAutoMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id || !admin?.userId) throw new Error('Tenant and admin required');

      const { error } = await (supabase as any)
        .from('sidebar_preferences')
        .update({ operation_size: null })
        .eq('tenant_id', tenant.id)
        .eq('user_id', admin.userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sidebar-preferences', tenant?.id, admin?.userId] });
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

  // Always return - handle missing user in the return values
  // This ensures hooks are called in the same order every render
  const hasUser = !!admin?.userId;

  return {
    operationSize: hasUser ? operationSize : detectedSize,
    detectedSize,
    isAutoDetected: hasUser ? isAutoDetected : true,
    setOperationSize: hasUser ? setOperationSize : () => { },
    resetToAuto: hasUser ? resetToAuto : () => { },
    isLoading: preferencesLoading || !hasUser,
  };
}

