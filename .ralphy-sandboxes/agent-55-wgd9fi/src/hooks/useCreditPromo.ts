/**
 * useCreditPromo Hook
 *
 * Validates and previews promotional credit codes via the credits-apply-promo
 * edge function. Returns discount preview without applying the promo, and
 * stores valid promo state for the checkout flow.
 */

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

export interface PromoDiscountPreview {
  /** The validated promo code */
  code: string;
  /** Discount type: percentage, fixed_credits, or multiplier */
  discountType: 'percentage' | 'fixed_credits' | 'multiplier';
  /** Raw discount value (e.g., 20 for 20%, 500 for 500 credits) */
  discountValue: number;
  /** Calculated discount amount in credits for the given package */
  discountAmount: number;
  /** Final price after discount in credits */
  finalPrice: number;
  /** Original price before discount */
  originalPrice: number;
}

export interface ApplyPromoInput {
  /** The promo code string to validate */
  promoCode: string;
  /** The credit package ID to calculate discount against */
  packageId: string;
}

export interface ApplyPromoError {
  type: 'invalid_format' | 'invalid_code' | 'expired' | 'usage_limit' | 'per_user_limit' | 'not_active' | 'server_error';
  message: string;
}

export interface UseCreditPromoReturn {
  /** Apply/validate a promo code to preview discount */
  applyPromo: (input: ApplyPromoInput) => Promise<PromoDiscountPreview | null>;
  /** Whether a promo validation is in progress */
  isValidating: boolean;
  /** The currently stored valid promo for checkout */
  activePromo: PromoDiscountPreview | null;
  /** Clear the stored promo */
  clearPromo: () => void;
  /** Last error from promo validation */
  promoError: ApplyPromoError | null;
  /** Clear the error state */
  clearError: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Client-side promo code format validation.
 * Codes must be 3-30 characters, alphanumeric with hyphens/underscores.
 */
const PROMO_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,28}[A-Z0-9]$/;
const PROMO_CODE_MIN_LENGTH = 3;
const PROMO_CODE_MAX_LENGTH = 30;

// ============================================================================
// Helpers
// ============================================================================

function validateCodeFormat(code: string): ApplyPromoError | null {
  if (!code || code.trim().length === 0) {
    return {
      type: 'invalid_format',
      message: 'Please enter a promo code.',
    };
  }

  const normalized = code.trim().toUpperCase();

  if (normalized.length < PROMO_CODE_MIN_LENGTH) {
    return {
      type: 'invalid_format',
      message: `Promo code must be at least ${PROMO_CODE_MIN_LENGTH} characters.`,
    };
  }

  if (normalized.length > PROMO_CODE_MAX_LENGTH) {
    return {
      type: 'invalid_format',
      message: `Promo code must be at most ${PROMO_CODE_MAX_LENGTH} characters.`,
    };
  }

  if (!PROMO_CODE_PATTERN.test(normalized)) {
    return {
      type: 'invalid_format',
      message: 'Promo code can only contain letters, numbers, hyphens, and underscores.',
    };
  }

  return null;
}

function mapServerError(errorMessage: string): ApplyPromoError {
  const lower = errorMessage.toLowerCase();

  if (lower.includes('expired') || lower.includes('past valid')) {
    return {
      type: 'expired',
      message: 'This promo code has expired and is no longer valid.',
    };
  }

  if (lower.includes('usage limit') || lower.includes('max uses') || lower.includes('fully redeemed')) {
    return {
      type: 'usage_limit',
      message: 'This promo code has reached its maximum number of uses.',
    };
  }

  if (lower.includes('per_user') || lower.includes('already used') || lower.includes('already redeemed')) {
    return {
      type: 'per_user_limit',
      message: 'You have already used this promo code.',
    };
  }

  if (lower.includes('not active') || lower.includes('inactive') || lower.includes('deactivated')) {
    return {
      type: 'not_active',
      message: 'This promo code is no longer active.',
    };
  }

  if (lower.includes('not found') || lower.includes('invalid') || lower.includes('does not exist')) {
    return {
      type: 'invalid_code',
      message: 'This promo code is not recognized. Please check and try again.',
    };
  }

  return {
    type: 'server_error',
    message: 'Unable to validate promo code. Please try again later.',
  };
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCreditPromo(): UseCreditPromoReturn {
  const { tenant } = useTenantAdminAuth();
  const [activePromo, setActivePromo] = useState<PromoDiscountPreview | null>(null);
  const [promoError, setPromoError] = useState<ApplyPromoError | null>(null);

  const applyPromoMutation = useMutation({
    mutationFn: async (input: ApplyPromoInput): Promise<PromoDiscountPreview> => {
      const normalizedCode = input.promoCode.trim().toUpperCase();

      const { data, error } = await supabase.functions.invoke('credits-apply-promo', {
        body: {
          promo_code: normalizedCode,
          package_id: input.packageId,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to validate promo code');
      }

      const response = data as {
        discount_type: 'percentage' | 'fixed_credits' | 'multiplier';
        discount_value: number;
        discount_amount: number;
        final_price: number;
        original_price: number;
        error?: string;
      };

      if (response.error) {
        throw new Error(response.error);
      }

      return {
        code: normalizedCode,
        discountType: response.discount_type,
        discountValue: response.discount_value,
        discountAmount: response.discount_amount,
        finalPrice: response.final_price,
        originalPrice: response.original_price,
      };
    },
    onSuccess: (preview) => {
      setActivePromo(preview);
      setPromoError(null);
      toast.success('Promo code applied!', {
        description: `You save ${preview.discountAmount.toLocaleString()} credits.`,
      });
    },
    onError: (error: Error) => {
      const mapped = mapServerError(error.message);
      setPromoError(mapped);
      setActivePromo(null);
      toast.error('Promo code invalid', {
        description: mapped.message,
      });
      logger.error('Promo code validation failed', { error: error.message });
    },
  });

  const applyPromo = useCallback(
    async (input: ApplyPromoInput): Promise<PromoDiscountPreview | null> => {
      // Client-side format validation first
      const formatError = validateCodeFormat(input.promoCode);
      if (formatError) {
        setPromoError(formatError);
        setActivePromo(null);
        toast.error('Invalid promo code', { description: formatError.message });
        return null;
      }

      if (!tenant?.id) {
        const noTenantError: ApplyPromoError = {
          type: 'server_error',
          message: 'Unable to validate promo code. Please sign in and try again.',
        };
        setPromoError(noTenantError);
        return null;
      }

      try {
        const result = await applyPromoMutation.mutateAsync(input);
        return result;
      } catch {
        // Error already handled in onError callback
        return null;
      }
    },
    [tenant?.id, applyPromoMutation]
  );

  const clearPromo = useCallback(() => {
    setActivePromo(null);
    setPromoError(null);
  }, []);

  const clearError = useCallback(() => {
    setPromoError(null);
  }, []);

  return {
    applyPromo,
    isValidating: applyPromoMutation.isPending,
    activePromo,
    clearPromo,
    promoError,
    clearError,
  };
}
