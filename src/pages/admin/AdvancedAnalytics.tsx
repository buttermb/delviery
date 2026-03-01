import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { handleError } from '@/utils/errorHandling/handlers';
import { isPostgrestError } from '@/utils/errorHandling/typeGuards';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { exportAnalyticsToCSV, exportAnalyticsToPDF, formatCurrencyForReport } from '@/lib/utils/analyticsExport';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';
import { CHART_COLORS } from '@/lib/chartColors';

export default function AdvancedAnalytics() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [isExporting, setIsExporting] = useState(false);

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: queryKeys.advancedAnalyticsOrders.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, order_items(*), customers(*)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1000);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data ?? [];
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') return [];
        handleError(error, { component: 'AdvancedAnalytics', toastTitle: 'Failed to load orders' });
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: queryKeys.advancedAnalyticsOrders.customers(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('customers')
          .select('id, customer_type, tenant_id')
          .eq('tenant_id', tenantId);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data ?? [];
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') return [];
        handleError(error, { component: 'AdvancedAnalytics', toastTitle: 'Failed to load customers' });
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  if (ordersLoading || customersLoading) {
    return (
      <div className="p-4 space-y-4">
        <div>
          <h1 className="text-xl font-bold">Advanced Analytics</h1>
          <p className="text-muted-foreground">Deep insights and business intelligence</p>
        </div>
        <EnhancedLoadingState variant="dashboard" />
      </div>
    );
  }

  const hasNoData = (!orders || orders.length === 0) && (!customers || customers.length === 0);

  if (hasNoData) {
    return (
      <div className="p-4 space-y-4">
        <div>
          <h1 className="text-xl font-bold">Advanced Analytics</h1>
          <p className="text-muted-foreground">Deep insights and business intelligence</p>
        </div>
        <EnhancedEmptyState
          type="no_analytics"
          title="No Analytics Data Available"
          description="Analytics will populate once you have orders and customers in the system."
        />
      </div>
    );
  }

  interface MonthlyRevenue { month: string; revenue: number; orders: number }
  const revenueByMonth = (orders ?? []).reduce((acc: MonthlyRevenue[], order) => {
    const month = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const existing = acc.find((item) => item.month === month);
    const revenue = parseFloat(String(order.total ?? 0));
    if (existing) {
      existing.revenue += revenue;
      existing.orders += 1;
    } else {
      acc.push({ month, revenue, orders: 1 });
    }
    return acc;
  }, []).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

  const customerSegments = (customers ?? []).reduce((acc: Record<string, number>, customer) => {
    const segment = customer.customer_type || 'regular';
    acc[segment] = (acc[segment] ?? 0) + 1;
    return acc;
  }, {});

  const segmentData = Object.entries(customerSegments).map(([name, value]) => ({
    name,
    value,
  }));

  // Calculate metrics for export
  const totalRevenue = revenueByMonth.reduce((sum: number, item: { revenue: number }) => sum + item.revenue, 0);
  const totalOrders = orders?.length ?? 0;
  const totalCustomers = customers?.length ?? 0;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Export handler
  const handleExport = (format: 'csv' | 'pdf') => {
    setIsExporting(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const reportData = {
        title: 'Advanced Analytics Report',
        dateRange: {
          start: thirtyDaysAgo,
          end: new Date(),
        },
        metrics: [
          { label: 'Total Revenue', value: formatCurrencyForReport(totalRevenue), change: 12.5 },
          { label: 'Total Orders', value: totalOrders.toLocaleString(), change: 8.2 },
          { label: 'Total Customers', value: totalCustomers.toLocaleString(), change: 5.1 },
          { label: 'Avg Order Value', value: formatCurrencyForReport(avgOrderValue), change: 3.4 },
        ],
        charts: [
          {
            title: 'Revenue by Month',
            data: revenueByMonth.map((item: { month: string; revenue: number; orders: number }) => ({
              label: item.month,
              value: item.revenue,
              orders: item.orders,
            })),
          },
        ],
        tables: [
          {
            title: 'Customer Segments',
            headers: ['Segment', 'Count', 'Percentage'],
            rows: segmentData.map((seg) => [
              seg.name,
              seg.value as number,
              `${((seg.value as number) / totalCustomers * 100).toFixed(1)}%`,
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
      handleError(error, { component: 'AdvancedAnalytics', toastTitle: 'Export failed' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Advanced Analytics</h1>
          <p className="text-muted-foreground">Deep insights and business intelligence</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={isExporting}>
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export Report'}
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

      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
              <CardDescription>Monthly revenue analysis</CardDescription>
            </CardHeader>
            <CardContent>
              {revenueByMonth.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke={CHART_COLORS[0]} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EnhancedEmptyState
                  type="no_analytics"
                  title="No Revenue Data Yet"
                  description="Revenue trends will appear here once you start processing orders."
                  compact
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Segments</CardTitle>
              <CardDescription>Customer distribution by type</CardDescription>
            </CardHeader>
            <CardContent>
              {segmentData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={segmentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill={CHART_COLORS[0]}
                      dataKey="value"
                    >
                      {segmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EnhancedEmptyState
                  type="no_customers"
                  title="No Customer Data Yet"
                  description="Customer segments will populate once customers start placing orders."
                  compact
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Product Performance</CardTitle>
              <CardDescription>Product sales and popularity</CardDescription>
            </CardHeader>
            <CardContent>
              <EnhancedEmptyState
                type="no_analytics"
                title="No Product Data Yet"
                description="Product analytics will appear here once product sales data is available."
                compact
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
