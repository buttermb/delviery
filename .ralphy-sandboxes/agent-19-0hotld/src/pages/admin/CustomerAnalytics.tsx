import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Users, TrendingUp, DollarSign } from 'lucide-react';
import { isPostgrestError } from '@/utils/errorHandling/typeGuards';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { queryKeys } from '@/lib/queryKeys';
import { CHART_COLORS } from '@/lib/chartColors';

interface Customer {
  id: string;
  customer_type?: string;
  tenant_id: string;
}

interface Order {
  id: string;
  total: number | string;
  customer_id: string;
  tenant_id: string;
}

export default function CustomerAnalytics() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data: customers, isLoading: customersLoading, error: customersError, refetch: refetchCustomers } = useQuery({
    queryKey: queryKeys.customerAnalytics.customers(tenantId),
    queryFn: async (): Promise<Customer[]> => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('customers')
          .select('id, customer_type, tenant_id')
          .eq('tenant_id', tenantId);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return (data ?? []) as unknown as Customer[];
      } catch (error: unknown) {
        if (isPostgrestError(error) && error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const { data: orders, isLoading: ordersLoading, error: ordersError, refetch: refetchOrders } = useQuery({
    queryKey: queryKeys.customerAnalytics.orders(tenantId),
    queryFn: async (): Promise<Order[]> => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, customer_id')
          .eq('tenant_id', tenantId);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return (data ?? []) as unknown as Order[];
      } catch (error: unknown) {
        if (isPostgrestError(error) && error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  if (customersLoading || ordersLoading) {
    return (
      <div className="p-4 space-y-4">
        <div>
          <h1 className="text-xl font-bold">Customer Analytics</h1>
          <p className="text-muted-foreground">Understand your customer base</p>
        </div>
        <EnhancedLoadingState variant="dashboard" />
      </div>
    );
  }

  const hasError = customersError || ordersError;
  if (hasError) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">Failed to load data. Please try again.</p>
        <Button variant="outline" onClick={() => { refetchCustomers(); refetchOrders(); }} className="mt-4">Retry</Button>
      </div>
    );
  }

  const customerCount = customers?.length ?? 0;
  const totalRevenue = orders?.reduce((sum: number, o: Order) => sum + parseFloat(String(o.total ?? 0)), 0) ?? 0;
  const avgCustomerValue = customerCount > 0 ? totalRevenue / customerCount : 0;

  const customerTypes = (customers ?? []).reduce((acc: Record<string, number>, customer: Customer) => {
    const type = customer.customer_type || 'regular';
    acc[type] = (acc[type] ?? 0) + 1;
    return acc;
  }, {});

  const customerTypeData = Object.entries(customerTypes).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Customer Analytics</h1>
        <p className="text-muted-foreground">Understand your customer base</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerCount}</div>
          </CardContent>
        </Card>

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
            <CardTitle className="text-sm font-medium">Avg Customer Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgCustomerValue.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {customerTypeData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Customer Types</CardTitle>
            <CardDescription>Distribution of customer types</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={customerTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill={CHART_COLORS[0]}
                  dataKey="value"
                >
                  {customerTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {customerTypeData.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">No customer data available</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
