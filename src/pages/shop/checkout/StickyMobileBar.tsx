/**
 * StickyMobileBar
 * Fixed bottom bar for mobile with continue/place-order actions
 */

import { ArrowRight, Check, Clock, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';

interface StickyMobileBarProps {
  currentStep: number;
  total: number;
  themeColor: string;
  isPending: boolean;
  agreeToTerms: boolean;
  isStoreClosed: boolean;
  onNextStep: () => void;
  onPlaceOrder: () => void;
}

export function StickyMobileBar({
  currentStep,
  total,
  themeColor,
  isPending,
  agreeToTerms,
  isStoreClosed,
  onNextStep,
  onPlaceOrder,
}: StickyMobileBarProps) {
  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-background/95 backdrop-blur-md border-t px-3 sm:px-4 py-3 sm:py-4 z-50" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        {currentStep < 4 ? (
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
              <p className="text-base sm:text-lg font-bold" style={{ color: themeColor }}>{formatCurrency(total)}</p>
            </div>
            <Button
              onClick={onNextStep}
              disabled={isPending}
              style={{ backgroundColor: themeColor }}
              className="flex-1 h-12 text-white text-base"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Order Total</span>
              <span className="font-bold text-base" style={{ color: themeColor }}>{formatCurrency(total)}</span>
            </div>
            <Button
              onClick={onPlaceOrder}
              disabled={isPending || !agreeToTerms}
              style={{ backgroundColor: themeColor }}
              className="w-full h-12 text-white text-base font-semibold"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : isStoreClosed ? (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  Place Pre-Order — {formatCurrency(total)}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Place Order — {formatCurrency(total)}
                </>
              )}
            </Button>
          </div>
        )}
      </div>
      {/* Spacer for mobile sticky bar */}
      <div className="h-28 lg:hidden" />
    </>
  );
}
