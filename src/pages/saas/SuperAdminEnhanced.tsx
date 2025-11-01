/**
 * Enhanced Super Admin Dashboard
 * Complete platform control center with all metrics and tools
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DollarSign,
  Building2,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CreditCard,
  Ticket,
  Users,
  Activity,
  BarChart3,
  Settings,
  Search,
  Filter,
  Download,
  Plus,
  Eye,
  LogIn,
  MoreVertical,
  Mail,
  Bell,
  Shield,
  Zap,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { calculateHealthScore } from '@/lib/tenant';

interface PlatformStats {
  mrr: number;
  arr: number;
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  churnRate: number;
  revenue: number;
  newSignups: number;
  conversions: number;
  churned: number;
  openTickets: number;
}

interface TenantSummary {
  id: string;
  business_name: string;
  subscription_plan: string;
  subscription_status: string;
  mrr: number;
  health_score: number;
  created_at: string;
  last_activity_at: string;
}

export default function SuperAdminEnhanced() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [tenantDetailOpen, setTenantDetailOpen] = useState(false);

  // Fetch platform stats
  const { data: stats, isLoading: statsLoading } = useQuery<PlatformStats>({
    queryKey: ['super-admin-stats'],
    queryFn: async () => {
      const { data: tenants } = await supabase
        .from('tenants')
        .select('subscription_plan, subscription_status, mrr, created_at');

      if (!tenants) return defaultStats();

      const active = tenants.filter((t) => t.subscription_status === 'active');
      const trials = tenants.filter((t) => t.subscription_status === 'trial' || t.subscription_status === 'trialing');
      const cancelled = tenants.filter((t) => t.subscription_status === 'cancelled');

      const mrr = tenants.reduce((sum, t) => sum + (t.mrr || 0), 0);
      const arr = mrr * 12;

      // Calculate churn rate (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentCancelled = cancelled.filter(
        (t) => new Date(t.created_at || 0) > thirtyDaysAgo
      );
      const churnRate = active.length > 0 ? (recentCancelled.length / active.length) * 100 : 0;

      // Calculate new signups (last 30 days)
      const newSignups = tenants.filter(
        (t) => new Date(t.created_at || 0) > thirtyDaysAgo
      ).length;

      // Calculate conversions (trials that converted)
      const conversions = tenants.filter(
        (t) =>
          (t.subscription_status === 'active' || t.subscription_status === 'past_due') &&
          trials.some((tr) => tr.id === t.id)
      ).length;

      return {
        mrr,
        arr,
        totalTenants: tenants.length,
        activeTenants: active.length,
        trialTenants: trials.length,
        churnRate,
        revenue: arr,
        newSignups,
        conversions: Math.round(conversions * 0.67), // Estimated conversion rate
        churned: recentCancelled.length,
        openTickets: 8, // Placeholder
      };
    },
  });

  // Fetch tenant list
  const { data: tenants, isLoading: tenantsLoading } = useQuery<TenantSummary[]>({
    queryKey: ['super-admin-tenants', searchTerm, statusFilter, planFilter],
    queryFn: async () => {
      let query = supabase
        .from('tenants')
        .select('id, business_name, subscription_plan, subscription_status, mrr, created_at, last_activity_at')
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.ilike('business_name', `%${searchTerm}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('subscription_status', statusFilter);
      }

      if (planFilter !== 'all') {
        query = query.eq('subscription_plan', planFilter);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;

      // Calculate health scores
      const tenantsWithHealth = await Promise.all(
        (data || []).map(async (tenant) => {
          const { data: fullTenant } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', tenant.id)
            .single();

          const health = fullTenant ? calculateHealthScore(fullTenant) : { score: 50, reasons: [] };

          return {
            ...tenant,
            health_score: health.score,
          };
        })
      );

      return tenantsWithHealth;
    },
  });

  // Fetch at-risk tenants
  const { data: atRiskTenants } = useQuery({
    queryKey: ['at-risk-tenants'],
    queryFn: async () => {
      const { data: allTenants } = await supabase
        .from('tenants')
        .select('*');

      if (!allTenants) return [];

      const atRisk = allTenants
        .map((tenant) => ({
          tenant,
          health: calculateHealthScore(tenant),
        }))
        .filter(({ health }) => health.score < 50)
        .sort((a, b) => a.health.score - b.health.score)
        .slice(0, 12);

      return atRisk;
    },
  });

  const defaultStats = (): PlatformStats => ({
    mrr: 0,
    arr: 0,
    totalTenants: 0,
    activeTenants: 0,
    trialTenants: 0,
    churnRate: 0,
    revenue: 0,
    newSignups: 0,
    conversions: 0,
    churned: 0,
    openTickets: 0,
  });

  const handleLoginAsTenant = async (tenantId: string) => {
    try {
      // Set tenant context
      await supabase.rpc('set_config', {
        setting_name: 'app.current_tenant_id',
        setting_value: tenantId,
      });

      // Store in localStorage for frontend
      localStorage.setItem('super_admin_tenant_id', tenantId);
      localStorage.setItem('impersonating_tenant', 'true');

      toast({
        title: 'Logged in as tenant',
        description: 'You are now viewing as this tenant',
      });

      // Navigate to tenant's dashboard
      window.location.href = '/admin/dashboard';
    } catch (error: any) {
      toast({
        title: 'Failed to login',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      trial: 'secondary',
      trialing: 'secondary',
      past_due: 'destructive',
      cancelled: 'outline',
      suspended: 'destructive',
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getHealthBadge = (score: number) => {
    if (score >= 80) return <span className="text-green-600 font-semibold">●●●●○</span>;
    if (score >= 60) return <span className="text-yellow-600 font-semibold">●●●○○</span>;
    if (score >= 40) return <span className="text-orange-600 font-semibold">●●○○○</span>;
    return <span className="text-red-600 font-semibold">●○○○○</span>;
  };

  if (statsLoading || tenantsLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Loading platform data...</p>
        </Card>
      </div>
    );
  }

  const platformStats = stats || defaultStats();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">🎛️ Platform Admin</h1>
          <p className="text-muted-foreground">Complete control center for your SaaS platform</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Bell className="h-4 w-4 mr-2" />
            3
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Tenant
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button variant="outline">
          <Bell className="h-4 w-4 mr-2" />
          Send Notification
        </Button>
        <Button variant="outline">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Data
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">💰 MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(platformStats.mrr)}</div>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              +15% ↑
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">🏢 Tenants</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{platformStats.activeTenants} Active</div>
            <p className="text-xs text-muted-foreground">
              {platformStats.totalTenants} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">📉 Churn</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{platformStats.churnRate.toFixed(1)}%</div>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              -0.5% ↓
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">🆓 Trials</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{platformStats.trialTenants} Active</div>
            <p className="text-xs text-muted-foreground">
              {platformStats.conversions} converted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">💳 Revenue</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(platformStats.arr / 1000)}k ARR</div>
            <p className="text-xs text-green-600">+18% YoY</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">🎫 Support</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{platformStats.openTickets} Open</div>
            <p className="text-xs text-muted-foreground">15m avg</p>
          </CardContent>
        </Card>
      </div>

      {/* At-Risk Tenants */}
      {atRiskTenants && atRiskTenants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              At-Risk Tenants ({atRiskTenants.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {atRiskTenants.slice(0, 5).map(({ tenant, health }) => (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => {
                    setSelectedTenant(tenant.id);
                    setTenantDetailOpen(true);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">{tenant.business_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Health: {health.score} • {health.reasons[0] || 'Low engagement'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoginAsTenant(tenant.id);
                    }}
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4">
              View All At-Risk →
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tenant Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>🏢 All Tenants</CardTitle>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tenants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="past_due">Past Due</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tenant Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 text-sm font-medium">Business</th>
                  <th className="text-left p-3 text-sm font-medium">Plan</th>
                  <th className="text-left p-3 text-sm font-medium">Status</th>
                  <th className="text-left p-3 text-sm font-medium">MRR</th>
                  <th className="text-left p-3 text-sm font-medium">Health</th>
                  <th className="text-left p-3 text-sm font-medium">Joined</th>
                  <th className="text-left p-3 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants?.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="border-t hover:bg-muted/50 cursor-pointer"
                    onClick={() => {
                      setSelectedTenant(tenant.id);
                      setTenantDetailOpen(true);
                    }}
                  >
                    <td className="p-3">
                      <div className="font-medium">{tenant.business_name}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">{tenant.subscription_plan}</Badge>
                    </td>
                    <td className="p-3">{getStatusBadge(tenant.subscription_status)}</td>
                    <td className="p-3">{formatCurrency(tenant.mrr || 0)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {getHealthBadge(tenant.health_score)}
                        <span className="text-sm text-muted-foreground">
                          ({tenant.health_score})
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {formatSmartDate(tenant.created_at)}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTenant(tenant.id);
                            setTenantDetailOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoginAsTenant(tenant.id);
                          }}
                        >
                          <LogIn className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {tenants && tenants.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No tenants found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tenant Detail Dialog */}
      <Dialog open={tenantDetailOpen} onOpenChange={setTenantDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tenant Details</DialogTitle>
            <DialogDescription>
              Complete tenant information and management
            </DialogDescription>
          </DialogHeader>
          {selectedTenant && (
            <TenantDetailView tenantId={selectedTenant} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Tenant Detail View Component
function TenantDetailView({ tenantId }: { tenantId: string }) {
  const { data: tenant } = useQuery({
    queryKey: ['tenant-detail', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  if (!tenant) {
    return <div>Loading...</div>;
  }

  const health = calculateHealthScore(tenant);

  return (
    <Tabs defaultValue="overview" className="mt-4">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="features">Features</TabsTrigger>
        <TabsTrigger value="usage">Usage</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">MRR</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(tenant.mrr || 0)}</div>
              <p className="text-xs text-muted-foreground">Next: Nov 15</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Health Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{health.score}</div>
              <p className="text-xs text-muted-foreground">
                {health.reasons.length > 0 ? health.reasons[0] : 'Healthy'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tenant.usage?.customers || 0} / {tenant.limits?.customers === -1 ? '∞' : tenant.limits?.customers || 0}
              </div>
              <p className="text-xs text-muted-foreground">Usage</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Contact Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><strong>Owner:</strong> {tenant.owner_name || 'N/A'}</p>
            <p><strong>Email:</strong> {tenant.owner_email}</p>
            <p><strong>Phone:</strong> {tenant.phone || 'N/A'}</p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="features">
        <FeatureManagement tenant={tenant} />
      </TabsContent>

      <TabsContent value="usage">
        <UsageMonitoring tenant={tenant} />
      </TabsContent>

      <TabsContent value="billing">
        <BillingManagement tenant={tenant} />
      </TabsContent>

      <TabsContent value="activity">
        <ActivityTimeline tenantId={tenantId} />
      </TabsContent>
    </Tabs>
  );
}

// Feature Management Component
function FeatureManagement({ tenant }: { tenant: any }) {
  const { toast } = useToast();
  const [features, setFeatures] = useState(tenant?.features || {});

  const handleToggleFeature = async (featureKey: string, enabled: boolean) => {
    try {
      const updatedFeatures = { ...features, [featureKey]: enabled };
      
      const { error } = await supabase
        .from('tenants')
        .update({ features: updatedFeatures })
        .eq('id', tenant.id);

      if (error) throw error;

      setFeatures(updatedFeatures);
      toast({
        title: 'Feature updated',
        description: `${featureKey} ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error: any) {
      toast({
        title: 'Failed to update feature',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const coreFeatures = [
    { key: 'product_management', label: 'Product Management', description: 'Manage product catalog' },
    { key: 'customer_management', label: 'Customer Management', description: 'Manage customer database' },
    { key: 'order_management', label: 'Order Management', description: 'Process and track orders' },
  ];

  const advancedFeatures = [
    { key: 'api_access', label: 'API Access', description: 'RESTful API access', plan: 'professional' },
    { key: 'custom_branding', label: 'Custom Branding', description: 'Customize colors, logo, theme', plan: 'professional' },
    { key: 'white_label', label: 'White Label', description: 'Remove branding, custom domain', plan: 'enterprise' },
    { key: 'advanced_analytics', label: 'Advanced Analytics', description: 'Enhanced reporting', plan: 'professional' },
    { key: 'sms_enabled', label: 'SMS Enabled', description: 'Send SMS notifications', plan: 'professional' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Core Features</h3>
        <div className="space-y-2">
          {coreFeatures.map((feature) => (
            <Card key={feature.key} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{feature.label}</h4>
                    <Badge variant={features[feature.key] ? 'default' : 'secondary'}>
                      {features[feature.key] ? 'ON' : 'OFF'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
                <Button
                  variant={features[feature.key] ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleToggleFeature(feature.key, !features[feature.key])}
                >
                  {features[feature.key] ? 'Disable' : 'Enable'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Advanced Features</h3>
        <div className="space-y-2">
          {advancedFeatures.map((feature) => {
            const isPlanEligible = tenant.subscription_plan === feature.plan || 
                                   tenant.subscription_plan === 'enterprise';
            const isEnabled = features[feature.key];

            return (
              <Card key={feature.key} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{feature.label}</h4>
                      <Badge variant={isEnabled ? 'default' : 'secondary'}>
                        {isEnabled ? 'ON' : 'OFF'}
                      </Badge>
                      {!isPlanEligible && (
                        <Badge variant="outline" className="text-xs">
                          Requires {feature.plan === 'enterprise' ? 'Enterprise' : 'Professional'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                    {feature.plan && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ✓ Included in {feature.plan === 'enterprise' ? 'Enterprise' : 'Professional'} plan
                      </p>
                    )}
                  </div>
                  <Button
                    variant={isEnabled ? 'default' : 'outline'}
                    size="sm"
                    disabled={!isPlanEligible && !isEnabled}
                    onClick={() => handleToggleFeature(feature.key, !isEnabled)}
                  >
                    {isEnabled ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Usage Monitoring Component
function UsageMonitoring({ tenant }: { tenant: any }) {
  const { data: usage } = useQuery({
    queryKey: ['tenant-usage', tenant.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tenants')
        .select('usage, limits')
        .eq('id', tenant.id)
        .single();
      return data || { usage: {}, limits: {} };
    },
  });

  const usageData = usage?.usage || tenant?.usage || {};
  const limitsData = usage?.limits || tenant?.limits || {};

  const resources = [
    { key: 'customers', label: 'Customers', icon: Users },
    { key: 'menus', label: 'Menus', icon: Activity },
    { key: 'products', label: 'Products', icon: BarChart3 },
    { key: 'locations', label: 'Locations', icon: Building2 },
    { key: 'users', label: 'Team Members', icon: Users },
  ];

  const getUsagePercentage = (key: string) => {
    const current = usage[key] || 0;
    const limit = limits[key];
    if (limit === -1) return null;
    return (current / limit) * 100;
  };

  return (
    <div className="space-y-4">
      {resources.map((resource) => {
        const current = usage[resource.key] || 0;
        const limit = limits[resource.key];
        const unlimited = limit === -1;
        const percentage = getUsagePercentage(resource.key);
        const Icon = resource.icon;

        return (
          <Card key={resource.key} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <h4 className="font-medium">{resource.label}</h4>
              </div>
              <div className="text-right">
                <div className="font-semibold">
                  {current} / {unlimited ? '∞' : limit} ({percentage ? `${Math.round(percentage)}%` : 'Unlimited'})
                </div>
                {!unlimited && (
                  <div className="text-sm text-muted-foreground">
                    {Math.max(0, limit - current)} remaining
                  </div>
                )}
              </div>
            </div>
            {percentage !== null && (
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full ${
                    percentage >= 90 ? 'bg-red-500' : percentage >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, percentage)}%` }}
                />
              </div>
            )}
            {percentage !== null && percentage >= 90 && (
              <p className="text-sm text-red-600 mt-2">⚠️ Near limit</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// Billing Management Component
function BillingManagement({ tenant }: { tenant: any }) {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string>(tenant?.subscription_plan || 'starter');

  const plans = [
    { id: 'starter', name: 'Starter', price: 99 },
    { id: 'professional', name: 'Professional', price: 299 },
    { id: 'enterprise', name: 'Enterprise', price: 799 },
  ];

  const handleChangePlan = async (newPlan: string) => {
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          subscription_plan: newPlan,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenant.id);

      if (error) throw error;

      setSelectedPlan(newPlan);
      toast({
        title: 'Plan updated',
        description: `Changed to ${newPlan} plan`,
      });
    } catch (error: any) {
      toast({
        title: 'Failed to change plan',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Current Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-2xl font-bold">{tenant.subscription_plan?.toUpperCase()} PLAN</p>
            <p className="text-muted-foreground">
              ${plans.find((p) => p.id === tenant.subscription_plan)?.price || 0}/month
            </p>
            <p className="text-sm text-muted-foreground">
              Next billing: {formatSmartDate(tenant.subscription_current_period_end || tenant.created_at)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`p-4 border rounded-lg cursor-pointer ${
                  tenant?.subscription_plan === plan.id ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => handleChangePlan(plan.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{plan.name}</p>
                    <p className="text-sm text-muted-foreground">${plan.price}/month</p>
                  </div>
                  {tenant?.subscription_plan === plan.id && (
                    <Badge>Current</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Activity Timeline Component
function ActivityTimeline({ tenantId }: { tenantId: string }) {
  const { data: events } = useQuery({
    queryKey: ['tenant-activity', tenantId],
    queryFn: async () => {
      const { data: subscriptionEvents } = await supabase
        .from('subscription_events')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(20);

      return subscriptionEvents || [];
    },
  });

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Recent Activity</h3>
      <div className="space-y-2">
        {events?.map((event, idx) => (
          <div key={idx} className="flex items-start gap-3 p-3 border rounded-lg">
            <div className="flex-1">
              <p className="font-medium">{event.event_type}</p>
              <p className="text-sm text-muted-foreground">
                {formatSmartDate(event.created_at)}
              </p>
            </div>
          </div>
        ))}
        {(!events || events.length === 0) && (
          <p className="text-muted-foreground text-center py-8">No activity yet</p>
        )}
      </div>
    </div>
  );
}

