/**
 * Purchase Success Page
 * Shown after successful credit purchase. Displays confetti animation,
 * credits added, new total balance, transaction ID, and suggestions.
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  Coins,
  Loader2,
  ArrowRight,
  ShoppingCart,
  Zap,
  TrendingUp,
  Copy,
  Check,
} from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';
import { useTenantNavigation } from '@/hooks/useTenantNavigation';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { showCopyToast } from '@/utils/toastHelpers';
import confetti from 'canvas-confetti';
import { queryKeys } from '@/lib/queryKeys';

interface CreditSuggestion {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const CREDIT_SUGGESTIONS: CreditSuggestion[] = [
  {
    icon: <ShoppingCart className="w-5 h-5 text-blue-500" />,
    title: 'Place Orders',
    description: 'Use credits to place wholesale orders with your suppliers.',
  },
  {
    icon: <Zap className="w-5 h-5 text-amber-500" />,
    title: 'Unlock Premium Features',
    description: 'Access advanced analytics, AI insights, and automation tools.',
  },
  {
    icon: <TrendingUp className="w-5 h-5 text-green-500" />,
    title: 'Boost Your Business',
    description: 'Run promotions, featured listings, and marketing campaigns.',
  },
];

export function PurchaseSuccessPage() {
  const [searchParams] = useSearchParams();
  const _navigate = useNavigate();
  const { balance, isLoading } = useCredits();
  const { navigateToAdmin } = useTenantNavigation();
  const queryClient = useQueryClient();
  const [hasRefreshed, setHasRefreshed] = useState(false);
  const [copied, setCopied] = useState(false);

  const creditsAdded = searchParams.get('credits_added');
  const transactionId = searchParams.get('transaction_id') || searchParams.get('session_id');
  const bonusCredits = searchParams.get('bonus_credits');

  const creditsAddedNum = creditsAdded ? parseInt(creditsAdded, 10) : null;
  const bonusCreditsNum = bonusCredits ? parseInt(bonusCredits, 10) : null;
  const totalAdded = (creditsAddedNum ?? 0) + (bonusCreditsNum ?? 0);

  // Refresh credits balance on mount
  useEffect(() => {
    if (!hasRefreshed) {
      queryClient.invalidateQueries({ queryKey: queryKeys.credits.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenantCredits.all });
      setHasRefreshed(true);
    }
  }, [queryClient, hasRefreshed]);

  // Fire confetti animation on mount
  useEffect(() => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 }; // matches --z-max token

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleCopyTransactionId = async () => {
    if (!transactionId) return;
    try {
      await navigator.clipboard.writeText(transactionId);
      setCopied(true);
      showCopyToast('Transaction ID');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      logger.warn('Failed to copy transaction ID to clipboard');
    }
  };

  const handleGoToDashboard = () => {
    navigateToAdmin('dashboard');
  };

  const handleViewHistory = () => {
    navigateToAdmin('billing');
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Success Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Purchase Successful!</h1>
          <p className="text-muted-foreground">
            Your credits have been added to your account instantly.
          </p>
        </div>

        {/* Credits Summary Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-center">Credits Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Credits Added */}
            {totalAdded > 0 && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-300 mb-1">
                  <Coins className="w-5 h-5" />
                  <span className="text-sm font-medium">Credits Added</span>
                </div>
                <div className="text-3xl font-bold text-center text-green-700 dark:text-green-300">
                  +{totalAdded.toLocaleString()}
                </div>
                {bonusCreditsNum && bonusCreditsNum > 0 && (
                  <p className="text-xs text-center text-green-600 dark:text-green-400 mt-1">
                    Includes {bonusCreditsNum.toLocaleString()} bonus credits
                  </p>
                )}
              </div>
            )}

            {/* New Total Balance */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                <Coins className="w-5 h-5" />
                <span className="text-sm">New Balance</span>
              </div>
              <div className="text-4xl font-bold text-center">
                {isLoading ? (
                  <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                ) : (
                  balance.toLocaleString()
                )}
              </div>
              <div className="text-sm text-muted-foreground text-center">credits available</div>
            </div>

            {/* Transaction ID */}
            {transactionId && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Transaction ID</p>
                  <p className="text-sm font-mono truncate">
                    {transactionId.length > 24
                      ? `${transactionId.slice(0, 12)}...${transactionId.slice(-8)}`
                      : transactionId}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyTransactionId}
                  className="ml-2 shrink-0"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Suggestions Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">What to do with your credits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {CREDIT_SUGGESTIONS.map((suggestion) => (
                <div
                  key={suggestion.title}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="mt-0.5 shrink-0">{suggestion.icon}</div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{suggestion.title}</p>
                    <p className="text-xs text-muted-foreground">{suggestion.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          <Button onClick={handleGoToDashboard} className="w-full" size="lg">
            Continue to Dashboard
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button
            variant="outline"
            onClick={handleViewHistory}
            className="w-full"
          >
            View Transaction History
          </Button>
        </div>
      </div>
    </div>
  );
}
