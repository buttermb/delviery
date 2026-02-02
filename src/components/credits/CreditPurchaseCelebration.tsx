/**
 * CreditPurchaseCelebration Component
 * 
 * A celebratory modal shown after a successful credit purchase.
 * Reinforces the value of the purchase and encourages usage.
 */

import { useEffect, useState } from 'react';
import PartyPopper from "lucide-react/dist/esm/icons/party-popper";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Zap from "lucide-react/dist/esm/icons/zap";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import Coins from "lucide-react/dist/esm/icons/coins";
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
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (open) {
      setShowConfetti(true);
      // Auto-close after 5 seconds if not manually closed
      const timer = setTimeout(() => {
        // Don't auto-close, let user dismiss
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setShowConfetti(false);
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
          {/* Celebration Icon */}
          <div className={cn(
            "relative w-20 h-20 mx-auto mb-2",
            showConfetti && "animate-bounce"
          )}>
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-blue-500/20 to-purple-500/20 rounded-full animate-pulse" />
            <div className="absolute inset-2 bg-gradient-to-br from-emerald-500 via-blue-500 to-purple-500 rounded-full flex items-center justify-center">
              <PartyPopper className="h-10 w-10 text-white" />
            </div>
            {/* Sparkle decorations */}
            <Sparkles className="absolute -top-1 -right-1 h-6 w-6 text-yellow-400 animate-pulse" />
            <Sparkles className="absolute -bottom-1 -left-1 h-5 w-5 text-purple-400 animate-pulse" style={{ animationDelay: '0.5s' }} />
          </div>

          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
            🎉 Full Access Restored!
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
          <div className="bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 rounded-xl p-4 border border-emerald-500/20">
            <div className="flex items-center justify-center gap-3">
              <Coins className="h-8 w-8 text-emerald-500" />
              <div className="text-left">
                <p className="text-sm text-muted-foreground">Credits Added</p>
                <p className="text-3xl font-bold text-emerald-600">
                  +{creditsAdded.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* New Balance */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Your New Balance</span>
            <Badge variant="outline" className="text-lg px-3 py-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              {newBalance.toLocaleString()} credits
            </Badge>
          </div>

          {/* What you can do */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">What you can do now:</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 bg-blue-500/10 rounded-lg">
                <span className="text-lg font-bold text-blue-600">{estimatedActions.orders}</span>
                <p className="text-[10px] text-muted-foreground">Orders</p>
              </div>
              <div className="text-center p-2 bg-purple-500/10 rounded-lg">
                <span className="text-lg font-bold text-purple-600">{estimatedActions.menus}</span>
                <p className="text-[10px] text-muted-foreground">Menus</p>
              </div>
              <div className="text-center p-2 bg-orange-500/10 rounded-lg">
                <span className="text-lg font-bold text-orange-600">{estimatedActions.sms}</span>
                <p className="text-[10px] text-muted-foreground">SMS</p>
              </div>
            </div>
          </div>

          {/* Benefits reminder */}
          <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-500/10 rounded-lg p-3">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            <span>No daily limits while you have credits!</span>
          </div>
        </div>

        <Button 
          onClick={handleContinue}
          className="w-full bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 hover:from-emerald-700 hover:via-blue-700 hover:to-purple-700"
          size="lg"
        >
          <Zap className="h-4 w-4 mr-2" />
          Start Using Credits
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

