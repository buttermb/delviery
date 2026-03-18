import { useMemo } from 'react';
import {
  Eye, ShoppingCart, DollarSign, TrendingUp, Flame, Clock,
  BarChart3, PieChart as PieChartIcon, Activity, RefreshCw, Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useMenuDashboardAnalytics } from '@/hooks/useMenuDashboardAnalytics';
import { AnalyticsExportButton } from './AnalyticsExportButton';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';
import { CHART_COLORS, chartSemanticColors } from '@/lib/chartColors';

const DONUT_COLORS = [CHART_COLORS[5], CHART_COLORS[7], CHART_COLORS[6], CHART_COLORS[9]];
const BURN_REASON_COLORS = [CHART_COLORS[4], CHART_COLORS[8], CHART_COLORS[7], CHART_COLORS[3], CHART_COLORS[9]];

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-2xl font-bold truncate">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
          {subtitle && (
            <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>
          )}
        </div>
      </div>
    </Card>
  );
}

function FunnelStage({
  stage,
  value,
  percentage,
  index,
}: {
  stage: string;
  value: number;
  percentage: number;
  index: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{stage}</span>
        <span className="text-muted-foreground">{value.toLocaleString()}</span>
      </div>
      <Progress value={percentage} className="h-3" />
      {index > 0 && percentage < 100 && (
        <div className="text-[11px] text-muted-foreground text-right">
          {percentage.toFixed(1)}% of total
        </div>
      )}
    </div>
  );
}

