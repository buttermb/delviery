import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useBreadcrumbLabel } from '@/contexts/BreadcrumbContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { User, DollarSign, ShoppingCart, TrendingUp } from 'lucide-react';
import { isPostgrestError } from "@/utils/errorHandling/typeGuards";

export default function CustomerInsights() {
  const { id } = useParams();
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', id, tenantId],
    queryFn: async () => {
      if (!id || !tenantId) return null;

      try {
        const { data, error } = await supabase
          .from('customers' as any)
          .select('*')
          .eq('id', id)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (error && error.code === '42P01') return null;
        if (error) throw error;
        return data;
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') return null;
        throw error;
      }
    },
    enabled: !!id && !!tenantId,
  });

  const customerRecord = customer as Record<string, unknown> | null;
  useBreadcrumbLabel(customerRecord ? `${customerRecord.first_name ?? ''} ${customerRecord.last_name ?? ''}`.trim() || null : null);

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['customer-orders', id, tenantId],
    queryFn: async () => {
      if (!id || !tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('orders' as any)
          .select('*, order_items(*)')
          .eq('customer_id', id)
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data || [];
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!id && !!tenantId,
  });

  if (customerLoading || ordersLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading customer insights...</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">Customer not found</div>
      </div>
    );
  }

  const totalSpent = orders?.reduce((sum: number, o: any) => sum + parseFloat(o.total || 0), 0) || 0;
  const orderCount = orders?.length || 0;
  const avgOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;

  const orderHistory = (orders || []).map((order: any) => ({
    date: new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    revenue: parseFloat(order.total || 0),
    orders: 1,
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Customer Insights</h1>
        <p className="text-muted-foreground">
          Detailed analytics for {(customer as any).first_name} {(customer as any).last_name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm font-medium">Name</div>
              <div className="text-lg">
                {(customer as any).first_name} {(customer as any).last_name}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium">Email</div>
              <div className="text-sm text-muted-foreground">{(customer as any).email || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm font-medium">Phone</div>
              <div className="text-sm text-muted-foreground">{(customer as any).phone || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm font-medium">Type</div>
              <Badge>{(customer as any).customer_type || 'regular'}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSpent.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Order Count</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgOrderValue.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Loyalty Points</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(customer as any).loyalty_points || 0}</div>
          </CardContent>
        </Card>
      </div>

      {orderHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Purchase History</CardTitle>
            <CardDescription>Customer order trends over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={orderHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {orderHistory.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">No order history available</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

