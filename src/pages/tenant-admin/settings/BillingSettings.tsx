import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
  ChevronDown,
  ChevronUp,
  XCircle,
  ArrowUp,
  Coins,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import { formatSmartDate } from '@/lib/formatters';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { TIER_PRICES, TIER_NAMES, getFeaturesByCategory, type SubscriptionTier } from '@/lib/featureConfig';
import { businessTierToSubscriptionTier } from '@/lib/tierMapping';
import { AddPaymentMethodDialog } from '@/components/billing/AddPaymentMethodDialog';
import type { Database } from '@/integrations/supabase/types';
import { useCredits } from '@/hooks/useCredits';
import { CreditBalance, CreditUsageStats } from '@/components/credits';
import { FREE_TIER_MONTHLY_CREDITS } from '@/lib/credits';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { queryKeys } from '@/lib/queryKeys';

type Invoice = Database['public']['Tables']['invoices']['Row'];

interface ExtendedInvoice extends Invoice {
  tax_rate?: number;
  notes?: string;
  items?: Array<{ description?: string; name?: string; quantity?: number; amount?: number; unit_price?: number; total?: number }>; // Fallback for differing structures
}

type ExtendedTenant = Partial<Database['public']['Tables']['tenants']['Row']> & {
  id?: string;
  name?: string;
  slug?: string;
  created_at?: string;
  payment_method_added?: boolean;
  billing_cycle?: 'monthly' | 'yearly';
  subscription_plan?: string;
  trial_ends_at?: string;
  mrr?: number;
  limits?: Record<string, number>;
  usage?: Record<string, number>;
  contact_email?: string;
  address?: string;
};

