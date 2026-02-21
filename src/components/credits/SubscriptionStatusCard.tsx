/**
 * SubscriptionStatusCard Component
 *
 * Displays active subscription details including credits per period,
 * credits remaining with progress bar, next renewal date, and
 * manage subscription button. Handles paused/cancelled states.
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Crown,
  AlertTriangle,
  PauseCircle,
  XCircle,
  CreditCard,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { formatSmartDate } from '@/lib/formatters';

export interface SubscriptionStatusCardProps {
  className?: string;
}

interface CreditSubscription {
  id: string;
  status: string;
  credits_per_period: number;
  period_type: string;
  credits_remaining_this_period: number | null;
  current_period_end: string | null;
  current_period_start: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
}

type SubscriptionDisplayStatus = 'active' | 'paused' | 'cancelled' | 'past_due' | 'trialing';

function getStatusConfig(status: SubscriptionDisplayStatus, cancelAtPeriodEnd: boolean) {
  if (cancelAtPeriodEnd && status === 'active') {
    return {
      label: 'Cancelling',
      icon: XCircle,
      badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800',
      progressClass: '[&>div]:bg-orange-500',
    };
  }

  switch (status) {
    case 'active':
    case 'trialing':
      return {
        label: status === 'trialing' ? 'Trial' : 'Active',
        icon: Crown,
        badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        progressClass: '[&>div]:bg-emerald-500',
      };
    case 'paused':
      return {
        label: 'Paused',
        icon: PauseCircle,
        badgeClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
        progressClass: '[&>div]:bg-yellow-500',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        icon: XCircle,
        badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
        progressClass: '[&>div]:bg-red-500',
      };
    case 'past_due':
      return {
        label: 'Past Due',
        icon: AlertTriangle,
        badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
        progressClass: '[&>div]:bg-red-500',
      };
    default:
      return {
        label: 'Unknown',
        icon: AlertTriangle,
        badgeClass: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200 dark:border-gray-800',
        progressClass: '[&>div]:bg-gray-500',
      };
  }
}

function formatPeriodType(periodType: string): string {
  switch (periodType) {
    case 'monthly':
      return 'month';
    case 'yearly':
      return 'year';
    case 'weekly':
      return 'week';
    default:
      return periodType;
  }
}

function formatRenewalDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  return formatSmartDate(dateString);
}

export function SubscriptionStatusCard({ className }: SubscriptionStatusCardProps) {
  const { tenant, tenantSlug } = useTenantAdminAuth();
  const { currentTier } = useSubscriptionStatus();
  const navigate = useNavigate();

  const tenantId = tenant?.id;

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['credit-subscription', tenantId],
    queryFn: async (): Promise<CreditSubscription | null> => {
      if (!tenantId) return null;

      try {
        const { data, error } = await (supabase as any)
          .from('credit_subscriptions')
          .select('id, status, credits_per_period, period_type, credits_remaining_this_period, current_period_end, current_period_start, cancel_at_period_end, cancelled_at')
          .eq('tenant_id', tenantId)
          .in('status', ['active', 'paused', 'cancelled', 'past_due', 'trialing'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          logger.error('Failed to fetch credit subscription', { error, tenantId });
          return null;
        }

        return data as CreditSubscription | null;
      } catch (err) {
        logger.error('Error fetching credit subscription', { error: err });
        return null;
      }
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
  });

  const statusConfig = useMemo(() => {
    if (!subscription) return null;
    return getStatusConfig(
      subscription.status as SubscriptionDisplayStatus,
      subscription.cancel_at_period_end
    );
  }, [subscription]);

  const progressPercent = useMemo(() => {
    if (!subscription) return 0;
    const remaining = subscription.credits_remaining_this_period ?? 0;
    const total = subscription.credits_per_period;
    if (total <= 0) return 0;
    return Math.min(Math.round((remaining / total) * 100), 100);
  }, [subscription]);

  if (isLoading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardHeader className="pb-2">
          <div className="h-5 w-40 bg-muted rounded" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-2 w-full bg-muted rounded" />
          <div className="h-4 w-32 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return null;
  }

  const StatusIcon = statusConfig?.icon ?? Crown;
  const isInactive = subscription.status === 'paused' || subscription.status === 'cancelled';

  return (
    <Card className={cn(isInactive ? 'opacity-80' : '', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <StatusIcon className="h-5 w-5 text-primary" />
            Credit Subscription
          </CardTitle>
          {statusConfig && (
            <Badge
              variant="outline"
              className={cn('text-xs', statusConfig.badgeClass)}
            >
              {statusConfig.label}
            </Badge>
          )}
        </div>
        <CardDescription>
          {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} plan
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Credits per period */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Credits per {formatPeriodType(subscription.period_type)}</span>
          <span className="font-semibold">{subscription.credits_per_period.toLocaleString()}</span>
        </div>

        {/* Credits remaining with progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Remaining this period</span>
            <span className="font-semibold">
              {(subscription.credits_remaining_this_period ?? 0).toLocaleString()}
              {' / '}
              {subscription.credits_per_period.toLocaleString()}
            </span>
          </div>
          <Progress
            value={progressPercent}
            className={cn('h-2', statusConfig?.progressClass)}
          />
          <p className="text-xs text-muted-foreground text-right">
            {progressPercent}% remaining
          </p>
        </div>

        {/* Next renewal date */}
        {subscription.status === 'active' && !subscription.cancel_at_period_end && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4" />
            <span>
              Renews on {formatRenewalDate(subscription.current_period_end)}
            </span>
          </div>
        )}

        {/* Cancelling at period end */}
        {subscription.cancel_at_period_end && subscription.status === 'active' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 text-sm text-orange-700 dark:text-orange-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Subscription ends on {formatRenewalDate(subscription.current_period_end)}
            </span>
          </div>
        )}

        {/* Paused state */}
        {subscription.status === 'paused' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 text-sm text-yellow-700 dark:text-yellow-300">
            <PauseCircle className="h-4 w-4 shrink-0" />
            <span>
              Your subscription is paused. Credits will not renew until resumed.
            </span>
          </div>
        )}

        {/* Cancelled state */}
        {subscription.status === 'cancelled' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-sm text-red-700 dark:text-red-300">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>
              Subscription cancelled
              {subscription.cancelled_at && (
                <> on {formatRenewalDate(subscription.cancelled_at)}</>
              )}
              . Remaining credits can still be used.
            </span>
          </div>
        )}

        {/* Past due state */}
        {subscription.status === 'past_due' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Payment failed. Please update your payment method to continue receiving credits.
            </span>
          </div>
        )}

        {/* Manage subscription button */}
        <Button
          variant={isInactive ? 'default' : 'outline'}
          className="w-full gap-2"
          onClick={() => navigate(`/${tenantSlug}/admin/billing`)}
        >
          <CreditCard className="h-4 w-4" />
          {isInactive ? 'Reactivate Subscription' : 'Manage Subscription'}
        </Button>
      </CardContent>
    </Card>
  );
}
