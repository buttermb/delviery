/**
 * useCustomerCredit Hook
 *
 * Manages customer credit/balance for store credit functionality.
 * Credits can be added (refunds, manual), deducted (applied to orders),
 * and queried for balance display.
 *
 * Connects customer, payment, and order modules.
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { formatCurrency } from '@/lib/formatters';

// ============================================================================
// Types
// ============================================================================

export type CreditTransactionType = 'issued' | 'used' | 'refund' | 'expired' | 'adjustment';

export interface CustomerCreditTransaction {
  id: string;
  tenant_id: string;
  customer_id: string;
  amount: number;
  transaction_type: CreditTransactionType;
  reason: string | null;
  order_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CustomerCreditBalance {
  balance: number;
  totalIssued: number;
  totalUsed: number;
  totalRefunded: number;
  lastTransaction: CustomerCreditTransaction | null;
}

export interface AddCreditParams {
  customerId: string;
  amount: number;
  reason?: string;
  orderId?: string;
  transactionType?: 'issued' | 'refund' | 'adjustment';
}

export interface DeductCreditParams {
  customerId: string;
  amount: number;
  reason?: string;
  orderId?: string;
}

export interface UseCustomerCreditReturn {
  // Balance data
  balance: number;
  creditData: CustomerCreditBalance | null;
  transactions: CustomerCreditTransaction[];

  // Loading/error states
  isLoading: boolean;
  isLoadingTransactions: boolean;
  error: Error | null;

  // Mutations
  addCredit: (params: AddCreditParams) => Promise<CustomerCreditTransaction | null>;
  deductCredit: (params: DeductCreditParams) => Promise<CustomerCreditTransaction | null>;

  // Mutation states
  isAddingCredit: boolean;
  isDeductingCredit: boolean;

  // Helpers
  getBalance: () => number;
  hasCredit: (amount: number) => boolean;
  refetch: () => void;
}

// ============================================================================
// Query Keys
// ============================================================================

const customerCreditKeys = {
  all: ['customer-credit'] as const,
  balance: (tenantId: string, customerId: string) =>
    [...customerCreditKeys.all, 'balance', tenantId, customerId] as const,
  transactions: (tenantId: string, customerId: string) =>
    [...customerCreditKeys.all, 'transactions', tenantId, customerId] as const,
};

// ============================================================================
// Data Fetching Functions
// ============================================================================

async function fetchCustomerCreditBalance(
  tenantId: string,
  customerId: string
): Promise<CustomerCreditBalance> {
  const { data, error } = await supabase
    .from('customer_credits')
    .select('id, tenant_id, customer_id, amount, transaction_type, reason, order_id, created_by, created_at')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch customer credit balance', error, {
      tenantId,
      customerId,
      component: 'useCustomerCredit'
    });
    throw error;
  }

  const transactions = (data ?? []) as CustomerCreditTransaction[];

  // Calculate balance based on transaction types
  let totalIssued = 0;
  let totalUsed = 0;
  let totalRefunded = 0;

  for (const tx of transactions) {
    const amount = tx.amount ?? 0;
    switch (tx.transaction_type) {
      case 'issued':
      case 'adjustment':
        totalIssued += amount;
        break;
      case 'used':
        totalUsed += amount;
        break;
      case 'refund':
        totalRefunded += amount;
        break;
      case 'expired':
        totalUsed += amount; // Expired credits reduce balance
        break;
    }
  }

  // Balance = issued + refunded - used
  const balance = Math.max(0, totalIssued + totalRefunded - totalUsed);

  return {
    balance,
    totalIssued,
    totalUsed,
    totalRefunded,
    lastTransaction: transactions[0] || null,
  };
}

async function fetchCustomerCreditTransactions(
  tenantId: string,
  customerId: string,
  limit = 50
): Promise<CustomerCreditTransaction[]> {
  const { data, error } = await supabase
    .from('customer_credits')
    .select('id, tenant_id, customer_id, amount, transaction_type, reason, order_id, created_by, created_at')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to fetch customer credit transactions', error, {
      tenantId,
      customerId,
      component: 'useCustomerCredit'
    });
    throw error;
  }

  return (data ?? []) as CustomerCreditTransaction[];
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCustomerCredit(customerId: string | undefined): UseCustomerCreditReturn {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  // Fetch credit balance
  const {
    data: creditData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: customerCreditKeys.balance(tenantId ?? '', customerId ?? ''),
    queryFn: () => fetchCustomerCreditBalance(tenantId!, customerId!),
    enabled: !!tenantId && !!customerId,
    staleTime: 30000, // 30 seconds
  });

  // Fetch transactions history
  const {
    data: transactions,
    isLoading: isLoadingTransactions,
  } = useQuery({
    queryKey: customerCreditKeys.transactions(tenantId ?? '', customerId ?? ''),
    queryFn: () => fetchCustomerCreditTransactions(tenantId!, customerId!),
    enabled: !!tenantId && !!customerId,
    staleTime: 30000,
  });

  // Add credit mutation
  const addCreditMutation = useMutation({
    mutationFn: async (params: AddCreditParams): Promise<CustomerCreditTransaction> => {
      if (!tenantId) throw new Error('No tenant context');

      const { data, error } = await supabase
        .from('customer_credits')
        .insert({
          tenant_id: tenantId,
          customer_id: params.customerId,
          amount: Math.abs(params.amount), // Ensure positive
          transaction_type: params.transactionType || 'issued',
          reason: params.reason || 'Manual credit issued',
          order_id: params.orderId || null,
          created_by: admin?.id || null,
        })
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to add customer credit', error, {
          tenantId,
          customerId: params.customerId,
          component: 'useCustomerCredit'
        });
        throw error;
      }

      logger.info('Customer credit added', {
        tenantId,
        customerId: params.customerId,
        amount: params.amount,
        type: params.transactionType || 'issued',
        component: 'useCustomerCredit'
      });

      return data as CustomerCreditTransaction;
    },
    onSuccess: (_data, variables) => {
      toast.success('Credit added successfully');
      queryClient.invalidateQueries({
        queryKey: customerCreditKeys.balance(tenantId!, variables.customerId),
      });
      queryClient.invalidateQueries({
        queryKey: customerCreditKeys.transactions(tenantId!, variables.customerId),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to add credit'));
    },
  });

  // Deduct credit mutation
  const deductCreditMutation = useMutation({
    mutationFn: async (params: DeductCreditParams): Promise<CustomerCreditTransaction> => {
      if (!tenantId) throw new Error('No tenant context');

      // First check if customer has sufficient balance
      const currentBalance = creditData?.balance ?? 0;
      if (currentBalance < params.amount) {
        throw new Error(`Insufficient credit balance. Available: ${formatCurrency(currentBalance)}, Required: ${formatCurrency(params.amount)}`);
      }

      const { data, error } = await supabase
        .from('customer_credits')
        .insert({
          tenant_id: tenantId,
          customer_id: params.customerId,
          amount: Math.abs(params.amount), // Store as positive, type indicates direction
          transaction_type: 'used',
          reason: params.reason || 'Credit applied to order',
          order_id: params.orderId || null,
          created_by: admin?.id || null,
        })
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to deduct customer credit', error, {
          tenantId,
          customerId: params.customerId,
          component: 'useCustomerCredit'
        });
        throw error;
      }

      logger.info('Customer credit deducted', {
        tenantId,
        customerId: params.customerId,
        amount: params.amount,
        orderId: params.orderId,
        component: 'useCustomerCredit'
      });

      return data as CustomerCreditTransaction;
    },
    onSuccess: (_data, variables) => {
      toast.success('Credit deducted successfully');
      queryClient.invalidateQueries({
        queryKey: customerCreditKeys.balance(tenantId!, variables.customerId),
      });
      queryClient.invalidateQueries({
        queryKey: customerCreditKeys.transactions(tenantId!, variables.customerId),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to deduct credit'));
    },
  });

  // Helper functions
  const getBalance = useCallback((): number => {
    return creditData?.balance ?? 0;
  }, [creditData]);

  const hasCredit = useCallback((amount: number): boolean => {
    return (creditData?.balance ?? 0) >= amount;
  }, [creditData]);

  // Wrapped mutation functions that return Promise
  const addCredit = useCallback(async (params: AddCreditParams): Promise<CustomerCreditTransaction | null> => {
    try {
      return await addCreditMutation.mutateAsync(params);
    } catch {
      return null;
    }
  }, [addCreditMutation]);

  const deductCredit = useCallback(async (params: DeductCreditParams): Promise<CustomerCreditTransaction | null> => {
    try {
      return await deductCreditMutation.mutateAsync(params);
    } catch {
      return null;
    }
  }, [deductCreditMutation]);

  return {
    // Balance data
    balance: creditData?.balance ?? 0,
    creditData: creditData || null,
    transactions: transactions ?? [],

    // Loading/error states
    isLoading,
    isLoadingTransactions,
    error: error as Error | null,

    // Mutations
    addCredit,
    deductCredit,

    // Mutation states
    isAddingCredit: addCreditMutation.isPending,
    isDeductingCredit: deductCreditMutation.isPending,

    // Helpers
    getBalance,
    hasCredit,
    refetch,
  };
}

// ============================================================================
// Standalone Balance Fetcher (for use outside React components)
// ============================================================================

/**
 * Fetch customer credit balance outside of React component context.
 * Useful for order processing flows.
 */
export async function getCustomerCreditBalance(
  tenantId: string,
  customerId: string
): Promise<number> {
  try {
    const balanceData = await fetchCustomerCreditBalance(tenantId, customerId);
    return balanceData.balance;
  } catch (error) {
    logger.error('Failed to get customer credit balance', error instanceof Error ? error : new Error(String(error)), {
      tenantId,
      customerId,
      component: 'getCustomerCreditBalance'
    });
    return 0;
  }
}
