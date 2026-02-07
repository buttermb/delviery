/**
 * MRR Breakdown Chart
 * Monthly Recurring Revenue trends with breakdown by tier
 * Inspired by Stripe's revenue analytics
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface MRRDataPoint {
  month: string;
  total: number;
  starter: number;
  professional: number;
  enterprise: number;
}

export function MRRBreakdownChart() {
  const { data: mrrData, isLoading } = useQuery({
    queryKey: ['mrr-breakdown'],
    queryFn: async () => {
      const { data: tenants, error } = await supabase
        .from('tenants')
        .select('id, created_at, subscription_plan, mrr, subscription_status')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const planPrices: Record<string, number> = {
        starter: 99,
        professional: 299,
        enterprise: 799,
      };

      // Group by month
      const monthlyData: Record<string, MRRDataPoint> = {};
      const now = new Date();

      // Last 12 months
      for (let i = 11; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = format(month, 'MMM yyyy');

        monthlyData[monthKey] = {
          month: monthKey,
          total: 0,
          starter: 0,
          professional: 0,
          enterprise: 0,
        };

        // Calculate MRR for each tenant active at this point
        tenants?.forEach((tenant) => {
          const created = new Date(tenant.created_at);
          const isActive = tenant.subscription_status === 'active';
          
          if (created <= month && isActive) {
            const planPrice = planPrices[tenant.subscription_plan as string] || tenant.mrr || 0;
            monthlyData[monthKey].total += planPrice;
            
            if (tenant.subscription_plan === 'starter') {
              monthlyData[monthKey].starter += planPrice;
            } else if (tenant.subscription_plan === 'professional') {
              monthlyData[monthKey].professional += planPrice;
            } else if (tenant.subscription_plan === 'enterprise') {
              monthlyData[monthKey].enterprise += planPrice;
            }
          }
        });
      }

      return Object.values(monthlyData);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            MRR Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!mrrData || mrrData.length === 0) return null;

  const currentMRR = mrrData[mrrData.length - 1]?.total || 0;
  const previousMRR = mrrData[mrrData.length - 2]?.total || 0;
  const growth = previousMRR > 0 ? ((currentMRR - previousMRR) / previousMRR) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            MRR Breakdown (12 Months)
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-lg">
              ${currentMRR.toLocaleString()}/mo
            </Badge>
            {growth !== 0 && (
              <Badge variant={growth > 0 ? 'default' : 'destructive'}>
                {growth > 0 ? '+' : ''}{growth.toFixed(1)}%
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={mrrData}>
            <defs>
              <linearGradient id="colorStarter" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorProfessional" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorEnterprise" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
              </linearGradient>
            </defs>
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
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              className="text-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number | string) => `$${typeof value === 'number' ? value.toLocaleString() : value}`}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="starter"
              stackId="1"
              stroke="#3b82f6"
              fill="url(#colorStarter)"
              name="Starter"
            />
            <Area
              type="monotone"
              dataKey="professional"
              stackId="1"
              stroke="#10b981"
              fill="url(#colorProfessional)"
              name="Professional"
            />
            <Area
              type="monotone"
              dataKey="enterprise"
              stackId="1"
              stroke="#8b5cf6"
              fill="url(#colorEnterprise)"
              name="Enterprise"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

