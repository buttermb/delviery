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
  const { account, loading: accountLoading } = useAccount();
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
    if (account && !accountLoading) {
      loadReports();
    } else if (!accountLoading && !account) {
      setLoading(false);
    }
  }, [account, accountLoading]);

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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <SEOHead 
          title="Customer Reports | Admin"
          description="Customer analytics and insights"
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Customer Reports & Analytics</h1>
            <p className="text-gray-500 mt-1">Insights into your customer base</p>
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
          <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total Customers</CardTitle>
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono text-gray-900">{stats.totalCustomers}</div>
              <p className="text-xs text-emerald-600 flex items-center gap-1 mt-2">
                <TrendingUp className="w-3 h-3" />
                +{stats.newThisMonth} this month
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Active Customers</CardTitle>
              <div className="p-2 bg-blue-100 rounded-lg">
                <ShoppingBag className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono text-gray-900">{stats.activeCustomers}</div>
              <p className="text-xs text-gray-500 mt-2">
                {((stats.activeCustomers / stats.totalCustomers) * 100).toFixed(1)}% of total
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">At Risk</CardTitle>
              <div className="p-2 bg-amber-100 rounded-lg">
                <Calendar className="h-5 w-5 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono text-red-600">{stats.atRiskCustomers}</div>
              <p className="text-xs text-gray-500 mt-2">60+ days since order</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Medical Patients</CardTitle>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Award className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono text-gray-900">{stats.medicalPatients}</div>
              <p className="text-xs text-gray-500 mt-2">
                {((stats.medicalPatients / stats.totalCustomers) * 100).toFixed(1)}% of total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Metrics */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total Revenue</CardTitle>
              <div className="p-2 bg-emerald-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono text-gray-900">${stats.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-2">Lifetime value</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Avg Order Value</CardTitle>
              <div className="p-2 bg-blue-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono text-gray-900">${stats.avgOrderValue.toFixed(2)}</div>
              <p className="text-xs text-gray-500 mt-2">Per transaction</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Avg Lifetime Value</CardTitle>
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono text-gray-900">${stats.avgLifetimeValue.toFixed(2)}</div>
              <p className="text-xs text-gray-500 mt-2">Per customer</p>
            </CardContent>
          </Card>
        </div>

        {/* Top Customers */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Top 10 Customers by Spend</CardTitle>
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
    </div>
  );
}
