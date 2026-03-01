import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Download, TrendingUp, Users, DollarSign, ShoppingBag,
  Award, Calendar, BarChart3
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { handleError } from "@/utils/errorHandling/handlers";
import { formatCurrency } from '@/lib/formatters';

export default function CustomerReports() {
  const { tenant, loading: tenantLoading } = useTenantAdminAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    newThisMonth: 0,
    activeCustomers: 0,
    atRiskCustomers: 0,
    medicalPatients: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    avgLifetimeValue: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    topCustomers: [] as any[]
  });

  useEffect(() => {
    if (tenant && !tenantLoading) {
      loadReports();
    } else if (!tenantLoading && !tenant) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, tenantLoading]);

  const loadReports = async () => {
    if (!tenant) return;

    try {
      setLoading(true);

      // Load all customers
      const { data: customers, error } = await supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', tenant.id);

      if (error) throw error;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      // Calculate stats
      const totalCustomers = customers?.length ?? 0;
      const newThisMonth = customers?.filter(c =>
        new Date(c.created_at) >= thirtyDaysAgo
      ).length ?? 0;
      const activeCustomers = customers?.filter(c => c.status === 'active').length ?? 0;
      const atRiskCustomers = customers?.filter(c => {
        if (!c.last_purchase_at) return false;
        return new Date(c.last_purchase_at) < sixtyDaysAgo;
      }).length ?? 0;
      const medicalPatients = customers?.filter(c => c.customer_type === 'medical').length ?? 0;
      const totalRevenue = customers?.reduce((sum, c) => sum + (c.total_spent ?? 0), 0) ?? 0;
      const avgLifetimeValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

      // Load orders to calculate avg order value
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('tenant_id', tenant.id);

      const avgOrderValue = orders && orders.length > 0
        ? orders.reduce((sum, o) => sum + (o.total_amount ?? 0), 0) / orders.length
        : 0;

      // Get top customers
      const topCustomers = customers
        ?.sort((a, b) => (b.total_spent ?? 0) - (a.total_spent ?? 0))
        .slice(0, 10) ?? [];

      setStats({
        totalCustomers,
        newThisMonth,
        activeCustomers,
        atRiskCustomers,
        medicalPatients,
        totalRevenue,
        avgOrderValue,
        avgLifetimeValue,
        topCustomers
      });

      toast.success('Reports loaded');
    } catch (error) {
      handleError(error, {
        component: 'CustomerReports.loadReports',
        toastTitle: 'Error',
        showToast: true
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = () => {
    const csv = [
      ['Metric', 'Value'],
      ['Total Customers', stats.totalCustomers],
      ['New This Month', stats.newThisMonth],
      ['Active Customers', stats.activeCustomers],
      ['At Risk Customers', stats.atRiskCustomers],
      ['Medical Patients', stats.medicalPatients],
      ['Total Revenue', formatCurrency(stats.totalRevenue)],
      ['Avg Order Value', formatCurrency(stats.avgOrderValue)],
      ['Avg Lifetime Value', formatCurrency(stats.avgLifetimeValue)],
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Report exported');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-zinc-900 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <SEOHead
          title="Customer Reports | Admin"
          description="Customer analytics and insights"
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Customer Reports & Analytics</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Insights into your customer base</p>
          </div>
          <Button
            onClick={handleExportReport}
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-4 gap-6">
          <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--tenant-text-light))]">Total Customers</CardTitle>
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono text-[hsl(var(--tenant-text))]">{stats.totalCustomers}</div>
              <p className="text-xs text-emerald-600 flex items-center gap-1 mt-2">
                <TrendingUp className="w-3 h-3" />
                +{stats.newThisMonth} this month
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--tenant-text-light))]">Active Customers</CardTitle>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <ShoppingBag className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono text-[hsl(var(--tenant-text))]">{stats.activeCustomers}</div>
              <p className="text-xs text-[hsl(var(--tenant-text-light))] mt-2">
                {stats.totalCustomers > 0 ? ((stats.activeCustomers / stats.totalCustomers) * 100).toFixed(1) : '0.0'}% of total
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--tenant-text-light))]">At Risk</CardTitle>
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Calendar className="h-5 w-5 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono text-red-600">{stats.atRiskCustomers}</div>
              <p className="text-xs text-[hsl(var(--tenant-text-light))] mt-2">60+ days since order</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--tenant-text-light))]">Medical Patients</CardTitle>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Award className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono text-[hsl(var(--tenant-text))]">{stats.medicalPatients}</div>
              <p className="text-xs text-[hsl(var(--tenant-text-light))] mt-2">
                {stats.totalCustomers > 0 ? ((stats.medicalPatients / stats.totalCustomers) * 100).toFixed(1) : '0.0'}% of total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Metrics */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--tenant-text-light))]">Total Revenue</CardTitle>
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono text-[hsl(var(--tenant-text))]">{formatCurrency(stats.totalRevenue)}</div>
              <p className="text-xs text-[hsl(var(--tenant-text-light))] mt-2">Lifetime value</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--tenant-text-light))]">Avg Order Value</CardTitle>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono text-[hsl(var(--tenant-text))]">{formatCurrency(stats.avgOrderValue)}</div>
              <p className="text-xs text-[hsl(var(--tenant-text-light))] mt-2">Per transaction</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--tenant-text-light))]">Avg Lifetime Value</CardTitle>
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono text-[hsl(var(--tenant-text))]">{formatCurrency(stats.avgLifetimeValue)}</div>
              <p className="text-xs text-[hsl(var(--tenant-text-light))] mt-2">Per customer</p>
            </CardContent>
          </Card>
        </div>

        {/* Top Customers */}
        <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-[hsl(var(--tenant-text))]">Top 10 Customers by Spend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topCustomers && stats.topCustomers.length > 0 ? (
                stats.topCustomers.map((customer, index) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">
                          {customer.first_name} {customer.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">{customer.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{formatCurrency(customer.total_spent)}</p>
                      <Badge variant="default">{customer.loyalty_tier}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No customer data available yet.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
