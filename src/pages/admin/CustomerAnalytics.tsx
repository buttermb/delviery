import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface CustomerOrderData {
  customer_id: string;
  customers?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    created_at: string;
  };
  total_amount: number;
  order_count: number;
  first_order_date: string;
  last_order_date: string;
}

export default function CustomerAnalytics() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data: customerData, isLoading } = useQuery({
    queryKey: ['customer-analytics', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      // Get all orders with customer info
      const { data: orders, error } = await supabase
        .from('orders')
        .select('customer_id, total_amount, created_at, customers(id, first_name, last_name, email, created_at)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!orders) return [];

      // Aggregate by customer
      const customerMap: Record<string, CustomerOrderData> = {};

      orders.forEach((order: any) => {
        const customerId = order.customer_id;
        if (!customerId) return;

        if (!customerMap[customerId]) {
          customerMap[customerId] = {
            customer_id: customerId,
            customers: order.customers,
            total_amount: 0,
            order_count: 0,
            first_order_date: order.created_at,
            last_order_date: order.created_at,
          };
        }

        customerMap[customerId].total_amount += Number(order.total_amount || 0);
        customerMap[customerId].order_count += 1;

        const orderDate = new Date(order.created_at);
        const firstDate = new Date(customerMap[customerId].first_order_date);
        const lastDate = new Date(customerMap[customerId].last_order_date);

        if (orderDate < firstDate) {
          customerMap[customerId].first_order_date = order.created_at;
        }
        if (orderDate > lastDate) {
          customerMap[customerId].last_order_date = order.created_at;
        }
      });

      return Object.values(customerMap);
    },
    enabled: !!tenantId,
  });

  // Calculate metrics
  const totalCustomers = customerData?.length || 0;
  const totalCLV = customerData?.reduce((sum, c) => sum + c.total_amount, 0) || 0;
  const avgCLV = totalCustomers > 0 ? totalCLV / totalCustomers : 0;
  const repeatCustomers = customerData?.filter((c) => c.order_count > 1).length || 0;
  const repeatRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;

  // Top customers
  const topCustomers = customerData
    ? [...customerData]
        .sort((a, b) => b.total_amount - a.total_amount)
        .slice(0, 10)
    : [];

  // Customer segments
  const segments = {
    new: customerData?.filter((c) => {
      const daysSinceFirst = (Date.now() - new Date(c.first_order_date).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceFirst <= 30 && c.order_count === 1;
    }).length || 0,
    repeat: customerData?.filter((c) => c.order_count >= 2 && c.order_count < 5).length || 0,
    vip: customerData?.filter((c) => c.order_count >= 5 || c.total_amount >= 1000).length || 0,
  };

  // Purchase frequency data
  const frequencyData = customerData
    ? customerData.map((c) => ({
        name: `${c.customers?.first_name || ''} ${c.customers?.last_name || 'Customer'}`.trim() || 'Unknown',
        frequency: c.order_count,
        clv: c.total_amount,
      }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 20)
    : [];

  // Customer acquisition trend
  const acquisitionData = customerData
    ? customerData.reduce((acc, c) => {
        const month = new Date(c.first_order_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    : {};

  const acquisitionChartData = Object.entries(acquisitionData)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading customer analytics...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Customer Analytics</h1>
        <p className="text-muted-foreground">Analyze customer behavior and lifetime value</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average CLV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgCLV.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Repeat Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{repeatRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Repeat Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{repeatCustomers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Segments */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Segments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">New Customers</div>
                <div className="text-2xl font-bold">{segments.new}</div>
              </div>
              <Badge variant="outline">New</Badge>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">Repeat Customers</div>
                <div className="text-2xl font-bold">{segments.repeat}</div>
              </div>
              <Badge variant="secondary">Repeat</Badge>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">VIP Customers</div>
                <div className="text-2xl font-bold">{segments.vip}</div>
              </div>
              <Badge variant="default">VIP</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="acquisition" className="w-full">
        <TabsList>
          <TabsTrigger value="acquisition">Acquisition Trends</TabsTrigger>
          <TabsTrigger value="frequency">Purchase Frequency</TabsTrigger>
          <TabsTrigger value="top">Top Customers</TabsTrigger>
        </TabsList>

        <TabsContent value="acquisition" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Acquisition Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={acquisitionChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#0088FE" strokeWidth={2} name="New Customers" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="frequency" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Purchase Frequency vs Lifetime Value</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={frequencyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="frequency" fill="#0088FE" name="Orders" />
                  <Bar dataKey="clv" fill="#00C49F" name="Lifetime Value ($)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Customers by Lifetime Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topCustomers.map((customer, index) => (
                  <div key={customer.customer_id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">
                          {customer.customers?.first_name} {customer.customers?.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {customer.customers?.email} • {customer.order_count} orders
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">${customer.total_amount.toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">Lifetime Value</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

