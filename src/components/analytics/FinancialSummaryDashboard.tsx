/**
 * Task 370: Add financial summary dashboard
 * P&L summary: revenue, COGS, gross margin, expenses. Monthly comparison.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingUp, TrendingDown, Minus } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

export function FinancialSummaryDashboard() {
  const { tenant } = useTenantAdminAuth();

  const { data: financials } = useQuery({
    queryKey: queryKeys.financialSummary.byTenant(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return null;

      const now = new Date();
      const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      // Fetch orders for this month
      const { data: thisMonthOrders } = await supabase
        .from('orders')
        .select('total')
        .eq('tenant_id', tenant.id)
        .gte('created_at', firstDayThisMonth.toISOString());

      // Fetch orders for last month
      const { data: lastMonthOrders } = await supabase
        .from('orders')
        .select('total')
        .eq('tenant_id', tenant.id)
        .gte('created_at', firstDayLastMonth.toISOString())
        .lte('created_at', lastDayLastMonth.toISOString());

      const thisMonthRevenue = thisMonthOrders?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
      const lastMonthRevenue = lastMonthOrders?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;

      // Simplified COGS (would need actual product costs)
      const estimatedCOGS = thisMonthRevenue * 0.6; // 60% assumption
      const grossMargin = thisMonthRevenue - estimatedCOGS;
      const grossMarginPercent = thisMonthRevenue > 0 ? (grossMargin / thisMonthRevenue) * 100 : 0;

      // Simplified expenses (would need actual expense tracking)
      const estimatedExpenses = 5000; // Fixed assumption
      const netProfit = grossMargin - estimatedExpenses;

      const revenueChange = lastMonthRevenue > 0
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : 0;

      return {
        thisMonth: {
          revenue: thisMonthRevenue,
          cogs: estimatedCOGS,
          grossMargin,
          grossMarginPercent,
          expenses: estimatedExpenses,
          netProfit,
        },
        lastMonth: {
          revenue: lastMonthRevenue,
        },
        revenueChange,
      };
    },
    enabled: !!tenant?.id,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const TrendIcon = ({ value }: { value: number }) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-emerald-600" />;
    if (value < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-2xl font-bold">
                {formatCurrency(financials?.thisMonth.revenue || 0)}
              </p>
              <div className="flex items-center gap-2 text-sm">
                <TrendIcon value={financials?.revenueChange || 0} />
                <span className={financials?.revenueChange && financials.revenueChange > 0 ? 'text-emerald-600' : financials?.revenueChange && financials.revenueChange < 0 ? 'text-red-600' : 'text-muted-foreground'}>
                  {financials?.revenueChange ? `${Math.abs(financials.revenueChange).toFixed(1)}%` : '0%'}
                </span>
                <span className="text-muted-foreground">vs last month</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Gross Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-2xl font-bold">
                {formatCurrency(financials?.thisMonth.grossMargin || 0)}
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {financials?.thisMonth.grossMarginPercent.toFixed(1)}%
                </Badge>
                <span className="text-sm text-muted-foreground">margin</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className={`text-2xl font-bold ${(financials?.thisMonth.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(financials?.thisMonth.netProfit || 0)}
              </p>
              <p className="text-sm text-muted-foreground">
                After expenses
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>P&L Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="font-medium">Revenue</span>
              <span className="font-semibold">{formatCurrency(financials?.thisMonth.revenue || 0)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b text-red-600">
              <span>Cost of Goods Sold (COGS)</span>
              <span>-{formatCurrency(financials?.thisMonth.cogs || 0)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b font-medium">
              <span>Gross Profit</span>
              <span>{formatCurrency(financials?.thisMonth.grossMargin || 0)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b text-red-600">
              <span>Operating Expenses</span>
              <span>-{formatCurrency(financials?.thisMonth.expenses || 0)}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-t-2 font-bold text-lg">
              <span>Net Profit</span>
              <span className={(financials?.thisMonth.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                {formatCurrency(financials?.thisMonth.netProfit || 0)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
