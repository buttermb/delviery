/**
 * PromoCodeInput Component
 *
 * Text input with apply button for entering and validating promo codes.
 * Shows loading during validation, success with discount preview or error message.
 * Clears on invalid, stores valid code in parent state for checkout,
 * handles already applied state.
 */

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Tag,
  Loader2,
  CheckCircle2,
  XCircle,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { validatePromoCode } from '@/lib/credits/promoCodeService';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface ValidatedPromoCode {
  code: string;
  creditsAmount: number;
  description?: string;
}

export interface PromoCodeInputProps {
  /** Callback when a valid code is applied - stores code in parent state for checkout */
  onCodeApplied: (promoCode: ValidatedPromoCode | null) => void;
  /** Currently applied code from parent state (handles already applied state) */
  appliedCode?: ValidatedPromoCode | null;
  /** Additional class names */
  className?: string;
  /** Whether the input is disabled (e.g., during checkout processing) */
  disabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function PromoCodeInput({
  onCodeApplied,
  appliedCode = null,
  className,
  disabled = false,
}: PromoCodeInputProps) {
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Validate promo code mutation
  const validateMutation = useMutation({
    mutationFn: async (codeToValidate: string) => {
      return validatePromoCode(codeToValidate);
    },
    onSuccess: (result) => {
      if (result.valid && result.promoCode) {
        const validated: ValidatedPromoCode = {
          code: result.promoCode.code,
          creditsAmount: result.promoCode.creditsAmount,
          description: result.promoCode.description,
        };
        onCodeApplied(validated);
        setErrorMessage(null);
        setCode('');
      } else {
        setErrorMessage(result.error || 'Invalid promo code');
        setCode('');
        onCodeApplied(null);
      }
    },
    onError: (error) => {
      logger.error('Failed to validate promo code', { error });
      setErrorMessage('Failed to validate code. Please try again.');
      setCode('');
      onCodeApplied(null);
    },
  });

  const isLoading = validateMutation.isPending;

  // Handle input change
  const handleChange = useCallback((value: string) => {
    const formatted = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setCode(formatted);
    if (errorMessage) {
      setErrorMessage(null);
    }
  }, [errorMessage]);

  // Handle apply button click
  const handleApply = useCallback(() => {
    if (code.length < 3) {
      setErrorMessage('Please enter a valid promo code');
      return;
    }
    validateMutation.mutate(code);
  }, [code, validateMutation]);

  // Handle key press (Enter to apply)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && code.length >= 3 && !isLoading) {
      handleApply();
    }
  }, [code, isLoading, handleApply]);

  // Handle removing an applied code
  const handleRemoveCode = useCallback(() => {
    onCodeApplied(null);
    setCode('');
    setErrorMessage(null);
  }, [onCodeApplied]);

  // Already applied state
  if (appliedCode) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 p-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Code applied: <span className="font-mono">{appliedCode.code}</span>
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              +{appliedCode.creditsAmount.toLocaleString()} bonus credits
            </p>
          </div>
          {!disabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveCode}
              className="h-6 w-6 p-0 text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200"
              aria-label="Remove promo code"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Input state (not applied)
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Enter promo code"
            value={code}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              'pl-9 font-mono uppercase',
              errorMessage && 'border-red-500 focus-visible:ring-red-500'
            )}
            maxLength={20}
            disabled={disabled || isLoading}
            aria-label="Promo code"
            aria-invalid={!!errorMessage}
            aria-describedby={errorMessage ? 'promo-error' : undefined}
          />
        </div>
        <Button
          onClick={handleApply}
          disabled={disabled || isLoading || code.length < 3}
          variant="outline"
          size="default"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Apply'
          )}
        </Button>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div
          id="promo-error"
          className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          <XCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
