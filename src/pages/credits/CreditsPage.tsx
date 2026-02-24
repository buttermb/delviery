/**
 * CreditsPage - Protected credits overview page
 *
 * Displays current balance prominently, lifetime stats, recent transactions,
 * subscription status, and a CTA to purchase more credits.
 */

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Coins,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ShoppingCart,
  CreditCard,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useCredits } from '@/hooks/useCredits';
import { getCreditTransactions, type CreditTransaction } from '@/lib/credits';
import { logger } from '@/lib/logger';
import { formatSmartDate } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';

// ============================================================================
// Helper Functions
// ============================================================================

function getBalanceColorClass(balance: number): string {
  if (balance > 2000) return 'text-emerald-600';
  if (balance > 1000) return 'text-yellow-600';
  if (balance > 500) return 'text-amber-600';
  if (balance > 100) return 'text-orange-600';
  return 'text-red-600';
}

function getBalanceBgClass(balance: number): string {
  if (balance > 2000) return 'bg-emerald-50 border-emerald-200';
  if (balance > 1000) return 'bg-yellow-50 border-yellow-200';
  if (balance > 500) return 'bg-amber-50 border-amber-200';
  if (balance > 100) return 'bg-orange-50 border-orange-200';
  return 'bg-red-50 border-red-200';
}

function getTransactionIcon(type: CreditTransaction['transactionType']) {
  switch (type) {
    case 'purchase':
      return <TrendingUp className="h-4 w-4 text-emerald-500" />;
    case 'usage':
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    case 'free_grant':
      return <Sparkles className="h-4 w-4 text-blue-500" />;
    case 'refund':
      return <TrendingUp className="h-4 w-4 text-blue-500" />;
    case 'bonus':
      return <Sparkles className="h-4 w-4 text-purple-500" />;
    case 'adjustment':
      return <Coins className="h-4 w-4 text-gray-500" />;
    default:
      return <Coins className="h-4 w-4 text-gray-500" />;
  }
}

function getTransactionLabel(type: CreditTransaction['transactionType']): string {
  switch (type) {
    case 'purchase': return 'Purchase';
    case 'usage': return 'Usage';
    case 'free_grant': return 'Free Grant';
    case 'refund': return 'Refund';
    case 'bonus': return 'Bonus';
    case 'adjustment': return 'Adjustment';
    default: return 'Transaction';
  }
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatSmartDate(date.toISOString());
}

// ============================================================================
// Sub-Components
// ============================================================================

function BalanceCard({ balance, isLoading }: { balance: number; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card className="col-span-full md:col-span-2 border-2">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-14 w-48" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('col-span-full md:col-span-2 border-2', getBalanceBgClass(balance))}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-medium">
          <Coins className="h-5 w-5" />
          Current Balance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className={cn('text-5xl font-bold tracking-tight', getBalanceColorClass(balance))}>
            {balance.toLocaleString()}
          </span>
          <span className="text-lg text-muted-foreground">credits</span>
        </div>
      </CardContent>
    </Card>
  );
}

