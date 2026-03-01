import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Package,
  Users,
  FileSpreadsheet,
  CreditCard,
  ArrowRight,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { STORAGE_KEYS } from "@/constants/storageKeys";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  checkComplete: () => Promise<boolean>;
}

interface OnboardingChecklistProps {
  tenantSlug: string;
  className?: string;
  collapsible?: boolean;
  showDismiss?: boolean;
}

export function OnboardingChecklist({ 
  tenantSlug, 
  className,
  collapsible = true,
  showDismiss = true
}: OnboardingChecklistProps) {
  const navigate = useNavigate();
  const { tenant } = useTenantAdminAuth();
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if checklist was dismissed
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEYS.ONBOARDING_DISMISSED);
      if (dismissed === 'true') {
        setIsDismissed(true);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const steps: OnboardingStep[] = useMemo(() => [
    {
      id: 'add-product',
      title: 'Add Your First Product',
      description: 'Import or manually add inventory items',
      icon: Package,
      path: `/${tenantSlug}/admin/inventory/products`,
      checkComplete: async () => {
        if (!tenant?.id) return false;
        const { count } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id);
        return (count ?? 0) > 0;
      }
    },
    {
      id: 'add-customer',
      title: 'Add a Customer',
      description: 'Start building your customer base',
      icon: Users,
      path: `/${tenantSlug}/admin/customers`,
      checkComplete: async () => {
        if (!tenant?.id) return false;
        const { count } = await supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id);
        return (count ?? 0) > 0;
      }
    },
    {
      id: 'create-menu',
      title: 'Create a Disposable Menu',
      description: 'Share secure menus with clients',
      icon: FileSpreadsheet,
      path: `/${tenantSlug}/admin/disposable-menus`,
      checkComplete: async () => {
        if (!tenant?.id) return false;
        const { count } = await supabase
          .from('disposable_menus')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id);
        return (count ?? 0) > 0;
      }
    },
    {
      id: 'add-payment',
      title: 'Add Payment Method',
      description: 'Secure your subscription',
      icon: CreditCard,
      path: `/${tenantSlug}/admin/billing`,
      checkComplete: async () => {
        return tenant?.payment_method_added === true;
      }
    }
  ], [tenant?.id, tenant?.payment_method_added, tenantSlug]);

  // Check completion status
  useEffect(() => {
    const checkCompletion = async () => {
      if (!tenant?.id) return;
      
      setIsLoading(true);
      const completed = new Set<string>();
      
      for (const step of steps) {
        try {
          const isComplete = await step.checkComplete();
          if (isComplete) {
            completed.add(step.id);
          }
        } catch (error) {
          logger.error(`Failed to check step ${step.id}`, error);
        }
      }
      
      setCompletedSteps(completed);
      setIsLoading(false);
    };

    checkCompletion();
  }, [tenant?.id, steps]);

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEYS.ONBOARDING_DISMISSED, 'true');
    } catch {
      // Ignore localStorage errors
    }
    setIsDismissed(true);
  };

  const completionPercentage = Math.round((completedSteps.size / steps.length) * 100);
  const allComplete = completedSteps.size === steps.length;

  // Don't show if dismissed or all complete
  if (isDismissed || (allComplete && !isLoading)) {
    return null;
  }

  // Calculate trial days remaining
  const trialEndsAt = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
  const daysRemaining = trialEndsAt 
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const isTrial = tenant?.subscription_status === 'trial';

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      {/* Gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500" />
      
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">Get Started</CardTitle>
            {isTrial && daysRemaining !== null && (
              <Badge variant="secondary" className="ml-2">
                <Clock className="h-3 w-3 mr-1" />
                {daysRemaining} days left
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {showDismiss && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleDismiss}
                aria-label="Dismiss checklist"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            {collapsible && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-label={isExpanded ? "Collapse checklist" : "Expand checklist"}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Progress value={completionPercentage} className="flex-1 h-2" />
          <span className="text-sm font-medium text-muted-foreground">
            {completedSteps.size}/{steps.length}
          </span>
        </div>
        
        <CardDescription>
          Complete these steps to get the most out of FloraIQ
        </CardDescription>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-2">
          {steps.map((step) => {
            const isComplete = completedSteps.has(step.id);
            const Icon = step.icon;
            
            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer",
                  isComplete 
                    ? "bg-green-50 dark:bg-green-950/20 opacity-75" 
                    : "bg-muted/50 hover:bg-muted"
                )}
                onClick={() => !isComplete && navigate(step.path)}
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                  isComplete 
                    ? "bg-green-100 dark:bg-green-900" 
                    : "bg-primary/10"
                )}>
                  {isComplete ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <Icon className="h-5 w-5 text-primary" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "font-medium text-sm",
                    isComplete && "line-through text-muted-foreground"
                  )}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {step.description}
                  </p>
                </div>
                
                {!isComplete && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            );
          })}

          {/* All complete celebration */}
          {allComplete && (
            <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="font-semibold text-green-700 dark:text-green-300">
                All done! You're ready to go.
              </p>
              <Button
                variant="link"
                className="text-green-600 dark:text-green-400"
                onClick={handleDismiss}
              >
                Dismiss this checklist
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
