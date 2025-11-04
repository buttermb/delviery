/**
 * Lifetime Value Calculator
 * Calculates customer lifetime value (LTV) with cohort analysis
 * Inspired by Stripe's LTV metrics
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, Calculator } from 'lucide-react';
import { useState } from 'react';

interface LTVMetrics {
  avgLTV: number;
  avgLifetimeMonths: number;
  avgMonthlyRevenue: number;
  churnRate: number;
  ltvByPlan: Record<string, number>;
  ltvByCohort: Array<{
    cohort: string;
    ltv: number;
    tenantCount: number;
  }>;
}

export function LTVCalculator() {
  const [customChurnRate, setCustomChurnRate] = useState<number | null>(null);
  const [customARPU, setCustomARPU] = useState<number | null>(null);

  const { data: ltvData, isLoading } = useQuery({
    queryKey: ['ltv-calculator', customChurnRate, customARPU],
    queryFn: async () => {
      const { data: tenants, error } = await supabase
        .from('tenants')
        .select('id, created_at, cancelled_at, subscription_plan, mrr')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const activeTenants = tenants?.filter((t) => t.subscription_status === 'active') || [];
      const cancelledTenants = tenants?.filter((t) => t.cancelled_at) || [];

      // Calculate average monthly revenue per tenant (ARPU)
      const totalMRR = activeTenants.reduce((sum, t) => sum + (t.mrr || 0), 0);
      const avgARPU = customARPU || (activeTenants.length > 0 ? totalMRR / activeTenants.length : 0);

      // Calculate average lifetime (in months)
      const lifetimes = cancelledTenants.map((t) => {
        const created = new Date(t.created_at);
        const cancelled = new Date(t.cancelled_at!);
        const months = (cancelled.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 30);
        return months;
      });

      const avgLifetimeMonths =
        lifetimes.length > 0
          ? lifetimes.reduce((sum, months) => sum + months, 0) / lifetimes.length
          : 12; // Default to 12 months if no cancellations

      // Calculate churn rate
      const totalTenants = tenants?.length || 0;
      const churnRate =
        customChurnRate ||
        (totalTenants > 0 ? (cancelledTenants.length / totalTenants) * 100 : 0);

      // LTV = ARPU / Churn Rate (simplified formula)
      const avgLTV = churnRate > 0 ? (avgARPU / (churnRate / 100)) : avgARPU * avgLifetimeMonths;

      // LTV by plan
      const ltvByPlan: Record<string, number> = {};
      const planPrices: Record<string, number> = {
        starter: 99,
        professional: 299,
        enterprise: 799,
      };

      Object.entries(planPrices).forEach(([plan, price]) => {
        const planTenants = tenants?.filter((t) => t.subscription_plan === plan) || [];
        const planChurned = planTenants.filter((t) => t.cancelled_at).length;
        const planChurnRate =
          planTenants.length > 0 ? (planChurned / planTenants.length) * 100 : churnRate;
        ltvByPlan[plan] = planChurnRate > 0 ? price / (planChurnRate / 100) : price * 12;
      });

      // LTV by cohort (group by signup month)
      const cohortMap = new Map<string, { tenants: typeof tenants; cancelled: number }>();
      
      tenants?.forEach((t) => {
        const cohort = new Date(t.created_at).toISOString().slice(0, 7); // YYYY-MM
        if (!cohortMap.has(cohort)) {
          cohortMap.set(cohort, { tenants: [], cancelled: 0 });
        }
        const cohortData = cohortMap.get(cohort)!;
        cohortData.tenants.push(t);
        if (t.cancelled_at) {
          cohortData.cancelled++;
        }
      });

      const ltvByCohort = Array.from(cohortMap.entries())
        .map(([cohort, data]) => {
          const cohortChurnRate =
            data.tenants.length > 0 ? (data.cancelled / data.tenants.length) * 100 : 0;
          const cohortARPU =
            data.tenants.length > 0
              ? data.tenants.reduce((sum, t) => sum + (t.mrr || 0), 0) / data.tenants.length
              : avgARPU;
          const cohortLTV =
            cohortChurnRate > 0 ? cohortARPU / (cohortChurnRate / 100) : cohortARPU * 12;

          return {
            cohort,
            ltv: cohortLTV,
            tenantCount: data.tenants.length,
          };
        })
        .sort((a, b) => b.cohort.localeCompare(a.cohort))
        .slice(0, 12); // Last 12 cohorts

      return {
        avgLTV,
        avgLifetimeMonths: Math.round(avgLifetimeMonths * 10) / 10,
        avgMonthlyRevenue: avgARPU,
        churnRate: Math.round(churnRate * 10) / 10,
        ltvByPlan,
        ltvByCohort,
      } as LTVMetrics;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Lifetime Value Calculator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!ltvData) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Lifetime Value (LTV) Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Custom Inputs */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="churn-rate">Custom Churn Rate (%)</Label>
            <Input
              id="churn-rate"
              type="number"
              step="0.1"
              placeholder={ltvData.churnRate.toString()}
              value={customChurnRate || ''}
              onChange={(e) =>
                setCustomChurnRate(e.target.value ? parseFloat(e.target.value) : null)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="arpu">Custom ARPU ($/month)</Label>
            <Input
              id="arpu"
              type="number"
              step="0.01"
              placeholder={ltvData.avgMonthlyRevenue.toFixed(2)}
              value={customARPU || ''}
              onChange={(e) =>
                setCustomARPU(e.target.value ? parseFloat(e.target.value) : null)
              }
            />
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Average LTV</p>
            <p className="text-2xl font-bold">
              ${ltvData.avgLTV.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg Lifetime</p>
            <p className="text-2xl font-bold">{ltvData.avgLifetimeMonths} months</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg ARPU</p>
            <p className="text-2xl font-bold">
              ${ltvData.avgMonthlyRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Churn Rate</p>
            <p className="text-2xl font-bold">{ltvData.churnRate}%</p>
          </div>
        </div>

        {/* LTV by Plan */}
        <div>
          <h3 className="text-sm font-semibold mb-3">LTV by Plan</h3>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(ltvData.ltvByPlan).map(([plan, ltv]) => (
              <div
                key={plan}
                className="p-3 border rounded-lg bg-muted/50"
              >
                <p className="text-xs text-muted-foreground uppercase">{plan}</p>
                <p className="text-lg font-bold">
                  ${ltv.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* LTV by Cohort */}
        <div>
          <h3 className="text-sm font-semibold mb-3">LTV by Cohort (Last 12 Months)</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {ltvData.ltvByCohort.map((cohort) => (
              <div
                key={cohort.cohort}
                className="flex items-center justify-between p-2 border rounded text-sm"
              >
                <span className="font-medium">{cohort.cohort}</span>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">
                    {cohort.tenantCount} tenants
                  </span>
                  <Badge variant="outline">
                    ${cohort.ltv.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Formula */}
        <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
          <p className="font-medium mb-1">LTV Formula:</p>
          <p>LTV = ARPU / (Churn Rate / 100)</p>
          <p className="mt-2">
            Current: ${ltvData.avgMonthlyRevenue.toFixed(2)} / ({ltvData.churnRate}% / 100) = $
            {ltvData.avgLTV.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