export function MenuAnalyticsDashboard() {
  const { tenant } = useTenantAdminAuth();
  const {
    analytics,
    isLoading,
    realtimeViews,
    realtimeOrders,
    getExportData,
    refresh,
  } = useMenuDashboardAnalytics(tenant?.id);

  // Format views over time for chart (show only last 14 days with short date labels)
  const viewsChartData = useMemo(() => {
    return analytics.viewsOverTime.slice(-14).map(item => ({
      ...item,
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));
  }, [analytics.viewsOverTime]);

  // Format orders over time for chart
  const ordersChartData = useMemo(() => {
    return analytics.ordersOverTime.slice(-14).map(item => ({
      ...item,
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));
  }, [analytics.ordersOverTime]);

  // Format burn reasons for pie chart
  const burnReasonsData = useMemo(() => {
    return Object.entries(analytics.burnReasons).map(([name, value]) => ({
      name,
      value,
    }));
  }, [analytics.burnReasons]);

  // Format views by hour for bar chart
  const peakHoursData = useMemo(() => {
    return analytics.viewsByHour.map(item => ({
      ...item,
      label: `${item.hour}:00`,
    }));
  }, [analytics.viewsByHour]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Menu Analytics</h2>
          {(realtimeViews > 0 || realtimeOrders > 0) && (
            <Badge variant="outline" className="animate-pulse border-green-500 text-green-600">
              <Activity className="h-3 w-3 mr-1" />
              Live: +{realtimeViews} views, +{realtimeOrders} orders
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <AnalyticsExportButton
            data={getExportData()}
            filename={`menu-analytics-${new Date().toISOString().split('T')[0]}`}
          />
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Menus"
          value={analytics.totalMenus}
          icon={BarChart3}
          color="bg-violet-500"
        />
        <StatCard
          label="Active Menus"
          value={analytics.activeMenus}
          icon={Zap}
          color="bg-green-500"
        />
        <StatCard
          label="Burned Menus"
          value={analytics.burnedMenus}
          icon={Flame}
          color="bg-orange-500"
        />
        <StatCard
          label="Total Views"
          value={(analytics.totalViews).toLocaleString()}
          icon={Eye}
          color="bg-blue-500"
          subtitle={realtimeViews > 0 ? `+${realtimeViews} live` : undefined}
        />
        <StatCard
          label="Total Orders"
          value={analytics.totalOrders.toLocaleString()}
          icon={ShoppingCart}
          color="bg-emerald-500"
          subtitle={realtimeOrders > 0 ? `+${realtimeOrders} live` : undefined}
        />
        <StatCard
          label="Revenue"
          value={formatCurrency(analytics.totalRevenue)}
          icon={DollarSign}
          color="bg-amber-500"
        />
        <StatCard
          label="Conversion Rate"
          value={`${analytics.conversionRate.toFixed(1)}%`}
          icon={TrendingUp}
          color="bg-indigo-500"
        />
        <StatCard
          label="Avg Time to View"
          value={analytics.avgTimeToFirstView < 60
            ? `${analytics.avgTimeToFirstView.toFixed(0)}m`
            : `${(analytics.avgTimeToFirstView / 60).toFixed(1)}h`}
          icon={Clock}
          color="bg-pink-500"
          subtitle="First view after creation"
        />
      </div>

      {/* Charts Row 1: Views & Orders Over Time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Views Over Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-500" />
              Views Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {viewsChartData.some(d => d.views > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={viewsChartData}>
                  <defs>
                    <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS[4]} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS[4]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke={CHART_COLORS[4]}
                    strokeWidth={2}
                    fill="url(#viewsGradient)"
                    name="Views"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Eye className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No view data yet</p>
                  <p className="text-xs mt-1">Share menus with clients to see activity</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Orders & Revenue Over Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-emerald-500" />
              Orders & Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ordersChartData.some(d => d.orders > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={ordersChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, name: string) =>
                      name === 'Revenue' ? formatCurrency(value) : value
                    }
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="orders"
                    stroke={chartSemanticColors.success}
                    strokeWidth={2}
                    dot={{ fill: chartSemanticColors.success, r: 3 }}
                    name="Orders"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenue"
                    stroke={chartSemanticColors.cost}
                    strokeWidth={2}
                    dot={{ fill: chartSemanticColors.cost, r: 3 }}
                    name="Revenue"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No orders yet</p>
                  <p className="text-xs mt-1">Orders will appear as clients purchase</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Status Breakdown & Burn Reasons */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active vs Burned Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-violet-500" />
              Menu Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.menuStatusBreakdown.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={analytics.menuStatusBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {analytics.menuStatusBreakdown.map((entry, index) => (
                        <Cell key={`status-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-3 justify-center mt-2">
                  {analytics.menuStatusBreakdown.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-1.5 text-xs">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
                      />
                      <span className="text-muted-foreground">{item.name}: {item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                <p className="text-sm">No menus created yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Burn Reasons Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Burn Reasons
            </CardTitle>
          </CardHeader>
          <CardContent>
            {burnReasonsData.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={burnReasonsData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} (${(percent * 100).toFixed(0)}%)`
                      }
                      labelLine={false}
                    >
                      {burnReasonsData.map((_, index) => (
                        <Cell key={`burn-${index}`} fill={BURN_REASON_COLORS[index % BURN_REASON_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-3 justify-center mt-2">
                  {burnReasonsData.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-1.5 text-xs">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: BURN_REASON_COLORS[index % BURN_REASON_COLORS.length] }}
                      />
                      <span className="text-muted-foreground">{item.name}: {item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Flame className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No burned menus</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversion Funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-500" />
              Conversion Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.conversionFunnel[0].value > 0 ? (
              <div className="space-y-4 py-2">
                {analytics.conversionFunnel.map((stage, index) => (
                  <FunnelStage
                    key={stage.stage}
                    stage={stage.stage}
                    value={stage.value}
                    percentage={stage.percentage}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No funnel data yet</p>
                  <p className="text-xs mt-1">Data populates as menus are viewed</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3: Peak Hours & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Peak Access Hours */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-pink-500" />
              Peak Access Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            {peakHoursData.some(d => d.views > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={peakHoursData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="label"
                    className="text-xs"
                    tick={{ fontSize: 10 }}
                    interval={2}
                  />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    labelFormatter={(label) => `Hour: ${label}`}
                  />
                  <Bar dataKey="views" fill={CHART_COLORS[8]} radius={[4, 4, 0, 0]} name="Views" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No hourly data</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-500" />
              Top Products by Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.topProducts.length > 0 ? (
              <div className="space-y-3">
                {analytics.topProducts.slice(0, 7).map((product, idx) => {
                  const maxRevenue = analytics.topProducts[0]?.revenue || 1;
                  const widthPercent = (product.revenue / maxRevenue) * 100;
                  return (
                    <div key={product.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground w-5 shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="font-medium truncate">{product.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          <span className="text-xs text-muted-foreground">
                            {product.orders} sold
                          </span>
                          <span className="font-semibold text-emerald-600">
                            {formatCurrency(product.revenue)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all"
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No product data yet</p>
                  <p className="text-xs mt-1">Products appear after orders are placed</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Insights */}
      {analytics.totalViews > 0 && (
        <Card className="bg-gradient-to-r from-violet-500/5 via-indigo-500/5 to-purple-500/5 border-violet-500/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
                <Activity className="h-4 w-4 text-violet-600" />
              </div>
              <div className="space-y-1">
                <h4 className="font-medium text-sm">Key Insights</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>
                    Avg {analytics.avgViewsPerMenu.toFixed(1)} views per menu with a{' '}
                    {analytics.conversionRate.toFixed(1)}% conversion rate
                  </li>
                  {analytics.avgTimeToFirstView > 0 && (
                    <li>
                      Menus receive their first view on average{' '}
                      {analytics.avgTimeToFirstView < 60
                        ? `${analytics.avgTimeToFirstView.toFixed(0)} minutes`
                        : `${(analytics.avgTimeToFirstView / 60).toFixed(1)} hours`}{' '}
                      after creation
                    </li>
                  )}
                  {analytics.viewsByHour.length > 0 && (
                    <li>
                      Peak activity at{' '}
                      {analytics.viewsByHour.reduce((max, h) => h.views > max.views ? h : max, analytics.viewsByHour[0]).hour}:00
                      with {analytics.viewsByHour.reduce((max, h) => h.views > max.views ? h : max, analytics.viewsByHour[0]).views} views
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
