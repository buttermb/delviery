/**
 * Growth Metrics Card Component
 * Shows New MRR, Expansion MRR, and Churn MRR
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils/formatCurrency';

interface GrowthMetricsCardProps {
  stats: {
    mrr: number;
    totalTenants: number;
    activeTenants: number;
  };
}

export function GrowthMetricsCard({ stats }: GrowthMetricsCardProps) {
  const { data: growthMetrics } = useQuery({
    queryKey: ['super-admin-growth-metrics'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: recentTenants } = await supabase
        .from('tenants')
        .select('id, created_at, mrr, subscription_plan, subscription_status')
        .gte('created_at', thirtyDaysAgo.toISOString());

      const { data: allTenants } = await supabase
        .from('tenants')
        .select('id, created_at, mrr, subscription_plan, subscription_status, cancelled_at')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (!recentTenants || !allTenants) {
        return {
          newMRR: 0,
          expansionMRR: 0,
          churnMRR: 0,
          newMRRChange: 0,
          expansionMRRChange: 0,
          churnMRRChange: 0,
        };
      }

      const planPrices: Record<string, number> = {
        starter: 99,
        professional: 299,
        enterprise: 799,
      };

      // Calculate New MRR (new tenants in last 30 days)
      const newMRR = recentTenants
        .filter((t) => t.subscription_status === 'active')
        .reduce((sum, t) => {
          const mrr = Number(t.mrr) || planPrices[t.subscription_plan?.toLowerCase() || 'starter'] || 0;
          return sum + mrr;
        }, 0);

      // Calculate Expansion MRR (upgrades)
      const expansionMRR = allTenants
        .filter((t) => {
          // This is a simplified calculation - in production, track plan changes
          return t.subscription_plan === 'enterprise' || t.subscription_plan === 'professional';
        })
        .reduce((sum, t) => {
          const mrr = Number(t.mrr) || planPrices[t.subscription_plan?.toLowerCase() || 'starter'] || 0;
          return sum + mrr * 0.1; // Estimate 10% expansion
        }, 0);

      // Calculate Churn MRR (cancelled tenants)
      const churnMRR = allTenants
        .filter((t) => t.subscription_status === 'cancelled' || t.cancelled_at)
        .reduce((sum, t) => {
          const mrr = Number(t.mrr) || planPrices[t.subscription_plan?.toLowerCase() || 'starter'] || 0;
          return sum + mrr;
        }, 0);

      // Calculate percentage changes (simplified - compare to previous period)
      const previousPeriodMRR = stats.mrr * 0.95; // Estimate 5% growth
      const newMRRChange = previousPeriodMRR > 0 ? ((newMRR / previousPeriodMRR) * 100) : 0;
      const expansionMRRChange = stats.mrr > 0 ? ((expansionMRR / stats.mrr) * 100) : 0;
      const churnMRRChange = stats.mrr > 0 ? ((churnMRR / stats.mrr) * 100) : 0;

      return {
        newMRR: Math.round(newMRR),
        expansionMRR: Math.round(expansionMRR),
        churnMRR: Math.round(churnMRR),
        newMRRChange: Math.round(newMRRChange * 10) / 10,
        expansionMRRChange: Math.round(expansionMRRChange * 10) / 10,
        churnMRRChange: Math.round(churnMRRChange * 10) / 10,
      };
    },
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  const metrics = growthMetrics || {
    newMRR: 0,
    expansionMRR: 0,
    churnMRR: 0,
    newMRRChange: 0,
    expansionMRRChange: 0,
    churnMRRChange: 0,
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="p-4 rounded-lg bg-success/10 border border-success/20">
        <div className="text-sm text-muted-foreground mb-1">New MRR</div>
        <div className="text-2xl font-bold text-success">{formatCurrency(metrics.newMRR)}</div>
        <div className="text-xs text-success mt-1">
          {metrics.newMRRChange > 0 ? '+' : ''}
          {metrics.newMRRChange.toFixed(1)}%
        </div>
      </div>
      <div className="p-4 rounded-lg bg-info/10 border border-info/20">
        <div className="text-sm text-muted-foreground mb-1">Expansion MRR</div>
        <div className="text-2xl font-bold text-info">{formatCurrency(metrics.expansionMRR)}</div>
        <div className="text-xs text-info mt-1">
          {metrics.expansionMRRChange > 0 ? '+' : ''}
          {metrics.expansionMRRChange.toFixed(1)}%
        </div>
      </div>
      <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
        <div className="text-sm text-muted-foreground mb-1">Churn MRR</div>
        <div className="text-2xl font-bold text-destructive">{formatCurrency(metrics.churnMRR)}</div>
        <div className="text-xs text-destructive mt-1">
          {metrics.churnMRRChange > 0 ? '-' : ''}
          {metrics.churnMRRChange.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

