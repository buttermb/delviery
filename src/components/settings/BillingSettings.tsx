import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, ExternalLink, Calendar, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';
import { format } from 'date-fns';

export function BillingSettings() {
  const { tenant } = useTenantAdminAuth();
  const [loading, setLoading] = useState(false);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      trial: 'secondary',
      trialing: 'secondary',
      past_due: 'destructive',
      cancelled: 'outline',
      suspended: 'destructive',
    };
    return variants[status] || 'outline';
  };

  const getPlanName = (plan: string) => {
    const names: Record<string, string> = {
      starter: 'Starter',
      professional: 'Professional',
      enterprise: 'Enterprise',
    };
    return names[plan] || plan;
  };

  const handleManageBilling = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would redirect to Stripe customer portal
      toast.info('Redirecting to billing portal...');
      logger.info('Billing portal access requested', { tenantId: tenant?.id });

      // Placeholder for Stripe portal URL
      // const { data } = await supabase.functions.invoke('create-billing-portal-session', {
      //   body: { tenantId: tenant?.id }
      // });
      // window.location.href = data.url;
    } catch (error) {
      logger.error('Error accessing billing portal:', error);
      toast.error('Failed to access billing portal');
    } finally {
      setLoading(false);
    }
  };

  if (!tenant) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">Loading billing information...</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <CreditCard className="h-5 w-5" />
        Billing & Subscription
      </h3>

      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Current Plan</p>
            <p className="text-2xl font-bold">{getPlanName(tenant.subscription_plan)}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge variant={getStatusBadge(tenant.subscription_status)}>
              {tenant.subscription_status?.toUpperCase()}
            </Badge>
          </div>
        </div>

        {tenant.trial_ends_at && tenant.subscription_status === 'trial' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900">Trial Period</p>
                <p className="text-sm text-amber-700">
                  Your trial ends on{' '}
                  {format(new Date(tenant.trial_ends_at), 'MMM dd, yyyy')}
                </p>
              </div>
            </div>
          </div>
        )}

        {(tenant as unknown as Record<string, unknown>).mrr && (
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Monthly Recurring Revenue</p>
              <p className="text-xl font-semibold">
                ${((tenant as unknown as Record<string, number>).mrr || 0).toFixed(2)}
              </p>
            </div>
          </div>
        )}

        <div className="border-t pt-6">
          <h4 className="font-medium mb-4">Plan Features</h4>
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customers</span>
              <span className="font-medium">
                {(tenant.limits as Record<string, number>)?.customers || 'Unlimited'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Products</span>
              <span className="font-medium">
                {(tenant.limits as Record<string, number>)?.products || 'Unlimited'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Locations</span>
              <span className="font-medium">
                {(tenant.limits as Record<string, number>)?.locations || 'Unlimited'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Menus</span>
              <span className="font-medium">
                {(tenant.limits as Record<string, number>)?.menus || 'Unlimited'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleManageBilling} disabled={loading}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Manage Billing
          </Button>
          <Button variant="outline">
            <ExternalLink className="h-4 w-4 mr-2" />
            View Invoices
          </Button>
        </div>
      </div>
    </Card>
  );
}
