import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, Users, DollarSign, Target,
  ArrowLeft, Activity
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';

export default function SuperAdminAnalytics() {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: accountLoading } = useAccount();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    newCustomers: 0,
    churnRate: 0,
    avgRevPerCustomer: 0,
    customerGrowth: 0,
    revenueGrowth: 0
  });

  useEffect(() => {
    if (!accountLoading && !isSuperAdmin) {
      navigate('/admin/dashboard');
    }
  }, [isSuperAdmin, accountLoading, navigate]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadAnalytics();
    }
  }, [isSuperAdmin]);

  const loadAnalytics = async () => {
    try {
      // Get accounts
      const { data: accounts } = await supabase
        .from('accounts')
        .select('*');

      // Get subscriptions
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select(`
          *,
          plan:plans(price_monthly)
        `)
        .eq('status', 'active');

      // Calculate metrics
      const totalRevenue = subscriptions?.reduce((sum, s) => 
        sum + (s.plan?.price_monthly || 0), 0) || 0;
      
      const newCustomersThisMonth = accounts?.filter(a => {
        const created = new Date(a.created_at);
        const now = new Date();
        return created.getMonth() === now.getMonth() && 
               created.getFullYear() === now.getFullYear();
      }).length || 0;

      const avgRevPerCustomer = accounts && accounts.length > 0 
        ? totalRevenue / accounts.length 
        : 0;

      setMetrics({
        totalRevenue: totalRevenue * 12, // ARR
        newCustomers: newCustomersThisMonth,
        churnRate: 2.5, // TODO: Calculate from data
        avgRevPerCustomer,
        customerGrowth: 15.5, // TODO: Calculate from data
        revenueGrowth: 23.2 // TODO: Calculate from data
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (accountLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title="Platform Analytics | Super Admin"
        description="Platform-wide analytics and insights"
      />

      {/* Header */}
      <div className="border-b border-border/40 bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/super-admin/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
          <h1 className="text-2xl font-bold">Platform Analytics</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Key Metrics */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total ARR</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${metrics.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-green-600">+{metrics.revenueGrowth}%</span> from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">New Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.newCustomers}</div>
              <p className="text-xs text-muted-foreground mt-1">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.churnRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Revenue Per Customer</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${metrics.avgRevPerCustomer.toFixed(0)}</div>
              <p className="text-xs text-muted-foreground mt-1">Monthly</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Customer Growth</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">+{metrics.customerGrowth}%</div>
              <p className="text-xs text-muted-foreground mt-1">Month over month</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              Revenue chart coming soon
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
