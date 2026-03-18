/**
 * Analytics KPI Cards
 * Displays key performance indicators (Revenue, Orders, Average Order Value)
 * with a period selector for date range filtering.
 */

import { useState } from 'react';

import { DollarSign, ShoppingCart, TrendingUp } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { DashboardPeriod } from '@/hooks/useDashboardStats';

import { KPICard, KPICardSkeleton } from '@/components/admin/dashboard/KPICard';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { formatCurrency } from '@/lib/utils/formatCurrency';

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'mtd', label: 'Month to date' },
  { value: 'ytd', label: 'Year to date' },
];

const TREND_LABEL = 'vs previous';

export function AnalyticsKPICards() {
  const [period, setPeriod] = useState<DashboardPeriod>('30d');
  const { stats, isLoading } = useDashboardStats(period);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Key Metrics</h3>
        <Select value={period} onValueChange={(v) => setPeriod(v as DashboardPeriod)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              title="Revenue"
              value={formatCurrency(stats.revenueToday.value)}
              icon={<DollarSign className="h-5 w-5" />}
              description="Total revenue for period"
              variant="success"
              trend={
                stats.revenueToday.changePercent !== 0
                  ? { value: stats.revenueToday.changePercent, label: TREND_LABEL }
                  : undefined
              }
            />
            <KPICard
              title="Orders"
              value={stats.ordersToday.value}
              icon={<ShoppingCart className="h-5 w-5" />}
              description="Total orders for period"
              trend={
                stats.ordersToday.changePercent !== 0
                  ? { value: stats.ordersToday.changePercent, label: TREND_LABEL }
                  : undefined
              }
            />
            <KPICard
              title="Avg Order Value"
              value={formatCurrency(stats.avgOrderValue.value)}
              icon={<TrendingUp className="h-5 w-5" />}
              description="Average order value for period"
              trend={
                stats.avgOrderValue.changePercent !== 0
                  ? { value: stats.avgOrderValue.changePercent, label: TREND_LABEL }
                  : undefined
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
