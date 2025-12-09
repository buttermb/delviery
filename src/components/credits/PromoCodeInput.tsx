/**
 * PromoCodeInput Component
 * 
 * Simple input for entering and redeeming promo codes.
 * Shows in Settings > Billing for free tier users.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Gift,
  Tag,
  Loader2,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useCredits } from '@/hooks/useCredits';
import {
  validatePromoCode,
  redeemPromoCode,
  type PromoCode,
} from '@/lib/credits/promoCodeService';
import { logger } from '@/lib/logger';

export interface PromoCodeInputProps {
  className?: string;
  variant?: 'card' | 'inline';
  onSuccess?: (creditsGranted: number) => void;
}

export function PromoCodeInput({
  className,
  variant = 'card',
  onSuccess,
}: PromoCodeInputProps) {
  const { tenant } = useTenantAdminAuth();
  const { isFreeTier } = useCredits();
  const queryClient = useQueryClient();

  const [code, setCode] = useState('');
  const [validatedCode, setValidatedCode] = useState<PromoCode | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const tenantId = tenant?.id;

  // Validate mutation
  const validateMutation = useMutation({
    mutationFn: async (codeToValidate: string) => {
      return validatePromoCode(codeToValidate);
    },
    onSuccess: (result) => {
      if (result.valid && result.promoCode) {
        setValidatedCode(result.promoCode);
        setValidationError(null);
      } else {
        setValidatedCode(null);
        setValidationError(result.error || 'Invalid code');
      }
    },
    onError: () => {
      setValidatedCode(null);
      setValidationError('Failed to validate code');
    },
  });

  // Redeem mutation
  const redeemMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !code) throw new Error('Missing data');
      return redeemPromoCode(tenantId, code);
    },
    onSuccess: (result) => {
      if (result.success && result.creditsGranted) {
        toast.success(`🎉 ${result.creditsGranted.toLocaleString()} credits added!`);
        setCode('');
        setValidatedCode(null);
        queryClient.invalidateQueries({ queryKey: ['credits'] });
        onSuccess?.(result.creditsGranted);
      } else {
        toast.error(result.error || 'Failed to redeem code');
      }
    },
    onError: (error) => {
      logger.error('Failed to redeem promo code', { error });
      toast.error('Failed to redeem code');
    },
  });

  // Handle code change
  const handleCodeChange = (newCode: string) => {
    const formatted = newCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setCode(formatted);
    setValidatedCode(null);
    setValidationError(null);
  };

  // Handle validate
  const handleValidate = () => {
    if (code.length < 4) {
      setValidationError('Code too short');
      return;
    }
    validateMutation.mutate(code);
  };

  // Handle redeem
  const handleRedeem = () => {
    if (!validatedCode) {
      handleValidate();
      return;
    }
    redeemMutation.mutate();
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (validatedCode) {
        handleRedeem();
      } else {
        handleValidate();
      }
    }
  };

  // Don't show for paid tier
  if (!isFreeTier) {
    return null;
  }

  // Inline variant
  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Input
          placeholder="Enter promo code"
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          onKeyPress={handleKeyPress}
          className={cn(
            'font-mono uppercase w-40',
            validatedCode && 'border-emerald-500',
            validationError && 'border-red-500'
          )}
          maxLength={20}
        />
        <Button
          onClick={handleRedeem}
          disabled={!code || redeemMutation.isPending || validateMutation.isPending}
          size="sm"
        >
          {redeemMutation.isPending || validateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Apply'
          )}
        </Button>
      </div>
    );
  }

  // Card variant
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Tag className="h-4 w-4 text-purple-500" />
          Promo Code
        </CardTitle>
        <CardDescription>
          Have a promo code? Enter it to get bonus credits
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            placeholder="PROMO2024"
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            onKeyPress={handleKeyPress}
            className={cn(
              'font-mono uppercase',
              validatedCode && 'border-emerald-500 focus:ring-emerald-500',
              validationError && 'border-red-500 focus:ring-red-500'
            )}
            maxLength={20}
          />
          <Button
            onClick={handleRedeem}
            disabled={!code || redeemMutation.isPending || validateMutation.isPending}
          >
            {redeemMutation.isPending || validateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : validatedCode ? (
              <>
                <Gift className="h-4 w-4 mr-2" />
                Redeem
              </>
            ) : (
              'Apply'
            )}
          </Button>
        </div>

        {/* Validation result */}
        {validatedCode && (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                Valid! Get {validatedCode.creditsAmount.toLocaleString()} credits
              </span>
            </div>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
              <Sparkles className="h-3 w-3 mr-1" />
              {validatedCode.creditsAmount.toLocaleString()}
            </Badge>
          </div>
        )}

        {/* Error message */}
        {validationError && (
          <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 flex items-center gap-2">
            <X className="h-5 w-5 text-red-500" />
            <span className="text-sm text-red-700 dark:text-red-300">
              {validationError}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}







