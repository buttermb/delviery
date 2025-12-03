import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import {
  SettingsSection,
  SettingsCard,
} from '@/components/settings/SettingsSection';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CreditCard,
  Receipt,
  TrendingUp,
  Download,
  Plus,
  Check,
  Star,
  Crown,
  Calendar,
  ExternalLink,
  Loader2,
  AlertCircle,
  Zap,
  Diamond,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { useToast } from '@/hooks/use-toast';
import { TIER_PRICES, TIER_NAMES, type SubscriptionTier } from '@/lib/featureConfig';
import { businessTierToSubscriptionTier } from '@/lib/tierMapping';
import { AddPaymentMethodDialog } from '@/components/billing/AddPaymentMethodDialog';
import type { Database } from '@/integrations/supabase/types';

type Invoice = Database['public']['Tables']['invoices']['Row'];

export default function BillingSettings() {
  const { tenant, admin } = useTenantAdminAuth();
  const { currentTier, currentTierName } = useFeatureAccess();
  const { isTrial, needsPaymentMethod } = useSubscriptionStatus();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const tenantId = tenant?.id;

  // Check Stripe configuration health
  const { data: stripeHealth, isLoading: stripeLoading } = useQuery({
    queryKey: ['stripe-health'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('check-stripe-config');
      if (error) throw error;
      return data as { configured: boolean; valid: boolean; error?: string; testMode?: boolean };
    },
    retry: 2,
    staleTime: 60000,
  });

  // Fetch invoices
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['tenant-invoices', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('invoice-management', {
          body: { action: 'list', tenant_id: tenantId },
        });

        if (!edgeError && edgeData?.invoices) {
          return edgeData.invoices;
        }
      } catch {
        // Fall back to direct query
      }

      const { data } = await supabase
        .from('invoices')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('issue_date', { ascending: false })
        .limit(10);

      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch subscription plans from database
  const { data: subscriptionPlans = [] } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly');

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Usage data from tenant
  const limits = (tenant?.limits as Record<string, number>) || {};
  const usage = (tenant?.usage as Record<string, number>) || {};

  const getUsagePercentage = (resource: string) => {
    const limit = limits[resource] === -1 ? Infinity : (limits[resource] || 0);
    const current = usage[resource] || 0;
    if (limit === Infinity) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  // Subscription update mutation
  const updateSubscriptionMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { data, error } = await supabase.functions.invoke('update-subscription', {
        body: {
          tenant_id: tenant?.id,
          plan_id: planId
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.open(data.url, '_blank');
        toast({
          title: 'Redirecting to Stripe',
          description: 'Opening checkout in new tab...',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      setUpgradeDialogOpen(false);
      setUpgradeLoading(false);
    },
    onError: (error: Error) => {
      logger.error('Error updating subscription', { error: error.message });
      toast({
        title: 'Upgrade Failed',
        description: error.message,
        variant: 'destructive',
      });
      setUpgradeLoading(false);
    }
  });

  const handlePlanChange = async (targetPlan: SubscriptionTier) => {
    if (!tenantId) return;

    const currentSubscriptionTier = businessTierToSubscriptionTier(currentTier);
    if (currentSubscriptionTier === targetPlan) {
      toast({
        title: 'Already on this plan',
        description: `You're already on the ${TIER_NAMES[targetPlan]} plan.`,
      });
      return;
    }

    if (!stripeHealth?.valid) {
      toast({
        title: 'Stripe Not Configured',
        description: stripeHealth?.error || 'Payment processing is not available.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedPlan(targetPlan);
    setUpgradeDialogOpen(true);
  };

  const confirmPlanChange = async () => {
    if (!selectedPlan || !subscriptionPlans) return;

    const targetPlan = subscriptionPlans.find(p =>
      p.name.toLowerCase() === selectedPlan.toLowerCase()
    );

    if (!targetPlan) {
      toast({
        title: 'Error',
        description: 'Selected plan not found.',
        variant: 'destructive',
      });
      return;
    }

    setUpgradeLoading(true);
    updateSubscriptionMutation.mutate(targetPlan.id);
  };

  const handleManageSubscription = async () => {
    if (!tenantId) return;

    try {
      setUpgradeLoading(true);
      const { data, error } = await supabase.functions.invoke('stripe-customer-portal', {
        body: { tenant_id: tenantId }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.url) {
        window.open(data.url, '_blank');
        toast({
          title: 'Success',
          description: 'Opening Stripe Customer Portal...',
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to open customer portal';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setUpgradeLoading(false);
    }
  };

  const trialDaysLeft = tenant?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const currentSubscriptionTier = businessTierToSubscriptionTier(currentTier);

  const PLANS = [
    {
      id: 'starter' as SubscriptionTier,
      name: 'Basic',
      price: TIER_PRICES.starter,
      icon: Zap,
      color: 'text-green-600',
      features: ['50 customers', '3 menus', '100 products', '12 core features'],
    },
    {
      id: 'professional' as SubscriptionTier,
      name: 'Professional',
      price: TIER_PRICES.professional,
      icon: Star,
      color: 'text-blue-600',
      popular: true,
      features: ['200 customers', '10 menus', '500 products', 'Advanced analytics', 'Team management'],
    },
    {
      id: 'enterprise' as SubscriptionTier,
      name: 'Enterprise',
      price: TIER_PRICES.enterprise,
      icon: Diamond,
      color: 'text-purple-600',
      features: ['Unlimited everything', 'All 56 features', 'Fleet management', 'POS system', 'API access', '24/7 support'],
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Billing</h2>
        <p className="text-muted-foreground mt-1">
          Manage your subscription, payment methods, and invoices
        </p>
      </div>

      {/* Stripe Status Alerts */}
      {stripeHealth && !stripeHealth.valid && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Payment processing unavailable:</strong> {stripeHealth.error || 'Stripe is not configured.'}
          </AlertDescription>
        </Alert>
      )}

      {stripeHealth?.testMode && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Test Mode:</strong> Use card 4242 4242 4242 4242 for testing.
          </AlertDescription>
        </Alert>
      )}

      {/* Trial Banner */}
      {isTrial && trialDaysLeft > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-200">
                  {trialDaysLeft} days left in trial
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {needsPaymentMethod ? 'Add a payment method to continue after trial' : 'Upgrade now to keep all features'}
                </p>
              </div>
            </div>
            <Button 
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => needsPaymentMethod ? setPaymentDialogOpen(true) : handlePlanChange('professional')}
            >
              {needsPaymentMethod ? 'Add Payment Method' : 'Upgrade Now'}
            </Button>
          </div>
        </div>
      )}

      {/* Current Plan & Usage */}
      <SettingsSection
        title="Current Plan"
        description="Your active subscription and usage"
        icon={Crown}
      >
        <SettingsCard>
          <div className="flex items-start justify-between pb-6 border-b flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold">{currentTierName}</h3>
                <Badge variant="secondary">{isTrial ? 'Trial' : 'Active'}</Badge>
              </div>
              <p className="text-2xl font-bold mt-2">
                {formatCurrency(TIER_PRICES[currentSubscriptionTier])}
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </p>
              {tenant?.mrr && (
                <p className="text-sm text-muted-foreground mt-1">
                  Current MRR: {formatCurrency(tenant.mrr as number)}
                </p>
              )}
            </div>
            <Button 
              variant="outline" 
              onClick={handleManageSubscription}
              disabled={upgradeLoading || !stripeHealth?.valid}
            >
              {upgradeLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Manage Subscription
            </Button>
          </div>

          {/* Usage Meters */}
          {Object.keys(limits).length > 0 && (
            <div className="pt-6 space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Usage This Month</h4>
              
              <div className="space-y-4">
                {Object.keys(limits).map((resource) => {
                  const limit = limits[resource];
                  const current = usage[resource] || 0;
                  const isUnlimited = limit === -1;
                  const percentage = getUsagePercentage(resource);
                  const isOverLimit = !isUnlimited && current > limit;

                  return (
                    <div key={resource} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize">{resource.replace(/_/g, ' ')}</span>
                        <span className={cn(
                          "text-muted-foreground",
                          isOverLimit && "text-red-600 font-medium"
                        )}>
                          {current.toLocaleString()} / {isUnlimited ? '∞' : limit.toLocaleString()}
                        </span>
                      </div>
                      {!isUnlimited && (
                        <Progress 
                          value={percentage} 
                          className={cn("h-2", isOverLimit && "[&>div]:bg-red-500")}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SettingsCard>
      </SettingsSection>

      {/* Available Plans */}
      <SettingsSection
        title="Available Plans"
        description="Compare and upgrade your plan"
        icon={TrendingUp}
      >
        <div className="grid md:grid-cols-3 gap-4">
          {PLANS.map((plan) => {
            const isCurrent = currentSubscriptionTier === plan.id;
            const Icon = plan.icon;
            
            return (
              <div
                key={plan.id}
                className={cn(
                  'relative rounded-xl border p-6 transition-all',
                  plan.popular && 'border-primary shadow-lg shadow-primary/10',
                  isCurrent && 'bg-primary/5 border-primary'
                )}
              >
                {plan.popular && !isCurrent && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Star className="h-3 w-3 mr-1" /> Most Popular
                  </Badge>
                )}
                
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-6 w-6", plan.color)} />
                    <h3 className="font-semibold text-lg">{plan.name}</h3>
                    {isCurrent && <Badge>Current</Badge>}
                  </div>
                  
                  <p className="text-3xl font-bold">
                    {formatCurrency(plan.price)}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                  
                  <ul className="space-y-2">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  <Button
                    className="w-full"
                    variant={isCurrent ? 'secondary' : 'default'}
                    disabled={isCurrent || upgradeLoading || !stripeHealth?.valid}
                    onClick={() => handlePlanChange(plan.id)}
                  >
                    {upgradeLoading && selectedPlan === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {isCurrent ? 'Current Plan' : currentSubscriptionTier === 'enterprise' || 
                      (['starter', 'professional', 'enterprise'].indexOf(plan.id) < 
                       ['starter', 'professional', 'enterprise'].indexOf(currentSubscriptionTier)) 
                      ? 'Downgrade' : 'Upgrade'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </SettingsSection>

      {/* Payment Methods */}
      <SettingsSection
        title="Payment Methods"
        description="Manage your payment options"
        icon={CreditCard}
      >
        <SettingsCard>
          {tenant?.payment_method_added ? (
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-16 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white text-xs font-bold">
                  VISA
                </div>
                <div>
                  <p className="font-medium">•••• •••• •••• 4242</p>
                  <p className="text-sm text-muted-foreground">Payment method on file</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Default</Badge>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleManageSubscription}
                  disabled={upgradeLoading}
                >
                  Update
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <CreditCard className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">No payment method added</p>
              <Button onClick={() => setPaymentDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Payment Method
              </Button>
            </div>
          )}
        </SettingsCard>
      </SettingsSection>

      {/* Invoices */}
      <SettingsSection
        title="Billing History"
        description="Download past invoices"
        icon={Receipt}
      >
        <SettingsCard>
          {invoicesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : invoices.length > 0 ? (
            <div className="space-y-2">
              {invoices.map((invoice: Invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between py-3 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Receipt className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">
                        {invoice.invoice_number || `Invoice #${invoice.id.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatSmartDate(invoice.issue_date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium">{formatCurrency(invoice.total || 0)}</span>
                    <Badge
                      variant={
                        invoice.status === 'paid'
                          ? 'default'
                          : invoice.status === 'pending'
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      {invoice.status?.toUpperCase() || 'PENDING'}
                    </Badge>
                    <Button variant="ghost" size="icon">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Receipt className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No invoices yet</p>
            </div>
          )}
        </SettingsCard>
      </SettingsSection>

      {/* Upgrade Confirmation Dialog */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedPlan && 
                (['starter', 'professional', 'enterprise'].indexOf(selectedPlan) > 
                 ['starter', 'professional', 'enterprise'].indexOf(currentSubscriptionTier)
                  ? 'Confirm Upgrade'
                  : 'Confirm Downgrade')}
            </DialogTitle>
            <DialogDescription>
              {selectedPlan && (
                <>
                  You are changing from <strong>{TIER_NAMES[currentSubscriptionTier]}</strong> to{' '}
                  <strong>{TIER_NAMES[selectedPlan]}</strong>.
                  <br /><br />
                  New monthly price: <strong>{formatCurrency(TIER_PRICES[selectedPlan])}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUpgradeDialogOpen(false);
                setSelectedPlan(null);
              }}
              disabled={upgradeLoading}
            >
              Cancel
            </Button>
            <Button onClick={confirmPlanChange} disabled={upgradeLoading}>
              {upgradeLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Payment Method Dialog */}
      <AddPaymentMethodDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        tenantId={tenantId || ''}
      />
    </div>
  );
}
