/**
 * GracePeriodBanner Component
 * 
 * Shows when user is in the 24-hour grace period after credits hit zero.
 * Warns them about upcoming blocking and encourages immediate action.
 */

import { useState, useEffect } from 'react';
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Clock from "lucide-react/dist/esm/icons/clock";
import Zap from "lucide-react/dist/esm/icons/zap";
import X from "lucide-react/dist/esm/icons/x";
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCredits } from '@/hooks/useCredits';
import { GRACE_PERIOD } from '@/lib/credits';
import { CreditPurchaseModal } from './CreditPurchaseModal';

export interface GracePeriodBannerProps {
  className?: string;
  onDismiss?: () => void;
}

const GRACE_STORAGE_KEY = 'credit_grace_period_start';

export function GracePeriodBanner({ className, onDismiss }: GracePeriodBannerProps) {
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  
  const { balance, isFreeTier, isOutOfCredits } = useCredits();

  // Calculate and track grace period
  useEffect(() => {
    if (!isFreeTier) return;

    // If out of credits, start or continue grace period
    if (isOutOfCredits || balance <= 0) {
      let graceStart = localStorage.getItem(GRACE_STORAGE_KEY);
      
      if (!graceStart) {
        // Start grace period now
        graceStart = new Date().toISOString();
        localStorage.setItem(GRACE_STORAGE_KEY, graceStart);
      }

      const startTime = new Date(graceStart).getTime();
      const graceEndTime = startTime + (GRACE_PERIOD.DURATION_HOURS * 60 * 60 * 1000);
      
      // Update time remaining every second
      const updateTimer = () => {
        const now = Date.now();
        const remaining = Math.max(0, graceEndTime - now);
        setTimeRemaining(remaining);
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      
      return () => clearInterval(interval);
    } else {
      // Credits restored, clear grace period
      localStorage.removeItem(GRACE_STORAGE_KEY);
      setTimeRemaining(null);
    }
  }, [isFreeTier, isOutOfCredits, balance]);

  // Don't show if not in grace period or dismissed
  if (!isFreeTier || timeRemaining === null || dismissed) {
    return null;
  }

  // Grace period expired
  if (timeRemaining <= 0) {
    return (
      <>
        <div className={cn(
          "bg-red-600 text-white px-4 py-3 flex items-center justify-between",
          className
        )}>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Grace Period Expired</p>
              <p className="text-sm text-red-100">
                Actions are now blocked. Purchase credits or upgrade to continue.
              </p>
            </div>
          </div>
          
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => setShowPurchaseModal(true)}
            className="bg-white text-red-600 hover:bg-red-50"
          >
            <Zap className="h-4 w-4 mr-1" />
            Get Credits Now
          </Button>
        </div>

        <CreditPurchaseModal 
          open={showPurchaseModal} 
          onOpenChange={setShowPurchaseModal} 
        />
      </>
    );
  }

  // Format time remaining
  const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

  const timeString = hours > 0 
    ? `${hours}h ${minutes}m`
    : minutes > 0 
      ? `${minutes}m ${seconds}s`
      : `${seconds}s`;

  // Determine urgency level
  const isUrgent = timeRemaining < 2 * 60 * 60 * 1000; // Less than 2 hours
  const isCritical = timeRemaining < 30 * 60 * 1000; // Less than 30 minutes

  return (
    <>
      <div className={cn(
        "px-4 py-3 flex items-center justify-between",
        isCritical 
          ? "bg-red-600 text-white"
          : isUrgent
            ? "bg-orange-500 text-white"
            : "bg-yellow-500 text-yellow-950",
        className
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-full",
            isCritical 
              ? "bg-red-500"
              : isUrgent
                ? "bg-orange-400"
                : "bg-yellow-400"
          )}>
            <Clock className="h-4 w-4" />
          </div>
          
          <div>
            <p className="font-semibold flex items-center gap-2">
              Grace Period Active
              <span className={cn(
                "px-2 py-0.5 rounded-full text-sm font-mono",
                isCritical 
                  ? "bg-red-500"
                  : isUrgent
                    ? "bg-orange-400"
                    : "bg-yellow-400/50"
              )}>
                {timeString}
              </span>
            </p>
            <p className={cn(
              "text-sm",
              isCritical 
                ? "text-red-100"
                : isUrgent
                  ? "text-orange-100"
                  : "text-yellow-800"
            )}>
              {isCritical 
                ? "Actions will be blocked very soon! Act now."
                : isUrgent
                  ? "Limited time remaining. Get credits to avoid interruption."
                  : `You can still perform up to ${GRACE_PERIOD.FREE_ACTIONS} essential actions.`
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            size="sm"
            onClick={() => setShowPurchaseModal(true)}
            className={cn(
              isCritical 
                ? "bg-white text-red-600 hover:bg-red-50"
                : isUrgent
                  ? "bg-white text-orange-600 hover:bg-orange-50"
                  : "bg-yellow-700 text-white hover:bg-yellow-800"
            )}
          >
            <Zap className="h-4 w-4 mr-1" />
            Get Credits
          </Button>
          
          {!isCritical && (
            <button
              onClick={() => {
                setDismissed(true);
                onDismiss?.();
              }}
              className={cn(
                "p-1 rounded hover:bg-black/10",
                isUrgent ? "text-orange-200" : "text-yellow-700"
              )}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <CreditPurchaseModal 
        open={showPurchaseModal} 
        onOpenChange={setShowPurchaseModal} 
      />
    </>
  );
}

// ============================================================================
// Hook for grace period state
// ============================================================================

export interface UseGracePeriodReturn {
  isInGracePeriod: boolean;
  isGraceExpired: boolean;
  timeRemaining: number | null;
  actionsRemaining: number;
  canPerformAction: (actionKey: string) => boolean;
}

export function useGracePeriod(): UseGracePeriodReturn {
  const { balance, isFreeTier, isOutOfCredits } = useCredits();
  const [actionsUsed, setActionsUsed] = useState(0);
  const [graceStart, setGraceStart] = useState<Date | null>(null);

  useEffect(() => {
    if (!isFreeTier) return;

    if (isOutOfCredits || balance <= 0) {
      const stored = localStorage.getItem(GRACE_STORAGE_KEY);
      if (stored) {
        setGraceStart(new Date(stored));
      } else {
        const now = new Date();
        localStorage.setItem(GRACE_STORAGE_KEY, now.toISOString());
        setGraceStart(now);
      }

      // Get actions used during grace
      const usedKey = `${GRACE_STORAGE_KEY}_actions`;
      const used = parseInt(localStorage.getItem(usedKey) || '0', 10);
      setActionsUsed(used);
    } else {
      localStorage.removeItem(GRACE_STORAGE_KEY);
      localStorage.removeItem(`${GRACE_STORAGE_KEY}_actions`);
      setGraceStart(null);
      setActionsUsed(0);
    }
  }, [isFreeTier, isOutOfCredits, balance]);

  const isInGracePeriod = graceStart !== null;
  const graceEndTime = graceStart 
    ? graceStart.getTime() + (GRACE_PERIOD.DURATION_HOURS * 60 * 60 * 1000)
    : 0;
  const timeRemaining = isInGracePeriod ? Math.max(0, graceEndTime - Date.now()) : null;
  const isGraceExpired = isInGracePeriod && timeRemaining === 0;
  const actionsRemaining = Math.max(0, GRACE_PERIOD.FREE_ACTIONS - actionsUsed);

  const canPerformAction = (actionKey: string): boolean => {
    // If not in grace period or has credits, allow
    if (!isInGracePeriod || balance > 0) return true;
    
    // If grace expired, block
    if (isGraceExpired) return false;
    
    // Check if action is blocked during grace
    if (GRACE_PERIOD.BLOCKED_ACTIONS.includes(actionKey as any)) return false;
    
    // Check actions remaining
    return actionsRemaining > 0;
  };

  return {
    isInGracePeriod,
    isGraceExpired,
    timeRemaining,
    actionsRemaining,
    canPerformAction,
  };
}

export default GracePeriodBanner;

