/**
 * LowCreditNudge Component
 * 
 * A subtle but noticeable indicator that appears when credits are running low.
 * Designed to be placed in the header/nav area to encourage purchases
 * before credits run out completely.
 */

import { useState } from 'react';
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Zap from "lucide-react/dist/esm/icons/zap";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import X from "lucide-react/dist/esm/icons/x";
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCredits } from '@/hooks/useCredits';
import { CreditPurchaseModal } from './CreditPurchaseModal';

export interface LowCreditNudgeProps {
  className?: string;
  /** Threshold below which to show the nudge (default: 100) */
  threshold?: number;
  /** Allow dismissing for this session */
  dismissible?: boolean;
}

export function LowCreditNudge({ 
  className,
  threshold = 100,
  dismissible = true,
}: LowCreditNudgeProps) {
  const [dismissed, setDismissed] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  
  const { 
    balance, 
    isFreeTier, 
    isLoading,
    isOutOfCredits,
    isCriticalCredits,
  } = useCredits();

  // Don't show for paid tier users or if loading
  if (!isFreeTier || isLoading) {
    return null;
  }

  // Don't show if balance is above threshold
  if (balance > threshold && !isOutOfCredits && !isCriticalCredits) {
    return null;
  }

  // Don't show if dismissed
  if (dismissed) {
    return null;
  }

  // Determine urgency level
  const isUrgent = isOutOfCredits || balance <= 25;
  const isWarning = isCriticalCredits || balance <= 50;

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm cursor-pointer transition-all',
          isUrgent 
            ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 animate-pulse'
            : isWarning
              ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20'
              : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20',
          className
        )}
        onClick={() => setShowPurchaseModal(true)}
      >
        {isUrgent ? (
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        ) : (
          <Zap className="h-4 w-4 flex-shrink-0" />
        )}
        
        <span className="font-medium">
          {isOutOfCredits 
            ? 'Out of credits!' 
            : `${balance} credits left`}
        </span>
        
        <Badge 
          variant="secondary" 
          className={cn(
            'text-xs px-1.5 py-0',
            isUrgent 
              ? 'bg-red-500 text-white hover:bg-red-600' 
              : isWarning
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-yellow-500 text-white hover:bg-yellow-600'
          )}
        >
          Buy Now
          <ChevronRight className="h-3 w-3 ml-0.5" />
        </Badge>

        {dismissible && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDismissed(true);
            }}
            className="ml-1 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
            aria-label="Dismiss notification"
            title="Dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <CreditPurchaseModal 
        open={showPurchaseModal} 
        onOpenChange={setShowPurchaseModal} 
      />
    </>
  );
}

export default LowCreditNudge;

