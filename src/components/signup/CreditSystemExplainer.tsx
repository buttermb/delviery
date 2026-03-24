/**
 * Credit System Explainer Component
 * 
 * A friendly, non-pushy explanation of the credit system for new users.
 * Shows during signup/onboarding.
 */

import { Coins, Zap, TrendingUp, Gift, CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FREE_TIER_MONTHLY_CREDITS, FREE_TIER_LIMITS } from '@/lib/credits';

// ============================================================================
// Types
// ============================================================================

export interface CreditSystemExplainerProps {
  onContinue?: () => void;
  onUpgrade?: () => void;
  variant?: 'full' | 'compact' | 'minimal';
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function CreditSystemExplainer({
  onContinue,
  onUpgrade,
  variant = 'full',
  className,
}: CreditSystemExplainerProps) {
  // Sample actions to show credit costs
  const sampleActions = [
    { action: 'Create a menu', credits: 100 },
    { action: 'Receive an order', credits: 75 },
    { action: 'Send an SMS', credits: 25 },
    { action: 'Process a sale', credits: 25 },
    { action: 'View reports', credits: 0 },
  ];

  // Minimal variant - just a badge
  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
          <Gift className="h-3 w-3 mr-1" />
          {FREE_TIER_MONTHLY_CREDITS} Free Credits
        </Badge>
      </div>
    );
  }

  // Compact variant - single line with info
  if (variant === 'compact') {
    return (
      <div className={cn(
        'flex items-center justify-between p-3 rounded-lg bg-card border shadow-sm',
        className
      )}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Coins className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">Start with {FREE_TIER_MONTHLY_CREDITS} free credits</p>
            <p className="text-xs text-muted-foreground">
              Explore all features • Upgrade anytime for unlimited
            </p>
          </div>
        </div>
        {onContinue && (
          <Button size="sm" variant="ghost" onClick={onContinue}>
            Got it
          </Button>
        )}
      </div>
    );
  }

  // Full variant - detailed explanation
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center">
          <Coins className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">Start Free with Credits</h3>
        <p className="text-muted-foreground mt-1">
          No credit card required. Explore everything.
        </p>
      </div>

      {/* Credit Balance */}
      <div className="bg-card border shadow-sm rounded-xl p-6 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <Coins className="h-4 w-4" />
            <span className="text-sm font-medium">Your Starting Balance</span>
        </div>
        <div className="text-4xl font-semibold tracking-tight mb-2 flex items-baseline gap-1">
            {FREE_TIER_MONTHLY_CREDITS.toLocaleString()}
            <span className="text-lg text-muted-foreground font-normal">credits</span>
        </div>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            Refreshes monthly • No credit card required
        </p>
      </div>

      {/* How It Works */}
      <div className="space-y-3">
        <h4 className="font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          How Credits Work
        </h4>
        
        <div className="grid gap-2">
          {sampleActions.map((item) => (
            <div
              key={item.action}
              className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
            >
              <span className="text-sm">{item.action}</span>
              {item.credits === 0 ? (
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  Free
                </Badge>
              ) : (
                <span className="text-sm font-mono text-muted-foreground">
                  -{item.credits}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* What's Included */}
      <div className="space-y-3 mt-6">
        <h4 className="font-semibold flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-primary" />
          What's Included Free
        </h4>
        
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary/70 flex-shrink-0" />
            <span>All core features unlocked</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary/70 flex-shrink-0" />
            <span>Up to {FREE_TIER_LIMITS.max_products} products</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary/70 flex-shrink-0" />
            <span>Up to {FREE_TIER_LIMITS.max_customers} customers</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary/70 flex-shrink-0" />
            <span>Unlimited viewing and browsing</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary/70 flex-shrink-0" />
            <span>Email support</span>
          </li>
        </ul>
      </div>

      {/* Upgrade CTA */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-3 border">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <span className="font-medium">Need More?</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Upgrade to a paid plan for <strong>unlimited usage</strong> - no credits to worry about.
          Plans start at just $79/month.
        </p>
        {onUpgrade && (
          <Button variant="outline" size="sm" onClick={onUpgrade}>
            View Plans
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>

      {/* Continue Button */}
      {onContinue && (
        <Button className="w-full" size="lg" onClick={onContinue}>
          Start with {FREE_TIER_MONTHLY_CREDITS} Free Credits
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      )}

      {/* Fine Print */}
      <p className="text-xs text-center text-muted-foreground">
        Credits refresh monthly. No credit card required. Cancel anytime.
      </p>
    </div>
  );
}

export default CreditSystemExplainer;







