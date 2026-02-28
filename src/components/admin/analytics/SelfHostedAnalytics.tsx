/**
 * Self-Hosted Analytics Component
 * Inspired by Plausible, Umami, and Matomo
 * Privacy-friendly analytics without external services
 *
 * Connected to all data sources: Orders, Inventory, Customers, Finance
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  BarChart,
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  Calendar,
  Download,
  FileText,
  FileSpreadsheet,
  ShoppingCart,
  DollarSign,
  Package,
  Layers,
  AlertTriangle,
  ArrowUpRight,
} from 'lucide-react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { exportAnalyticsToCSV, exportAnalyticsToPDF, formatNumberForReport } from '@/lib/utils/analyticsExport';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import {
  BarChart as RechartsBarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useAnalyticsData, type UnifiedAnalyticsData } from '@/hooks/useAnalyticsData';
import { format } from 'date-fns';
import { formatCurrency, formatCompactCurrency } from '@/lib/formatters';
import { CHART_COLORS } from '@/lib/chartColors';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
  trendLabel?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

function MetricCard({ title, value, icon, trend, trendLabel, variant = 'default' }: MetricCardProps) {
  const variantStyles = {
    default: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-destructive',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
          </div>
          <div className={`opacity-50 ${variantStyles[variant]}`}>
            {icon}
          </div>
        </div>
        {trend !== undefined && (
          <div className="mt-4">
            <Badge
              variant="outline"
              className={trend >= 0 ? 'text-success border-success' : 'text-destructive border-destructive'}
            >
              {trend >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
              {trendLabel && <span className="ml-1 text-muted-foreground">{trendLabel}</span>}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OrdersTab({ data }: { data: UnifiedAnalyticsData }) {
  const { orders } = data;

  const orderTypeData = [
    { name: 'Retail', value: orders.ordersByType.retail, color: CHART_COLORS[0] },
    { name: 'Wholesale', value: orders.ordersByType.wholesale, color: CHART_COLORS[1] },
    { name: 'Menu', value: orders.ordersByType.menu, color: CHART_COLORS[2] },
    { name: 'POS', value: orders.ordersByType.pos, color: CHART_COLORS[3] },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Orders"
          value={orders.totalOrders}
          icon={<ShoppingCart className="h-8 w-8" />}
          variant="default"
        />
        <MetricCard
          title="Pending Orders"
          value={orders.pendingOrders}
          icon={<Eye className="h-8 w-8" />}
          variant={orders.pendingOrders > 10 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(orders.totalRevenue)}
          icon={<DollarSign className="h-8 w-8" />}
          variant="success"
        />
        <MetricCard
          title="Avg Order Value"
          value={formatCurrency(orders.averageOrderValue)}
          icon={<TrendingUp className="h-8 w-8" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Daily Orders & Revenue</CardTitle>
            <CardDescription>Orders and revenue over the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={orders.dailyOrders}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => format(new Date(value), 'MMM d')}
                />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} tickFormatter={(v) => formatCompactCurrency(v)} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === 'revenue' ? formatCurrency(value) : value,
                    name === 'revenue' ? 'Revenue' : 'Orders',
                  ]}
                  labelFormatter={(label) => format(new Date(label), 'MMM d, yyyy')}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="count"
                  stroke={CHART_COLORS[1]}
                  strokeWidth={2}
                  name="Orders"
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenue"
                  stroke={CHART_COLORS[0]}
                  strokeWidth={2}
                  name="Revenue"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders by Type</CardTitle>
            <CardDescription>Distribution of order types</CardDescription>
          </CardHeader>
          <CardContent>
            {orderTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={orderTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill={CHART_COLORS[0]}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {orderTypeData.map((entry) => (
                      <Cell key={`cell-${entry.name}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No order data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Orders by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Object.entries(orders.ordersByStatus).map(([status, count]) => (
              <div key={status} className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-sm text-muted-foreground capitalize">{status.replace('_', ' ')}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InventoryTab({ data }: { data: UnifiedAnalyticsData }) {
  const { inventory } = data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Products"
          value={inventory.totalProducts}
          icon={<Package className="h-8 w-8" />}
        />
        <MetricCard
          title="Active Products"
          value={inventory.activeProducts}
          icon={<Layers className="h-8 w-8" />}
          variant="success"
        />
        <MetricCard
          title="Low Stock Items"
          value={inventory.lowStockProducts}
          icon={<AlertTriangle className="h-8 w-8" />}
          variant={inventory.lowStockProducts > 5 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Total Stock Value"
          value={formatCurrency(inventory.totalStockValue)}
          icon={<DollarSign className="h-8 w-8" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Top Products by Stock</CardTitle>
            <CardDescription>Products with the most inventory</CardDescription>
          </CardHeader>
          <CardContent>
            {inventory.topProducts.length > 0 ? (
              <div className="space-y-3">
                {inventory.topProducts.slice(0, 8).map((product, index) => {
                  const stockPercentage = Math.min(100, (product.stockQuantity / (product.lowStockAlert * 5)) * 100);
                  const isLowStock = product.stockQuantity <= product.lowStockAlert;

                  return (
                    <div key={product.id} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground w-5">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate">{product.name}</span>
                          <span className={`text-sm ${isLowStock ? 'text-warning' : 'text-muted-foreground'}`}>
                            {product.stockQuantity} units
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isLowStock ? 'bg-warning' : 'bg-success'}`}
                            style={{ width: `${stockPercentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                No product data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory by Category</CardTitle>
            <CardDescription>Stock value distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {inventory.categoryBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsBarChart data={inventory.categoryBreakdown.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => formatCompactCurrency(v)} />
                  <YAxis type="category" dataKey="category" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), 'Value']} />
                  <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No category data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {inventory.outOfStockProducts > 0 && (
        <Card className="border-warning">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-warning" />
              <div>
                <p className="font-medium">Out of Stock Alert</p>
                <p className="text-sm text-muted-foreground">
                  {inventory.outOfStockProducts} {inventory.outOfStockProducts === 1 ? 'product is' : 'products are'} currently out of stock
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CustomersTab({ data }: { data: UnifiedAnalyticsData }) {
  const { customers } = data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Customers"
          value={customers.totalCustomers}
          icon={<Users className="h-8 w-8" />}
        />
        <MetricCard
          title="New Customers"
          value={customers.newCustomers}
          icon={<ArrowUpRight className="h-8 w-8" />}
          variant="success"
        />
        <MetricCard
          title="Active Customers"
          value={customers.activeCustomers}
          icon={<Eye className="h-8 w-8" />}
        />
        <MetricCard
          title="Retention Rate"
          value={`${customers.retentionRate}%`}
          icon={<TrendingUp className="h-8 w-8" />}
          variant={customers.retentionRate >= 50 ? 'success' : 'warning'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Customer Growth</CardTitle>
            <CardDescription>New customer acquisitions over time</CardDescription>
          </CardHeader>
          <CardContent>
            {customers.customerGrowth.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={customers.customerGrowth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => format(new Date(value), 'MMM d')}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip labelFormatter={(label) => format(new Date(label), 'MMM d, yyyy')} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="totalCustomers"
                    stroke={CHART_COLORS[0]}
                    strokeWidth={2}
                    name="Total Customers"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="newCustomers"
                    stroke={CHART_COLORS[1]}
                    strokeWidth={2}
                    name="New Customers"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No growth data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Customers by Spend</CardTitle>
            <CardDescription>Highest value customers</CardDescription>
          </CardHeader>
          <CardContent>
            {customers.topCustomers.length > 0 ? (
              <div className="space-y-3">
                {customers.topCustomers.slice(0, 8).map((customer, index) => (
                  <div key={customer.id} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground w-5">{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{customer.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{customer.email}</p>
                        </div>
                        <div className="text-right ml-2">
                          <p className="text-sm font-medium">{formatCurrency(customer.totalSpent)}</p>
                          <p className="text-xs text-muted-foreground">{customer.orderCount} {customer.orderCount === 1 ? 'order' : 'orders'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                No customer data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Segments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(customers.customersBySegment).map(([segment, count]) => (
              <div key={segment} className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-sm text-muted-foreground">{segment}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FinanceTab({ data }: { data: UnifiedAnalyticsData }) {
  const { finance } = data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Today's Revenue"
          value={formatCurrency(finance.todayRevenue)}
          icon={<DollarSign className="h-8 w-8" />}
          variant="success"
        />
        <MetricCard
          title="Week Revenue"
          value={formatCurrency(finance.weekRevenue)}
          icon={<Calendar className="h-8 w-8" />}
        />
        <MetricCard
          title="Month Revenue"
          value={formatCurrency(finance.monthRevenue)}
          icon={<TrendingUp className="h-8 w-8" />}
        />
        <MetricCard
          title="Outstanding Balance"
          value={formatCurrency(finance.totalOutstanding)}
          icon={<AlertTriangle className="h-8 w-8" />}
          variant={finance.totalOutstanding > 10000 ? 'warning' : 'default'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Revenue & Profit</CardTitle>
            <CardDescription>Daily revenue breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {finance.revenueByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsBarChart data={finance.revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => format(new Date(value), 'MMM d')}
                  />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatCompactCurrency(v)} />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    labelFormatter={(label) => format(new Date(label), 'MMM d, yyyy')}
                  />
                  <Legend />
                  <Bar dataKey="revenue" fill={CHART_COLORS[0]} name="Revenue" stackId="a" />
                  <Bar dataKey="cost" fill={CHART_COLORS[3]} name="Cost" stackId="b" />
                  <Bar dataKey="profit" fill={CHART_COLORS[1]} name="Profit" stackId="b" />
                </RechartsBarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No revenue data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cash Flow Summary</CardTitle>
            <CardDescription>Collections and expected payments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-success/10">
                <div className="flex items-center gap-3">
                  <ArrowUpRight className="h-5 w-5 text-success" />
                  <div>
                    <p className="font-medium">Collections Today</p>
                    <p className="text-sm text-muted-foreground">Payments received</p>
                  </div>
                </div>
                <p className="text-xl font-bold text-success">{formatCurrency(finance.collectionsToday)}</p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-info/10">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-info" />
                  <div>
                    <p className="font-medium">Expected This Week</p>
                    <p className="text-sm text-muted-foreground">From pending orders</p>
                  </div>
                </div>
                <p className="text-xl font-bold text-info">{formatCurrency(finance.expectedThisWeek)}</p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-warning/10">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <div>
                    <p className="font-medium">Total Outstanding</p>
                    <p className="text-sm text-muted-foreground">Unpaid balances</p>
                  </div>
                </div>
                <p className="text-xl font-bold text-warning">{formatCurrency(finance.totalOutstanding)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {finance.overdueAccounts.length > 0 && (
        <Card className="border-warning">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Overdue Accounts
            </CardTitle>
            <CardDescription>Accounts past their payment terms</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {finance.overdueAccounts.map((account, index) => (
                <div key={account.clientId} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center text-warning font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{account.clientName}</p>
                      <p className="text-sm text-muted-foreground">
                        {account.daysPastDue} days overdue
                      </p>
                    </div>
                  </div>
                  <p className="font-bold text-warning">{formatCurrency(account.amount)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function SelfHostedAnalytics() {
  useTenantAdminAuth(); // Verify tenant admin context is available
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Use the unified analytics data hook
  const { data: analytics, isLoading, error } = useAnalyticsData();

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !analytics) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Failed to load analytics data</p>
            <p className="text-sm">Please try refreshing the page</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) return null;

  // Export handler
  const handleExport = (format: 'csv' | 'pdf') => {
    if (!analytics) return;

    setIsExporting(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const reportData = {
        title: 'Analytics Dashboard Report',
        dateRange: {
          start: thirtyDaysAgo,
          end: new Date(),
        },
        metrics: [
          { label: 'Total Revenue', value: `$${formatNumberForReport(analytics.orders.totalRevenue)}`, change: 12.5 },
          { label: 'Total Orders', value: formatNumberForReport(analytics.orders.totalOrders), change: 8.2 },
          { label: 'Total Customers', value: formatNumberForReport(analytics.customers.totalCustomers), change: 5.1 },
          { label: 'Active Products', value: formatNumberForReport(analytics.inventory.activeProducts) },
        ],
        charts: [
          {
            title: 'Daily Orders',
            data: analytics.orders.dailyOrders.map((stat) => ({
              label: stat.date,
              value: stat.count,
              revenue: stat.revenue,
            })),
          },
        ],
        tables: [
          {
            title: 'Top Products',
            headers: ['Product', 'Stock', 'Alert Level'],
            rows: analytics.inventory.topProducts.map((product) => [
              product.name,
              product.stockQuantity,
              product.lowStockAlert,
            ]),
          },
          {
            title: 'Top Customers',
            headers: ['Customer', 'Orders', 'Total Spent'],
            rows: analytics.customers.topCustomers.map((customer) => [
              customer.name,
              customer.orderCount,
              formatCurrency(customer.totalSpent),
            ]),
          },
        ],
      };

      if (format === 'csv') {
        exportAnalyticsToCSV(reportData);
        toast.success('CSV report downloaded successfully');
      } else {
        exportAnalyticsToPDF(reportData);
        toast.success('PDF report downloaded successfully');
      }
    } catch (error) {
      toast.error('Failed to export report', { description: humanizeError(error) });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart className="h-6 w-6" />
            Analytics Dashboard
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Privacy-friendly analytics - all data stored locally
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isExporting}>
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export Data'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport('csv')}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('pdf')}>
              <FileText className="h-4 w-4 mr-2" />
              Export as PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Orders</span>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Inventory</span>
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Customers</span>
          </TabsTrigger>
          <TabsTrigger value="finance" className="gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Finance</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Revenue"
              value={formatCurrency(analytics.orders.totalRevenue)}
              icon={<DollarSign className="h-8 w-8" />}
              variant="success"
            />
            <MetricCard
              title="Total Orders"
              value={analytics.orders.totalOrders}
              icon={<ShoppingCart className="h-8 w-8" />}
            />
            <MetricCard
              title="Total Customers"
              value={analytics.customers.totalCustomers}
              icon={<Users className="h-8 w-8" />}
            />
            <MetricCard
              title="Active Products"
              value={analytics.inventory.activeProducts}
              icon={<Package className="h-8 w-8" />}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Daily Revenue (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.orders.dailyOrders}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => format(new Date(value), 'MMM d')}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => formatCompactCurrency(v)}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                      labelFormatter={(label) => format(new Date(label), 'MMM d, yyyy')}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke={CHART_COLORS[0]}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Orders by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsBarChart
                    data={[
                      { type: 'Retail', count: analytics.orders.ordersByType.retail },
                      { type: 'Wholesale', count: analytics.orders.ordersByType.wholesale },
                      { type: 'Menu', count: analytics.orders.ordersByType.menu },
                      { type: 'POS', count: analytics.orders.ordersByType.pos },
                    ].filter(d => d.count > 0)}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Inventory Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Low Stock</span>
                    <Badge variant={analytics.inventory.lowStockProducts > 5 ? 'destructive' : 'secondary'}>
                      {analytics.inventory.lowStockProducts}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Out of Stock</span>
                    <Badge variant={analytics.inventory.outOfStockProducts > 0 ? 'destructive' : 'secondary'}>
                      {analytics.inventory.outOfStockProducts}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Customer Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">New (30d)</span>
                    <Badge variant="secondary">{analytics.customers.newCustomers}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Retention Rate</span>
                    <Badge variant={analytics.customers.retentionRate >= 50 ? 'default' : 'destructive'}>
                      {analytics.customers.retentionRate}%
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Financial Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Outstanding</span>
                    <Badge variant={analytics.finance.totalOutstanding > 10000 ? 'destructive' : 'secondary'}>
                      {formatCurrency(analytics.finance.totalOutstanding)}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Overdue Accounts</span>
                    <Badge variant={analytics.finance.overdueAccounts.length > 0 ? 'destructive' : 'secondary'}>
                      {analytics.finance.overdueAccounts.length}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <OrdersTab data={analytics} />
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory">
          <InventoryTab data={analytics} />
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers">
          <CustomersTab data={analytics} />
        </TabsContent>

        {/* Finance Tab */}
        <TabsContent value="finance">
          <FinanceTab data={analytics} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
