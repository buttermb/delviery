import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Sparkles,
  Package,
  Users,
  FileSpreadsheet,
  ArrowRight,
  PartyPopper,
  Clock,
  Crown,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { CHART_COLORS } from "@/lib/chartColors";

interface TrialWelcomeModalProps {
  tenantSlug?: string;
  businessName?: string;
  onClose?: () => void;
}

export function TrialWelcomeModal({ tenantSlug, businessName, onClose }: TrialWelcomeModalProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { tenant } = useTenantAdminAuth();

  const isWelcome = searchParams.get("welcome") === "true";
  const isTrial = searchParams.get("trial") === "true";
  const isSuccess = searchParams.get("success") === "true";

  // Calculate trial days remaining
  const trialEndsAt = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
  const daysRemaining = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 14;
  const trialProgress = Math.min(100, ((14 - daysRemaining) / 14) * 100);

  // Get subscription tier display
  const subscriptionTier = tenant?.subscription_plan || 'starter';
  const tierDisplayNames: Record<string, string> = {
    starter: 'Starter',
    professional: 'Professional',
    enterprise: 'Enterprise'
  };

  // Show modal if welcome=true or success=true in URL
  useEffect(() => {
    if (isWelcome || (isSuccess && isTrial)) {
      setOpen(true);

      // Trigger confetti on open
      const timer = setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: [
            CHART_COLORS[5], // emerald-ish
            CHART_COLORS[0], // blue-ish
            CHART_COLORS[4], // purple-ish
            CHART_COLORS[7], // amber-ish
          ],
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isWelcome, isSuccess, isTrial]);

  const handleClose = () => {
    setOpen(false);
    // Remove URL params
    searchParams.delete("welcome");
    searchParams.delete("trial");
    searchParams.delete("success");
    setSearchParams(searchParams, { replace: true });
    onClose?.();
  };

  const quickStartItems = [
    {
      icon: Package,
      title: "Add Your First Product",
      description: "Import or manually add your inventory",
      action: () => {
        handleClose();
        navigate(`/${tenantSlug}/admin/inventory/products`);
      },
    },
    {
      icon: Users,
      title: "Add a Customer",
      description: "Start building your customer base",
      action: () => {
        handleClose();
        navigate(`/${tenantSlug}/admin/customers/add`);
      },
    },
    {
      icon: FileSpreadsheet,
      title: "Create a Disposable Menu",
      description: "Share a secure, one-time menu with clients",
      action: () => {
        handleClose();
        navigate(`/${tenantSlug}/admin/menus/create`);
      },
    },
  ];

  if (!isWelcome && !(isSuccess && isTrial)) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-center pb-4">
          <div className="mx-auto mb-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mx-auto">
                <PartyPopper className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -right-1 -top-1">
                <Sparkles className="w-6 h-6 text-yellow-500 animate-pulse" />
              </div>
            </div>
          </div>

          <DialogTitle className="text-2xl font-bold">
            Welcome to FloraIQ!
          </DialogTitle>

          <DialogDescription className="text-base mt-2">
            {businessName && (
              <span className="block font-medium text-foreground mb-1">
                {businessName}
              </span>
            )}
            Your account is ready. Let's get you set up!
          </DialogDescription>
        </DialogHeader>

        {/* Subscription Info */}
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              <span className="font-semibold">{tierDisplayNames[subscriptionTier]} Plan</span>
            </div>
            {isTrial && (
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Trial Active
              </Badge>
            )}
          </div>

          {isTrial && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>{daysRemaining} days remaining</span>
                </div>
                <span className="text-green-600 dark:text-green-400 font-medium">
                  No charges until trial ends
                </span>
              </div>
              <Progress value={trialProgress} className="h-2" />
            </div>
          )}

          {!isTrial && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Subscription active - Full access enabled</span>
            </div>
          )}
        </div>

        {/* Annual Upgrade Promo - Only show for trial users */}
        {isTrial && subscriptionTier !== 'enterprise' && (
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 rounded-lg p-4 mb-4 border border-purple-200 dark:border-purple-800">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-purple-900 dark:text-purple-100">
                  Save 17% with Annual Billing
                </p>
                <p className="text-sm text-purple-700 dark:text-purple-300 mb-2">
                  Switch to yearly billing and get 2 months free!
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-purple-300 text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900"
                  onClick={() => {
                    handleClose();
                    navigate(`/${tenantSlug}/admin/billing`);
                  }}
                >
                  View Billing Options
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Start Items */}
        <div className="space-y-3 mb-6">
          <p className="text-sm font-medium text-muted-foreground">Get started in minutes:</p>
          {quickStartItems.map((item, index) => (
            <Card
              key={index}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md hover:border-primary/50",
                "group"
              )}
              onClick={item.action}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={handleClose}>
            Explore Dashboard
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
            onClick={() => {
              handleClose();
              navigate(`/${tenantSlug}/admin/inventory/products`);
            }}
          >
            Add First Product
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
