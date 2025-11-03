import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Users, TrendingUp, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function CommissionTracking() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data: commissions, isLoading } = useQuery({
    queryKey: ['commission-tracking', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        // Try to get from commission_transactions table first
        const { data, error } = await supabase
          .from('commission_transactions' as any)
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error && error.code === '42P01') {
          // Table doesn't exist, calculate from orders
          const { data: orders, error: orderError } = await supabase
            .from('orders' as any)
            .select('*')
            .eq('tenant_id', tenantId);

          if (orderError && orderError.code === '42P01') return [];
          if (orderError) throw orderError;

          // Calculate commissions from orders (2% default)
          return (orders || []).map((order: any) => ({
            id: order.id,
            amount: parseFloat(order.total || 0) * 0.02,
            order_id: order.id,
            created_at: order.created_at,
          }));
        }
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
        <div className="text-center">Loading commissions...</div>
      </div>
    );
  }

  const totalCommissions = commissions?.reduce((sum: number, c: any) => sum + (c.amount || 0), 0) || 0;
  const pendingCommissions = commissions?.filter((c: any) => c.status === 'pending').reduce((sum: number, c: any) => sum + (c.amount || 0), 0) || 0;
  const paidCommissions = commissions?.filter((c: any) => c.status === 'paid').reduce((sum: number, c: any) => sum + (c.amount || 0), 0) || 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Commission Tracking</h1>
        <p className="text-muted-foreground">Track and manage sales commissions</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commissions</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCommissions.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${pendingCommissions.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${paidCommissions.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Commissions</CardTitle>
          <CardDescription>Latest commission transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {commissions && commissions.length > 0 ? (
            <div className="space-y-4">
              {commissions.slice(0, 10).map((commission: any) => (
                <div key={commission.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">Order #{commission.order_id?.slice(0, 8) || 'N/A'}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(commission.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-lg font-bold">${(commission.amount || 0).toFixed(2)}</div>
                    <Badge variant={commission.status === 'paid' ? 'default' : 'secondary'}>
                      {commission.status || 'pending'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No commission data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

