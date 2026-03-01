/**
 * useCustomerFlags Hook
 *
 * Manages customer flags and blocks for flagging customers
 * with payment issues, compliance concerns, fraud, or abuse.
 *
 * - Flagged customers show warning banner in order creation
 * - Blocked customers are prevented from ordering via storefront
 * - Admin-only actions via usePermissions
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { escapePostgresLike } from '@/lib/utils/searchSanitize';
import { humanizeError } from '@/lib/humanizeError';

// ============================================================================
// Types
// ============================================================================

export type FlagType = 'flagged' | 'blocked';

export type FlagReason = 'payment_issues' | 'compliance' | 'fraud' | 'abuse' | 'other';

export interface CustomerFlag {
  id: string;
  tenant_id: string;
  customer_id: string;
  flag_type: FlagType;
  flag_reason: FlagReason;
  reason_details: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
}

export interface CustomerFlagWithCreator extends CustomerFlag {
  creator?: {
    full_name: string | null;
    email: string | null;
  };
  resolver?: {
    full_name: string | null;
    email: string | null;
  };
}

export interface AddFlagParams {
  customerId: string;
  flagType: FlagType;
  flagReason: FlagReason;
  reasonDetails?: string;
}

export interface ResolveFlagParams {
  flagId: string;
  resolutionNotes?: string;
}

export interface CustomerFlagStatus {
  isFlagged: boolean;
  isBlocked: boolean;
  activeFlags: CustomerFlag[];
  flagCount: number;
  blockCount: number;
}

export interface UseCustomerFlagsReturn {
  // Flag status
  status: CustomerFlagStatus;
  flags: CustomerFlagWithCreator[];
  flagHistory: CustomerFlagWithCreator[];

  // Loading/error states
  isLoading: boolean;
  isLoadingHistory: boolean;
  error: Error | null;

  // Mutations
  addFlag: (params: AddFlagParams) => Promise<CustomerFlag | null>;
  resolveFlag: (params: ResolveFlagParams) => Promise<CustomerFlag | null>;

  // Mutation states
  isAddingFlag: boolean;
  isResolvingFlag: boolean;

  // Helpers
  checkBlocked: () => boolean;
  checkFlagged: () => boolean;
  refetch: () => void;
}

// ============================================================================
// Constants
// ============================================================================

export const FLAG_REASON_LABELS: Record<FlagReason, string> = {
  payment_issues: 'Payment Issues',
  compliance: 'Compliance',
  fraud: 'Fraud',
  abuse: 'Abuse',
  other: 'Other',
};

export const FLAG_TYPE_LABELS: Record<FlagType, string> = {
  flagged: 'Flagged',
  blocked: 'Blocked',
};

// ============================================================================
// Query Keys
// ============================================================================

const customerFlagsKeys = {
  all: ['customer-flags'] as const,
  active: (tenantId: string, customerId: string) =>
    [...customerFlagsKeys.all, 'active', tenantId, customerId] as const,
  history: (tenantId: string, customerId: string) =>
    [...customerFlagsKeys.all, 'history', tenantId, customerId] as const,
  status: (tenantId: string, customerId: string) =>
    [...customerFlagsKeys.all, 'status', tenantId, customerId] as const,
};

// ============================================================================
// Data Fetching Functions
// ============================================================================

async function fetchActiveFlags(
  tenantId: string,
  customerId: string
): Promise<CustomerFlagWithCreator[]> {
  const { data, error } = await supabase
    .from('customer_flags')
    .select(`
      *,
      creator:profiles!customer_flags_created_by_fkey(full_name, email),
      resolver:profiles!customer_flags_resolved_by_fkey(full_name, email)
    `)
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    // Try simpler query without joins if the join fails
    logger.warn('Failed to fetch flags with profiles, trying simpler query', error, {
      component: 'useCustomerFlags'
    });

    const { data: simpleData, error: simpleError } = await supabase
      .from('customer_flags')
      .select('id, tenant_id, customer_id, flag_type, flag_reason, reason_details, is_active, created_by, created_at, updated_at, resolved_at, resolved_by, resolution_notes')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (simpleError) {
      logger.error('Failed to fetch active customer flags', simpleError, {
        tenantId,
        customerId,
        component: 'useCustomerFlags'
      });
      throw simpleError;
    }

    return (simpleData ?? []) as CustomerFlagWithCreator[];
  }

  return (data ?? []) as CustomerFlagWithCreator[];
}

async function fetchFlagHistory(
  tenantId: string,
  customerId: string,
  limit = 50
): Promise<CustomerFlagWithCreator[]> {
  const { data, error } = await supabase
    .from('customer_flags')
    .select('id, tenant_id, customer_id, flag_type, flag_reason, reason_details, is_active, created_by, created_at, updated_at, resolved_at, resolved_by, resolution_notes')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to fetch customer flag history', error, {
      tenantId,
      customerId,
      component: 'useCustomerFlags'
    });
    throw error;
  }

  return (data ?? []) as CustomerFlagWithCreator[];
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCustomerFlags(customerId: string | undefined): UseCustomerFlagsReturn {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  // Fetch active flags
  const {
    data: flags,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: customerFlagsKeys.active(tenantId ?? '', customerId ?? ''),
    queryFn: () => fetchActiveFlags(tenantId!, customerId!),
    enabled: !!tenantId && !!customerId,
    staleTime: 30000, // 30 seconds
  });

  // Fetch flag history
  const {
    data: flagHistory,
    isLoading: isLoadingHistory,
  } = useQuery({
    queryKey: customerFlagsKeys.history(tenantId ?? '', customerId ?? ''),
    queryFn: () => fetchFlagHistory(tenantId!, customerId!),
    enabled: !!tenantId && !!customerId,
    staleTime: 60000, // 1 minute
  });

  // Calculate status from flags
  const status: CustomerFlagStatus = {
    isFlagged: (flags ?? []).some(f => f.flag_type === 'flagged' && f.is_active),
    isBlocked: (flags ?? []).some(f => f.flag_type === 'blocked' && f.is_active),
    activeFlags: (flags ?? []).filter(f => f.is_active),
    flagCount: (flags ?? []).filter(f => f.flag_type === 'flagged' && f.is_active).length,
    blockCount: (flags ?? []).filter(f => f.flag_type === 'blocked' && f.is_active).length,
  };

  // Add flag mutation
  const addFlagMutation = useMutation({
    mutationFn: async (params: AddFlagParams): Promise<CustomerFlag> => {
      if (!tenantId) throw new Error('No tenant context');

      const { data, error } = await supabase
        .from('customer_flags')
        .insert({
          tenant_id: tenantId,
          customer_id: params.customerId,
          flag_type: params.flagType,
          flag_reason: params.flagReason,
          reason_details: params.reasonDetails || null,
          is_active: true,
          created_by: admin?.id || null,
        })
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to add customer flag', error, {
          tenantId,
          customerId: params.customerId,
          flagType: params.flagType,
          component: 'useCustomerFlags'
        });
        throw error;
      }

      logger.info('Customer flag added', {
        tenantId,
        customerId: params.customerId,
        flagType: params.flagType,
        flagReason: params.flagReason,
        component: 'useCustomerFlags'
      });

      return data as CustomerFlag;
    },
    onSuccess: (_data, variables) => {
      toast.success('Customer flag added successfully');
      queryClient.invalidateQueries({
        queryKey: customerFlagsKeys.active(tenantId!, variables.customerId),
      });
      queryClient.invalidateQueries({
        queryKey: customerFlagsKeys.history(tenantId!, variables.customerId),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to add customer flag'));
    },
  });

  // Resolve flag mutation
  const resolveFlagMutation = useMutation({
    mutationFn: async (params: ResolveFlagParams): Promise<CustomerFlag> => {
      if (!tenantId) throw new Error('No tenant context');

      const { data, error } = await supabase
        .from('customer_flags')
        .update({
          is_active: false,
          resolved_at: new Date().toISOString(),
          resolved_by: admin?.id || null,
          resolution_notes: params.resolutionNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.flagId)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to resolve customer flag', error, {
          tenantId,
          flagId: params.flagId,
          component: 'useCustomerFlags'
        });
        throw error;
      }

      logger.info('Customer flag resolved', {
        tenantId,
        flagId: params.flagId,
        component: 'useCustomerFlags'
      });

      return data as CustomerFlag;
    },
    onSuccess: (data) => {
      toast.success('Customer flag resolved successfully');
      queryClient.invalidateQueries({
        queryKey: customerFlagsKeys.active(tenantId!, data.customer_id),
      });
      queryClient.invalidateQueries({
        queryKey: customerFlagsKeys.history(tenantId!, data.customer_id),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to resolve customer flag'));
    },
  });

  // Helper functions
  const checkBlocked = useCallback((): boolean => {
    return status.isBlocked;
  }, [status.isBlocked]);

  const checkFlagged = useCallback((): boolean => {
    return status.isFlagged;
  }, [status.isFlagged]);

  // Wrapped mutation functions that return Promise
  const addFlag = useCallback(async (params: AddFlagParams): Promise<CustomerFlag | null> => {
    try {
      return await addFlagMutation.mutateAsync(params);
    } catch {
      return null;
    }
  }, [addFlagMutation]);

  const resolveFlag = useCallback(async (params: ResolveFlagParams): Promise<CustomerFlag | null> => {
    try {
      return await resolveFlagMutation.mutateAsync(params);
    } catch {
      return null;
    }
  }, [resolveFlagMutation]);

  return {
    // Flag status
    status,
    flags: flags ?? [],
    flagHistory: flagHistory ?? [],

    // Loading/error states
    isLoading,
    isLoadingHistory,
    error: error as Error | null,

    // Mutations
    addFlag,
    resolveFlag,

    // Mutation states
    isAddingFlag: addFlagMutation.isPending,
    isResolvingFlag: resolveFlagMutation.isPending,

    // Helpers
    checkBlocked,
    checkFlagged,
    refetch,
  };
}

// ============================================================================
// Standalone Functions (for use outside React components)
// ============================================================================

/**
 * Check if a customer is blocked from ordering.
 * Useful for storefront order validation.
 */
