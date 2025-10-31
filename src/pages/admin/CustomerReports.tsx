import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from '@/contexts/AccountContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Download, TrendingUp, Users, DollarSign, ShoppingBag, 
  Award, Calendar, BarChart3 
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';

export default function CustomerReports() {
  const { account } = useAccount();
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
    topCustomers: [] as any[]
  });

  useEffect(() => {
    if (account) {
      loadReports();
    }
  }, [account]);

  const loadReports = async () => {
    if (!account) return;

    try {
      setLoading(true);

      // Load all customers
      const { data: customers, error } = await supabase
        .from('customers')
        .select('*')
        .eq('account_id', account.id);

      if (error) throw error;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      // Calculate stats
      const totalCustomers = customers?.length || 0;
      const newThisMonth = customers?.filter(c => 
        new Date(c.created_at) >= thirtyDaysAgo
      ).length || 0;
      const activeCustomers = customers?.filter(c => c.status === 'active').length || 0;
      const atRiskCustomers = customers?.filter(c => {
        if (!c.last_purchase_at) return false;
        return new Date(c.last_purchase_at) < sixtyDaysAgo;
      }).length || 0;
      const medicalPatients = customers?.filter(c => c.customer_type === 'medical').length || 0;
      const totalRevenue = customers?.reduce((sum, c) => sum + (c.total_spent || 0), 0) || 0;
      const avgLifetimeValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

      // Load orders to calculate avg order value
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('account_id', account.id);

      const avgOrderValue = orders && orders.length > 0
        ? orders.reduce((sum, o) => sum + (o.total_amount || 0), 0) / orders.length
        : 0;

      // Get top customers
      const topCustomers = customers
        ?.sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0))
        .slice(0, 10) || [];

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
    } catch (error: any) {
      console.error('Error loading reports:', error);
      toast.error('Failed to load reports');
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
      ['Total Revenue', `$${stats.totalRevenue.toFixed(2)}`],
      ['Avg Order Value', `$${stats.avgOrderValue.toFixed(2)}`],
      ['Avg Lifetime Value', `$${stats.avgLifetimeValue.toFixed(2)}`],
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
    <div className="space-y-6">
      <SEOHead 
        title="Customer Reports | Admin"
        description="Customer analytics and insights"
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customer Reports & Analytics</h1>
          <p className="text-muted-foreground">Insights into your customer base</p>
        </div>
        <Button onClick={handleExportReport}>
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +{stats.newThisMonth} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCustomers}</div>
            <p className="text-xs text-muted-foreground">
              {((stats.activeCustomers / stats.totalCustomers) * 100).toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">At Risk</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.atRiskCustomers}</div>
            <p className="text-xs text-muted-foreground">60+ days since order</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Medical Patients</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.medicalPatients}</div>
            <p className="text-xs text-muted-foreground">
              {((stats.medicalPatients / stats.totalCustomers) * 100).toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Metrics */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Lifetime value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.avgOrderValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Per transaction</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Lifetime Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.avgLifetimeValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Per customer</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Customers */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Customers by Spend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.topCustomers.map((customer, index) => (
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
                  <p className="font-bold text-lg">${customer.total_spent?.toFixed(2)}</p>
                  <Badge variant="default">{customer.loyalty_tier}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
