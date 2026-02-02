/**
 * Revenue Widget Component
 * Displays revenue KPI cards for:
 * - Today's Revenue
 * - Month to Date Revenue with growth percentage
 * - Average Order Value
 */

import { DollarSign, TrendingUp, ShoppingCart } from 'lucide-react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { KPICard, KPICardSkeleton } from './KPICard';

export function RevenueWidget() {
  const { data: stats, isLoading } = useDashboardStats();

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-green-600" />
        Revenue
      </h2>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <KPICardSkeleton key={i} />)
        ) : (
          <>
            <KPICard
              title="Today's Revenue"
              value={formatCurrency(stats?.revenueToday ?? 0)}
              icon={<DollarSign className="h-5 w-5" />}
              description="Completed orders today"
              variant="success"
            />
            <KPICard
              title="Month to Date"
              value={formatCurrency(stats?.revenueMTD ?? 0)}
              icon={<TrendingUp className="h-5 w-5" />}
              description="Revenue this month"
              variant="success"
              trend={stats?.revenueGrowthPercent !== undefined ? {
                value: stats.revenueGrowthPercent,
                label: 'vs last month'
              } : undefined}
            />
            <KPICard
              title="Avg Order Value"
              value={formatCurrency(stats?.avgOrderValue ?? 0)}
              icon={<ShoppingCart className="h-5 w-5" />}
              description="Per order this month"
              variant="default"
            />
          </>
        )}
      </div>
    </div>
  );
}
