/**
 * CustomerStatsCard Component
 *
 * Displays customer statistics (total spent, order count, average order value)
 * using the useCustomerStats hook.
 */

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCustomerStats } from '@/hooks/useCustomerStats';
import { DollarSign, ShoppingCart, TrendingUp } from 'lucide-react';

interface CustomerStatsCardProps {
  customerId: string | undefined;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function CustomerStatsCard({ customerId }: CustomerStatsCardProps) {
  const { data: stats, isLoading, isError } = useCustomerStats(customerId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-32" />
          </Card>
        ))}
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 col-span-full">
          <p className="text-sm text-muted-foreground">Unable to load customer statistics.</p>
        </Card>
      </div>
    );
  }

  const statItems = [
    {
      label: 'Total Spent',
      value: formatCurrency(stats.total_spent),
      icon: DollarSign,
      color: 'text-emerald-500 bg-emerald-500/10',
    },
    {
      label: 'Order Count',
      value: stats.order_count.toLocaleString(),
      icon: ShoppingCart,
      color: 'text-blue-500 bg-blue-500/10',
    },
    {
      label: 'Avg Order Value',
      value: formatCurrency(stats.avg_order_value),
      icon: TrendingUp,
      color: 'text-purple-500 bg-purple-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {statItems.map((item) => (
        <Card key={item.label} className="p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-lg ${item.color}`}>
              <item.icon className="h-5 w-5" />
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{item.label}</p>
          <p className="text-2xl font-bold">{item.value}</p>
        </Card>
      ))}
    </div>
  );
}
