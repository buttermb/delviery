import { logger } from '@/lib/logger';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { isCancelled } from '@/utils/subscriptionStatus';
/**
 * Super Admin Dashboard Page
 * Redesigned with horizontal navigation layout
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DollarSign,
  Building2,
  TrendingDown,
  TrendingUp,
  Heart,
  UserPlus,
  Megaphone,
  FileText,
  Settings,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { calculateHealthScore, type Tenant } from '@/lib/tenant';
import { MetricCard } from '@/components/super-admin/dashboard/MetricCard';
import { ActivityFeed } from '@/components/super-admin/dashboard/ActivityFeed';
import { AtRiskTenantCard } from '@/components/super-admin/dashboard/AtRiskTenantCard';
import { GrowthMetricsCard } from '@/components/super-admin/dashboard/GrowthMetricsCard';
import { SystemHealthMonitor } from '@/components/super-admin/SystemHealthMonitor';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useState, useEffect } from 'react';
import { SUBSCRIPTION_PLANS } from '@/utils/subscriptionPlans';
import { queryKeys } from '@/lib/queryKeys';

interface TenantPayload {
  id?: string;
  subscription_plan?: string;
  subscription_status?: string;
}

export default function SuperAdminDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState('30d');

  // Real-time subscription for tenants table (subscription changes, status updates)
  useEffect(() => {
    const channel = supabase
      .channel('super-admin-tenants-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenants',
        },
        (payload) => {
          // Type-safe payload access
          const newData = payload.new as TenantPayload | null;
          const oldData = payload.old as TenantPayload | null;

          logger.debug('Tenant data changed', {
            event: payload.eventType,
            component: 'SuperAdminDashboard',
            tenantId: newData?.id || oldData?.id,
            subscriptionPlan: newData?.subscription_plan,
            subscriptionStatus: newData?.subscription_status,
          });

          // Invalidate stats queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: queryKeys.superAdminTools.platformStats() });
          queryClient.invalidateQueries({ queryKey: queryKeys.superAdminTools.atRiskTenants() });
          queryClient.invalidateQueries({ queryKey: queryKeys.superAdminTools.recentActivity() });

          // If subscription plan or status changed, also invalidate tenant detail queries
          if (newData?.subscription_plan !== oldData?.subscription_plan ||
            newData?.subscription_status !== oldData?.subscription_status) {
            logger.info('Subscription tier or status changed', {
              tenantId: newData?.id,
              oldPlan: oldData?.subscription_plan,
              newPlan: newData?.subscription_plan,
              oldStatus: oldData?.subscription_status,
              newStatus: newData?.subscription_status,
              component: 'SuperAdminDashboard',
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.superAdminTools.tenantDetail(newData?.id) });
            queryClient.invalidateQueries({ queryKey: queryKeys.superAdminTools.tenantsListPage() });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Super admin tenants realtime subscription active', { component: 'SuperAdminDashboard' });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('Super admin tenants realtime subscription error', { status, component: 'SuperAdminDashboard' });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch platform stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.superAdminTools.platformStats(),
    queryFn: async () => {
      const { data: tenants } = await supabase
        .from('tenants')
        .select('subscription_plan, subscription_status, mrr, created_at, last_activity_at');

      if (!tenants) return null;

      const active = tenants.filter((t) => t.subscription_status === 'active');
      const trials = tenants.filter(
        (t) => t.subscription_status === 'trial' || t.subscription_status === 'trialing'
      );

      const mrr = tenants.reduce((sum, t) => sum + (Number(t.mrr) || 0), 0);
      const arr = mrr * 12;
      const commission = mrr * 0.02;

      // Calculate churn rate
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentCancelled = tenants.filter(
        (t) =>
          isCancelled(t.subscription_status) &&
          new Date(t.created_at ?? 0) > thirtyDaysAgo
      );
      const churnRate =
        active.length > 0 ? (recentCancelled.length / active.length) * 100 : 0;

      // Calculate health score (average of all tenants)
      const healthScores = tenants.map((t) => calculateHealthScore(t as unknown as Tenant).score);
      const avgHealthScore =
        healthScores.length > 0
          ? healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length
          : 100;

      return {
        mrr,
        arr,
        commission,
        totalTenants: tenants.length,
        activeTenants: active.length,
        trialTenants: trials.length,
        churnRate,
        avgHealthScore,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30000, // Refetch every 30 seconds for near real-time updates
  });

  // Fetch at-risk tenants
  const { data: atRiskTenants = [] } = useQuery({
    queryKey: queryKeys.superAdminTools.atRiskTenants(),
    queryFn: async () => {
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, business_name, slug, owner_email, owner_name, phone, subscription_plan, subscription_status, trial_ends_at, stripe_customer_id, payment_method_added, mrr, limits, usage, features, white_label, status, cancelled_at, last_activity_at, onboarded, created_at, updated_at')
        .in('subscription_status', ['active', 'trial', 'trialing']);

      if (!tenants) return [];

      return tenants
        .map((tenant) => {
          const health = calculateHealthScore(tenant as unknown as Tenant);
          return {
            ...tenant,
            health_score: health.score,
            risk_factors: health.reasons.slice(0, 3),
          };
        })
        .filter((t) => t.health_score < 50)
        .sort((a, b) => a.health_score - b.health_score)
        .slice(0, 10);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch active trials
  const { data: activeTrials = [] } = useQuery({
    queryKey: queryKeys.superAdminTools.activeTrials(),
    queryFn: async () => {
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, business_name, slug, owner_email, subscription_plan, subscription_status, trial_ends_at, created_at')
        .in('subscription_status', ['trial', 'trialing']);

      return tenants ?? [];
    },
  });

  // Fetch revenue data over time (last 12 months)
  const { data: revenueData = [] } = useQuery({
    queryKey: queryKeys.superAdminTools.revenueHistory(timeRange),
    queryFn: async () => {
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, created_at, mrr, subscription_status, subscription_plan');

      if (!tenants) return [];

      const planPrices: Record<string, number> = {
        [SUBSCRIPTION_PLANS.STARTER]: 99,
        [SUBSCRIPTION_PLANS.PROFESSIONAL]: 299,
        [SUBSCRIPTION_PLANS.ENTERPRISE]: 799,
      };

      // Calculate monthly revenue for last 12 months
      const monthlyRevenue: Record<string, number> = {};
      const now = new Date();

      for (let i = 11; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = month.toLocaleDateString('en-US', { month: 'short' });
        monthlyRevenue[monthKey] = 0;

        tenants.forEach((tenant) => {
          const tenantCreated = new Date(tenant.created_at ?? 0);
          const tenantMonth = new Date(tenantCreated.getFullYear(), tenantCreated.getMonth(), 1);

          // Only count if tenant existed in this month and was active
          if (tenantMonth <= month && tenant.subscription_status === 'active') {
            const mrr = Number(tenant.mrr) || planPrices[tenant.subscription_plan?.toLowerCase() || SUBSCRIPTION_PLANS.STARTER] || 0;
            monthlyRevenue[monthKey] += mrr;
          }
        });
      }

      return Object.entries(monthlyRevenue).map(([date, revenue]) => ({
        date,
        revenue: Math.round(revenue),
      }));
    },
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  // Fetch recent activity from audit logs
  const { data: recentActivity = [] } = useQuery({
    queryKey: queryKeys.superAdminTools.recentActivity(),
    queryFn: async () => {
      const { data: logs, error } = await supabase
        .from('audit_logs' as 'tenants')
        .select('id, action, resource_type, resource_id, tenant_id, timestamp, changes')
        .order('timestamp', { ascending: false })
        .limit(20);

      if (error || !logs) return [];

      const logRecords = logs as unknown as Array<Record<string, unknown>>;
      // Fetch tenant names for tenant-related actions
      const tenantIds = [...new Set(logRecords.map((log) => log.tenant_id as string).filter(Boolean))];
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('id, business_name')
        .in('id', tenantIds);

      const tenantMap = new Map(tenantData?.map((t) => [t.id, t.business_name]) ?? []);

      return logRecords.map((log) => {
        let type: 'tenant_created' | 'tenant_updated' | 'subscription_changed' | 'payment_received' | 'system_event' = 'system_event';
        let message = '';
        const logTenantId = log.tenant_id as string | null;

        if (log.action === 'create' && log.resource_type === 'tenant') {
          type = 'tenant_created';
          const tenantName = logTenantId ? tenantMap.get(logTenantId) : 'Unknown';
          message = `New tenant "${tenantName || 'Unknown'}" signed up`;
        } else if (log.action === 'update' && log.resource_type === 'tenant') {
          type = 'tenant_updated';
          const tenantName = logTenantId ? tenantMap.get(logTenantId) : 'Unknown';
          const changes = log.changes as Record<string, unknown> | null;
          if (changes?.subscription_plan) {
            type = 'subscription_changed';
            message = `${tenantName || 'A tenant'} updated subscription plan`;
          } else {
            message = `${tenantName || 'A tenant'} was updated`;
          }
        } else if (log.action === 'payment' || log.action === 'payment_received') {
          type = 'payment_received';
          const tenantName = logTenantId ? tenantMap.get(logTenantId) : 'Unknown';
          message = `Payment received from "${tenantName || 'Unknown'}"`;
        } else {
          message = `${log.action} on ${(log.resource_type as string) || 'resource'}`;
        }

        return {
          id: log.id as string,
          type,
          message,
          timestamp: (log.timestamp as string) || (log.created_at as string) || new Date().toISOString(),
        };
      });
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30000, // Refetch every 30 seconds for near real-time updates
  });

  const platformStats = stats || {
    mrr: 0,
    arr: 0,
    commission: 0,
    totalTenants: 0,
    activeTenants: 0,
    trialTenants: 0,
    churnRate: 0,
    avgHealthScore: 100,
  };

  // Calculate trial conversion rate from actual data
  const { data: trialConversionRate = 0 } = useQuery({
    queryKey: queryKeys.superAdminTools.trialConversion(),
    queryFn: async () => {
      const { data: allTenants } = await supabase
        .from('tenants')
        .select('subscription_status, created_at');

      if (!allTenants) return 0;

      const totalTrials = allTenants.filter(
        (t) => t.subscription_status === 'trial' || t.subscription_status === 'trialing'
      ).length;
      // Note: converted trials are trials that became active (tracked separately)
      const convertedTrials = 0; // This needs proper tracking through subscription history

      // Calculate conversion rate: trials that became active
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentTrials = allTenants.filter(
        (t) => (t.subscription_status === 'trial' || t.subscription_status === 'trialing') &&
          new Date(t.created_at ?? 0) > thirtyDaysAgo
      );

      // Get all tenants that were trials and are now active
      const { data: convertedTenants } = await supabase
        .from('tenants')
        .select('id, created_at, subscription_status')
        .eq('subscription_status', 'active')
        .gte('created_at', thirtyDaysAgo.toISOString());

      const recentConverted = convertedTenants?.filter((t) =>
        recentTrials.some((rt) => rt.id === t.id)
      ) ?? [];

      return recentTrials.length > 0
        ? Math.round((recentConverted.length / recentTrials.length) * 100)
        : totalTrials > 0
          ? Math.round((convertedTrials / totalTrials) * 100)
          : 0;
    },
  });

  // Calculate expiring soon (within 7 days)
  const expiringSoon = activeTrials.filter((trial) => {
    if (!trial.created_at) return false;
    const trialEnd = new Date(trial.created_at);
    trialEnd.setDate(trialEnd.getDate() + 14); // 14-day trial
    const daysUntilEnd = Math.floor(
      (trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilEnd <= 7 && daysUntilEnd > 0;
  }).length;

  if (statsLoading) {
    return <EnhancedLoadingState variant="dashboard" message="Loading dashboard..." />;
  }

  return (
    <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-screen-2xl mx-auto">
      {/* Hero Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(platformStats.mrr)}
          change="+12.5%"
          trend="up"
          icon={DollarSign}
          sparkline={revenueData.map((d) => ({ date: d.date, value: d.revenue }))}
        />
        <MetricCard
          title="Active Tenants"
          value={platformStats.activeTenants}
          change={`+${platformStats.totalTenants - platformStats.activeTenants}`}
          trend="up"
          icon={Building2}
        />
        <MetricCard
          title="MRR"
          value={formatCurrency(platformStats.mrr)}
          change="+5.2%"
          trend="up"
          icon={TrendingUp}
        />
        <MetricCard
          title="Churn Rate"
          value={`${platformStats.churnRate.toFixed(1)}%`}
          change="-0.5%"
          trend="down"
          icon={TrendingDown}
        />
        <MetricCard
          title="Health Score"
          value={`${Math.round(platformStats.avgHealthScore)}/100`}
          change="+3"
          trend="up"
          icon={Heart}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Revenue Over Time</CardTitle>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="90d">Last 90 Days</SelectItem>
                    <SelectItem value="1y">Last Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#revenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Growth Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Growth Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <GrowthMetricsCard stats={platformStats} />
            </CardContent>
          </Card>

          {/* Recent Activity Feed */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed items={recentActivity} />
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1/3 width) */}
        <div className="space-y-6">
          {/* At-Risk Tenants */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>At-Risk Tenants</CardTitle>
                <Badge variant="destructive">{atRiskTenants.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {atRiskTenants.length > 0 ? (
                  atRiskTenants.map((tenant) => (
                    <AtRiskTenantCard
                      key={tenant.id}
                      tenant={tenant}
                      onAction={(id) => navigate(`/super-admin/tenants/${id}`)}
                    />
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8 text-sm">
                    No at-risk tenants
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/super-admin/tenants?filter=at-risk">View All At-Risk</Link>
              </Button>
            </CardFooter>
          </Card>

          {/* Trial Conversions */}
          <Card>
            <CardHeader>
              <CardTitle>Active Trials</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Conversion Rate</span>
                  <span className="text-2xl font-bold">{trialConversionRate}%</span>
                </div>
                <Progress value={trialConversionRate} />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-muted-foreground">Active</div>
                    <div className="text-lg font-semibold">{activeTrials.length}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Expiring Soon</div>
                    <div className="text-lg font-semibold text-warning">{expiringSoon}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/super-admin/tenants/new')}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Create New Tenant
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/super-admin/communication')}
              >
                <Megaphone className="mr-2 h-4 w-4" />
                Send Announcement
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/super-admin/report-builder')}
              >
                <FileText className="mr-2 h-4 w-4" />
                Generate Report
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/super-admin/system-config')}
              >
                <Settings className="mr-2 h-4 w-4" />
                System Settings
              </Button>
            </CardContent>
          </Card>

          {/* System Health */}
          <SystemHealthMonitor />
        </div>
      </div>
    </div>
  );
}