export async function isCustomerBlocked(
  tenantId: string,
  customerId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_customer_blocked', {
      p_customer_id: customerId,
      p_tenant_id: tenantId,
    });

    if (error) {
      logger.error('Failed to check if customer is blocked', error, {
        tenantId,
        customerId,
        component: 'isCustomerBlocked'
      });
      return false;
    }

    return data === true;
  } catch (error) {
    logger.error('Error checking customer block status', error instanceof Error ? error : new Error(String(error)), {
      tenantId,
      customerId,
      component: 'isCustomerBlocked'
    });
    return false;
  }
}

/**
 * Get active flags for a customer (for order creation warning banner).
 */
export async function getActiveCustomerFlags(
  tenantId: string,
  customerId: string
): Promise<CustomerFlag[]> {
  try {
    const { data, error } = await supabase
      .from('customer_flags')
      .select('id, tenant_id, customer_id, flag_type, flag_reason, reason_details, is_active, created_by, created_at, updated_at, resolved_at, resolved_by, resolution_notes')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .eq('is_active', true);

    if (error) {
      logger.error('Failed to get active customer flags', error, {
        tenantId,
        customerId,
        component: 'getActiveCustomerFlags'
      });
      return [];
    }

    return (data ?? []) as CustomerFlag[];
  } catch (error) {
    logger.error('Error getting customer flags', error instanceof Error ? error : new Error(String(error)), {
      tenantId,
      customerId,
      component: 'getActiveCustomerFlags'
    });
    return [];
  }
}

