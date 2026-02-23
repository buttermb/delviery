/**
 * usePurchaseCredits Hook
 *
 * Handles the full credit purchase flow via Stripe.
 * Supports both redirect-based checkout and embedded Payment Element.
 * Manages loading/error states, invalidates credit balance on success,
 * and shows success toast with updated balance.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

// ============================================================================
// Types
// ============================================================================

export type PackageSlug = 'starter-pack' | 'growth-pack' | 'power-pack' | 'enterprise-pack';

export interface PurchaseCreditsParams {
  packageSlug: PackageSlug;
  successUrl?: string;
  cancelUrl?: string;
}

export interface PurchaseCreditsResponse {
  success: boolean;
  checkout_url: string;
  session_id: string;
}

export interface StripeCardError {
  type: 'card_error' | 'validation_error' | 'api_error' | 'network_error';
  code?: string;
  message: string;
  declineCode?: string;
}

export interface UsePurchaseCreditsReturn {
  purchaseCredits: (params: PurchaseCreditsParams) => void;
  purchaseCreditsAsync: (params: PurchaseCreditsParams) => Promise<PurchaseCreditsResponse>;
  isLoading: boolean;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: StripeCardError | null;
  reset: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Maps raw error responses to structured StripeCardError objects
 */
function parseStripeError(error: unknown): StripeCardError {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Card decline errors
    if (message.includes('card') || message.includes('decline') || message.includes('insufficient')) {
      return {
        type: 'card_error',
        message: getCardErrorMessage(message),
        code: extractErrorCode(message),
        declineCode: extractDeclineCode(message),
      };
    }

    // Validation errors
    if (message.includes('invalid') || message.includes('expired') || message.includes('cvc')) {
      return {
        type: 'validation_error',
        message: getValidationErrorMessage(message),
        code: extractErrorCode(message),
      };
    }

    // Network errors
    if (message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
      return {
        type: 'network_error',
        message: 'Network error. Please check your connection and try again.',
      };
    }

    // Generic API error
    return {
      type: 'api_error',
      message: error.message || 'An unexpected error occurred. Please try again.',
    };
  }

  // Handle object-style errors from Supabase functions
  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;
    const message = (errObj['message'] as string) || (errObj['error'] as string) || 'Unknown error';
    return {
      type: 'api_error',
      message,
    };
  }

  return {
    type: 'api_error',
    message: 'An unexpected error occurred. Please try again.',
  };
}

function getCardErrorMessage(message: string): string {
  if (message.includes('insufficient funds') || message.includes('insufficient_funds')) {
    return 'Your card has insufficient funds. Please try a different card.';
  }
  if (message.includes('declined') || message.includes('decline')) {
    return 'Your card was declined. Please try a different payment method.';
  }
  if (message.includes('lost') || message.includes('stolen')) {
    return 'This card cannot be used. Please try a different card.';
  }
  if (message.includes('limit') || message.includes('exceeded')) {
    return 'Card limit exceeded. Please try a different card or contact your bank.';
  }
  return 'Your card was declined. Please check your details and try again.';
}

function getValidationErrorMessage(message: string): string {
  if (message.includes('expired')) {
    return 'Your card has expired. Please use a different card.';
  }
  if (message.includes('cvc') || message.includes('cvv')) {
    return 'Invalid security code. Please check your CVC and try again.';
  }
  if (message.includes('number') || message.includes('invalid')) {
    return 'Invalid card number. Please check your card details.';
  }
  return 'Invalid card details. Please check and try again.';
}

