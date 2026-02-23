import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';

export default function AdvancedAnalyticsPage() {
  const { tenant } = useTenantAdminAuth();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['advanced-analytics-orders', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      const { data, error } = await supabase
        .from('orders' as any)
        .select('*, order_items(*)')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error && error.code === '42P01') return [];
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  // Revenue trends
  const revenueByMonth = (orders as any[]).reduce((acc: any, order: any) => {
    const month = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    if (!acc[month]) acc[month] = { month, revenue: 0, orders: 0 };
    acc[month].revenue += order.total_amount || 0;
    acc[month].orders += 1;
    return acc;
  }, {});

  const revenueData = Object.values(revenueByMonth).slice(-12);

  // Product performance
  const productPerformance = (orders as any[]).flatMap((order: any) => order.order_items || [])
    .reduce((acc: any, item: any) => {
      const name = item.product_name || 'Unknown';
      if (!acc[name]) acc[name] = { name, quantity: 0, revenue: 0 };
      acc[name].quantity += item.quantity || 0;
      acc[name].revenue += (item.price * item.quantity) || 0;
      return acc;
    }, {});

  const productData = Object.values(productPerformance).slice(0, 10);

  if (isLoading) {
    return <EnhancedLoadingState variant="dashboard" message="Loading..." />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Advanced Analytics</h1>

      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Revenue Trends</TabsTrigger>
          <TabsTrigger value="products">Product Performance</TabsTrigger>
          <TabsTrigger value="customers">Customer Segments</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Monthly Revenue</h2>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#8884d8" name="Revenue ($)" />
                  <Line type="monotone" dataKey="orders" stroke="#82ca9d" name="Orders" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No revenue data available</p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Top 10 Products</h2>
            {productData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={productData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" fill="#8884d8" name="Revenue ($)" />
                  <Bar dataKey="quantity" fill="#82ca9d" name="Quantity Sold" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No product data available</p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Customer Insights</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold">{orders.length}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Avg Order Value</p>
                <p className="text-2xl font-bold">
                  ${orders.length > 0 ? ((orders as any[]).reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0) / orders.length).toFixed(2) : '0.00'}
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">
                  ${(orders as any[]).reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0).toFixed(2)}
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
