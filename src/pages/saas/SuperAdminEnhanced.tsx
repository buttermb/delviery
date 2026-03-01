/**
 * Enhanced Super Admin Dashboard
 * Complete platform control center with all metrics and tools
 */

import { useState } from 'react';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { escapePostgresLike } from '@/lib/utils/searchSanitize';
import { useAuth } from '@/contexts/AuthContext';
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
  Download,
  LogIn,
  Zap,
  LogOut,
} from 'lucide-react';
import { exportTenantsToCSV, exportTenantsToJSON } from '@/utils/tenantExport';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { calculateHealthScore, type Tenant } from '@/lib/tenant';
import { handleError } from '@/utils/errorHandling/handlers';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { CreateTenantDialog } from '@/components/admin/CreateTenantDialog';
import { NotificationDialog } from '@/components/admin/NotificationDialog';
import { TenantQuickActions } from '@/components/admin/TenantQuickActions';
import { TenantFilters, FilterType } from '@/components/admin/TenantFilters';
import { HealthScoreTooltip } from '@/components/admin/HealthScoreTooltip';
import { OnboardingTracker } from '@/components/admin/OnboardingTracker';
import { TenantHoverCard } from '@/components/admin/TenantHoverCard';
import { BulkActionsBar } from '@/components/admin/BulkActionsBar';
import { Checkbox } from '@/components/ui/checkbox';

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
  slug: string;
  subscription_plan: string;
  subscription_status: string;
  mrr: number;
  health_score: number;
  created_at: string;
  last_activity_at: string;
  health_reasons?: string[];
  full_tenant?: Tenant | null;
}

import {
  isTrial,
  isCancelled,
  getSubscriptionStatusLabel,
  SUBSCRIPTION_STATUS
} from '@/utils/subscriptionStatus';
import { SUBSCRIPTION_PLANS, SubscriptionPlan } from '@/utils/subscriptionPlans';
import { queryKeys } from '@/lib/queryKeys';

// ... imports

