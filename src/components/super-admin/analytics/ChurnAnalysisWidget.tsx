/**
 * Churn Analysis Widget
 * Analyzes tenant churn patterns with cohort breakdown
 * Inspired by Mixpanel and Amplitude cohort analysis
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { TrendingDown, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { queryKeys } from '@/lib/queryKeys';

interface ChurnData {
  month: string;
  totalTenants: number;
  churned: number;
  churnRate: number;
  revenueLost: number;
}

export function ChurnAnalysisWidget() {
  const { data: churnData, isLoading } = useQuery({
    queryKey: queryKeys.superAdminTools.churnAnalysis(),
    queryFn: async () => {
      // Get all tenants with cancellation dates
      const { data: tenants, error } = await supabase
        .from('tenants')
        .select('id, created_at, cancelled_at, subscription_plan, mrr')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by month
      const monthlyData: Record<string, ChurnData> = {};
      const now = new Date();
      
      // Analyze last 12 months
      for (let i = 11; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const monthKey = format(monthStart, 'MMM yyyy');

        // Count total tenants at start of month
        const totalAtStart = tenants?.filter(
          (t) => new Date(t.created_at) <= monthEnd
        ).length ?? 0;

        // Count churned in this month
        const churned = tenants?.filter(
          (t) =>
            t.cancelled_at &&
            new Date(t.cancelled_at) >= monthStart &&
            new Date(t.cancelled_at) <= monthEnd
        ).length ?? 0;

        // Calculate revenue lost
        const revenueLost = tenants
          ?.filter(
            (t) =>
              t.cancelled_at &&
              new Date(t.cancelled_at) >= monthStart &&
              new Date(t.cancelled_at) <= monthEnd
          )
          .reduce((sum, t) => sum + (t.mrr ?? 0), 0) ?? 0;

        const churnRate = totalAtStart > 0 ? (churned / totalAtStart) * 100 : 0;

        monthlyData[monthKey] = {
          month: monthKey,
          totalTenants: totalAtStart,
          churned,
          churnRate: Math.round(churnRate * 10) / 10,
          revenueLost,
        };
      }

      // Calculate overall metrics
      const totalChurned = tenants?.filter((t) => t.cancelled_at).length ?? 0;
      const totalRevenueLost = tenants
        ?.filter((t) => t.cancelled_at)
        .reduce((sum, t) => sum + (t.mrr ?? 0), 0) ?? 0;
      
      const avgChurnRate =
        Object.values(monthlyData).reduce((sum, d) => sum + d.churnRate, 0) /
        Object.values(monthlyData).length;

      return {
        monthlyData: Object.values(monthlyData),
        totalChurned,
        totalRevenueLost,
        avgChurnRate: Math.round(avgChurnRate * 10) / 10,
      };
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Churn Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!churnData) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          Churn Analysis (12 Months)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Churned</p>
            <p className="text-2xl font-bold">{churnData.totalChurned}</p>
            <p className="text-xs text-muted-foreground">Tenants</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg Churn Rate</p>
            <p className="text-2xl font-bold">{churnData.avgChurnRate}%</p>
            <p className="text-xs text-muted-foreground">Per month</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Revenue Lost</p>
            <p className="text-2xl font-bold">
              ${churnData.totalRevenueLost.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">MRR</p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={churnData.monthlyData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="month"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Legend />
            <Bar 
              yAxisId="left"
              dataKey="churnRate" 
              fill="#ef4444" 
              name="Churn Rate %"
              radius={[8, 8, 0, 0]}
            />
            <Bar 
              yAxisId="right"
              dataKey="churned" 
              fill="#f59e0b" 
              name="Churned Tenants"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>

        {churnData.avgChurnRate > 5 && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-500">High Churn Rate Detected</p>
              <p className="text-xs text-muted-foreground mt-1">
                Average churn rate of {churnData.avgChurnRate}% is above industry standard (3-5%).
                Consider implementing retention strategies.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

