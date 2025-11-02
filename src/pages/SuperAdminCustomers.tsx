import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from '@/contexts/AccountContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, Building, DollarSign, Users, 
  Calendar, Eye, LogIn, ArrowLeft 
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function SuperAdminCustomers() {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: accountLoading } = useAccount();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountLoading && !isSuperAdmin) {
      navigate('/admin/dashboard');
    }
  }, [isSuperAdmin, accountLoading, navigate]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadAccounts();
    }
  }, [isSuperAdmin]);

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select(`
          *,
          plan:plans(name, price_monthly),
          locations:locations(count),
          team_members:profiles(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = accounts.filter(account =>
    account.company_name.toLowerCase().includes(search.toLowerCase()) ||
    account.slug.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'trial': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'past_due': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'suspended': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-muted text-muted-foreground border-border';
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
        title="Customer Management | Super Admin"
        description="Manage all customer accounts"
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Customer Accounts</h1>
              <p className="text-sm text-muted-foreground">{accounts.length} total customers</p>
            </div>
            <Button onClick={() => navigate('/signup')}>
              <Building className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by company name or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Accounts Grid */}
        <div className="grid gap-4">
          {filteredAccounts.map((account) => (
            <Card key={account.id} className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-xl">{account.company_name}</CardTitle>
                      <Badge className={getStatusColor(account.status)}>
                        {account.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">@{account.slug}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      ${account.plan?.price_monthly || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">/month</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Plan</p>
                      <p className="font-medium text-sm">{account.plan?.name || 'None'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Team</p>
                      <p className="font-medium text-sm">{account.team_members?.[0]?.count || 0} members</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Locations</p>
                      <p className="font-medium text-sm">{account.locations?.[0]?.count || 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Joined</p>
                      <p className="font-medium text-sm">
                        {format(new Date(account.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => navigate(`/super-admin/customers/${account.id}`)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={async () => {
                      if (!confirm(`Login as ${account.business_name || 'this account'}? This will create a temporary admin session.`)) {
                        return;
                      }
                      
                      try {
                        // In a real implementation, this would create a temporary session token
                        // and redirect to the tenant's dashboard
                        toast({
                          title: 'Session Created',
                          description: `Logging in as ${account.business_name}. Note: This is a simulated admin session.`
                        });
                        
                        // Store the original admin session for later restoration
                        sessionStorage.setItem('super_admin_session', 'true');
                        sessionStorage.setItem('impersonated_account_id', account.id);
                        
                        // In production, navigate to tenant dashboard
                        // navigate(`/admin/dashboard?impersonate=${account.id}`);
                      } catch (error: any) {
                        toast({
                          title: 'Login Failed',
                          description: error.message,
                          variant: 'destructive'
                        });
                      }
                    }}
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Login As
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredAccounts.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Building className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No customers found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
