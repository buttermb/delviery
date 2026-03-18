/**
 * Customer Dashboard Page
 *
 * Overview page for customer module with:
 * - Stats cards: total customers, new this week, active percentage, average LTV, churn rate
 * - Segment distribution pie chart
 * - Top customers by LTV table
 * - Recent customer activity feed
 * - Customer growth trend line chart
 * - Quick actions: add customer, import, export
 */

import { useMemo, useCallback } from 'react';

import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Users, UserPlus, Activity, TrendingUp, TrendingDown,
  Crown, UserX, Download, Upload, Plus, ArrowRight, AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format, subDays, parseISO, startOfWeek, isWithinInterval } from 'date-fns';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { LastUpdated } from '@/components/shared/LastUpdated';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import {
  useCustomerSegments,
  getSegmentLabel,
  getSegmentColorClasses,
  type CustomerSegment,
} from '@/hooks/useCustomerSegments';
import {
  useBulkCustomerLTV,
  formatLTVCurrency,
  sortByLTV,
} from '@/hooks/useCustomerLTV';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { displayName } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';
import { chartSemanticColors } from '@/lib/chartColors';

// Segment color palette for charts
const SEGMENT_COLORS: Record<CustomerSegment, string> = {
  vip: 'hsl(var(--chart-8))',
  active: 'hsl(var(--chart-6))',
  new: 'hsl(var(--chart-4))',
  at_risk: 'hsl(var(--chart-7))',
  churned: 'hsl(var(--chart-7))',
};

interface CustomerGrowthPoint {
  date: string;
  isoDate: string;
  total: number;
  new: number;
}

/**
 * Hook to fetch customer growth data
 */
function useCustomerGrowth(tenantId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.customerGrowth.byTenant(tenantId),
    queryFn: async (): Promise<CustomerGrowthPoint[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('contacts')
        .select('id, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Failed to fetch customer growth data', error, {
          component: 'CustomerDashboard',
        });
        throw error;
      }

      // Group by date and calculate cumulative total
      const dateMap = new Map<string, { new: number; cumulative: number }>();
      let cumulative = 0;

      // Get last 30 days
      const thirtyDaysAgo = subDays(new Date(), 30);

      for (const customer of data ?? []) {
        const isoDate = format(parseISO(customer.created_at), 'yyyy-MM-dd');
        const customerDate = parseISO(customer.created_at);

        cumulative++;

        if (customerDate >= thirtyDaysAgo) {
          const existing = dateMap.get(isoDate) || { new: 0, cumulative: 0 };
          dateMap.set(isoDate, {
            new: existing.new + 1,
            cumulative,
          });
        }
      }

      // Fill in missing dates with cumulative values
      const result: CustomerGrowthPoint[] = [];
      let lastCumulative = cumulative - (data?.filter(c => parseISO(c.created_at) >= thirtyDaysAgo).length ?? 0);

      for (let i = 30; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const isoDate = format(date, 'yyyy-MM-dd');
        const displayDate = format(date, 'MMM d');

        const dayData = dateMap.get(isoDate);
        if (dayData) {
          lastCumulative = dayData.cumulative;
          result.push({
            date: displayDate,
            isoDate,
            total: dayData.cumulative,
            new: dayData.new,
          });
        } else {
          result.push({
            date: displayDate,
            isoDate,
            total: lastCumulative,
            new: 0,
          });
        }
      }

      return result;
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });
}

/**
 * Hook to fetch recent customer activity
 */
function useRecentCustomerActivity(tenantId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.customerGrowth.recentActivity(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      // Get recently active customers (those with recent orders)
      const { data: recentOrders, error } = await supabase
        .from('unified_orders')
        .select('customer_id, created_at, total_amount, status')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        logger.error('Failed to fetch recent customer activity', error, {
          component: 'CustomerDashboard',
        });
        throw error;
      }

      // Get unique customers and their most recent activity
      const customerMap = new Map<string, {
        customerId: string;
        lastActivity: string;
        lastOrderAmount: number;
        status: string;
      }>();

      for (const order of recentOrders ?? []) {
        if (!customerMap.has(order.customer_id)) {
          customerMap.set(order.customer_id, {
            customerId: order.customer_id,
            lastActivity: order.created_at,
            lastOrderAmount: order.total_amount ?? 0,
            status: order.status || 'pending',
          });
        }
      }

      // Get customer names
      const customerIds = Array.from(customerMap.keys());
      if (customerIds.length === 0) return [];

      const { data: customers } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, name, email')
        .eq('tenant_id', tenantId)
        .in('id', customerIds);

      const customerNameMap = new Map(
        (customers ?? []).map((c) => [c.id, { name: c.name || displayName(c.first_name, c.last_name), email: c.email }])
      );

      return Array.from(customerMap.values())
        .map(activity => {
          const info = customerNameMap.get(activity.customerId) as { name?: string; email?: string } | undefined;
          return {
            ...activity,
            customerName: info?.name || 'Unknown',
            customerEmail: info?.email ?? '',
          };
        })
        .slice(0, 10);
    },
    enabled: !!tenantId,
    staleTime: 30000,
  });
}

