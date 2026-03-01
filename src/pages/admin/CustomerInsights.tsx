import { useQuery } from '@tanstack/react-query';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useBreadcrumbLabel } from '@/contexts/BreadcrumbContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { User, DollarSign, ShoppingCart, TrendingUp } from 'lucide-react';
import { isPostgrestError } from "@/utils/errorHandling/typeGuards";
import { queryKeys } from '@/lib/queryKeys';

export default function CustomerInsights() {
  const { id } = useParams<{ id: string }>();
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: queryKeys.customerInsightsAdmin.customer(id, tenantId),
    queryFn: async () => {
      if (!id || !tenantId) return null;

      try {
        const { data, error } = await supabase
          .from('customers')
          .select('id, first_name, last_name, email, phone, customer_type, loyalty_points, tenant_id')
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

  const customerRecord = (customer as unknown) as Record<string, unknown> | null;
  useBreadcrumbLabel(customerRecord ? `${customerRecord.first_name ?? ''} ${customerRecord.last_name ?? ''}`.trim() || null : null);

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: queryKeys.customerInsightsAdmin.orders(id, tenantId),
    queryFn: async () => {
      if (!id || !tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('customer_id', id)
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data ?? [];
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!id && !!tenantId,
  });

  if (customerLoading || ordersLoading) {
    return <EnhancedLoadingState variant="dashboard" message="Loading customer insights..." />;
  }

  if (!customer) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">Customer not found</div>
      </div>
    );
  }

  const orderRecords = (orders ?? []) as unknown as Record<string, unknown>[];
  const totalSpent = orderRecords.reduce((sum: number, o) => sum + parseFloat(String(o.total ?? 0)), 0) || 0;
  const orderCount = orderRecords.length;
  const avgOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;

  const orderHistory = orderRecords.map((order) => ({
    date: new Date(String(order.created_at)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    revenue: parseFloat(String(order.total ?? 0)),
    orders: 1,
  }));

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Customer Insights</h1>
        <p className="text-muted-foreground">
          Detailed analytics for {customerRecord?.first_name as string} {customerRecord?.last_name as string}
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
                {customerRecord?.first_name as string} {customerRecord?.last_name as string}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium">Email</div>
              <div className="text-sm text-muted-foreground">{(customerRecord?.email as string) || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm font-medium">Phone</div>
              <div className="text-sm text-muted-foreground">{(customerRecord?.phone as string) || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm font-medium">Type</div>
              <Badge>{(customerRecord?.customer_type as string) || 'regular'}</Badge>
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
            <div className="text-2xl font-bold">{(customerRecord?.loyalty_points as number) ?? 0}</div>
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

