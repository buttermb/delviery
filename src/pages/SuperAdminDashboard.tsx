import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from '@/contexts/AccountContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, DollarSign, TrendingUp, AlertCircle, 
  Building, Package, CreditCard, LogOut 
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { toast } from 'sonner';

interface DashboardMetrics {
  totalCustomers: number;
  activeCustomers: number;
  trialCustomers: number;
  mrr: number;
  churnRate: number;
  newSignupsThisMonth: number;
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isSuperAdmin, loading: accountLoading } = useAccount();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalCustomers: 0,
    activeCustomers: 0,
    trialCustomers: 0,
    mrr: 0,
    churnRate: 0,
    newSignupsThisMonth: 0
  });
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountLoading && !isSuperAdmin && user) {
      navigate('/admin/dashboard');
    }
  }, [isSuperAdmin, accountLoading, user, navigate]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadDashboardData();
    }
  }, [isSuperAdmin]);

  const loadDashboardData = async () => {
    try {
      // Get all accounts with their plans
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select(`
          *,
          plan:plans(name, price_monthly)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (accountsError) throw accountsError;

      if (accountsData) {
        setAccounts(accountsData);

        // Calculate metrics
        const active = accountsData.filter(a => a.status === 'active').length;
        const trial = accountsData.filter(a => a.status === 'trial').length;
        const totalMrr = accountsData
          .filter(a => a.status === 'active')
          .reduce((sum, a: any) => sum + ((a.mrr as number) || (a.plan?.price_monthly as number) || 0), 0);

        const now = new Date();
        const newThisMonth = accountsData.filter(a => {
          const created = new Date(a.created_at);
          return created.getMonth() === now.getMonth() && 
                 created.getFullYear() === now.getFullYear();
        }).length;

        setMetrics({
          totalCustomers: accountsData.length,
          activeCustomers: active,
          trialCustomers: trial,
          mrr: totalMrr,
          churnRate: 0, // TODO: Calculate from historical data
          newSignupsThisMonth: newThisMonth
        });
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const loginAsAccount = async (accountId: string) => {
    // TODO: Implement login as functionality
    console.log('Login as account:', accountId);
  };

  if (accountLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title="Super Admin Dashboard | BuddasH Platform"
        description="Platform administration and customer management"
      />

      {/* Header */}
      <div className="border-b border-border/40 bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Platform Management</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Metrics Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.totalCustomers}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.newSignupsThisMonth} new this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">MRR</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${metrics.mrr.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Monthly Recurring Revenue
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.activeCustomers}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.trialCustomers} on trial
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.churnRate}%</div>
              <p className="text-xs text-muted-foreground">
                Last 30 days
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Button onClick={() => navigate('/super-admin/customers')} className="h-20">
            <Users className="mr-2 h-5 w-5" />
            Manage Customers
          </Button>
          <Button onClick={() => navigate('/super-admin/subscriptions')} variant="outline" className="h-20">
            <CreditCard className="mr-2 h-5 w-5" />
            Subscriptions
          </Button>
          <Button onClick={() => navigate('/super-admin/support')} variant="outline" className="h-20">
            <Package className="mr-2 h-5 w-5" />
            Support Tickets
          </Button>
          <Button onClick={() => navigate('/super-admin/analytics')} variant="outline" className="h-20">
            <TrendingUp className="mr-2 h-5 w-5" />
            Analytics
          </Button>
        </div>

        {/* Recent Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Customer Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-semibold">{account.company_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {account.plan?.name || 'No plan'} • ${((account as any).mrr || account.plan?.price_monthly || 0).toFixed(2)}/mo
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Status: <span className={`font-medium ${
                        account.status === 'active' ? 'text-green-600 dark:text-green-400' :
                        account.status === 'trial' ? 'text-blue-600 dark:text-blue-400' :
                        'text-gray-600 dark:text-gray-400'
                      }`}>{account.status}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate(`/super-admin/customers/${account.id}`)}
                    >
                      View Details
                    </Button>
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={() => loginAsAccount(account.id)}
                    >
                      Login As
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button 
              variant="link" 
              className="w-full mt-4"
              onClick={() => navigate('/super-admin/customers')}
            >
              View All Customers →
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
