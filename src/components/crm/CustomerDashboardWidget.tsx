import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Users, TrendingUp, TrendingDown, DollarSign, UserPlus, UserMinus, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';
import { queryKeys } from '@/lib/queryKeys';
import { subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface CustomerMetrics {
  totalCustomers: number;
  newThisMonth: number;
  churnedThisMonth: number;
  churnRate: number;
  topSpender: {
    name: string;
    totalSpent: number;
  } | null;
}

/**
 * CustomerDashboardWidget component
 *
 * Dashboard widget showing: total customers, new this month, churn rate, top spender.
 */
export function CustomerDashboardWidget() {
  const { tenant } = useTenantAdminAuth();
  const navigate = useNavigate();

  const { data: metrics, isLoading } = useQuery({
    queryKey: queryKeys.customers.metrics(tenant?.id),
    queryFn: async (): Promise<CustomerMetrics> => {
      if (!tenant?.id) {
        return {
          totalCustomers: 0,
          newThisMonth: 0,
          churnedThisMonth: 0,
          churnRate: 0,
          topSpender: null,
        };
      }

      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));

      // Total customers
      const { count: totalCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);

      // New this month
      const { count: newThisMonth } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      // Customers active last month
      const { data: activeLastMonth } = await supabase
        .from('unified_orders')
        .select('customer_id')
        .eq('tenant_id', tenant.id)
        .gte('created_at', lastMonthStart.toISOString())
        .lte('created_at', lastMonthEnd.toISOString());

      const activeLastMonthIds = new Set(activeLastMonth?.map((o) => o.customer_id) || []);

      // Customers active this month
      const { data: activeThisMonth } = await supabase
        .from('unified_orders')
        .select('customer_id')
        .eq('tenant_id', tenant.id)
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      const activeThisMonthIds = new Set(activeThisMonth?.map((o) => o.customer_id) || []);

      // Churned = active last month but not this month
      const churnedThisMonth = Array.from(activeLastMonthIds).filter(
        (id) => !activeThisMonthIds.has(id)
      ).length;

      const churnRate =
        activeLastMonthIds.size > 0 ? (churnedThisMonth / activeLastMonthIds.size) * 100 : 0;

      // Top spender
      const { data: customers } = await supabase
        .from('customers')
        .select('id, full_name, email')
        .eq('tenant_id', tenant.id);

      let topSpender: { name: string; totalSpent: number } | null = null;
      let maxSpent = 0;

      if (customers) {
        for (const customer of customers) {
          const { data: orders } = await supabase
            .from('unified_orders')
            .select('total_amount')
            .eq('tenant_id', tenant.id)
            .eq('customer_id', customer.id);

          const totalSpent = orders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;

          if (totalSpent > maxSpent) {
            maxSpent = totalSpent;
            topSpender = {
              name: customer.full_name || customer.email || 'Unknown',
              totalSpent,
            };
          }
        }
      }

      return {
        totalCustomers: totalCustomers || 0,
        newThisMonth: newThisMonth || 0,
        churnedThisMonth,
        churnRate,
        topSpender,
      };
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customer Overview</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Customer Overview</CardTitle>
            <CardDescription>Key customer metrics and insights</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/admin/${tenant?.tenant_slug}/customers`)}
          >
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Customers */}
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium">Total Customers</span>
            </div>
            <p className="text-2xl font-bold">{metrics?.totalCustomers || 0}</p>
          </div>

          {/* New This Month */}
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <UserPlus className="h-4 w-4" />
              <span className="text-sm font-medium">New This Month</span>
            </div>
            <p className="text-2xl font-bold">{metrics?.newThisMonth || 0}</p>
          </div>

          {/* Churn Rate */}
          <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <div className="flex items-center gap-2 text-orange-600 mb-1">
              <UserMinus className="h-4 w-4" />
              <span className="text-sm font-medium">Churn Rate</span>
            </div>
            <p className="text-2xl font-bold">
              {metrics?.churnRate ? `${metrics.churnRate.toFixed(1)}%` : '0%'}
            </p>
            {metrics && metrics.churnedThisMonth > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.churnedThisMonth} churned this month
              </p>
            )}
          </div>

          {/* Top Spender */}
          <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <Award className="h-4 w-4" />
              <span className="text-sm font-medium">Top Spender</span>
            </div>
            {metrics?.topSpender ? (
              <>
                <p className="text-2xl font-bold">
                  ${metrics.topSpender.totalSpent.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {metrics.topSpender.name}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No data</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
