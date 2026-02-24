/**
 * CreditDeductionToast Component
 * 
 * Shows a brief, non-intrusive toast notification when credits are deducted.
 * Auto-dismisses after 2 seconds. Clicking opens purchase modal.
 */

import { useState, useEffect } from 'react';
import { Coins, TrendingDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreditPurchaseModal } from './CreditPurchaseModal';

export interface CreditDeductionToastProps {
  amount: number;
  action: string;
  newBalance: number;
  onDismiss?: () => void;
  className?: string;
}

export function CreditDeductionToast({
  amount,
  action,
  newBalance,
  onDismiss,
  className,
}: CreditDeductionToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  // Auto-dismiss after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, 2000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleClick = () => {
    setShowPurchaseModal(true);
  };

  if (!isVisible) return null;

  const isLowBalance = newBalance < 1000;
  const isCriticalBalance = newBalance < 500;

  return (
    <>
      <div
        className={cn(
          'fixed bottom-20 right-4 z-50 animate-in slide-in-from-right-5 fade-in duration-200',
          'cursor-pointer transition-transform hover:scale-105',
          className
        )}
        onClick={handleClick}
      >
        <div
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-sm',
            isCriticalBalance
              ? 'bg-red-500/90 border-red-400 text-white'
              : isLowBalance
                ? 'bg-orange-500/90 border-orange-400 text-white'
                : 'bg-background/95 border-border text-foreground'
          )}
        >
          <div
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-full',
              isCriticalBalance
                ? 'bg-red-600'
                : isLowBalance
                  ? 'bg-orange-600'
                  : 'bg-primary/10'
            )}
          >
            <TrendingDown
              className={cn(
                'h-4 w-4',
                isCriticalBalance || isLowBalance
                  ? 'text-white'
                  : 'text-primary'
              )}
            />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">
                -{amount} credits
              </span>
              <span
                className={cn(
                  'text-xs',
                  isCriticalBalance || isLowBalance
                    ? 'text-white/80'
                    : 'text-muted-foreground'
                )}
              >
                ({action})
              </span>
            </div>
            <div
              className={cn(
                'text-xs flex items-center gap-1',
                isCriticalBalance || isLowBalance
                  ? 'text-white/70'
                  : 'text-muted-foreground'
              )}
            >
              <Coins className="h-3 w-3" />
              <span>{newBalance.toLocaleString()} remaining</span>
              {isLowBalance && (
                <span className="ml-1 flex items-center gap-1">
                  · <Sparkles className="h-3 w-3" /> Tap to upgrade
                </span>
              )}
            </div>
          </div>
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
// Toast Manager - Singleton for showing credit toasts
// ============================================================================

type ToastData = {
  id: string;
  amount: number;
  action: string;
  newBalance: number;
};

type ToastListener = (toasts: ToastData[]) => void;

class CreditToastManager {
  private toasts: ToastData[] = [];
  private listeners: Set<ToastListener> = new Set();

  show(amount: number, action: string, newBalance: number) {
    const toast: ToastData = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      amount,
      action,
      newBalance,
    };

    this.toasts.push(toast);
    this.notifyListeners();

    // Auto-remove after animation completes
    setTimeout(() => {
      this.dismiss(toast.id);
    }, 2500);
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notifyListeners();
  }

  subscribe(listener: ToastListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getToasts() {
    return this.toasts;
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }
}

export const creditToastManager = new CreditToastManager();

// ============================================================================
// Toast Container Component
// ============================================================================

export interface CreditToastContainerProps {
  className?: string;
}

import { createPortal } from 'react-dom';

export function CreditToastContainer({ className }: CreditToastContainerProps) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    const unsubscribe = creditToastManager.subscribe(setToasts);
    return () => { unsubscribe(); };
  }, []);

  if (toasts.length === 0) return null;

  return createPortal(
    <div className={cn('fixed bottom-20 right-4 z-toast space-y-2 pointer-events-none', className)}>
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{ transform: `translateY(-${index * 8}px)` }}
          className="pointer-events-auto"
        >
          <CreditDeductionToast
            amount={toast.amount}
            action={toast.action}
            newBalance={toast.newBalance}
            onDismiss={() => creditToastManager.dismiss(toast.id)}
          />
        </div>
      ))}
    </div>,
    document.body
  );
}

// ============================================================================
// Helper function to show credit toast
// ============================================================================

export function showCreditDeductionToast(
  amount: number,
  action: string,
  newBalance: number
) {
  creditToastManager.show(amount, action, newBalance);
}