/**
 * Loading skeleton for stats cards
 */
function StatsCardSkeleton() {
  return (
    <div className="h-32 bg-muted animate-pulse rounded-xl" />
  );
}

/**
 * Stats card component
 */
interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
  color: string;
  bg: string;
  delay?: number;
}

function StatsCard({ title, value, icon: Icon, trend, trendUp, color, bg, delay = 0 }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="border-none shadow-sm bg-gradient-to-br from-card to-muted/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <div className={cn("p-2 rounded-full", bg)}>
            <Icon className={cn("h-4 w-4", color)} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          {trend && (
            <p className={cn("text-xs flex items-center mt-1", trendUp ? "text-emerald-500" : "text-red-500")}>
              {trendUp ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {trend}
              <span className="text-muted-foreground ml-1">from last week</span>
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/**
 * Main Customer Dashboard component
 */
export default function CustomerDashboard() {
  const { tenant } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();
  const tenantId = tenant?.id;

  // Fetch customer segments data
  const { segments, counts, isLoading: segmentsLoading, refetch: refetchSegments } = useCustomerSegments();

  // Fetch LTV data for top customers
  const { ltvList, isLoading: ltvLoading, refetch: refetchLTV } = useBulkCustomerLTV({});

  // Fetch customer growth data
  const { data: growthData, isLoading: growthLoading, isError: growthError, refetch: refetchGrowth } = useCustomerGrowth(tenantId);

  // Fetch recent activity
  const { data: recentActivity, isLoading: activityLoading, isError: activityError, refetch: refetchActivity } = useRecentCustomerActivity(tenantId);

  // Calculate stats
  const stats = useMemo(() => {
    const totalCustomers = counts.total;
    const now = new Date();
    const weekStart = startOfWeek(now);

    // Count new customers this week
    const newThisWeek = segments.filter(s => {
      if (!s.firstOrderDate) return false;
      const firstOrder = parseISO(s.firstOrderDate);
      return isWithinInterval(firstOrder, { start: weekStart, end: now });
    }).length;

    // Active percentage (active + vip / total)
    const activeCount = counts.active + counts.vip;
    const activePercentage = totalCustomers > 0 ? Math.round((activeCount / totalCustomers) * 100) : 0;

    // Average LTV
    const totalLTV = ltvList.reduce((sum, ltv) => sum + ltv.totalSpend, 0);
    const avgLTV = ltvList.length > 0 ? totalLTV / ltvList.length : 0;

    // Churn rate (churned / total)
    const churnRate = totalCustomers > 0 ? Math.round((counts.churned / totalCustomers) * 100) : 0;

    return {
      totalCustomers,
      newThisWeek,
      activePercentage,
      avgLTV,
      churnRate,
    };
  }, [counts, segments, ltvList]);

  // Top customers by LTV
  const topCustomers = useMemo(() => {
    return [...ltvList].sort(sortByLTV).slice(0, 5);
  }, [ltvList]);

  // Segment distribution for pie chart
  const segmentDistribution = useMemo(() => {
    return [
      { name: 'VIP', value: counts.vip, color: SEGMENT_COLORS.vip },
      { name: 'Active', value: counts.active, color: SEGMENT_COLORS.active },
      { name: 'New', value: counts.new, color: SEGMENT_COLORS.new },
      { name: 'At Risk', value: counts.at_risk, color: SEGMENT_COLORS.at_risk },
      { name: 'Churned', value: counts.churned, color: SEGMENT_COLORS.churned },
    ].filter(seg => seg.value > 0);
  }, [counts]);

  // Refresh all data
  const handleRefresh = useCallback(() => {
    refetchSegments();
    refetchLTV();
    refetchGrowth();
    refetchActivity();
  }, [refetchSegments, refetchLTV, refetchGrowth, refetchActivity]);

  // Navigation handlers
  const handleAddCustomer = useCallback(() => {
    navigateToAdmin('customers/new');
  }, [navigateToAdmin]);

  const handleImport = useCallback(() => {
    navigateToAdmin('customers?action=import');
  }, [navigateToAdmin]);

  const handleExport = useCallback(() => {
    navigateToAdmin('customers?action=export');
  }, [navigateToAdmin]);

  const handleViewAllCustomers = useCallback(() => {
    navigateToAdmin('customers');
  }, [navigateToAdmin]);

  const handleViewCustomer = useCallback((customerId: string) => {
    navigateToAdmin(`customers/${customerId}`);
  }, [navigateToAdmin]);

  const isLoading = segmentsLoading || ltvLoading || growthLoading || activityLoading;
  const isError = growthError || activityError;

  if (isLoading) {
    return (
      <div className="p-4 sm:p-4 space-y-4 pb-20 sm:pb-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-8 w-32 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map(i => (
            <StatsCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 h-96 bg-muted animate-pulse rounded-xl" />
          <div className="h-96 bg-muted animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-sm text-muted-foreground">Failed to load customer dashboard data. Please try again.</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => handleRefresh()}>
          Retry
        </Button>
      </div>
    );
  }

  const statsCards = [
    {
      title: "Total Customers",
      value: stats.totalCustomers.toLocaleString(),
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    {
      title: "New This Week",
      value: stats.newThisWeek.toLocaleString(),
      icon: UserPlus,
      trend: "+12%",
      trendUp: true,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10"
    },
    {
      title: "Active Rate",
      value: `${stats.activePercentage}%`,
      icon: Activity,
      trend: "+3%",
      trendUp: true,
      color: "text-violet-500",
      bg: "bg-violet-500/10"
    },
    {
      title: "Avg. LTV",
      value: formatLTVCurrency(stats.avgLTV),
      icon: TrendingUp,
      trend: "+8%",
      trendUp: true,
      color: "text-amber-500",
      bg: "bg-amber-500/10"
    },
    {
      title: "Churn Rate",
      value: `${stats.churnRate}%`,
      icon: UserX,
      trend: "-2%",
      trendUp: true,
      color: "text-red-500",
      bg: "bg-red-500/10"
    },
  ];

  return (
    <div className="p-4 sm:p-4 space-y-4 pb-20 sm:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-xl font-bold tracking-tight">Customer Dashboard</h1>
          <p className="text-muted-foreground">Overview of your customer base and activity</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <LastUpdated date={new Date()} onRefresh={handleRefresh} isLoading={isLoading} />
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="border-none shadow-sm bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Quick Actions:</span>
            <Button size="sm" onClick={handleAddCustomer} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Customer
            </Button>
            <Button size="sm" variant="outline" onClick={handleImport} className="gap-2">
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button size="sm" variant="ghost" onClick={handleViewAllCustomers} className="gap-2 ml-auto">
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards - Stack on mobile, grid on larger screens */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {statsCards.map((stat, index) => (
          <StatsCard
            key={stat.title}
            {...stat}
            delay={index * 0.1}
          />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Customer Growth Chart */}
        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-none shadow-md overflow-hidden">
              <CardHeader>
                <CardTitle>Customer Growth</CardTitle>
                <CardDescription>Total customers over the last 30 days</CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                <div className="h-[300px] w-full">
                  {growthData && growthData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={growthData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="total"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 6, strokeWidth: 2 }}
                          name="Total Customers"
                        />
                        <Line
                          type="monotone"
                          dataKey="new"
                          stroke={chartSemanticColors.revenue}
                          strokeWidth={2}
                          dot={false}
                          strokeDasharray="5 5"
                          name="New Customers"
                        />
                        <Legend />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <EnhancedEmptyState
                      icon={Users}
                      title="No Growth Data"
                      description="Customer growth data will appear here once you have customers."
                      compact
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Segment Distribution Pie Chart */}
        <div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="border-none shadow-md overflow-hidden h-full">
              <CardHeader>
                <CardTitle>Segment Distribution</CardTitle>
                <CardDescription>Customer breakdown by segment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] w-full">
                  {segmentDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={segmentDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {segmentDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                          formatter={(value: number) => [value, 'Customers']}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EnhancedEmptyState
                      icon={Activity}
                      title="No Segments"
                      description="Segment distribution will appear once you have customers."
                      compact
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Bottom Grid - Top Customers & Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Customers by LTV */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="border-none shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Top Customers by LTV</CardTitle>
                <CardDescription>Your most valuable customers</CardDescription>
              </div>
              <Crown className="h-5 w-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              {topCustomers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">LTV</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead>Segment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topCustomers.map((customer) => (
                      <TableRow
                        key={customer.customerId}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewCustomer(customer.customerId)}
                      >
                        <TableCell className="font-medium">
                          {customer.customerName || 'Unknown'}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">
                          {formatLTVCurrency(customer.totalSpend)}
                        </TableCell>
                        <TableCell className="text-right">
                          {customer.orderCount}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("text-xs", getSegmentColorClasses(customer.segment as CustomerSegment))}
                          >
                            {getSegmentLabel(customer.segment as CustomerSegment)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EnhancedEmptyState
                  icon={Crown}
                  title="No Customers Yet"
                  description="Top customers will appear here once you have order data."
                  compact
                />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Customer Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="border-none shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest customer orders</CardDescription>
              </div>
              <Activity className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              {recentActivity && recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div
                      key={activity.customerId}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleViewCustomer(activity.customerId)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-semibold text-primary">
                            {activity.customerName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{activity.customerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(activity.lastActivity), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">
                          {formatLTVCurrency(activity.lastOrderAmount)}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {activity.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EnhancedEmptyState
                  icon={Activity}
                  title="No Recent Activity"
                  description="Customer activity will appear here as orders are placed."
                  compact
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
