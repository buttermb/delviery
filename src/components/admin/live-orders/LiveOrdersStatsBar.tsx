import { useMemo } from 'react';
import { ShoppingCart, DollarSign, Clock, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardStats } from '@/hooks/useDashboardStats';

interface StatItemProps {
  icon: React.ElementType;
  label: string;
  value: string;
  iconColor: string;
}

function StatItem({ icon: Icon, label, value, iconColor }: StatItemProps) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className={`p-1.5 rounded-md ${iconColor}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground leading-none">{label}</p>
        <p className="text-sm font-semibold leading-tight tabular-nums truncate">{value}</p>
      </div>
    </div>
  );
}

function StatsBarSkeleton() {
  return (
    <div className="flex items-center gap-6 px-6 py-2.5 border-b bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-md" />
          <div className="space-y-1">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-4 w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatCurrency(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`;
  }
  return `$${amount.toFixed(0)}`;
}

export function LiveOrdersStatsBar() {
  const { stats, rawStats, isLoading } = useDashboardStats();

  const items = useMemo((): StatItemProps[] => [
    {
      icon: ShoppingCart,
      label: 'Today',
      value: String(stats.ordersToday.value),
      iconColor: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
    },
    {
      icon: DollarSign,
      label: 'Revenue',
      value: formatCurrency(stats.revenueToday.value),
      iconColor: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400',
    },
    {
      icon: Clock,
      label: 'Pending',
      value: String(rawStats.pendingOrders),
      iconColor: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400',
    },
    {
      icon: TrendingUp,
      label: 'Avg Order',
      value: formatCurrency(stats.avgOrderValue.value),
      iconColor: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400',
    },
  ], [stats, rawStats]);

  if (isLoading) {
    return <StatsBarSkeleton />;
  }

  return (
    <div className="flex items-center gap-6 px-6 py-2.5 border-b bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 overflow-x-auto">
      {items.map((item) => (
        <StatItem key={item.label} {...item} />
      ))}
    </div>
  );
}