// Map database invoice to PDF-compatible format
function mapInvoiceToPdfData(invoice: ExtendedInvoice, tenant: ExtendedTenant | null) {
  return {
    invoiceNumber: invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`,
    issueDate: invoice.issue_date || new Date().toISOString(),
    dueDate: invoice.due_date || new Date().toISOString(),
    customerName: tenant?.name || 'Customer',
    customerAddress: tenant?.address ?? '',
    customerEmail: tenant?.contact_email ?? '',
    companyName: 'FloraIQ',
    companyAddress: '123 Business Ave, Suite 100',
    lineItems: Array.isArray(invoice.line_items)
      ? (invoice.line_items as Array<{ description?: string; name?: string; quantity?: number; amount?: number; unit_price?: number; total?: number }>).map(item => ({
        description: item.description || item.name || 'Subscription',
        quantity: item.quantity || 1,
        unitPrice: item.amount || item.unit_price || invoice.total || 0,
        total: item.total || item.amount || invoice.total || 0,
      }))
      : [{
        description: 'Monthly Subscription',
        quantity: 1,
        unitPrice: invoice.total ?? 0,
        total: invoice.total ?? 0,
      }],
    subtotal: invoice.subtotal || invoice.total || 0,
    tax: invoice.tax ?? 0,
    taxRate: invoice.tax_rate ?? 0,
    total: invoice.total ?? 0,
    notes: invoice.notes ?? '',
  };
}

export default function BillingSettings() {
  const { tenant: rawTenant } = useTenantAdminAuth();
  const tenant = rawTenant as unknown as ExtendedTenant | null;
  const { currentTier, currentTierName } = useFeatureAccess();
  const { isTrial, needsPaymentMethod } = useSubscriptionStatus();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [featureComparisonOpen, setFeatureComparisonOpen] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState<string | null>(null);
  const comparisonRef = useRef<HTMLDivElement>(null);

  const tenantId = tenant?.id;

  // Credit system hook for free tier users
  const {
    balance: creditBalance,
    isFreeTier,
    isLowCredits,
    isCriticalCredits,
    isOutOfCredits,
    nextFreeGrantAt,
    lifetimeSpent,
  } = useCredits();

  // Handle Stripe redirect success
  useEffect(() => {
    const success = searchParams.get('success');
    const paymentMethod = searchParams.get('payment_method');

    if (success === 'true' && paymentMethod === 'true') {
      logger.info('[BillingSettings] Payment method added successfully via Stripe');

      toast.success('Payment Method Added', { description: 'Your payment method has been successfully added.' });

      // Clean up URL params
      setSearchParams({});

      // Refresh tenant data
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all });
    }
  }, [searchParams, setSearchParams, queryClient]);

  // Check Stripe configuration health
  const { data: stripeHealth } = useQuery({
    queryKey: queryKeys.stripeHealth.all,
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
    queryKey: queryKeys.tenantInvoices.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('invoice-management', {
          body: { action: 'list', tenant_id: tenantId },
        });

        if (edgeError) {
          logger.warn('invoice-management edge function failed, falling back to direct query', {
            component: 'BillingSettings',
            error: edgeError,
          });
        }
        if (!edgeError && edgeData?.invoices) {
          return edgeData.invoices;
        }
      } catch {
        // Fall back to direct query
      }

      const { data } = await supabase
        .from('invoices')
        .select('id, invoice_number, issue_date, due_date, total, subtotal, tax, status, line_items')
        .eq('tenant_id', tenantId)
        .order('issue_date', { ascending: false })
        .limit(10);

      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // Fetch subscription plans from database
  const { data: subscriptionPlans = [] } = useQuery({
    queryKey: queryKeys.subscriptionPlans.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, display_name, description, price_monthly, is_active, limits, features')
        .eq('is_active', true)
        .order('price_monthly');

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Usage data from tenant
  const limits = (tenant?.limits as Record<string, number>) || {};
  const usage = (tenant?.usage as Record<string, number>) || {};

  const getUsagePercentage = (resource: string) => {
    const limit = limits[resource] === -1 ? Infinity : (limits[resource] ?? 0);
    const current = usage[resource] ?? 0;
    if (limit === Infinity) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 80) return 'text-red-600';
    if (percentage >= 60) return 'text-amber-600';
    return 'text-emerald-600';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return '[&>div]:bg-red-500';
    if (percentage >= 60) return '[&>div]:bg-amber-500';
    return '[&>div]:bg-emerald-500';
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
        window.open(data.url, '_blank', 'noopener,noreferrer');
        toast.success('Redirecting to Stripe', { description: 'Opening checkout in new tab...' });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all });
      setUpgradeDialogOpen(false);
      setUpgradeLoading(false);
    },
    onError: (error: Error) => {
      logger.error('Error updating subscription', { error: error.message });
      toast.error('Upgrade Failed', { description: humanizeError(error) });
      setUpgradeLoading(false);
    }
  });

  const handlePlanChange = async (targetPlan: SubscriptionTier) => {
    if (!tenantId) return;

    const currentSubscriptionTier = businessTierToSubscriptionTier(currentTier);
    if (currentSubscriptionTier === targetPlan) {
      toast.info('Already on this plan', { description: `You're already on the ${TIER_NAMES[targetPlan]} plan.` });
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
      toast.error('Error', { description: 'Selected plan not found.' });
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
        window.open(data.url, '_blank', 'noopener,noreferrer');
        toast.success('Success', { description: 'Opening Stripe Customer Portal...' });
      }
    } catch (error: unknown) {
      toast.error('Error', { description: humanizeError(error, 'Failed to open customer portal') });
    } finally {
      setUpgradeLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!tenantId) return;

    setCancelDialogOpen(false);

    try {
      setUpgradeLoading(true);
      // Open Stripe portal to the cancellation page
      const { data, error } = await supabase.functions.invoke('stripe-customer-portal', {
        body: { tenant_id: tenantId }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
        toast.success('Manage Subscription', { description: 'Opening Stripe portal to manage your subscription...' });
      }
    } catch (error: unknown) {
      toast.error('Error', { description: humanizeError(error, 'Failed to open customer portal') });
    } finally {
      setUpgradeLoading(false);
    }
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    setDownloadingInvoice(invoice.id);

    try {
      // Generate HTML invoice and download it
      const invoiceData = mapInvoiceToPdfData(invoice, tenant);

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Invoice ${invoiceData.invoiceNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
    .title { font-size: 24px; font-weight: bold; }
    .row { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .section { margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background: #f5f5f5; }
    .totals { text-align: right; margin-top: 20px; }
    .total-row { font-size: 18px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">INVOICE</div>
    <div>${invoiceData.companyName}</div>
  </div>
  <div class="section">
    <div class="row"><strong>Invoice #:</strong> ${invoiceData.invoiceNumber}</div>
    <div class="row"><strong>Date:</strong> ${formatSmartDate(invoiceData.issueDate)}</div>
    <div class="row"><strong>Due:</strong> ${formatSmartDate(invoiceData.dueDate)}</div>
  </div>
  <div class="section">
    <strong>Bill To:</strong><br/>
    ${invoiceData.customerName}<br/>
    ${invoiceData.customerEmail ?? ''}
  </div>
  <table>
    <thead>
      <tr><th scope="col">Description</th><th scope="col">Qty</th><th scope="col">Price</th><th scope="col">Total</th></tr>
    </thead>
    <tbody>
      ${invoiceData.lineItems.map(item => `
        <tr>
          <td>${item.description}</td>
          <td>${item.quantity}</td>
          <td>${formatCurrency(item.unitPrice)}</td>
          <td>${formatCurrency(item.total)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="totals">
    <div>Subtotal: ${formatCurrency(invoiceData.subtotal)}</div>
    ${invoiceData.tax > 0 ? `<div>Tax: ${formatCurrency(invoiceData.tax)}</div>` : ''}
    <div class="total-row">Total: ${formatCurrency(invoiceData.total)}</div>
  </div>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceData.invoiceNumber}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Invoice Downloaded', { description: `Invoice ${invoiceData.invoiceNumber} downloaded successfully` });
    } catch (error) {
      logger.error('Failed to download invoice', { error });
      toast.error('Download Failed', { description: 'Could not download the invoice. Please try again.' });
    } finally {
      setDownloadingInvoice(null);
    }
  };

  const scrollToComparison = () => {
    setFeatureComparisonOpen(true);
    setTimeout(() => {
      comparisonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const trialDaysLeft = tenant?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const currentSubscriptionTier = businessTierToSubscriptionTier(currentTier);

  // Calculate next billing date (30 days from now or subscription start)
  const nextBillingDate = tenant?.created_at
    ? new Date(new Date(tenant.created_at).getTime() + 30 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Get actual plan name from tenant
  const displayPlanName = tenant?.subscription_plan
    ? tenant?.subscription_plan.charAt(0).toUpperCase() + tenant?.subscription_plan.slice(1)
    : currentTierName;

  const PLANS = [
    {
      id: 'starter' as SubscriptionTier,
      name: 'Basic',
      priceMonthly: TIER_PRICES.starter,
      priceYearly: 790,
      icon: Zap,
      color: 'text-green-600',
      borderColor: 'border-green-500/50',
      features: ['50 customers', '3 menus', '100 products', '28 core features'],
    },
    {
      id: 'professional' as SubscriptionTier,
      name: 'Professional',
      priceMonthly: TIER_PRICES.professional,
      priceYearly: 1500,
      icon: Star,
      color: 'text-blue-600',
      borderColor: 'border-blue-500/50',
      popular: true,
      features: ['500 customers', '10 menus', '1000 products', 'Advanced analytics', 'Team management'],
    },
    {
      id: 'enterprise' as SubscriptionTier,
      name: 'Enterprise',
      priceMonthly: TIER_PRICES.enterprise,
      priceYearly: 4990,
      icon: Diamond,
      color: 'text-purple-600',
      borderColor: 'border-purple-500/50',
      features: ['Unlimited everything', 'All 87 features', 'Fleet management', 'POS system', 'API access', '24/7 support'],
    },
  ];

  const featureCategories = getFeaturesByCategory();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Billing</h2>
        <p className="text-muted-foreground mt-1">
          Manage your subscription, payment methods, and invoices
        </p>
      </div>

      {/* Test Mode Alert (only shown when in test mode) */}
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

      {/* Annual Savings Banner - for monthly subscribers */}
      {!isTrial && !isFreeTier && tenant?.billing_cycle !== 'yearly' && (
        <div className="bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Zap className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-green-800 dark:text-green-200">
                  Save 17% with Annual Billing
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Switch to yearly billing and get 2 months free — that&apos;s {formatCurrency(Math.round(TIER_PRICES[currentSubscriptionTier] * 12 * 0.17))} in savings!
                </p>
              </div>
            </div>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleManageSubscription}
            >
              Switch to Annual
            </Button>
          </div>
        </div>
      )}

      {/* Free Tier Credit Section */}
      {isFreeTier && (
        <SettingsSection
          title="Credits"
          description="Your monthly credits and usage analytics"
          icon={Coins}
        >
          <Tabs defaultValue="balance" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-4">
              <TabsTrigger value="balance">Balance</TabsTrigger>
              <TabsTrigger value="usage">Usage History</TabsTrigger>
            </TabsList>

            <TabsContent value="balance">
              <SettingsCard className="border-emerald-500/50 bg-emerald-500/5">
                <div className="flex items-start justify-between pb-4 border-b flex-wrap gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold">Free Tier</h3>
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        {FREE_TIER_MONTHLY_CREDITS.toLocaleString()} credits/month
                      </Badge>
                    </div>
                    <p className="text-3xl font-bold mt-2 text-emerald-600">
                      {creditBalance.toLocaleString()}
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        credits remaining
                      </span>
                    </p>
                    {nextFreeGrantAt && (
                      <p className="text-sm text-muted-foreground mt-1">
                        <Sparkles className="h-3 w-3 inline mr-1" />
                        Refreshes on {formatSmartDate(nextFreeGrantAt)}
                      </p>
                    )}
                  </div>
                  <CreditBalance variant="badge" />
                </div>

                {/* Credit Progress Bar */}
                <div className="py-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Credits used</span>
                    <span className={cn(
                      "font-medium",
                      isOutOfCredits ? "text-red-600" :
                        isCriticalCredits ? "text-orange-600" :
                          isLowCredits ? "text-yellow-600" :
                            "text-emerald-600"
                    )}>
                      {lifetimeSpent.toLocaleString()} / {FREE_TIER_MONTHLY_CREDITS.toLocaleString()}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, (creditBalance / FREE_TIER_MONTHLY_CREDITS) * 100)}
                    className={cn(
                      "h-2",
                      isOutOfCredits ? '[&>div]:bg-red-500' :
                        isCriticalCredits ? '[&>div]:bg-orange-500' :
                          isLowCredits ? '[&>div]:bg-yellow-500' :
                            '[&>div]:bg-emerald-500'
                    )}
                  />
                </div>

                {/* Low credit warning */}
                {(isLowCredits || isCriticalCredits || isOutOfCredits) && (
                  <Alert variant={isOutOfCredits ? 'destructive' : 'default'} className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {isOutOfCredits
                        ? "You're out of credits! Upgrade to a paid plan for unlimited usage."
                        : "Running low on credits. Upgrade for unlimited access to all features."}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-3">
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => navigate(`/${tenant?.slug}/admin/select-plan`)}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Upgrade for Unlimited
                  </Button>
                </div>
              </SettingsCard>
            </TabsContent>

            <TabsContent value="usage">
              <CreditUsageStats
                showUpgradeButton={true}
                onUpgradeClick={() => navigate(`/${tenant?.slug}/admin/select-plan`)}
              />
            </TabsContent>
          </Tabs>
        </SettingsSection>
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
                <h3 className="text-xl font-bold">{displayPlanName}</h3>
                <Badge variant="secondary">{isTrial ? 'Trial' : 'Active'}</Badge>
                {tenant?.billing_cycle === 'yearly' && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Annual
                  </Badge>
                )}
              </div>
              <p className="text-2xl font-bold mt-2">
                {formatCurrency(TIER_PRICES[currentSubscriptionTier])}
                <span className="text-sm font-normal text-muted-foreground">
                  /{tenant?.billing_cycle === 'yearly' ? 'year' : 'month'}
                </span>
              </p>
              {tenant?.billing_cycle === 'yearly' && (
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                  Saving 17% with annual billing
                </p>
              )}
              {!isTrial && (
                <p className="text-sm text-muted-foreground mt-1">
                  Next billing: {formatSmartDate(nextBillingDate)}
                </p>
              )}
              {tenant?.mrr && (
                <p className="text-sm text-muted-foreground">
                  Current MRR: {formatCurrency(tenant.mrr as number)}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={handleManageSubscription}
                disabled={upgradeLoading}
              >
                {upgradeLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Manage Subscription
              </Button>
              {!isTrial && currentSubscriptionTier !== 'starter' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setCancelDialogOpen(true)}
                  disabled={upgradeLoading}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Subscription
                </Button>
              )}
            </div>
          </div>

          {/* Usage Meters with Color Coding */}
          {Object.keys(limits).length > 0 && (
            <div className="pt-6 space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Usage This Month</h4>

              <div className="space-y-4">
                {Object.keys(limits).map((resource) => {
                  const limit = limits[resource];
                  const current = usage[resource] ?? 0;
                  const isUnlimited = limit === -1;
                  const percentage = getUsagePercentage(resource);
                  const isOverLimit = !isUnlimited && current > limit;
                  const showUpgradePrompt = !isUnlimited && percentage >= 80 && currentSubscriptionTier !== 'enterprise';

                  return (
                    <div key={resource} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize">{resource.replace(/_/g, ' ')}</span>
                        <span className={cn(
                          "font-medium",
                          isOverLimit ? "text-red-600" : getUsageColor(percentage)
                        )}>
                          {current.toLocaleString()} / {isUnlimited ? '∞' : limit.toLocaleString()}
                          {!isUnlimited && ` (${Math.round(percentage)}%)`}
                        </span>
                      </div>
                      {!isUnlimited && (
                        <Progress
                          value={percentage}
                          className={cn("h-2", getProgressColor(percentage))}
                        />
                      )}
                      {showUpgradePrompt && (
                        <div className="flex items-center gap-2 text-xs text-amber-600">
                          <ArrowUp className="h-3 w-3" />
                          <span>Running low! Consider upgrading for more capacity.</span>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs"
                            onClick={scrollToComparison}
                          >
                            Compare plans
                          </Button>
                        </div>
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
            const tierOrder = ['starter', 'professional', 'enterprise'];
            const isUpgrade = tierOrder.indexOf(plan.id) > tierOrder.indexOf(currentSubscriptionTier);

            return (
              <div
                key={plan.id}
                className={cn(
                  'relative rounded-xl border-2 p-6 transition-all',
                  plan.popular && !isCurrent && plan.borderColor,
                  isCurrent && 'bg-primary/5 border-primary shadow-lg'
                )}
              >
                {plan.popular && !isCurrent && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600">
                    <Star className="h-3 w-3 mr-1" /> Most Popular
                  </Badge>
                )}

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-6 w-6", plan.color)} />
                    <h3 className="font-semibold text-lg">{plan.name}</h3>
                    {isCurrent && <Badge variant="secondary">Current</Badge>}
                  </div>

                  <div className="space-y-1">
                    <p className="text-3xl font-bold">
                      {formatCurrency(plan.priceMonthly)}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      or {formatCurrency(plan.priceYearly)}/yr (save 17%)
                    </p>
                  </div>

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
                    variant={isCurrent ? 'secondary' : isUpgrade ? 'default' : 'outline'}
                    disabled={isCurrent || upgradeLoading}
                    onClick={() => handlePlanChange(plan.id)}
                  >
                    {upgradeLoading && selectedPlan === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {isCurrent ? 'Current Plan' : isUpgrade ? 'Upgrade' : 'Downgrade'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature Comparison (Collapsible) */}
        <div ref={comparisonRef} className="mt-6">
          <Collapsible open={featureComparisonOpen} onOpenChange={setFeatureComparisonOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <span className="font-medium">Full Feature Comparison</span>
                {featureComparisonOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  {Object.entries(featureCategories).map(([category, features]) => (
                    <div key={category} className="border-b last:border-b-0">
                      <div className="bg-muted/50 px-4 py-2 font-semibold text-sm">
                        {category}
                      </div>
                      <div className="divide-y">
                        {features.map((feature, idx) => (
                          <div key={`${feature.name}-${idx}`} className="grid grid-cols-4 gap-4 px-4 py-2 text-sm">
                            <div className="col-span-1">{feature.name}</div>
                            <div className="text-center">
                              {feature.tier === 'starter' ? (
                                <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                            <div className="text-center">
                              {feature.tier === 'starter' || feature.tier === 'professional' ? (
                                <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                            <div className="text-center">
                              <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-4 px-4 py-3 bg-muted/30 text-sm font-medium border-t">
                  <div>Feature</div>
                  <div className="text-center">Basic</div>
                  <div className="text-center">Professional</div>
                  <div className="text-center">Enterprise</div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
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
                  variant="outline"
                  size="sm"
                  onClick={handleManageSubscription}
                  disabled={upgradeLoading}
                >
                  {upgradeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update'}
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

      {/* Invoices / Billing History */}
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
                    <span className="font-medium">{formatCurrency(invoice.total ?? 0)}</span>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownloadInvoice(invoice)}
                      disabled={downloadingInvoice === invoice.id}
                      aria-label="Download invoice"
                    >
                      {downloadingInvoice === invoice.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
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
                  <br />
                  <span className="text-xs text-muted-foreground">
                    Changes take effect immediately. You'll be redirected to Stripe to complete the change.
                  </span>
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

      {/* Cancel Subscription Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Cancel Subscription
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your subscription? You'll be redirected to Stripe to manage your cancellation.
              <br /><br />
              <strong>Note:</strong> You can choose to cancel immediately or at the end of your billing period.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
            >
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={upgradeLoading}
            >
              {upgradeLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Proceed to Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Payment Method Dialog */}
      <AddPaymentMethodDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        tenantId={tenantId ?? ''}
      />
    </div>
  );
}