function extractErrorCode(message: string): string | undefined {
  const codeMatch = message.match(/code[:\s]+['"]?(\w+)['"]?/i);
  return codeMatch?.[1];
}

function extractDeclineCode(message: string): string | undefined {
  const declineMatch = message.match(/decline[_\s]?code[:\s]+['"]?(\w+)['"]?/i);
  return declineMatch?.[1];
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function usePurchaseCredits(): UsePurchaseCreditsReturn {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<PurchaseCreditsResponse, StripeCardError, PurchaseCreditsParams>({
    mutationFn: async (params: PurchaseCreditsParams) => {
      if (!tenant?.id) {
        throw new Error('No tenant found. Please log in again.');
      }

      const origin = window.location.origin;
      const tenantSlug = tenant.slug || 'admin';

      const successUrl = params.successUrl ||
        `${origin}/${tenantSlug}/admin/credits/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = params.cancelUrl ||
        `${origin}/${tenantSlug}/admin/credits/cancelled`;

      const { data, error } = await supabase.functions.invoke<PurchaseCreditsResponse>(
        'purchase-credits',
        {
          body: {
            tenant_id: tenant.id,
            package_slug: params.packageSlug,
            success_url: successUrl,
            cancel_url: cancelUrl,
          },
        }
      );

      if (error) {
        logger.error('Credit purchase failed', { error, packageSlug: params.packageSlug });
        throw error;
      }

      if (!data?.checkout_url) {
        throw new Error('No checkout URL returned from payment service.');
      }

      return data;
    },

    onSuccess: (data) => {
      // Invalidate credits balance queries so they refetch on return
      queryClient.invalidateQueries({ queryKey: ['credits', tenant?.id] });
      queryClient.invalidateQueries({ queryKey: ['tenant-credits'] });

      logger.info('Credit purchase checkout initiated', {
        sessionId: data.session_id,
        tenantId: tenant?.id,
      });

      toast.success('Checkout ready', {
        description: 'Complete your purchase to add credits to your balance.',
      });
    },

    onError: (error: StripeCardError) => {
      logger.error('Credit purchase error', {
        type: error.type,
        code: error.code,
        message: error.message,
        declineCode: error.declineCode,
      });

      // Show user-friendly error toast based on error type
      switch (error.type) {
        case 'card_error':
          toast.error('Payment Failed', {
            description: humanizeError(error),
            duration: 6000,
          });
          break;
        case 'validation_error':
          toast.error('Invalid Card Details', {
            description: humanizeError(error),
            duration: 5000,
          });
          break;
        case 'network_error':
          toast.error('Connection Error', {
            description: humanizeError(error),
            duration: 5000,
          });
          break;
        default:
          toast.error('Purchase Failed', {
            description: humanizeError(error, 'Please try again or contact support.'),
            duration: 5000,
          });
      }
    },

    // Transform raw errors into StripeCardError format
    throwOnError: false,
    meta: {
      errorTransformer: parseStripeError,
    },
  });

  // Wrap mutate to transform errors properly
  const purchaseCredits = (params: PurchaseCreditsParams) => {
    mutation.mutate(params);
  };

  const purchaseCreditsAsync = async (params: PurchaseCreditsParams): Promise<PurchaseCreditsResponse> => {
    try {
      const result = await mutation.mutateAsync(params);
      return result;
    } catch (rawError) {
      throw parseStripeError(rawError);
    }
  };

  return {
    purchaseCredits,
    purchaseCreditsAsync,
    isLoading: mutation.isPending,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error ?? null,
    reset: mutation.reset,
  };
}

// ============================================================================
// Companion Hook: Handle Post-Purchase Success
// ============================================================================

/**
 * Hook for the success page to confirm purchase and show updated balance.
 * Call this when user returns from Stripe checkout.
 */
export function usePurchaseSuccess() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const confirmPurchase = (newBalance?: number) => {
    // Invalidate all credit-related queries to fetch fresh balance
    queryClient.invalidateQueries({ queryKey: ['credits', tenant?.id] });
    queryClient.invalidateQueries({ queryKey: ['tenant-credits'] });

    if (newBalance !== undefined) {
      toast.success('Credits Added!', {
        description: `Your new balance is ${newBalance.toLocaleString()} credits.`,
        duration: 6000,
      });
    } else {
      toast.success('Purchase Complete!', {
        description: 'Your credits have been added to your account.',
        duration: 5000,
      });
    }

    logger.info('Credit purchase confirmed', {
      tenantId: tenant?.id,
      newBalance,
    });
  };

  return { confirmPurchase };
}
