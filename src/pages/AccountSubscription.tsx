import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CreditCard, Package, Users, MapPin,
  Calendar, DollarSign, TrendingUp, ArrowLeft
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function AccountSubscription() {
  const navigate = useNavigate();
  const { account, accountSettings, userProfile, loading: accountLoading } = useAccount();
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [usage, setUsage] = useState({
    locations: 0,
    products: 0,
    teamMembers: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountLoading && account) {
      loadSubscriptionData();
    }
  }, [account, accountLoading]);

  const loadSubscriptionData = async () => {
    if (!account) return;

    try {
      // Get subscription
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('*, plan:plans(*)')
        .eq('account_id', account.id)
        .single();

      if (subData) {
        setSubscription(subData);
        setPlan(subData.plan);
      }

      // Get usage counts (temporary hardcoded for demo)
      // TODO: Implement proper usage tracking
      setUsage({
        locations: 1,
        products: 25,
        teamMembers: 3
      });
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'trial': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
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
        title="My Subscription | Account"
        description="Manage your subscription and billing"
      />

      {/* Header */}
      <div className="border-b border-border/40 bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
          <h1 className="text-2xl font-bold">My Subscription</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Current Plan */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl mb-2">{plan?.name || 'No Plan'}</CardTitle>
                <Badge className={getStatusColor(account?.status || 'trial')}>
                  {account?.status || 'trial'}
                </Badge>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">
                  ${plan?.price_monthly || 0}
                </div>
                <p className="text-sm text-muted-foreground">/month</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {subscription && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Current period:</span>
                  <span className="font-medium">
                    {format(new Date(subscription.current_period_start), 'MMM d')} - {' '}
                    {format(new Date(subscription.current_period_end), 'MMM d, yyyy')}
                  </span>
                </div>

                {account?.trial_ends_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Trial ends:</span>
                    <span className="font-medium">
                      {format(new Date(account.trial_ends_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button onClick={() => navigate('/pricing')}>
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Upgrade Plan
                  </Button>
                  <Button variant="outline">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Update Payment
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Locations</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usage.locations} / {plan?.max_locations || '∞'}
                </span>
              </div>
              <Progress 
                value={plan?.max_locations ? (usage.locations / plan.max_locations) * 100 : 0} 
                className="h-2"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Products</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usage.products} / {plan?.max_products || '∞'}
                </span>
              </div>
              <Progress 
                value={plan?.max_products ? (usage.products / plan.max_products) * 100 : 0} 
                className="h-2"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Team Members</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usage.teamMembers} / {plan?.max_team_members || '∞'}
                </span>
              </div>
              <Progress 
                value={plan?.max_team_members ? (usage.teamMembers / plan.max_team_members) * 100 : 0} 
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>

        {/* Billing History */}
        <Card>
          <CardHeader>
            <CardTitle>Billing History</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No invoices yet</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
