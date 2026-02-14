import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Users, TrendingUp, DollarSign } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { useAnalyticsDrillDown } from '@/hooks/useAnalyticsDrillDown';
import { AnalyticsDrillDown } from '@/components/admin/analytics/AnalyticsDrillDown';
import type { DrillDownRecord } from '@/hooks/useAnalyticsDrillDown';
import { logger } from '@/lib/logger';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

interface Customer {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
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

  const {
    drillDown,
    openDrillDown,
    closeDrillDown,
    navigateToRecord,
    isOpen,
    breadcrumbTrail,
  } = useAnalyticsDrillDown('Customer Analytics');

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['customers', tenantId],
    queryFn: async (): Promise<Customer[]> => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('tenant_id', tenantId);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return (data || []) as unknown as Customer[];
      } catch (error: unknown) {
        if (error instanceof Error && 'code' in error && (error as Record<string, unknown>).code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['customer-orders', tenantId],
    queryFn: async (): Promise<Order[]> => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, customer_id')
          .eq('tenant_id', tenantId);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return (data || []) as unknown as Order[];
      } catch (error: unknown) {
        if (error instanceof Error && 'code' in error && (error as Record<string, unknown>).code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const customerCount = customers?.length || 0;
  const totalRevenue = useMemo(
    () => (orders || []).reduce((sum, o) => sum + parseFloat(String(o.total || 0)), 0),
    [orders]
  );
  const avgCustomerValue = customerCount > 0 ? totalRevenue / customerCount : 0;

  const customerTypes = useMemo(() => {
    return (customers || []).reduce((acc: Record<string, number>, customer) => {
      const type = customer.customer_type || 'regular';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }, [customers]);

  const customerTypeData = useMemo(
    () => Object.entries(customerTypes).map(([name, value]) => ({ name, value })),
    [customerTypes]
  );

  const handlePieClick = useCallback(
    (_data: unknown, index: number) => {
      const entry = customerTypeData[index];
      if (!entry || !customers) return;

      logger.debug('[CustomerAnalytics] Pie segment clicked', { segment: entry.name });

      const segmentCustomers = customers.filter(
        (c) => (c.customer_type || 'regular') === entry.name
      );

      const records: DrillDownRecord[] = segmentCustomers.map((c) => ({
        id: c.id,
        label: [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unknown',
        sublabel: c.email || undefined,
        value: entry.name,
        entityType: 'CUSTOMER' as const,
      }));

      openDrillDown({
        entityType: 'CUSTOMER',
        title: `${entry.name} Customers`,
        filterKey: entry.name,
        filterLabel: `${entry.name} (${entry.value})`,
        records,
      });
    },
    [customerTypeData, customers, openDrillDown]
  );

  const handleRecordClick = useCallback(
    (record: DrillDownRecord) => {
      navigateToRecord(record.entityType, record.id);
    },
    [navigateToRecord]
  );

  if (customersLoading || ordersLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Customer Analytics</h1>
          <p className="text-muted-foreground">Understand your customer base</p>
        </div>
        <EnhancedLoadingState variant="dashboard" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Customer Analytics</h1>
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

      {customerTypeData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Customer Types</CardTitle>
            <CardDescription>Click a segment to see customers in that group</CardDescription>
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
                  fill="#8884d8"
                  dataKey="value"
                  cursor="pointer"
                  onClick={handlePieClick}
                >
                  {customerTypeData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">No customer data available</div>
          </CardContent>
        </Card>
      )}

      <AnalyticsDrillDown
        open={isOpen}
        onOpenChange={(open) => { if (!open) closeDrillDown(); }}
        drillDown={drillDown}
        breadcrumbTrail={breadcrumbTrail}
        onRecordClick={handleRecordClick}
      />
    </div>
  );
}
