import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { Loader2, Target, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { queryKeys } from '@/lib/queryKeys';
import { subDays, startOfDay, endOfDay } from 'date-fns';

interface KPIDashboardProps {
  tenantId: string;
}

interface KPI {
  name: string;
  current: number;
  target: number;
  unit: 'currency' | 'number' | 'percentage';
  icon: React.ReactNode;
}

export function KPIDashboard({ tenantId }: KPIDashboardProps) {
  const { data: kpis, isLoading } = useQuery({
    queryKey: queryKeys.analytics.overview(tenantId),
    queryFn: async (): Promise<KPI[]> => {
      const endDate = endOfDay(new Date());
      const startDate = startOfDay(subDays(endDate, 30));

      const { data: orders } = await supabase
        .from('unified_orders')
        .select('total_amount, status')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      const revenue = (orders ?? []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
      const orderCount = orders?.length ?? 0;
      const completionRate = orderCount > 0
        ? ((orders?.filter(o => ['delivered', 'completed'].includes(o.status || '')).length ?? 0) / orderCount) * 100
        : 0;

      return [
        {
          name: 'Monthly Revenue',
          current: revenue,
          target: 50000,
          unit: 'currency',
          icon: <TrendingUp className="h-4 w-4" />
        },
        {
          name: 'Orders This Month',
          current: orderCount,
          target: 200,
          unit: 'number',
          icon: <Target className="h-4 w-4" />
        },
        {
          name: 'Order Completion Rate',
          current: completionRate,
          target: 95,
          unit: 'percentage',
          icon: <CheckCircle2 className="h-4 w-4" />
        }
      ];
    },
    enabled: !!tenantId,
    staleTime: 60_000
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">KPI Dashboard</h2>
        <p className="text-sm text-muted-foreground">Track performance against targets</p>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {(kpis ?? []).map((kpi) => {
          const percentage = (kpi.current / kpi.target) * 100;
          const isOnTrack = percentage >= 80;
          
          return (
            <Card key={kpi.name}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{kpi.name}</CardTitle>
                {kpi.icon}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-bold">
                    {kpi.unit === 'currency' && formatCurrency(kpi.current)}
                    {kpi.unit === 'number' && kpi.current.toLocaleString()}
                    {kpi.unit === 'percentage' && `${kpi.current.toFixed(1)}%`}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    / {kpi.unit === 'currency' && formatCurrency(kpi.target)}
                    {kpi.unit === 'number' && kpi.target.toLocaleString()}
                    {kpi.unit === 'percentage' && `${kpi.target}%`}
                  </div>
                </div>
                <Progress value={Math.min(percentage, 100)} className="h-2" />
                <div className="flex items-center justify-between text-xs">
                  <span className={isOnTrack ? 'text-emerald-500' : 'text-yellow-500'}>
                    {percentage.toFixed(0)}% of target
                  </span>
                  {isOnTrack ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
