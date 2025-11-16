import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, ShoppingCart, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useRealtimeShifts, useRealtimeTransactions } from '@/hooks/useRealtimePOS';
import { POSCharts } from '@/components/analytics/POSCharts';
import { ChartExport } from '@/components/analytics/ChartExport';

export default function PosAnalytics() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  // Enable real-time updates
  useRealtimeShifts(tenantId);
  useRealtimeTransactions(tenantId);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['pos-analytics', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('pos_transactions')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('payment_status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
    refetchInterval: 30000, // Backup polling every 30s
  });

  // Get shift summary
  const { data: shifts } = useQuery({
    queryKey: ['pos-shifts-summary', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('pos_shifts')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('started_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading POS analytics...</div>
      </div>
    );
  }

  // Process daily sales data
  const dailySales = (transactions || []).reduce((acc: any, transaction: any) => {
    const date = new Date(transaction.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const existing = acc.find((item: any) => item.date === date);
    const revenue = parseFloat(transaction.total_amount || 0);
    if (existing) {
      existing.revenue += revenue;
      existing.count += 1;
    } else {
      acc.push({ date, revenue, count: 1 });
    }
    return acc;
  }, []).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Process hourly data
  const hourlyData = (transactions || []).reduce((acc: any, transaction: any) => {
    const hour = new Date(transaction.created_at).getHours();
    const hourLabel = `${hour}:00`;
    const existing = acc.find((item: any) => item.hour === hourLabel);
    const revenue = parseFloat(transaction.total_amount || 0);
    
    if (existing) {
      existing.transactions += 1;
      existing.revenue += revenue;
    } else {
      acc.push({ hour: hourLabel, transactions: 1, revenue });
    }
    return acc;
  }, []).sort((a: any, b: any) => parseInt(a.hour) - parseInt(b.hour));

  const totalRevenue = transactions?.reduce((sum: number, t: any) => sum + parseFloat(t.total_amount || 0), 0) || 0;
  const totalTransactions = transactions?.length || 0;
  const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  
  // Calculate payment method breakdown for pie chart
  const paymentMethodData = Object.entries(
    (transactions || []).reduce((acc: any, t: any) => {
      const method = (t.payment_method || 'other').charAt(0).toUpperCase() + (t.payment_method || 'other').slice(1);
      acc[method] = (acc[method] || 0) + parseFloat(t.total_amount || 0);
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value: value as number }));

  const totalShifts = shifts?.length || 0;
  const openShifts = shifts?.filter((s: any) => s.status === 'open').length || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">POS Analytics</h1>
          <p className="text-muted-foreground">Point of sale performance metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <ChartExport 
            data={transactions || []} 
            filename="pos-analytics" 
            title="POS Analytics Report"
          />
          <Badge variant="outline" className="gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Live Updates
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTransactions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Transaction</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgTransactionValue.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Shifts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openShifts}</div>
            <p className="text-xs text-muted-foreground">{totalShifts} total shifts</p>
          </CardContent>
        </Card>
      </div>

      {/* Comprehensive Charts */}
      <POSCharts 
        dailySales={dailySales}
        paymentMethods={paymentMethodData}
        hourlyData={hourlyData}
      />
    </div>
  );
}