function StatsCards({
  lifetimeEarned,
  lifetimeSpent,
  percentUsed,
  isLoading,
}: {
  lifetimeEarned: number;
  lifetimeSpent: number;
  percentUsed: number;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <>
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-24" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-24" />
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            Lifetime Purchased
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{lifetimeEarned.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">Total credits acquired</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TrendingDown className="h-4 w-4 text-orange-500" />
            Lifetime Used
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{lifetimeSpent.toLocaleString()}</p>
          <div className="mt-2">
            <Progress value={percentUsed} className="h-1.5" />
            <p className="text-xs text-muted-foreground mt-1">{percentUsed}% of total used</p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function SubscriptionStatusCard({
  tenant,
  tenantSlug,
}: {
  tenant: { subscription_plan: string; subscription_status: string; is_free_tier?: boolean };
  tenantSlug: string;
}) {
  const navigate = useNavigate();
  const isActive = tenant.subscription_status === 'active' || tenant.subscription_status === 'trial';
  const isFreeTier = tenant.is_free_tier !== false;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CreditCard className="h-4 w-4" />
          Subscription
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isFreeTier ? 'Free Tier' : tenant.subscription_plan}
          </Badge>
          <Badge variant={isActive ? 'outline' : 'destructive'} className="text-xs">
            {tenant.subscription_status}
          </Badge>
        </div>
        {isFreeTier && (
          <p className="text-xs text-muted-foreground">
            Upgrade to unlock unlimited credits and premium features.
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between"
          onClick={() => navigate(`/${tenantSlug}/admin/settings/billing`)}
        >
          Manage subscription
          <ArrowRight className="h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  );
}

function RecentTransactions({
  transactions,
  isLoading,
  tenantSlug,
}: {
  transactions: CreditTransaction[];
  isLoading: boolean;
  tenantSlug: string;
}) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Recent Transactions
          </CardTitle>
          <CardDescription>Your latest credit activity</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={() => navigate(`/${tenantSlug}/admin/credits/analytics`)}
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Coins className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No transactions yet</p>
            <p className="text-sm">Your credit activity will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getTransactionIcon(tx.transactionType)}
                  <div>
                    <p className="text-sm font-medium">
                      {tx.description || getTransactionLabel(tx.transactionType)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeDate(tx.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={cn(
                      'text-sm font-semibold',
                      tx.amount > 0 ? 'text-emerald-600' : 'text-red-600'
                    )}
                  >
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Bal: {tx.balanceAfter.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export function CreditsPage() {
  const { tenant, tenantSlug } = useTenantAdminAuth();
  const navigate = useNavigate();
  const {
    balance,
    lifetimeEarned,
    lifetimeSpent,
    percentUsed,
    isLoading: isBalanceLoading,
  } = useCredits();

  const tenantId = tenant?.id;

  // Fetch recent transactions (last 5)
  const { data: recentTransactions = [], isLoading: isTransactionsLoading } = useQuery({
    queryKey: queryKeys.creditWidgets.recentTransactions(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      try {
        return await getCreditTransactions(tenantId, { limit: 5 });
      } catch (err) {
        logger.error('Failed to fetch recent transactions', err as Error);
        return [];
      }
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000,
  });

  if (!tenant || !tenantSlug) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32 col-span-full md:col-span-2" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-64 col-span-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credits</h1>
          <p className="text-muted-foreground">
            Manage your credit balance and view activity
          </p>
        </div>
        <Button
          onClick={() => navigate(`/${tenantSlug}/admin/credits/analytics`)}
          className="gap-2"
        >
          <ShoppingCart className="h-4 w-4" />
          Buy More Credits
        </Button>
      </div>

      {/* Main Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {/* Balance - spans 2 columns */}
        <BalanceCard balance={balance} isLoading={isBalanceLoading} />

        {/* Stats cards */}
        <StatsCards
          lifetimeEarned={lifetimeEarned}
          lifetimeSpent={lifetimeSpent}
          percentUsed={percentUsed}
          isLoading={isBalanceLoading}
        />

        {/* Subscription Status */}
        <SubscriptionStatusCard tenant={tenant} tenantSlug={tenantSlug} />

        {/* Buy More CTA Card */}
        <Card className="flex flex-col justify-between bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Need more credits?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Purchase credit packs or upgrade your plan for unlimited access.
            </p>
            <Button
              variant="default"
              size="sm"
              className="w-full gap-2"
              onClick={() => navigate(`/${tenantSlug}/admin/credits/analytics`)}
            >
              <Coins className="h-4 w-4" />
              Buy Credits
            </Button>
          </CardContent>
        </Card>

        {/* Spacer for layout on large screens */}
        <div className="hidden lg:block lg:col-span-2" />

        {/* Recent Transactions - full width */}
        <RecentTransactions
          transactions={recentTransactions}
          isLoading={isTransactionsLoading}
          tenantSlug={tenantSlug}
        />
      </div>
    </div>
  );
}
