import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { ArrowLeft, User, ShoppingBag, TrendingUp, Calendar } from 'lucide-react';
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

interface CustomerOrder {
  id: string;
  total_amount: number;
  status: string;
  created_at: string;
  order_items?: Array<{
    quantity: number;
    price: number;
    products?: {
      name: string;
      category: string;
    };
  }>;
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  customer_type: string;
  created_at: string;
  total_spent?: number;
  loyalty_points?: number;
}

export default function CustomerInsights() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer-insights', tenantId, id],
    queryFn: async (): Promise<Customer | null> => {
      if (!tenantId || !id) return null;

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!id,
  });

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['customer-orders', tenantId, id],
    queryFn: async (): Promise<CustomerOrder[]> => {
      if (!tenantId || !id) return [];

      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*, products(*))')
        .eq('tenant_id', tenantId)
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!id,
  });

  // If no customer ID provided, show list view
  if (!id) {
    return <CustomerListInsights />;
  }

  if (customerLoading || ordersLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading customer insights...</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">Customer not found</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalSpent = orders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
  const orderCount = orders?.length || 0;
  const avgOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;
  const daysSinceFirstOrder = orders && orders.length > 0
    ? Math.floor((Date.now() - new Date(orders[orders.length - 1].created_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Purchase frequency
  const purchaseFrequency = orders
    ? orders.reduce((acc, order) => {
        const month = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    : {};

  const purchaseFrequencyData = Object.entries(purchaseFrequency)
    .map(([month, count]) => ({ month, orders: count }))
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

  // Product preferences
  const productPreferences: Record<string, number> = {};
  orders?.forEach((order) => {
    order.order_items?.forEach((item) => {
      const category = item.products?.category || 'Uncategorized';
      productPreferences[category] = (productPreferences[category] || 0) + Number(item.quantity || 0);
    });
  });

  const productPreferenceData = Object.entries(productPreferences)
    .map(([category, quantity]) => ({ category, quantity }))
    .sort((a, b) => b.quantity - a.quantity);

  // Customer segment
  let segment = 'New';
  if (orderCount >= 5 || totalSpent >= 1000) {
    segment = 'VIP';
  } else if (orderCount >= 2) {
    segment = 'Repeat';
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/admin/customer-insights')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {customer.first_name} {customer.last_name}
          </h1>
          <p className="text-muted-foreground">{customer.email}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSpent.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Order Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgOrderValue.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Customer Segment</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={segment === 'VIP' ? 'default' : segment === 'Repeat' ? 'secondary' : 'outline'}>
              {segment}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="orders">Order History</TabsTrigger>
          <TabsTrigger value="preferences">Product Preferences</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Purchase Frequency</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={purchaseFrequencyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="orders" fill="#0088FE" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Email</div>
                  <div className="font-medium">{customer.email}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Phone</div>
                  <div className="font-medium">{customer.phone || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Customer Type</div>
                  <Badge variant="outline">{customer.customer_type || 'Standard'}</Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Member Since</div>
                  <div className="font-medium">
                    {new Date(customer.created_at).toLocaleDateString()}
                  </div>
                </div>
                {customer.loyalty_points !== undefined && (
                  <div>
                    <div className="text-sm text-muted-foreground">Loyalty Points</div>
                    <div className="font-medium">{customer.loyalty_points || 0}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="preferences" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Product Category Preferences</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={productPreferenceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="category" type="category" width={150} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="quantity" fill="#00C49F" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Order History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {orders && orders.length > 0 ? (
                  orders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium">Order #{order.id.slice(0, 8)}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">${Number(order.total_amount).toFixed(2)}</div>
                        <Badge variant="outline">{order.status}</Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No orders yet</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 border rounded-lg">
                  <Calendar className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Customer Created</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(customer.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                {orders?.map((order) => (
                  <div key={order.id} className="flex items-start gap-4 p-4 border rounded-lg">
                    <ShoppingBag className="h-5 w-5 mt-0.5 text-primary" />
                    <div className="flex-1">
                      <div className="font-medium">Order Placed</div>
                      <div className="text-sm text-muted-foreground">
                        ${Number(order.total_amount).toFixed(2)} • {new Date(order.created_at).toLocaleString()}
                      </div>
                    </div>
                    <Badge variant="outline">{order.status}</Badge>
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

// Customer List View
function CustomerListInsights() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const navigate = useNavigate();

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers-insights-list', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      // Get customers with order aggregates
      const { data: customerList, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email, created_at, total_spent, loyalty_points')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Get order counts
      const customersWithOrders = await Promise.all(
        (customerList || []).map(async (customer) => {
          const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('customer_id', customer.id);

          return {
            ...customer,
            order_count: count || 0,
          };
        })
      );

      return customersWithOrders;
    },
    enabled: !!tenantId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading customers...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Customer Insights</h1>
        <p className="text-muted-foreground">Detailed customer profiles and behavior analysis</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Customers ({customers?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {customers && customers.length > 0 ? (
              customers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/admin/customer-insights/${customer.id}`)}
                >
                  <div>
                    <div className="font-medium">
                      {customer.first_name} {customer.last_name}
                    </div>
                    <div className="text-sm text-muted-foreground">{customer.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">${(customer.total_spent || 0).toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">{customer.order_count || 0} orders</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">No customers found</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

