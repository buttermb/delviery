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
  Mail,
  CreditCard,
  Ban,
  Download,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { calculateHealthScore } from '@/lib/tenant';
import { MetricCard } from '@/components/super-admin/dashboard/MetricCard';
import { ActivityFeed } from '@/components/super-admin/dashboard/ActivityFeed';
import { AtRiskTenantCard } from '@/components/super-admin/dashboard/AtRiskTenantCard';
import { HealthIndicator } from '@/components/super-admin/dashboard/HealthIndicator';
import { GrowthMetricsCard } from '@/components/super-admin/dashboard/GrowthMetricsCard';
import { SystemHealthMonitor } from '@/components/super-admin/SystemHealthMonitor';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useState, useEffect } from 'react';
import { AnimatedNumber } from '@/components/shared/AnimatedNumber';

export default function SuperAdminDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState('30d');

  // Fetch platform stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['super-admin-platform-stats'],
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
          t.subscription_status === 'cancelled' &&
          new Date(t.created_at || 0) > thirtyDaysAgo
      );
      const churnRate =
        active.length > 0 ? (recentCancelled.length / active.length) * 100 : 0;

      // Calculate health score (average of all tenants)
      const healthScores = tenants.map((t) => calculateHealthScore(t).score);
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
    refetchInterval: 30000,
  });

  // Fetch at-risk tenants
  const { data: atRiskTenants = [] } = useQuery({
    queryKey: ['super-admin-at-risk-tenants'],
    queryFn: async () => {
      const { data: tenants } = await supabase
        .from('tenants')
        .select('*')
        .in('subscription_status', ['active', 'trial', 'trialing']);

      if (!tenants) return [];

      return tenants
        .map((tenant) => {
          const health = calculateHealthScore(tenant);
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
    refetchInterval: 30000,
  });

  // Fetch active trials
  const { data: activeTrials = [] } = useQuery({
    queryKey: ['super-admin-active-trials'],
    queryFn: async () => {
      const { data: tenants } = await supabase
        .from('tenants')
        .select('*')
        .in('subscription_status', ['trial', 'trialing']);

      return tenants || [];
    },
  });

  // Fetch revenue data over time (last 12 months)
  const { data: revenueData = [] } = useQuery({
    queryKey: ['super-admin-revenue-history', timeRange],
    queryFn: async () => {
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, created_at, mrr, subscription_status, subscription_plan');

      if (!tenants) return [];

      const planPrices: Record<string, number> = {
        starter: 99,
        professional: 299,
        enterprise: 799,
      };

      // Calculate monthly revenue for last 12 months
      const monthlyRevenue: Record<string, number> = {};
      const now = new Date();

      for (let i = 11; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = month.toLocaleDateString('en-US', { month: 'short' });
        monthlyRevenue[monthKey] = 0;

        tenants.forEach((tenant) => {
          const tenantCreated = new Date(tenant.created_at || 0);
          const tenantMonth = new Date(tenantCreated.getFullYear(), tenantCreated.getMonth(), 1);
          
          // Only count if tenant existed in this month and was active
          if (tenantMonth <= month && tenant.subscription_status === 'active') {
            const mrr = Number(tenant.mrr) || planPrices[tenant.subscription_plan?.toLowerCase() || 'starter'] || 0;
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
    queryKey: ['super-admin-recent-activity'],
    queryFn: async () => {
      const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('id, action, resource_type, resource_id, tenant_id, timestamp, changes')
        .order('timestamp', { ascending: false })
        .limit(20);

      if (error || !logs) return [];

      // Fetch tenant names for tenant-related actions
      const tenantIds = [...new Set(logs.map((log) => log.tenant_id).filter(Boolean))];
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('id, business_name')
        .in('id', tenantIds);

      const tenantMap = new Map(tenantData?.map((t) => [t.id, t.business_name]) || []);

      return logs.map((log) => {
        let type: 'tenant_created' | 'tenant_updated' | 'subscription_changed' | 'payment_received' | 'system_event' = 'system_event';
        let message = '';

        if (log.action === 'create' && log.resource_type === 'tenant') {
          type = 'tenant_created';
          const tenantName = log.tenant_id ? tenantMap.get(log.tenant_id) : 'Unknown';
          message = `New tenant "${tenantName || 'Unknown'}" signed up`;
        } else if (log.action === 'update' && log.resource_type === 'tenant') {
          type = 'tenant_updated';
          const tenantName = log.tenant_id ? tenantMap.get(log.tenant_id) : 'Unknown';
          const changes = log.changes as Record<string, unknown> | null;
          if (changes?.subscription_plan) {
            type = 'subscription_changed';
            message = `${tenantName || 'A tenant'} updated subscription plan`;
          } else {
            message = `${tenantName || 'A tenant'} was updated`;
          }
        } else if (log.action === 'payment' || log.action === 'payment_received') {
          type = 'payment_received';
          const tenantName = log.tenant_id ? tenantMap.get(log.tenant_id) : 'Unknown';
          message = `Payment received from "${tenantName || 'Unknown'}"`;
        } else {
          message = `${log.action} on ${log.resource_type || 'resource'}`;
        }

        return {
          id: log.id,
          type,
          message,
          timestamp: log.timestamp || log.created_at || new Date().toISOString(),
        };
      });
    },
    refetchInterval: 30000, // Refetch every 30 seconds
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
    queryKey: ['super-admin-trial-conversion'],
    queryFn: async () => {
      const { data: allTenants } = await supabase
        .from('tenants')
        .select('subscription_status, created_at');

      if (!allTenants) return 0;

      const totalTrials = allTenants.filter(
        (t) => t.subscription_status === 'trial' || t.subscription_status === 'trialing'
      ).length;
      const convertedTrials = allTenants.filter(
        (t) => (t.subscription_status === 'trial' || t.subscription_status === 'trialing') &&
          t.subscription_status === 'active'
      ).length;

      // Calculate conversion rate: trials that became active
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentTrials = allTenants.filter(
        (t) => (t.subscription_status === 'trial' || t.subscription_status === 'trialing') &&
          new Date(t.created_at || 0) > thirtyDaysAgo
      );
      
      // Get all tenants that were trials and are now active
      const { data: convertedTenants } = await supabase
        .from('tenants')
        .select('id, created_at, subscription_status')
        .eq('subscription_status', 'active')
        .gte('created_at', thirtyDaysAgo.toISOString());

      const recentConverted = convertedTenants?.filter((t) =>
        recentTrials.some((rt) => rt.id === t.id)
      ) || [];

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
    return (
      <div className="p-6">
        <div className="text-center py-12">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Hero Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Revenue Over Time</CardTitle>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
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
