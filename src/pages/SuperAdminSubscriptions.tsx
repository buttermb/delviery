import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, DollarSign, TrendingUp, AlertCircle,
  Calendar, ArrowLeft, Clock
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { format } from 'date-fns';

export default function SuperAdminSubscriptions() {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: accountLoading } = useAccount();
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    activeSubscriptions: 0,
    mrr: 0,
    pastDue: 0,
    cancelledThisMonth: 0
  });

  useEffect(() => {
    if (!accountLoading && !isSuperAdmin) {
      navigate('/admin/dashboard');
    }
  }, [isSuperAdmin, accountLoading, navigate]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadSubscriptions();
    }
  }, [isSuperAdmin]);

  const loadSubscriptions = async () => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          account:accounts(id, company_name, slug),
          plan:plans(name, price_monthly)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSubscriptions(data || []);

      // Calculate metrics
      const active = data?.filter(s => s.status === 'active').length || 0;
      const mrr = data?.filter(s => s.status === 'active')
        .reduce((sum, s) => sum + (s.plan?.price_monthly || 0), 0) || 0;
      const pastDue = data?.filter(s => s.status === 'past_due').length || 0;
      const cancelledThisMonth = data?.filter(s => {
        if (!s.cancelled_at) return false;
        const cancelled = new Date(s.cancelled_at);
        const now = new Date();
        return cancelled.getMonth() === now.getMonth() && 
               cancelled.getFullYear() === now.getFullYear();
      }).length || 0;

      setMetrics({
        activeSubscriptions: active,
        mrr,
        pastDue,
        cancelledThisMonth
      });
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'past_due': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-600 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
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
        title="Subscription Management | Super Admin"
        description="Manage customer subscriptions and billing"
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
          <h1 className="text-2xl font-bold">Subscription Management</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Metrics */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.activeSubscriptions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">MRR</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${metrics.mrr.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Past Due</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.pastDue}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Cancelled This Month</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.cancelledThisMonth}</div>
            </CardContent>
          </Card>
        </div>

        {/* Subscriptions List */}
        <div className="grid gap-4">
          {subscriptions.map((sub) => (
            <Card key={sub.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{sub.account?.company_name}</h3>
                      <Badge className={getStatusColor(sub.status)}>
                        {sub.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">@{sub.account?.slug}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      ${sub.plan?.price_monthly || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">/month</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Plan</p>
                    <p className="font-medium">{sub.plan?.name || 'None'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Current Period</p>
                    <p className="font-medium">
                      {sub.current_period_start && format(new Date(sub.current_period_start), 'MMM d')} - {' '}
                      {sub.current_period_end && format(new Date(sub.current_period_end), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Started</p>
                    <p className="font-medium">
                      {format(new Date(sub.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  {sub.cancelled_at && (
                    <div>
                      <p className="text-muted-foreground">Cancelled</p>
                      <p className="font-medium text-red-600">
                        {format(new Date(sub.cancelled_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/super-admin/customers/${sub.account?.id}`)}
                  >
                    View Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
