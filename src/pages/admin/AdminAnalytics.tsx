import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  Users,
  Calendar
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SalesData {
  date: string;
  revenue: number;
  orders: number;
}

interface CategoryData {
  name: string;
  value: number;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

const AdminAnalytics = () => {
  const { session } = useAdminAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    customerCount: 0,
    conversionRate: 0,
    repeatCustomerRate: 0
  });

  useEffect(() => {
    if (session) {
      fetchAnalytics();
    }
  }, [session, timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      startDate.setDate(startDate.getDate() - days);

      // Parallel fetch - orders with items and products
      const [ordersResponse, productsResponse] = await Promise.all([
        supabase
          .from("orders")
          .select(`
            *,
            order_items(product_id, quantity, price)
          `)
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString()),
        supabase
          .from("products")
          .select("id, category")
      ]);

      if (ordersResponse.error) throw ordersResponse.error;
      const orders = ordersResponse.data || [];

      // Calculate metrics
      const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
      const totalOrders = orders.length;
      const uniqueUsers = new Set(orders.map(o => o.user_id).filter(Boolean)).size;
      
      // Get repeat customers
      const userOrderCounts: { [key: string]: number } = {};
      orders.forEach(o => {
        if (o.user_id) {
          userOrderCounts[o.user_id] = (userOrderCounts[o.user_id] || 0) + 1;
        }
      });
      const repeatCustomers = Object.values(userOrderCounts).filter(count => count > 1).length;

      setMetrics({
        totalRevenue,
        totalOrders,
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        customerCount: uniqueUsers,
        conversionRate: 0,
        repeatCustomerRate: uniqueUsers > 0 ? (repeatCustomers / uniqueUsers) * 100 : 0
      });

      // Process daily sales data
      const dailySales: { [key: string]: { revenue: number; orders: number } } = {};
      orders.forEach(order => {
        const date = new Date(order.created_at).toLocaleDateString();
        if (!dailySales[date]) {
          dailySales[date] = { revenue: 0, orders: 0 };
        }
        dailySales[date].revenue += Number(order.total_amount || 0);
        dailySales[date].orders += 1;
      });

      const salesChartData = Object.entries(dailySales)
        .map(([date, data]) => ({
          date,
          revenue: data.revenue,
          orders: data.orders
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setSalesData(salesChartData);

      // Calculate category revenue
      const products = productsResponse.data || [];
      const categoryRevenue: { [key: string]: number } = {};
      
      orders.forEach(order => {
        order.order_items?.forEach((item: any) => {
          const product = products.find(p => p.id === item.product_id);
          if (product) {
            categoryRevenue[product.category] = (categoryRevenue[product.category] || 0) + 
              (item.quantity * Number(item.price));
          }
        });
      });

      const categoryChartData = Object.entries(categoryRevenue).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value
      }));

      setCategoryData(categoryChartData);

    } catch (error: any) {
      console.error("Failed to fetch analytics:", error);
      toast({
        variant: "destructive",
        title: "Error loading analytics",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Track performance metrics and trends
          </p>
        </div>
        <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
          <SelectTrigger className="w-40">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {timeRange === '7d' ? 'Last 7 days' : timeRange === '30d' ? 'Last 30 days' : 'Last 90 days'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              Avg ${metrics.averageOrderValue.toFixed(2)} per order
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.customerCount}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.repeatCustomerRate.toFixed(1)}% repeat rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.averageOrderValue.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Orders Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="orders" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: $${entry.value.toFixed(0)}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAnalytics;
