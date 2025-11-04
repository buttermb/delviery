import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard,
  CheckCircle2,
  ExternalLink,
  TrendingUp,
  AlertCircle,
  Star,
  Diamond,
  Zap,
  Loader2,
} from "lucide-react";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatSmartDate } from "@/lib/utils/formatDate";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { TIER_NAMES, TIER_PRICES, getFeaturesForTier, getFeaturesByCategory, type SubscriptionTier } from "@/lib/featureConfig";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

export default function TenantAdminBillingPage() {
  const { tenant, admin } = useTenantAdminAuth();
  const { currentTier, currentTierName } = useFeatureAccess();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  // Fetch invoices
  const { data: invoices } = useQuery({
    queryKey: ["tenant-invoices", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("issue_date", { ascending: false })
        .limit(10);

      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch subscription plans
  const { data: subscriptionPlans = [] } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('monthly_price');
      
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch subscription plan details
  const { data: plan } = useQuery({
    queryKey: ["subscription-plan", tenant?.subscription_plan],
    queryFn: async () => {
      if (!tenant?.subscription_plan) return null;

      const { data } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("name", tenant.subscription_plan)
        .maybeSingle();

      return data;
    },
    enabled: !!tenant?.subscription_plan,
  });

  const limits = (tenant as any)?.limits || {};
  const usage = (tenant as any)?.usage || {};

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
    },
    onError: (error: any) => {
      console.error('Subscription update error:', error);
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update subscription',
        variant: 'destructive',
      });
    }
  });

  const handlePlanChange = async (targetPlan: SubscriptionTier, useStripe = false) => {
    if (!tenantId) return;

    const tierHierarchy: SubscriptionTier[] = ['starter', 'professional', 'enterprise'];
    const currentIndex = tierHierarchy.indexOf(currentTier);
    const targetIndex = tierHierarchy.indexOf(targetPlan);

    if (currentIndex === targetIndex) {
      toast({
        title: 'Already on this plan',
        description: `You're already on the ${TIER_NAMES[targetPlan]} plan.`,
      });
      return;
    }

    const isUpgrade = targetIndex > currentIndex;
    const action = isUpgrade ? 'upgrade' : 'downgrade';

    // Show confirmation dialog
    setSelectedPlan(targetPlan);
    setUpgradeDialogOpen(true);
  };

  const confirmPlanChange = async () => {
    if (!selectedPlan || !subscriptionPlans) return;
    
    // Find the plan ID from the subscription plans
    const targetPlan = subscriptionPlans.find(p => p.name === selectedPlan);
    if (!targetPlan) {
      toast({
        title: 'Error',
        description: 'Selected plan not found',
        variant: 'destructive',
      });
      return;
    }
    
    setUpgradeLoading(true);
    updateSubscriptionMutation.mutate(targetPlan.id);
  };

  const handlePaymentMethod = async () => {
    if (!tenantId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Not Authenticated',
          description: 'Please log in to manage payment methods.',
          variant: 'destructive',
        });
        return;
      }

      setUpgradeLoading(true);

      const { data, error } = await supabase.functions.invoke('stripe-customer-portal', {
        body: { tenant_id: tenantId }
      });

      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
        toast({
          title: 'Success',
          description: 'Opening Stripe Customer Portal...',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to open payment method management. Please ensure Stripe is configured.',
        variant: 'destructive',
      });
      setUpgradeLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">💳 Billing & Subscription</h1>
          <p className="text-muted-foreground">Manage your subscription and view billing history</p>
        </div>

        <Tabs defaultValue="current" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="current">Current Plan</TabsTrigger>
            <TabsTrigger value="plans">Compare Plans</TabsTrigger>
            <TabsTrigger value="billing">Billing History</TabsTrigger>
          </TabsList>

          {/* CURRENT PLAN TAB */}
          <TabsContent value="current" className="space-y-6">
            {/* Current Plan */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Current Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold">
                      {plan?.display_name || (tenant?.subscription_plan as string)?.toUpperCase() || "No Plan"}
                    </span>
                    <Badge variant="outline">
                      {formatCurrency((tenant as any)?.mrr || 0)}/month
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {plan?.description || "Your current subscription plan"}
                  </p>
                  
                  {/* Platform Fee Notice */}
                  <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 mb-4">
                    <p className="text-sm text-purple-900 dark:text-purple-100">
                      💎 <strong>Platform Fee:</strong> {formatCurrency(((tenant as any)?.mrr || 0) * 0.02)}/month (2% of subscription)
                    </p>
                    <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                      This fee covers platform hosting, maintenance, and support
                    </p>
                  </div>

                  {plan?.features && Array.isArray(plan.features) && (
                    <div className="space-y-2 mb-4">
                      {plan.features.map((feature: string, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span>{feature.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => document.querySelector('[data-value="plans"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))}>
                      ⬆️ View Plans
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Usage This Month */}
            <Card>
              <CardHeader>
                <CardTitle>📊 Usage This Month</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.keys(limits).length > 0 ? (
                  Object.keys(limits).map((resource) => {
                    const limit = limits[resource];
                    const current = usage[resource] || 0;
                    const isUnlimited = limit === -1;
                    const percentage = getUsagePercentage(resource);
                    const isOverLimit = !isUnlimited && current > limit;

                    return (
                      <div key={resource} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="capitalize">{resource.replace(/_/g, " ")}</span>
                          <span className={isOverLimit ? "text-red-600 font-semibold" : "text-muted-foreground"}>
                            {current.toLocaleString()} / {isUnlimited ? "Unlimited" : limit.toLocaleString()}
                            {!isUnlimited && ` (${percentage.toFixed(0)}%)`}
                          </span>
                        </div>
                        {!isUnlimited && (
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                isOverLimit 
                                  ? "bg-red-500" 
                                  : percentage > 80 
                                    ? "bg-yellow-500" 
                                    : "bg-primary"
                              }`}
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                        )}
                        {isOverLimit && (
                          <p className="text-xs text-red-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Over limit! Overage charges may apply.
                          </p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-muted-foreground text-center py-4">No usage limits configured</p>
                )}

                {usage?.customers && limits?.customers && usage.customers > limits.customers && (
                  <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-500 border-2">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">Overage Charges</p>
                      </div>
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        <strong>{formatCurrency(
                          ((usage.customers - limits.customers) * 0.50)
                        )}</strong> for exceeding customer limit
                      </p>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(tenant as any)?.payment_method_added ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <CreditCard className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Payment method on file</p>
                        <p className="text-sm text-muted-foreground">Visa ending in 4242</p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={handlePaymentMethod} disabled={upgradeLoading}>
                      {upgradeLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Update Payment Method
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                      <CreditCard className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground mb-4">No payment method added</p>
                    <Button onClick={handlePaymentMethod} disabled={upgradeLoading}>
                      {upgradeLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Add Payment Method
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* COMPARE PLANS TAB */}
          <TabsContent value="plans" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Starter Plan */}
              <Card className={currentTier === 'starter' ? 'border-2 border-primary' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Zap className="h-8 w-8 text-green-600" />
                    {currentTier === 'starter' && <Badge>Current</Badge>}
                  </div>
                  <CardTitle className="text-2xl">Starter</CardTitle>
                  <div className="text-3xl font-bold">${TIER_PRICES.starter}<span className="text-sm text-muted-foreground">/mo</span></div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Perfect for small businesses getting started</p>
                  <div className="space-y-2">
                    <p className="font-semibold text-sm">Includes:</p>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>50 customers</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>3 menus</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>100 products</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>12 core features</span>
                      </li>
                    </ul>
                  </div>
                  <Button 
                    variant={currentTier === 'starter' ? 'outline' : 'default'} 
                    className="w-full" 
                    disabled={currentTier === 'starter' || upgradeLoading}
                    onClick={() => currentTier !== 'starter' && handlePlanChange('starter')}
                  >
                    {currentTier === 'starter' ? 'Current Plan' : upgradeLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {currentTier === 'starter' ? 'Current Plan' : 'Downgrade'}
                  </Button>
                </CardContent>
              </Card>

              {/* Professional Plan */}
              <Card className={currentTier === 'professional' ? 'border-2 border-primary' : 'border-2 border-blue-500/50'}>
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Star className="h-8 w-8 text-blue-600" />
                    {currentTier === 'professional' && <Badge>Current</Badge>}
                  </div>
                  <CardTitle className="text-2xl">Professional</CardTitle>
                  <div className="text-3xl font-bold">${TIER_PRICES.professional}<span className="text-sm text-muted-foreground">/mo</span></div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">For growing businesses with advanced needs</p>
                  <div className="space-y-2">
                    <p className="font-semibold text-sm">Everything in Starter, plus:</p>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        <span>200 customers</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        <span>10 menus</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        <span>500 products</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        <span>31 total features</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        <span>Advanced analytics</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        <span>Team management</span>
                      </li>
                    </ul>
                  </div>
                  <Button 
                    variant={currentTier === 'professional' ? 'outline' : 'default'} 
                    className="w-full" 
                    disabled={currentTier === 'professional' || upgradeLoading}
                    onClick={() => currentTier !== 'professional' && handlePlanChange('professional')}
                  >
                    {upgradeLoading && selectedPlan === 'professional' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {currentTier === 'professional' ? 'Current Plan' : currentTier === 'starter' ? 'Upgrade' : 'Downgrade'}
                  </Button>
                </CardContent>
              </Card>

              {/* Enterprise Plan */}
              <Card className={currentTier === 'enterprise' ? 'border-2 border-primary' : 'border-2 border-purple-500/50'}>
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Diamond className="h-8 w-8 text-purple-600" />
                    {currentTier === 'enterprise' && <Badge>Current</Badge>}
                  </div>
                  <CardTitle className="text-2xl">Enterprise</CardTitle>
                  <div className="text-3xl font-bold">${TIER_PRICES.enterprise}+<span className="text-sm text-muted-foreground">/mo</span></div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Complete solution for large operations</p>
                  <div className="space-y-2">
                    <p className="font-semibold text-sm">Everything in Professional, plus:</p>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-purple-600" />
                        <span>Unlimited everything</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-purple-600" />
                        <span>All 56 features</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-purple-600" />
                        <span>Fleet management</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-purple-600" />
                        <span>POS system</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-purple-600" />
                        <span>API access</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-purple-600" />
                        <span>24/7 priority support</span>
                      </li>
                    </ul>
                  </div>
                  <Button 
                    variant={currentTier === 'enterprise' ? 'outline' : 'default'} 
                    className="w-full" 
                    disabled={currentTier === 'enterprise' || upgradeLoading}
                    onClick={() => currentTier !== 'enterprise' && handlePlanChange('enterprise')}
                  >
                    {upgradeLoading && selectedPlan === 'enterprise' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {currentTier === 'enterprise' ? 'Current Plan' : 'Upgrade'}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Feature Comparison Table */}
            <Card>
              <CardHeader>
                <CardTitle>Full Feature Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {Object.entries(getFeaturesByCategory()).map(([category, features]) => (
                    <div key={category}>
                      <h3 className="font-semibold text-lg mb-3">{category}</h3>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="font-medium text-sm text-muted-foreground">Feature</div>
                        <div className="font-medium text-sm text-muted-foreground text-center">Starter</div>
                        <div className="font-medium text-sm text-muted-foreground text-center">Professional</div>
                        <div className="font-medium text-sm text-muted-foreground text-center">Enterprise</div>
                        
                        {features.map((feature, idx) => (
                          <React.Fragment key={`${feature.name}-${idx}`}>
                            <div className="text-sm py-2">{feature.name}</div>
                            <div className="text-center py-2">
                              {feature.tier === 'starter' || feature.tier === 'professional' || feature.tier === 'enterprise' ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                            <div className="text-center py-2">
                              {feature.tier === 'professional' || feature.tier === 'enterprise' ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                              ) : feature.tier === 'starter' ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                            <div className="text-center py-2">
                              <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BILLING HISTORY TAB */}
          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>📄 Billing History</CardTitle>
              </CardHeader>
              <CardContent>
                {invoices && invoices.length > 0 ? (
                  <div className="space-y-2">
                    {invoices.map((invoice: any) => (
                      <div
                        key={invoice.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors"
                      >
                        <div>
                          <p className="font-medium">{invoice.invoice_number || `Invoice #${invoice.id.slice(0, 8)}`}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatSmartDate(invoice.issue_date)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(invoice.total || 0)}</p>
                          <Badge 
                            variant={invoice.status === "paid" ? "default" : "outline"}
                          >
                            {invoice.status?.toUpperCase() || "PENDING"}
                          </Badge>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                      <CreditCard className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">No invoices yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Footer Note */}
            <Card>
              <CardContent className="text-center text-sm text-muted-foreground p-4">
                <p className="mb-1">Billing is managed by the platform administrator.</p>
                <p>For changes to your subscription, please contact support.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Upgrade/Downgrade Confirmation Dialog */}
        <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedPlan && currentTier && 
                  (['starter', 'professional', 'enterprise'].indexOf(selectedPlan) > ['starter', 'professional', 'enterprise'].indexOf(currentTier) 
                    ? 'Confirm Upgrade' 
                    : 'Confirm Downgrade')
                }
              </DialogTitle>
              <DialogDescription>
                {selectedPlan && currentTier && (
                  <>
                    You are about to {['starter', 'professional', 'enterprise'].indexOf(selectedPlan) > ['starter', 'professional', 'enterprise'].indexOf(currentTier) ? 'upgrade' : 'downgrade'} from{' '}
                    <strong>{TIER_NAMES[currentTier]}</strong> to <strong>{TIER_NAMES[selectedPlan]}</strong> plan.
                    <br /><br />
                    {['starter', 'professional', 'enterprise'].indexOf(selectedPlan) > ['starter', 'professional', 'enterprise'].indexOf(currentTier) ? (
                      <>
                        New monthly price: <strong>{formatCurrency(TIER_PRICES[selectedPlan])}</strong>
                        <br />
                        <span className="text-xs text-muted-foreground">
                          Your subscription will be updated immediately.
                        </span>
                      </>
                    ) : (
                      <>
                        Your plan will be changed to <strong>{TIER_NAMES[selectedPlan]}</strong>.
                        <br />
                        <span className="text-xs text-muted-foreground">
                          Changes will be effective immediately.
                        </span>
                        Some features may become unavailable after downgrade.
                      </>
                    )}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setUpgradeDialogOpen(false);
                setSelectedPlan(null);
                setUpgradeLoading(false);
              }} disabled={upgradeLoading}>
                Cancel
              </Button>
              <Button onClick={confirmPlanChange} disabled={upgradeLoading || !selectedPlan}>
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
      </div>
    </div>
  );
}
