/**
 * useRecordPayment Hook
 * 
 * React hook for recording payments with automatic cache invalidation.
 * Wraps the centralized paymentService for consistent payment handling.
 * 
 * Usage:
 *   const { recordPayment, recordFrontedPayment, isLoading } = useRecordPayment();
 *   
 *   await recordPayment({
 *     clientId: '...',
 *     amount: 500,
 *     paymentMethod: 'cash',
 *     context: 'collection'
 *   });
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { 
  paymentService, 
  PaymentMethod, 
  PaymentContext,
  PaymentResult,
  FrontedPaymentResult,
  DeliveryCollectionResult
} from '@/lib/services/paymentService';
import { queryKeys } from '@/lib/queryKeys';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface RecordPaymentInput {
  clientId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  reference?: string;
  context: PaymentContext;
  frontedInventoryId?: string;
  deliveryId?: string;
  orderId?: string;
  /** Show toast notification on success/error. Default: true */
  showToast?: boolean;
}

export interface RecordFrontedPaymentInput {
  frontedId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  reference?: string;
  /** Show toast notification on success/error. Default: true */
  showToast?: boolean;
}

export interface CompleteDeliveryInput {
  deliveryId: string;
  amountCollected: number;
  proofPhotoUrl?: string;
  /** Show toast notification on success/error. Default: true */
  showToast?: boolean;
}

