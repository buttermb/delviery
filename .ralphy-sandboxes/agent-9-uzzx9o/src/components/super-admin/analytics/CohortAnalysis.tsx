/**
 * Cohort Analysis Component
 * Analyzes tenant behavior by signup cohort
 * Inspired by Mixpanel cohort analysis
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Users } from 'lucide-react';
import { format } from 'date-fns';
import { queryKeys } from '@/lib/queryKeys';

interface CohortData {
  cohort: string;
  totalTenants: number;
  active: number;
  churned: number;
  retentionRates: Record<string, number>; // month -> retention %
  revenue: number;
}

export function CohortAnalysis() {
  const { data: cohortData, isLoading } = useQuery({
    queryKey: queryKeys.superAdminTools.cohortAnalysis(),
    queryFn: async () => {
      const { data: tenants, error } = await supabase
        .from('tenants')
        .select('id, created_at, cancelled_at, subscription_status, mrr')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group tenants by cohort (signup month)
      const cohortMap = new Map<string, typeof tenants>();

      tenants?.forEach((tenant) => {
        const cohort = format(new Date(tenant.created_at), 'yyyy-MM');
        if (!cohortMap.has(cohort)) {
          cohortMap.set(cohort, []);
        }
        const cohortList = cohortMap.get(cohort);
        if (cohortList) cohortList.push(tenant);
      });

      // Calculate retention for each cohort
      const cohorts: CohortData[] = [];
      const now = new Date();

      Array.from(cohortMap.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 12) // Last 12 months
        .forEach(([cohort, cohortTenants]) => {
          const cohortDate = new Date(cohort + '-01');
          const monthsSinceCohort = Math.floor(
            (now.getTime() - cohortDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
          );

          const active = cohortTenants.filter(
            (t) => t.subscription_status === 'active'
          ).length;
          const churned = cohortTenants.filter((t) => t.cancelled_at).length;
          const revenue = cohortTenants.reduce((sum, t) => sum + (t.mrr ?? 0), 0);

          // Calculate retention rates for each month
          const retentionRates: Record<string, number> = {};
          const initialCount = cohortTenants.length;

          for (let month = 0; month <= Math.min(monthsSinceCohort, 12); month++) {
            const monthDate = new Date(cohortDate);
            monthDate.setMonth(monthDate.getMonth() + month);

            // Count tenants still active at this month
            const stillActive = cohortTenants.filter((t) => {
              if (t.cancelled_at) {
                return new Date(t.cancelled_at) > monthDate;
              }
              return t.subscription_status === 'active';
            }).length;

            const retentionRate = initialCount > 0 ? (stillActive / initialCount) * 100 : 0;
            retentionRates[`Month ${month}`] = Math.round(retentionRate * 10) / 10;
          }

          cohorts.push({
            cohort: format(cohortDate, 'MMM yyyy'),
            totalTenants: cohortTenants.length,
            active,
            churned,
            retentionRates,
            revenue,
          });
        });

      // Calculate average retention
      const avgRetention = cohorts.reduce((sum, c) => {
        const month1Retention = c.retentionRates['Month 1'] ?? 0;
        return sum + month1Retention;
      }, 0) / cohorts.length;

      return {
        cohorts,
        avgRetention: Math.round(avgRetention * 10) / 10,
      };
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Cohort Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!cohortData) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Cohort Analysis
          <Badge variant="outline" className="ml-auto">
            Last 12 Cohorts
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">Average Month 1 Retention</p>
          <p className="text-2xl font-bold">{cohortData.avgRetention}%</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th scope="col" className="text-left p-2 font-semibold">Cohort</th>
                <th scope="col" className="text-right p-2 font-semibold">Total</th>
                <th scope="col" className="text-right p-2 font-semibold">Active</th>
                <th scope="col" className="text-right p-2 font-semibold">Churned</th>
                <th scope="col" className="text-right p-2 font-semibold">M0</th>
                <th scope="col" className="text-right p-2 font-semibold">M1</th>
                <th scope="col" className="text-right p-2 font-semibold">M3</th>
                <th scope="col" className="text-right p-2 font-semibold">M6</th>
                <th scope="col" className="text-right p-2 font-semibold">M12</th>
                <th scope="col" className="text-right p-2 font-semibold">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {cohortData.cohorts.map((cohort) => (
                <tr key={cohort.cohort} className="border-b hover:bg-muted/50">
                  <td className="p-2 font-medium">{cohort.cohort}</td>
                  <td className="p-2 text-right">{cohort.totalTenants}</td>
                  <td className="p-2 text-right text-green-600">{cohort.active}</td>
                  <td className="p-2 text-right text-red-600">{cohort.churned}</td>
                  <td className="p-2 text-right">
                    {cohort.retentionRates['Month 0']?.toFixed(1) || '-'}%
                  </td>
                  <td className="p-2 text-right">
                    {cohort.retentionRates['Month 1']?.toFixed(1) || '-'}%
                  </td>
                  <td className="p-2 text-right">
                    {cohort.retentionRates['Month 3']?.toFixed(1) || '-'}%
                  </td>
                  <td className="p-2 text-right">
                    {cohort.retentionRates['Month 6']?.toFixed(1) || '-'}%
                  </td>
                  <td className="p-2 text-right">
                    {cohort.retentionRates['Month 12']?.toFixed(1) || '-'}%
                  </td>
                  <td className="p-2 text-right font-medium">
                    ${cohort.revenue.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
          <p className="font-medium mb-1">Retention Metrics:</p>
          <p>M0 = Month 0 (signup), M1 = Month 1, etc.</p>
          <p>Percentage shows tenants still active at that month</p>
        </div>
      </CardContent>
    </Card>
  );
}

