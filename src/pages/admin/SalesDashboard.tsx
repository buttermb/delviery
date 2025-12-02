import { logger } from '@/lib/logger';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, ShoppingCart, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { isPostgrestError } from "@/utils/errorHandling/typeGuards";
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LastUpdated } from '@/components/shared/LastUpdated';
import { RecentItemsWidget } from "@/components/admin/dashboard/RecentItemsWidget";

export default function SalesDashboard() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ['sales-dashboard', tenantId, timeRange],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1000);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data || [];
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') return [];
        logger.error('Error fetching sales dashboard data', error, { component: 'SalesDashboard' });
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-8 w-32 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="h-96 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  const salesData = (orders || []).reduce((acc: any[], order: any) => {
    const date = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const existing = acc.find(item => item.date === date);
    const revenue = parseFloat(order.total || 0);
    if (existing) {
      existing.revenue += revenue;
      existing.orders += 1;
    } else {
      acc.push({ date, revenue, orders: 1 });
    }
    return acc;
  }, []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalRevenue = orders?.reduce((sum: number, o: any) => sum + parseFloat(o.total || 0), 0) || 0;
  const totalOrders = orders?.length || 0;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const stats = [
    {
      title: "Total Revenue",
      value: `$${totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      trend: "+12.5%",
      trendUp: true,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10"
    },
    {
      title: "Total Orders",
      value: totalOrders,
      icon: ShoppingCart,
      trend: "+5.2%",
      trendUp: true,
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    {
      title: "Avg Order Value",
      value: `$${avgOrderValue.toFixed(2)}`,
      icon: TrendingUp,
      trend: "-2.1%",
      trendUp: false,
      color: "text-violet-500",
      bg: "bg-violet-500/10"
    },
    {
      title: "Growth Rate",
      value: "15.3%",
      icon: Activity,
      trend: "+4.1%",
      trendUp: true,
      color: "text-amber-500",
      bg: "bg-amber-500/10"
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 pb-20 sm:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Sales Dashboard</h1>
          <p className="text-muted-foreground">Real-time performance metrics</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <LastUpdated date={new Date()} onRefresh={() => refetch()} isLoading={isLoading} />
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg self-start sm:self-auto">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setTimeRange(range)}
                className="text-xs font-medium"
              >
                {range.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile: Horizontal Scroll, Desktop: Grid */}
      <div className="flex overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 snap-x snap-mandatory hide-scrollbar">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="min-w-[280px] sm:min-w-0 snap-center"
          >
            <Card className="border-none shadow-sm bg-gradient-to-br from-card to-muted/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={cn("p-2 rounded-full", stat.bg)}>
                  <stat.icon className={cn("h-4 w-4", stat.color)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className={cn("text-xs flex items-center mt-1", stat.trendUp ? "text-emerald-500" : "text-red-500")}>
                  {stat.trendUp ? "+" : ""}{stat.trend}
                  <span className="text-muted-foreground ml-1">from last month</span>
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-none shadow-md overflow-hidden">
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>Daily revenue over time</CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                <div className="h-[300px] w-full">
                  {salesData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={salesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
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
                          tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorRevenue)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="border-none shadow-md overflow-hidden">
              <CardHeader>
                <CardTitle>Orders Volume</CardTitle>
                <CardDescription>Daily order count</CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                <div className="h-[300px] w-full">
                  {salesData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={salesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                          cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar
                          dataKey="orders"
                          fill="hsl(var(--primary))"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={50}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div>
          <RecentItemsWidget />
        </div>
      </div>
    </div>
  );
}
