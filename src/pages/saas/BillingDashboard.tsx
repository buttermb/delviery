/**
 * Billing Dashboard
 * Manage subscription, usage, and payments
 */

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreditCard, DollarSign, TrendingUp, AlertTriangle, Download, Plus, Users, Menu, Package, MapPin } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getPlanPrice, getPlanDisplayName, checkLimit } from '@/lib/tenant';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';

export default function BillingDashboard() {
  const { tenant, refresh } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('');

  // Fetch usage stats
  const { data: usageStats } = useQuery({
    queryKey: ['usage-stats', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;

      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const { data } = await supabase
        .from('usage_events')
        .select('event_type, quantity')
        .eq('tenant_id', tenant.id)
        .gte('created_at', monthStart.toISOString());

      const stats = {
        sms_sent: 0,
        emails_sent: 0,
        labels_printed: 0,
        api_calls: 0,
      };

      data?.forEach((event) => {
        if (event.event_type === 'sms_sent') stats.sms_sent += event.quantity || 1;
        if (event.event_type === 'email_sent') stats.emails_sent += event.quantity || 1;
        if (event.event_type === 'label_printed') stats.labels_printed += event.quantity || 1;
        if (event.event_type === 'api_call') stats.api_calls += event.quantity || 1;
      });

      return stats;
    },
    enabled: !!tenant?.id,
  });

  if (!tenant) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Loading billing information...</p>
        </Card>
      </div>
    );
  }

  const isTrial = tenant.subscription_status === 'trial';
  const trialDaysRemaining = tenant.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const UsageCard = ({
    title,
    resource,
    icon: Icon,
  }: {
    title: string;
    resource: keyof typeof tenant.limits;
    icon: any;
  }) => {
    const limitCheck = checkLimit(tenant, resource);
    const percentage = limitCheck.limit === Infinity ? 0 : (limitCheck.current / limitCheck.limit) * 100;

    return (
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{title}</span>
          </div>
          <Badge variant={limitCheck.allowed ? 'secondary' : 'destructive'}>
            {limitCheck.current} / {limitCheck.limit === Infinity ? '∞' : limitCheck.limit}
          </Badge>
        </div>
        {limitCheck.limit !== Infinity && (
          <Progress value={percentage} className="h-2" />
        )}
        {!limitCheck.allowed && (
          <p className="text-sm text-destructive mt-2">
            Limit reached. <a href="#" className="underline">Upgrade plan</a>
          </p>
        )}
      </Card>
    );
  };

  const handleUpgrade = async () => {
    if (!selectedPlan || !tenant) return;

    // TODO: Integrate with Stripe to upgrade subscription
    toast({
      title: 'Upgrade Initiated',
      description: `Upgrading to ${getPlanDisplayName(selectedPlan)} plan...`,
    });

    // Simulate upgrade
    await supabase
      .from('tenants')
      .update({
        subscription_plan: selectedPlan,
        limits: {
          customers: selectedPlan === 'professional' ? 500 : -1,
          menus: selectedPlan === 'professional' ? -1 : -1,
          products: -1,
          locations: selectedPlan === 'professional' ? 10 : -1,
          users: selectedPlan === 'professional' ? 10 : -1,
        },
        features: {
          api_access: selectedPlan !== 'starter',
          custom_branding: selectedPlan !== 'starter',
          white_label: selectedPlan === 'enterprise',
          advanced_analytics: selectedPlan !== 'starter',
          sms_enabled: selectedPlan !== 'starter',
        },
      })
      .eq('id', tenant.id);

    refresh();
    setUpgradeDialogOpen(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">💳 Billing & Subscription</h1>
          <p className="text-muted-foreground">Manage your plan, usage, and payments</p>
        </div>
      </div>

      {/* Current Plan */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">Current Plan</h2>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-lg px-3 py-1">
                {getPlanDisplayName(tenant.subscription_plan)}
              </Badge>
              <span className="text-2xl font-bold">
                {formatCurrency(getPlanPrice(tenant.subscription_plan))}/month
              </span>
            </div>
          </div>
          {isTrial && (
            <div className="text-right">
              <Badge variant="secondary" className="mb-2">
                ⏰ Trial ends in {trialDaysRemaining} days
              </Badge>
              <p className="text-sm text-muted-foreground">
                {formatSmartDate(tenant.trial_ends_at)}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <TrendingUp className="h-4 w-4 mr-2" />
                Upgrade Plan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upgrade Your Plan</DialogTitle>
                <DialogDescription>
                  Choose a plan that fits your growing needs
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional - $299/month</SelectItem>
                    <SelectItem value="enterprise">Enterprise - $799/month</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleUpgrade} className="w-full" disabled={!selectedPlan}>
                  Upgrade Now
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline">
            <CreditCard className="h-4 w-4 mr-2" />
            {tenant.payment_method_added ? 'Update Payment' : 'Add Payment Method'}
          </Button>
        </div>
      </Card>

      {/* Usage */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Current Usage</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <UsageCard title="Customers" resource="customers" icon={Users} />
          <UsageCard title="Menus" resource="menus" icon={Menu} />
          <UsageCard title="Products" resource="products" icon={Package} />
          <UsageCard title="Locations" resource="locations" icon={MapPin} />
          <UsageCard title="Team Members" resource="users" icon={Users} />
        </div>
      </div>

      {/* Add-On Usage */}
      {usageStats && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Add-On Usage This Month</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">SMS Messages</span>
                <p className="text-sm text-muted-foreground">
                  {usageStats.sms_sent.toLocaleString()} sent
                </p>
              </div>
              <div className="text-right">
                <span className="font-semibold">
                  {formatCurrency((usageStats.sms_sent / 1000) * 20)}
                </span>
                <p className="text-xs text-muted-foreground">$20 per 1,000</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">Emails</span>
                <p className="text-sm text-muted-foreground">
                  {usageStats.emails_sent.toLocaleString()} sent
                </p>
              </div>
              <div className="text-right">
                <span className="font-semibold">
                  {formatCurrency((usageStats.emails_sent / 10000) * 10)}
                </span>
                <p className="text-xs text-muted-foreground">$10 per 10,000</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">Labels Printed</span>
                <p className="text-sm text-muted-foreground">
                  {usageStats.labels_printed.toLocaleString()} printed
                </p>
              </div>
              <div className="text-right">
                <span className="font-semibold">
                  {formatCurrency((usageStats.labels_printed / 1000) * 15)}
                </span>
                <p className="text-xs text-muted-foreground">$15 per 1,000</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Payment Method */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Payment Method</h2>
        {tenant.payment_method_added ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">•••• •••• •••• 4242</p>
                <p className="text-sm text-muted-foreground">Expires 12/25</p>
              </div>
            </div>
            <Button variant="outline">Update Card</Button>
          </div>
        ) : (
          <div className="text-center py-8">
            <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              Add a payment method to continue after trial
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Payment Method
            </Button>
          </div>
        )}
      </Card>

      {/* Billing History */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Billing History</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium">{formatSmartDate(new Date().toISOString())}</p>
              <p className="text-sm text-muted-foreground">Starter Plan</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{formatCurrency(99)}</p>
              <Badge variant="secondary" className="mt-1">Paid</Badge>
            </div>
            <Button variant="ghost" size="sm">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