export interface UseRecordPaymentReturn {
  /** Record a general payment to a client */
  recordPayment: (input: RecordPaymentInput) => Promise<PaymentResult>;
  /** Record payment for fronted inventory */
  recordFrontedPayment: (input: RecordFrontedPaymentInput) => Promise<FrontedPaymentResult>;
  /** Complete delivery with cash collection */
  completeDelivery: (input: CompleteDeliveryInput) => Promise<DeliveryCollectionResult>;
  /** Adjust client balance directly */
  adjustBalance: (clientId: string, amount: number, operation: 'add' | 'subtract') => Promise<{ success: boolean; newBalance: number }>;
  /** Is any payment operation in progress */
  isLoading: boolean;
  /** Is recording a general payment */
  isRecordingPayment: boolean;
  /** Is recording a fronted payment */
  isRecordingFrontedPayment: boolean;
  /** Is completing a delivery */
  isCompletingDelivery: boolean;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useRecordPayment(): UseRecordPaymentReturn {
  const queryClient = useQueryClient();
  const { tenant } = useTenantAdminAuth();

  // Invalidate all payment-related queries
  const invalidatePaymentQueries = (clientId?: string) => {
    // Wholesale clients (balance changes)
    queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleClients.all });
    if (clientId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleClients.detail(clientId) });
    }

    // Collection mode data
    queryClient.invalidateQueries({ queryKey: ['collection-mode'] });
    queryClient.invalidateQueries({ queryKey: ['collection-activities'] });

    // Financial data
    queryClient.invalidateQueries({ queryKey: ['financial-command-center'] });
    queryClient.invalidateQueries({ queryKey: ['financial-data'] });

    // Fronted inventory
    queryClient.invalidateQueries({ queryKey: ['fronted-inventory'] });

    // Orders
    queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleOrders.all });
  };

  // Record general payment mutation
  const recordPaymentMutation = useMutation({
    mutationFn: async (input: RecordPaymentInput): Promise<PaymentResult> => {
      if (!tenant?.id) {
        throw new Error('Tenant not found');
      }

      const result = await paymentService.recordPayment({
        tenantId: tenant.id,
        clientId: input.clientId,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
        reference: input.reference,
        context: input.context,
        frontedInventoryId: input.frontedInventoryId,
        deliveryId: input.deliveryId,
        orderId: input.orderId
      });

      if (!result.success) {
        throw new Error(result.error || 'Payment failed');
      }

      return result;
    },
    onSuccess: (result, input) => {
      invalidatePaymentQueries(input.clientId);
      
      if (input.showToast !== false) {
        showSuccessToast(result.message || `Payment of $${input.amount.toFixed(2)} recorded`);
      }
    },
    onError: (error: Error, input) => {
      logger.error('Payment recording failed', error, { clientId: input.clientId });
      
      if (input.showToast !== false) {
        showErrorToast(error.message || 'Failed to record payment');
      }
    }
  });

  // Record fronted payment mutation
  const recordFrontedPaymentMutation = useMutation({
    mutationFn: async (input: RecordFrontedPaymentInput): Promise<FrontedPaymentResult> => {
      if (!tenant?.id) {
        throw new Error('Tenant not found');
      }

      const result = await paymentService.recordFrontedPayment({
        tenantId: tenant.id,
        frontedId: input.frontedId,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
        reference: input.reference
      });

      if (!result.success) {
        throw new Error(result.error || 'Payment failed');
      }

      return result;
    },
    onSuccess: (result, input) => {
      invalidatePaymentQueries();
      
      if (input.showToast !== false) {
        const statusMsg = result.remaining > 0 
          ? `Remaining: $${result.remaining.toFixed(2)}` 
          : 'Fully paid!';
        showSuccessToast(
          `Payment of $${input.amount.toFixed(2)} recorded${result.clientName ? ` for ${result.clientName}` : ''}. ${statusMsg}`
        );
      }
    },
    onError: (error: Error, input) => {
      logger.error('Fronted payment recording failed', error, { frontedId: input.frontedId });
      
      if (input.showToast !== false) {
        showErrorToast(error.message || 'Failed to record payment');
      }
    }
  });

  // Complete delivery mutation
  const completeDeliveryMutation = useMutation({
    mutationFn: async (input: CompleteDeliveryInput): Promise<DeliveryCollectionResult> => {
      const result = await paymentService.completeDeliveryWithCollection({
        deliveryId: input.deliveryId,
        amountCollected: input.amountCollected,
        proofPhotoUrl: input.proofPhotoUrl
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to complete delivery');
      }

      return result;
    },
    onSuccess: (result, input) => {
      // Invalidate delivery and runner-specific queries
      queryClient.invalidateQueries({ queryKey: ['runner-active-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['runner-today-stats'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all });
      invalidatePaymentQueries();
      
      if (input.showToast !== false) {
        showSuccessToast('Delivery marked complete');
      }
    },
    onError: (error: Error, input) => {
      logger.error('Delivery completion failed', error, { deliveryId: input.deliveryId });
      
      if (input.showToast !== false) {
        showErrorToast(error.message || 'Failed to complete delivery');
      }
    }
  });

  // Adjust balance mutation
  const adjustBalanceMutation = useMutation({
    mutationFn: async ({ clientId, amount, operation }: { clientId: string; amount: number; operation: 'add' | 'subtract' }) => {
      const result = await paymentService.adjustClientBalance({
        clientId,
        amount,
        operation
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to adjust balance');
      }

      return result;
    },
    onSuccess: (_, variables) => {
      invalidatePaymentQueries(variables.clientId);
    }
  });

  // Wrapper functions that return promises
  const recordPayment = async (input: RecordPaymentInput): Promise<PaymentResult> => {
    return recordPaymentMutation.mutateAsync(input);
  };

  const recordFrontedPayment = async (input: RecordFrontedPaymentInput): Promise<FrontedPaymentResult> => {
    return recordFrontedPaymentMutation.mutateAsync(input);
  };

  const completeDelivery = async (input: CompleteDeliveryInput): Promise<DeliveryCollectionResult> => {
    return completeDeliveryMutation.mutateAsync(input);
  };

  const adjustBalance = async (clientId: string, amount: number, operation: 'add' | 'subtract') => {
    return adjustBalanceMutation.mutateAsync({ clientId, amount, operation });
  };

  return {
    recordPayment,
    recordFrontedPayment,
    completeDelivery,
    adjustBalance,
    isLoading: 
      recordPaymentMutation.isPending || 
      recordFrontedPaymentMutation.isPending || 
      completeDeliveryMutation.isPending,
    isRecordingPayment: recordPaymentMutation.isPending,
    isRecordingFrontedPayment: recordFrontedPaymentMutation.isPending,
    isCompletingDelivery: completeDeliveryMutation.isPending
  };
}

/**
 * Standalone payment hook for components without tenant context (e.g., runner portal)
 * Requires tenantId to be passed explicitly
 */
export function useStandalonePayment() {
  const queryClient = useQueryClient();

  const completeDeliveryMutation = useMutation({
    mutationFn: async (input: CompleteDeliveryInput): Promise<DeliveryCollectionResult> => {
      const result = await paymentService.completeDeliveryWithCollection({
        deliveryId: input.deliveryId,
        amountCollected: input.amountCollected,
        proofPhotoUrl: input.proofPhotoUrl
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to complete delivery');
      }

      return result;
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['runner-active-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['runner-today-stats'] });
      
      if (input.showToast !== false) {
        showSuccessToast('Delivery marked complete');
      }
    },
    onError: (error: Error, input) => {
      logger.error('Delivery completion failed', error, { deliveryId: input.deliveryId });
      
      if (input.showToast !== false) {
        showErrorToast(error.message || 'Failed to complete delivery');
      }
    }
  });

  return {
    completeDelivery: completeDeliveryMutation.mutateAsync,
    isLoading: completeDeliveryMutation.isPending
  };
}