export default function SuperAdminEnhanced() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [smartFilter, setSmartFilter] = useState<FilterType>('all');
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [tenantDetailOpen, setTenantDetailOpen] = useState(false);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);

  // Fetch platform stats
  const { data: stats, isLoading: statsLoading } = useQuery<PlatformStats>({
    queryKey: queryKeys.superAdminTools.superAdminStats(),
    queryFn: async () => {
      const { data: tenants } = await supabase
        .from('tenants')
        .select('subscription_plan, subscription_status, mrr, created_at');

      if (!tenants) return defaultStats();

      const active = tenants.filter((t) => t.subscription_status === SUBSCRIPTION_STATUS.ACTIVE);
      const trials = tenants.filter((t) => isTrial(t.subscription_status));
      const cancelled = tenants.filter((t) => isCancelled(t.subscription_status));

      const mrr = tenants.reduce((sum, t) => sum + (t.mrr ?? 0), 0);
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

      // Calculate conversions (trials that converted) - simplified estimate
      const conversions = Math.round(active.length * 0.15);

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
  const { data: tenants, isLoading: tenantsLoading, refetch: refetchTenants } = useQuery<TenantSummary[]>({
    queryKey: queryKeys.superAdminTools.superAdminTenants(searchTerm, statusFilter, planFilter),
    queryFn: async () => {
      let query = supabase
        .from('tenants')
        .select('id, business_name, slug, subscription_plan, subscription_status, mrr, created_at, last_activity_at')
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`business_name.ilike.%${escapePostgresLike(searchTerm)}%,slug.ilike.%${escapePostgresLike(searchTerm)}%,owner_email.ilike.%${escapePostgresLike(searchTerm)}%,owner_name.ilike.%${escapePostgresLike(searchTerm)}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('subscription_status', statusFilter);
      }

      if (planFilter !== 'all') {
        query = query.eq('subscription_plan', planFilter);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;

      // Calculate health scores and filter based on smart filter
      const tenantsWithHealth = await Promise.all(
        (data ?? []).map(async (tenant) => {
          const { data: fullTenant } = await supabase
            .from('tenants')
            .select('id, business_name, slug, owner_email, owner_name, phone, subscription_plan, subscription_status, trial_ends_at, stripe_customer_id, payment_method_added, mrr, limits, usage, features, white_label, status, cancelled_at, last_activity_at, onboarded, created_at, updated_at')
            .eq('id', tenant.id)
            .maybeSingle();

          const health = fullTenant ? calculateHealthScore(fullTenant as unknown as Tenant) : { score: 50, reasons: [] };

          return {
            ...tenant,
            health_score: health.score,
            health_reasons: health.reasons,
            full_tenant: fullTenant
          };
        })
      );

      // Apply smart filters in memory (since they depend on derived data like health score)
      if (smartFilter !== 'all') {
        return tenantsWithHealth.filter(tenant => {
          const daysSinceCreation = (Date.now() - new Date(tenant.created_at).getTime()) / (1000 * 60 * 60 * 24);
          const isTenantTrial = isTrial(tenant.subscription_status);
          // Mock trial end date check (assuming 14 days)
          const trialEndsIn = 14 - daysSinceCreation;

          switch (smartFilter) {
            case 'needs_attention':
              return tenant.health_score < 50 || tenant.subscription_status === 'past_due';
            case 'onboarding':
              return daysSinceCreation < 7;
            case 'trial_ending':
              return isTenantTrial && trialEndsIn <= 3 && trialEndsIn > 0;
            case 'past_due':
              return tenant.subscription_status === 'past_due';
            case 'high_value':
              return (tenant.mrr ?? 0) > 500;
            default:
              return true;
          }
        });
      }

      return tenantsWithHealth;
    },
  });

  // Calculate filter counts
  const filterCounts = {
    all: stats?.totalTenants ?? 0,
    needs_attention: tenants?.filter(t => t.health_score < 50 || t.subscription_status === 'past_due').length ?? 0,
    onboarding: tenants?.filter(t => (Date.now() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24) < 7).length ?? 0,
    trial_ending: tenants?.filter(t => isTrial(t.subscription_status) && (14 - (Date.now() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24)) <= 3).length ?? 0,
    past_due: tenants?.filter(t => t.subscription_status === 'past_due').length ?? 0,
    high_value: tenants?.filter(t => (t.mrr ?? 0) > 500).length ?? 0,
  };

  // Fetch at-risk tenants
  const { data: atRiskTenants } = useQuery({
    queryKey: queryKeys.superAdminTools.atRiskTenantsSimple(),
    queryFn: async () => {
      const { data: allTenants } = await supabase
        .from('tenants')
        .select('id, business_name, slug, owner_email, owner_name, phone, subscription_plan, subscription_status, trial_ends_at, stripe_customer_id, payment_method_added, mrr, limits, usage, features, white_label, status, cancelled_at, last_activity_at, onboarded, created_at, updated_at');

      if (!allTenants) return [];

      const atRisk = allTenants
        .map((tenant) => ({
          tenant,
          health: calculateHealthScore(tenant as unknown as Tenant),
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
      // Fetch tenant data to get slug
      const { data: tenant, error } = await supabase
        .from('tenants')
        .select('slug, business_name')
        .eq('id', tenantId)
        .maybeSingle();

      if (error || !tenant) {
        throw new Error('Tenant not found');
      }

      // Set tenant context via localStorage (UI state only, not for auth)
      // Note: Super admin auth is token-based, this is just for UI context
      localStorage.setItem(STORAGE_KEYS.SUPER_ADMIN_TENANT_ID, tenantId);
      localStorage.setItem(STORAGE_KEYS.IMPERSONATING_TENANT, 'true');

      toast.success(`You are now viewing as ${tenant.business_name}`);

      // Navigate to tenant's admin dashboard using their slug
      navigate(`/${tenant.slug}/admin/dashboard`);
      navigate(`/${tenant.slug}/admin/dashboard`);
    } catch (error) {
      handleError(error, { component: 'SuperAdminEnhanced', toastTitle: 'Failed to login' });
    }
  };

  const getStatusBadge = (status: string) => {
    const variant =
      status === SUBSCRIPTION_STATUS.ACTIVE ? 'default' :
        isTrial(status) ? 'secondary' :
          status === SUBSCRIPTION_STATUS.PAST_DUE ? 'destructive' :
            isCancelled(status) ? 'outline' : 'outline';

    return (
      <Badge variant={variant}>
        {getSubscriptionStatusLabel(status).toUpperCase()}
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
    return <EnhancedLoadingState variant="dashboard" message="Loading platform data..." />;
  }

  const platformStats = stats || defaultStats();

  const handleLogout = async () => {
    await signOut();
    navigate('/saas/login');
    toast.success('You have been signed out successfully');
  };

  return (
    <div className="min-h-dvh bg-background">
      {/* Header Bar */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">🎛️ Platform Admin</h1>
            <p className="text-sm text-muted-foreground">Complete control center for your SaaS platform</p>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <div className="text-sm text-muted-foreground">
                {user.email}
              </div>
            )}
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6 space-y-6">
        {/* Quick Actions Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Platform Overview</h2>
            <p className="text-sm text-muted-foreground">Manage all tenants and platform settings</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/saas/admin/analytics">
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/saas/admin/support">
                <Ticket className="h-4 w-4 mr-2" />
                Support
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/saas/admin/automation">
                <Zap className="h-4 w-4 mr-2" />
                Automation
              </Link>
            </Button>
            <CreateTenantDialog />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <NotificationDialog />
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (tenants && tenants.length > 0) {
                exportTenantsToCSV(tenants as unknown as Array<Record<string, unknown>>);
              }
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (tenants && tenants.length > 0) {
                exportTenantsToJSON(tenants as unknown as Array<Record<string, unknown>>);
              }
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
          <Button variant="outline" asChild>
            <Link to="/saas/admin/settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Link>
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
            {/* Smart Filters */}
            <TenantFilters
              activeFilter={smartFilter}
              onFilterChange={setSmartFilter}
              counts={filterCounts}
            />

            {/* Filters and Search */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tenants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  aria-label="Search tenants"
                />
              </div>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  <SelectItem value={SUBSCRIPTION_PLANS.STARTER}>Starter</SelectItem>
                  <SelectItem value={SUBSCRIPTION_PLANS.PROFESSIONAL}>Professional</SelectItem>
                  <SelectItem value={SUBSCRIPTION_PLANS.ENTERPRISE}>Enterprise</SelectItem>
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
                    <th scope="col" className="w-[50px] p-3">
                      <Checkbox
                        checked={tenants?.length > 0 && selectedTenants.length === tenants?.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedTenants(tenants?.map(t => t.id) ?? []);
                          } else {
                            setSelectedTenants([]);
                          }
                        }}
                      />
                    </th>
                    <th scope="col" className="text-left p-3 text-sm font-medium">Business</th>
                    <th scope="col" className="text-left p-3 text-sm font-medium">Plan</th>
                    <th scope="col" className="text-left p-3 text-sm font-medium">Status</th>
                    <th scope="col" className="text-left p-3 text-sm font-medium">MRR</th>
                    <th scope="col" className="text-left p-3 text-sm font-medium">Health</th>
                    <th scope="col" className="text-left p-3 text-sm font-medium">Joined</th>
                    <th scope="col" className="text-left p-3 text-sm font-medium">Actions</th>
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
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedTenants.includes(tenant.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedTenants([...selectedTenants, tenant.id]);
                            } else {
                              setSelectedTenants(selectedTenants.filter(id => id !== tenant.id));
                            }
                          }}
                        />
                      </td>
                      <td className="p-3">
                        <TenantHoverCard tenant={{
                          id: tenant.id,
                          business_name: tenant.business_name,
                          slug: tenant.slug || tenant.id,
                          subscription_plan: tenant.subscription_plan,
                          subscription_status: tenant.subscription_status,
                          created_at: tenant.created_at,
                          mrr: tenant.mrr,
                          health_score: tenant.health_score,
                          owner_name: tenant.full_tenant?.owner_name || 'Unknown',
                          owner_email: tenant.full_tenant?.owner_email || 'Unknown',
                          last_activity_at: tenant.last_activity_at
                        }}>
                          <div className="font-medium hover:underline">{tenant.business_name}</div>
                        </TenantHoverCard>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{tenant.subscription_plan}</Badge>
                      </td>
                      <td className="p-3">{getStatusBadge(tenant.subscription_status)}</td>
                      <td className="p-3">{formatCurrency(tenant.mrr ?? 0)}</td>
                      <td className="p-3">
                        <HealthScoreTooltip score={tenant.health_score} reasons={tenant.health_reasons as unknown as Array<{ factor: string; impact: 'positive' | 'negative' | 'neutral'; message: string }>}>
                          <div className="flex items-center gap-2">
                            {getHealthBadge(tenant.health_score)}
                            <span className="text-sm text-muted-foreground">
                              ({tenant.health_score})
                            </span>
                          </div>
                        </HealthScoreTooltip>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {(Date.now() - new Date(tenant.created_at).getTime()) / (1000 * 60 * 60 * 24) < 14 ? (
                          <OnboardingTracker tenant={{
                            created_at: tenant.created_at,
                            onboarded: tenant.full_tenant?.onboarded,
                            usage: tenant.full_tenant?.usage,
                            email_verified: tenant.full_tenant?.owner_email ? true : undefined,
                            payment_method_attached: !!tenant.full_tenant?.stripe_customer_id
                          }} />
                        ) : (
                          formatSmartDate(tenant.created_at)
                        )}
                      </td>
                      <td className="p-3">
                        <TenantQuickActions
                          tenant={{
                            id: tenant.id,
                            business_name: tenant.business_name,
                            slug: tenant.slug || tenant.id,
                            subscription_status: tenant.subscription_status,
                          }}
                          onViewDetails={() => {
                            setSelectedTenant(tenant.id);
                            setTenantDetailOpen(true);
                          }}
                          onRefresh={() => {
                            // Refresh tenant data
                            refetchTenants();
                          }}
                        />
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
          <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
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

        {/* Bulk Actions Bar */}
        <BulkActionsBar
          selectedCount={selectedTenants.length}
          onClearSelection={() => setSelectedTenants([])}
          onBulkEmail={() => {
            // Open notification dialog with selected tenants
            // This would require updating NotificationDialog to accept initial selection
            toast.info(`Drafting email to ${selectedTenants.length} tenants`);
          }}
          onBulkSuspend={async () => {
            // Implement bulk suspend logic
            toast.warning(`Suspending ${selectedTenants.length} tenants`);
            setSelectedTenants([]);
          }}
          onBulkUnsuspend={() => { }}
          onBulkExport={() => {
            const selectedData = tenants?.filter(t => selectedTenants.includes(t.id)) ?? [];
            exportTenantsToCSV(selectedData as unknown as Array<Record<string, unknown>>);
            setSelectedTenants([]);
          }}
        />
      </div>
    </div>
  );
}

// Tenant Detail View Component
function TenantDetailView({ tenantId }: { tenantId: string }) {
  const { data: tenant } = useQuery({
    queryKey: queryKeys.superAdminTools.tenantDetailById(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, business_name, slug, owner_email, owner_name, phone, subscription_plan, subscription_status, trial_ends_at, stripe_customer_id, payment_method_added, mrr, limits, usage, features, white_label, status, cancelled_at, last_activity_at, onboarded, created_at, updated_at')
        .eq('id', tenantId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  if (!tenant) {
    return <EnhancedLoadingState variant="card" message="Loading tenant details..." />;
  }

  const health = calculateHealthScore(tenant as unknown as Tenant);

  return (
    <Tabs defaultValue="overview" className="mt-4">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="features">Features</TabsTrigger>
        <TabsTrigger value="usage">Usage</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
        <TabsTrigger value="support">Support</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">MRR</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(tenant.mrr ?? 0)}</div>
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
                {((tenant.usage as Record<string, unknown>)?.customers as number ?? 0)} / {((tenant.limits as Record<string, unknown>)?.customers === -1 ? '∞' : (tenant.limits as Record<string, unknown>)?.customers as number ?? 0)}
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
function FeatureManagement({ tenant }: { tenant: Record<string, unknown> }) {
  const [features, setFeatures] = useState<Record<string, boolean>>((tenant?.features as Record<string, boolean>) || {});

  const handleToggleFeature = async (featureKey: string, enabled: boolean) => {
    try {
      const updatedFeatures = { ...features, [featureKey]: enabled };

      const { error } = await supabase
        .from('tenants')
        .update({ features: updatedFeatures })
        .eq('id', tenant.id as string);

      if (error) throw error;

      setFeatures(updatedFeatures);
      toast.success(`${featureKey} ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      handleError(error, { component: 'SuperAdminEnhanced', toastTitle: 'Failed to update feature' });
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
            const plan = (tenant.subscription_plan as string) as SubscriptionPlan;
            const isPlanEligible = plan === feature.plan || plan === 'enterprise';
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
function UsageMonitoring({ tenant }: { tenant: Record<string, unknown> }) {
  const { data: usage } = useQuery({
    queryKey: queryKeys.superAdminTools.tenantUsage(tenant.id as string),
    queryFn: async () => {
      const { data } = await supabase
        .from('tenants')
        .select('usage, limits')
        .eq('id', tenant.id as string)
        .maybeSingle();
      return data || { usage: {}, limits: {} };
    },
  });

  const usageData = (usage?.usage || tenant?.usage || {}) as Record<string, number>;
  const limitsData = (usage?.limits || tenant?.limits || {}) as Record<string, number>;

  const resources = [
    { key: 'customers', label: 'Customers', icon: Users },
    { key: 'menus', label: 'Menus', icon: Activity },
    { key: 'products', label: 'Products', icon: BarChart3 },
    { key: 'locations', label: 'Locations', icon: Building2 },
    { key: 'users', label: 'Team Members', icon: Users },
  ];

  const getUsagePercentage = (key: string, usage: Record<string, number>, limits: Record<string, number>) => {
    const current = usage[key] ?? 0;
    const limit = limits[key];
    if (limit === -1) return null;
    return (current / limit) * 100;
  };

  return (
    <div className="space-y-4">
      {resources.map((resource) => {
        const current = usageData[resource.key] ?? 0;
        const limit = limitsData[resource.key];
        const unlimited = limit === -1;
        const percentage = getUsagePercentage(resource.key, usageData, limitsData);
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
                  className={`h-2 rounded-full ${percentage >= 90 ? 'bg-red-500' : percentage >= 80 ? 'bg-yellow-500' : 'bg-green-500'
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
function BillingManagement({ tenant }: { tenant: Record<string, unknown> }) {
  const [_selectedPlan, setSelectedPlan] = useState<string>((tenant?.subscription_plan as string) || SUBSCRIPTION_PLANS.STARTER);

  const plans = [
    { id: 'starter', name: 'Starter', price: 99 },
    { id: 'professional', name: 'Professional', price: 299 },
    { id: 'enterprise', name: 'Enterprise', price: 799 },
  ];

  const handleChangePlan = async (newPlan: 'starter' | 'professional' | 'enterprise') => {
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          subscription_plan: newPlan,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenant.id as string);

      if (error) throw error;

      setSelectedPlan(newPlan);
      toast.success(`Changed to ${newPlan} plan`);
    } catch (error) {
      handleError(error, { component: 'SuperAdminEnhanced', toastTitle: 'Failed to change plan' });
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
            <p className="text-2xl font-bold">{(tenant.subscription_plan as string)?.toUpperCase()} PLAN</p>
            <p className="text-muted-foreground">
              ${plans.find((p) => p.id === (tenant.subscription_plan as string))?.price ?? 0}/month
            </p>
            <p className="text-sm text-muted-foreground">
              Next billing: {formatSmartDate((tenant.subscription_current_period_end as string) || (tenant.created_at as string))}
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
                className={`p-4 border rounded-lg cursor-pointer ${(tenant?.subscription_plan as string) === plan.id ? 'border-primary bg-primary/5' : ''
                  }`}
                onClick={() => handleChangePlan(plan.id as 'starter' | 'professional' | 'enterprise')}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{plan.name}</p>
                    <p className="text-sm text-muted-foreground">${plan.price}/month</p>
                  </div>
                  {(tenant?.subscription_plan as string) === plan.id && (
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
    queryKey: queryKeys.superAdminTools.tenantActivity(tenantId),
    queryFn: async () => {
      const { data: subscriptionEvents } = await supabase
        .from('subscription_events')
        .select('id, event_type, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(20);

      return subscriptionEvents ?? [];
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

