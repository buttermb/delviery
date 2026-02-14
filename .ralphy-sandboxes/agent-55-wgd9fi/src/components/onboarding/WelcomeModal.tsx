import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Sparkles, ArrowRight, X, PlayCircle, Coins, Info } from 'lucide-react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTutorialContext } from '@/components/tutorial/TutorialProvider';
import { useCredits } from '@/hooks/useCredits';
import { FREE_TIER_MONTHLY_CREDITS } from '@/lib/credits';
import { CreditSystemExplainer } from '@/components/signup/CreditSystemExplainer';
import { cn } from '@/lib/utils';

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

export const WelcomeModal = ({ open, onClose }: WelcomeModalProps) => {
  const navigate = useNavigate();
  const _location = useLocation();
  const [searchParams] = useSearchParams();
  const { tenant, admin: _admin } = useTenantAdminAuth();
  const { startTutorial } = useTutorialContext();
  const { balance, isFreeTier } = useCredits();
  const [hasSeenWelcome, setHasSeenWelcome] = useState(false);
  const [showCreditsInfo, setShowCreditsInfo] = useState(false);

  // Check if coming from signup (URL param)
  const isFromSignup = searchParams.get('welcome') === 'true';

  // Check if user has already seen welcome modal
  useEffect(() => {
    if (tenant?.id) {
      const welcomeKey = `welcome_seen_${tenant.id}`;
      const seen = sessionStorage.getItem(welcomeKey);
      if (seen === 'true' && !isFromSignup) {
        setHasSeenWelcome(true);
        onClose();
      }
    }
  }, [tenant?.id, onClose, isFromSignup]);

  const handleGetStarted = () => {
    if (tenant?.id) {
      const welcomeKey = `welcome_seen_${tenant.id}`;
      sessionStorage.setItem(welcomeKey, 'true');
    }
    onClose();
    
    // Navigate to welcome/setup page
    if (tenant?.slug) {
      navigate(`/${tenant.slug}/admin/welcome`);
    }
  };

  const handleTakeTour = () => {
    if (tenant?.id) {
      const welcomeKey = `welcome_seen_${tenant.id}`;
      sessionStorage.setItem(welcomeKey, 'true');
    }
    onClose();
    
    // Start dashboard tutorial
    startTutorial('dashboard-tour', true);
  };

  const handleSkip = () => {
    if (tenant?.id) {
      const welcomeKey = `welcome_seen_${tenant.id}`;
      sessionStorage.setItem(welcomeKey, 'true');
    }
    onClose();
  };

  if (hasSeenWelcome) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                isFreeTier ? "bg-emerald-500/10" : "bg-primary/10"
              )}>
                {isFreeTier ? (
                  <Coins className="h-6 w-6 text-emerald-500" />
                ) : (
                  <Sparkles className="h-6 w-6 text-primary" />
                )}
              </div>
              <div>
                <DialogTitle className="text-2xl">
                  Welcome to {tenant?.business_name || 'Your Dashboard'}!
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {isFreeTier 
                    ? "You're all set with free credits to get started"
                    : "Your account has been created successfully"
                  }
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSkip}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Credit Balance Banner (for free tier users) */}
          {isFreeTier && (
            <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-emerald-500" />
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Your Credit Balance
                  </span>
                </div>
                <Badge className="bg-emerald-500 text-white">
                  {balance.toLocaleString()} credits
                </Badge>
              </div>
              <Progress 
                value={100} 
                className="h-2 [&>div]:bg-emerald-500"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {FREE_TIER_MONTHLY_CREDITS.toLocaleString()} credits/month • Auto-refreshes monthly
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Account Created</p>
                <p className="text-sm text-muted-foreground">
                  Your account is ready to use
                </p>
              </div>
            </div>

            {isFreeTier ? (
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">{FREE_TIER_MONTHLY_CREDITS.toLocaleString()} Credits Granted</p>
                  <p className="text-sm text-muted-foreground">
                    Explore all features • Upgrade anytime for unlimited
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">14-Day Trial Started</p>
                  <p className="text-sm text-muted-foreground">
                    Explore all features with full access
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Email Verification</p>
                <p className="text-sm text-muted-foreground">
                  Please verify your email within 7 days
                </p>
              </div>
            </div>
          </div>

          {/* Credit System Explainer (for free tier) */}
          {isFreeTier && (
            <div className="border rounded-lg overflow-hidden">
              <button
                onClick={() => setShowCreditsInfo(!showCreditsInfo)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  How credits work
                </span>
                <span className="text-muted-foreground">
                  {showCreditsInfo ? '−' : '+'}
                </span>
              </button>
              {showCreditsInfo && (
                <div className="border-t bg-muted/20">
                  <CreditSystemExplainer variant="compact" />
                </div>
              )}
            </div>
          )}

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-4">
              Let's get you set up in just a few minutes. We'll guide you through adding your first products, customers, and menus.
            </p>

            <div className="flex flex-col gap-2">
              <div className="flex gap-3">
                <Button
                  onClick={handleGetStarted}
                  className={cn(
                    "flex-1",
                    isFreeTier && "bg-emerald-600 hover:bg-emerald-700"
                  )}
                >
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTakeTour}
                  className="flex-1"
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Take Tour
                </Button>
              </div>
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="w-full"
              >
                Skip for Now
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

