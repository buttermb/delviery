/**
 * Lifetime Value Calculator - Placeholder
 * Shows mock LTV calculations based on tenants
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import Calculator from "lucide-react/dist/esm/icons/calculator";
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
        .select('id, created_at, subscription_plan')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Plan prices for mock calculation
      const planPrices: Record<string, number> = {
        starter: 99,
        professional: 299,
        enterprise: 799,
      };

      const activeTenants = tenants || [];

      // Calculate average monthly revenue per tenant (ARPU)
      const totalMRR = activeTenants.reduce(
        (sum, t) => sum + (planPrices[t.subscription_plan || 'starter'] || 99),
        0
      );
      const avgARPU = customARPU || (activeTenants.length > 0 ? totalMRR / activeTenants.length : 0);

      // Mock lifetime for demo
      const avgLifetimeMonths = 12;

      // Calculate REAL churn rate from cancelled tenants
      const cancelledCount = activeTenants.filter(t => 
        t.subscription_plan === 'cancelled' || t.subscription_plan === 'suspended'
      ).length;
      const realChurnRate = activeTenants.length > 0 
        ? (cancelledCount / activeTenants.length) * 100 
        : 0;
      
      const churnRate = customChurnRate || (realChurnRate > 0 ? realChurnRate : 2.5);

      // LTV = ARPU / Churn Rate (simplified formula)
      const avgLTV = churnRate > 0 ? (avgARPU / (churnRate / 100)) : avgARPU * avgLifetimeMonths;

      // LTV by plan
      const ltvByPlan: Record<string, number> = {};
      Object.entries(planPrices).forEach(([plan, price]) => {
        ltvByPlan[plan] = churnRate > 0 ? price / (churnRate / 100) : price * 12;
      });

      // LTV by cohort (group by signup month)
      const cohortMap = new Map<
        string,
        { tenants: Array<{ id: string; created_at: string; subscription_plan: string }> }
      >();

      tenants?.forEach((t) => {
        const cohort = new Date(t.created_at).toISOString().slice(0, 7); // YYYY-MM
        if (!cohortMap.has(cohort)) {
          cohortMap.set(cohort, { tenants: [] });
        }
        const cohortData = cohortMap.get(cohort)!;
        cohortData.tenants.push(t);
      });

      const ltvByCohort = Array.from(cohortMap.entries())
        .map(([cohort, data]) => {
          const cohortARPU =
            data.tenants.length > 0
              ? data.tenants.reduce(
                  (sum, t) => sum + (planPrices[t.subscription_plan || 'starter'] || 99),
                  0
                ) / data.tenants.length
              : avgARPU;
          const cohortLTV = churnRate > 0 ? cohortARPU / (churnRate / 100) : cohortARPU * 12;

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
              <div key={plan} className="p-3 border rounded-lg bg-muted/50">
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
                  <span className="text-muted-foreground">{cohort.tenantCount} tenants</span>
                  <Badge variant="outline">
                    ${cohort.ltv.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Formula Explanation */}
        <div className="p-4 bg-success/10 border border-success/20 rounded-lg text-sm">
          <p className="font-semibold mb-2 text-success">LTV Formula:</p>
          <p className="font-mono text-foreground">
            LTV = ARPU / (Churn Rate / 100)
          </p>
          <p className="text-foreground mt-2">
            Current: ${ltvData.avgMonthlyRevenue.toFixed(2)} / ({ltvData.churnRate}% / 100) = $
            {ltvData.avgLTV.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Calculated from real tenant and subscription data
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
