import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, ShoppingCart, Clock } from 'lucide-react';

export default function PosAnalytics() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['pos-analytics', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('pos_transactions')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1000);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data || [];
      } catch (error: any) {
        if (error.code === '42P01') return [];
        throw error;
      }
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

  const dailySales = (transactions || []).reduce((acc: any, transaction: any) => {
    const date = new Date(transaction.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const existing = acc.find((item: any) => item.date === date);
    const revenue = parseFloat(transaction.total || 0);
    if (existing) {
      existing.revenue += revenue;
      existing.count += 1;
    } else {
      acc.push({ date, revenue, count: 1 });
    }
    return acc;
  }, []).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalRevenue = transactions?.reduce((sum: number, t: any) => sum + parseFloat(t.total || 0), 0) || 0;
  const totalTransactions = transactions?.length || 0;
  const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">POS Analytics</h1>
        <p className="text-muted-foreground">Point of sale performance metrics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Sales Trend</CardTitle>
          <CardDescription>POS revenue over time</CardDescription>
        </CardHeader>
        <CardContent>
          {dailySales.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailySales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No POS transaction data available. Analytics will appear here once POS transactions are recorded.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaction Volume</CardTitle>
          <CardDescription>Number of transactions per day</CardDescription>
        </CardHeader>
        <CardContent>
          {dailySales.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailySales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="hsl(var(--chart-2))" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No transaction volume data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

