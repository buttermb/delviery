/**
 * CreditPurchaseCelebration Component
 * 
 * A celebratory modal shown after a successful credit purchase.
 * Reinforces the value of the purchase and encourages usage.
 */

import { useEffect, useState } from 'react';
import { Zap, CheckCircle2, ArrowRight, Coins } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface CreditPurchaseCelebrationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditsAdded: number;
  newBalance: number;
  packageName?: string;
  onContinue?: () => void;
}

export function CreditPurchaseCelebration({
  open,
  onOpenChange,
  creditsAdded,
  newBalance,
  packageName,
  onContinue,
}: CreditPurchaseCelebrationProps) {
  useEffect(() => {
    if (open) {
      // Auto-close after 5 seconds if not manually closed
      const timer = setTimeout(() => {
        // Don't auto-close, let user dismiss
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleContinue = () => {
    onOpenChange(false);
    onContinue?.();
  };

  // Calculate what they can do with the credits
  const estimatedActions = {
    orders: Math.floor(creditsAdded / 75),
    menus: Math.floor(creditsAdded / 100),
    sms: Math.floor(creditsAdded / 25),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader className="items-center">
          {/* Success Icon */}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>

          <DialogTitle className="text-xl font-semibold">
            Full Access Restored
          </DialogTitle>
          
          <DialogDescription className="text-base">
            {packageName 
              ? `Your ${packageName} purchase was successful!`
              : 'Your credit purchase was successful!'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Credits Added */}
          <div className="bg-card rounded-xl p-4 border shadow-sm">
            <div className="flex items-center justify-center gap-3">
              <Coins className="h-8 w-8 text-primary" />
              <div className="text-left">
                <p className="text-sm text-muted-foreground">Credits Added</p>
                <p className="text-3xl font-bold text-primary">
                  +{creditsAdded.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* New Balance */}
          <div className="flex items-center justify-between p-3 bg-muted/50 border rounded-lg">
            <span className="text-sm font-medium">Your New Balance</span>
            <span className="font-semibold text-primary">
              {newBalance.toLocaleString()} credits
            </span>
          </div>

          {/* What you can do */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-left">What you can do now:</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-card border rounded-lg shadow-sm">
                <span className="text-xl font-bold">{estimatedActions.orders}</span>
                <p className="text-xs text-muted-foreground mt-1">Orders</p>
              </div>
              <div className="text-center p-3 bg-card border rounded-lg shadow-sm">
                <span className="text-xl font-bold">{estimatedActions.menus}</span>
                <p className="text-xs text-muted-foreground mt-1">Menus</p>
              </div>
              <div className="text-center p-3 bg-card border rounded-lg shadow-sm">
                <span className="text-xl font-bold">{estimatedActions.sms}</span>
                <p className="text-xs text-muted-foreground mt-1">SMS</p>
              </div>
            </div>
          </div>

          {/* Benefits reminder */}
          <div className="flex items-center gap-2 text-sm text-foreground bg-primary/5 border border-primary/10 rounded-lg p-3">
            <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
            <span>No daily limits while you have credits.</span>
          </div>
        </div>

        <Button 
          onClick={handleContinue}
          className="w-full"
          size="lg"
        >
          <Zap className="h-4 w-4 mr-2" />
          Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Hook for managing celebration state
// ============================================================================

export interface UseCreditCelebrationReturn {
  showCelebration: (credits: number, balance: number, packageName?: string) => void;
  celebrationProps: CreditPurchaseCelebrationProps;
}

export function useCreditCelebration(): UseCreditCelebrationReturn {
  const [open, setOpen] = useState(false);
  const [creditsAdded, setCreditsAdded] = useState(0);
  const [newBalance, setNewBalance] = useState(0);
  const [packageName, setPackageName] = useState<string | undefined>();

  const showCelebration = (credits: number, balance: number, pkg?: string) => {
    setCreditsAdded(credits);
    setNewBalance(balance);
    setPackageName(pkg);
    setOpen(true);
  };

  return {
    showCelebration,
    celebrationProps: {
      open,
      onOpenChange: setOpen,
      creditsAdded,
      newBalance,
      packageName,
    },
  };
}

export default CreditPurchaseCelebration;