/**
 * Check if a customer is blocked by email lookup.
 * Used in storefront checkout to prevent blocked customers from ordering.
 */
export async function isCustomerBlockedByEmail(
  tenantId: string,
  email: string
): Promise<{ isBlocked: boolean; customerId: string | null; flagReason: FlagReason | null }> {
  try {
    // First, find the customer by email
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('email', escapePostgresLike(email.toLowerCase().trim()))
      .maybeSingle();

    if (customerError) {
      logger.error('Failed to lookup customer by email', customerError, {
        tenantId,
        email,
        component: 'isCustomerBlockedByEmail'
      });
      return { isBlocked: false, customerId: null, flagReason: null };
    }

    if (!customer) {
      // No customer found with this email - not blocked
      return { isBlocked: false, customerId: null, flagReason: null };
    }

    // Check if customer is blocked
    const { data: blockFlag, error: flagError } = await supabase
      .from('customer_flags')
      .select('flag_reason')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customer.id)
      .eq('flag_type', 'blocked')
      .eq('is_active', true)
      .maybeSingle();

    if (flagError) {
      logger.error('Failed to check block status', flagError, {
        tenantId,
        customerId: customer.id,
        component: 'isCustomerBlockedByEmail'
      });
      return { isBlocked: false, customerId: customer.id, flagReason: null };
    }

    return {
      isBlocked: !!blockFlag,
      customerId: customer.id,
      flagReason: blockFlag?.flag_reason as FlagReason | null,
    };
  } catch (error) {
    logger.error('Error checking customer block by email', error instanceof Error ? error : new Error(String(error)), {
      tenantId,
      email,
      component: 'isCustomerBlockedByEmail'
    });
    return { isBlocked: false, customerId: null, flagReason: null };
  }
}
