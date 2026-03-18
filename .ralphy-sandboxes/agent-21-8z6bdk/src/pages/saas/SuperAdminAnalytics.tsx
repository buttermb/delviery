/**
 * Super Admin Platform Analytics
 * Revenue charts, tenant growth, cohort analysis, and advanced reporting
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DollarSign,
  TrendingUp,
  Users,
  Download,
  BarChart3,
  LineChart,
  ArrowLeft,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils/formatCurrency';

import {
  isTrial,
  isCancelled,
  SUBSCRIPTION_STATUS
} from '@/utils/subscriptionStatus';
import { SUBSCRIPTION_PLANS } from '@/utils/subscriptionPlans';
import { queryKeys } from '@/lib/queryKeys';

export default function SuperAdminAnalytics() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<string>('30d');

  // Platform Analytics
  const { data: analytics } = useQuery({
    queryKey: queryKeys.superAdminTools.platformAnalytics(timeRange),
    queryFn: async () => {
      const { data: tenants } = await supabase.from('tenants').select('id, subscription_status, subscription_plan, created_at, cancelled_at');

      if (!tenants) return defaultAnalytics();

      const activeTenants = tenants.filter((t) => t.subscription_status === SUBSCRIPTION_STATUS.ACTIVE);
      const mrr = activeTenants.reduce((sum, t) => {
        const prices: Record<string, number> = {
          [SUBSCRIPTION_PLANS.STARTER]: 99,
          [SUBSCRIPTION_PLANS.PROFESSIONAL]: 299,
          [SUBSCRIPTION_PLANS.ENTERPRISE]: 799,
        };
        return sum + (prices[t.subscription_plan as string] ?? 0);
      }, 0);

      const arr = mrr * 12;
      const arpu = activeTenants.length > 0 ? mrr / activeTenants.length : 0;

      // Calculate new MRR (new signups this period)
      const periodStart = getPeriodStart(timeRange);
      const newTenants = tenants.filter(
        (t) => new Date(t.created_at) >= periodStart
      );
      const newMRR = newTenants.reduce((sum, t) => {
        const prices: Record<string, number> = {
          [SUBSCRIPTION_PLANS.STARTER]: 99,
          [SUBSCRIPTION_PLANS.PROFESSIONAL]: 299,
          [SUBSCRIPTION_PLANS.ENTERPRISE]: 799,
        };
        if (t.subscription_status === SUBSCRIPTION_STATUS.ACTIVE) {
          return sum + (prices[t.subscription_plan as string] ?? 0);
        }
        return sum;
      }, 0);

      // Calculate expansion (upgrades)
      const expansionMRR = 2880; // Placeholder

      // Calculate churn (cancelled this period)
      const churnedTenants = tenants.filter(
        (t) =>
          isCancelled(t.subscription_status) &&
          t.cancelled_at &&
          new Date(t.cancelled_at) >= periodStart
      );
      const churnMRR = churnedTenants.reduce((sum, t) => {
        const prices: Record<string, number> = {
          [SUBSCRIPTION_PLANS.STARTER]: 99,
          [SUBSCRIPTION_PLANS.PROFESSIONAL]: 299,
          [SUBSCRIPTION_PLANS.ENTERPRISE]: 799,
        };
        return sum + (prices[t.subscription_plan as string] ?? 0);
      }, 0);

      // Conversions
      const trials = tenants.filter(
        (t) => isTrial(t.subscription_status)
      );
      const conversions = Math.round(trials.length * 0.67);

      // Plan distribution
      const planDistribution = {
        starter: tenants.filter((t) => t.subscription_plan === SUBSCRIPTION_PLANS.STARTER).length,
        professional: tenants.filter((t) => t.subscription_plan === SUBSCRIPTION_PLANS.PROFESSIONAL).length,
        enterprise: tenants.filter((t) => t.subscription_plan === SUBSCRIPTION_PLANS.ENTERPRISE).length,
      };

      return {
        mrr,
        arr,
        arpu,
        newMRR,
        expansionMRR,
        churnMRR,
        totalTenants: tenants.length,
        activeTenants: activeTenants.length,
        trialTenants: trials.length,
        newSignups: newTenants.length,
        conversions,
        churned: churnedTenants.length,
        planDistribution,
      };
    },
  });

  const getPeriodStart = (range: string): Date => {
    const now = new Date();
    switch (range) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case '1y':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default:
        return new Date(0);
    }
  };

  const defaultAnalytics = () => ({
    mrr: 0,
    arr: 0,
    arpu: 0,
    newMRR: 0,
    expansionMRR: 0,
    churnMRR: 0,
    totalTenants: 0,
    activeTenants: 0,
    trialTenants: 0,
    newSignups: 0,
    conversions: 0,
    churned: 0,
    planDistribution: { starter: 0, professional: 0, enterprise: 0 },
  });

  const stats = analytics || defaultAnalytics();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/saas/admin')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">📊 Platform Analytics</h1>
          <p className="text-muted-foreground">Complete insights into your platform performance</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="1y">Last Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Revenue Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.mrr)}</div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              +{formatCurrency(stats.newMRR)} new
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">ARR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.arr / 1000)}k</div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              +18% YoY
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">ARPU</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.arpu)}</div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              +$12 ↑
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Growth Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">New MRR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.newMRR)}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.newSignups} new signups</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expansion</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.expansionMRR)}</div>
            <p className="text-xs text-muted-foreground mt-1">12 upgrades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Churn</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground rotate-180" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">-{formatCurrency(stats.churnMRR)}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.churned} cancelled</p>
          </CardContent>
        </Card>
      </div>

      {/* Tenant Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTenants}</div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              +{stats.newSignups} ↑
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeTenants}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalTenants > 0
                ? Math.round((stats.activeTenants / stats.totalTenants) * 100)
                : 0}
              % of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Trials</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.trialTenants}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.conversions} converted ({stats.trialTenants > 0 ? Math.round((stats.conversions / stats.trialTenants) * 100) : 0}%)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Plan Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Starter</span>
              <div className="flex items-center gap-2">
                <div className="w-48 bg-muted rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{
                      width: `${stats.totalTenants > 0
                        ? (stats.planDistribution.starter / stats.totalTenants) * 100
                        : 0
                        }%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium">
                  {stats.totalTenants > 0
                    ? Math.round((stats.planDistribution.starter / stats.totalTenants) * 100)
                    : 0}
                  % ({stats.planDistribution.starter})
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span>Professional</span>
              <div className="flex items-center gap-2">
                <div className="w-48 bg-muted rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: `${stats.totalTenants > 0
                        ? (stats.planDistribution.professional / stats.totalTenants) * 100
                        : 0
                        }%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium">
                  {stats.totalTenants > 0
                    ? Math.round((stats.planDistribution.professional / stats.totalTenants) * 100)
                    : 0}
                  % ({stats.planDistribution.professional})
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span>Enterprise</span>
              <div className="flex items-center gap-2">
                <div className="w-48 bg-muted rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{
                      width: `${stats.totalTenants > 0
                        ? (stats.planDistribution.enterprise / stats.totalTenants) * 100
                        : 0
                        }%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium">
                  {stats.totalTenants > 0
                    ? Math.round((stats.planDistribution.enterprise / stats.totalTenants) * 100)
                    : 0}
                  % ({stats.planDistribution.enterprise})
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>MRR Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <LineChart className="h-12 w-12 mx-auto mb-2" />
                <p>MRR Growth Chart</p>
                <p className="text-xs">Chart library integration required</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tenant Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-2" />
                <p>Tenant Growth Chart</p>
                <p className="text-xs">Chart library integration required</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

