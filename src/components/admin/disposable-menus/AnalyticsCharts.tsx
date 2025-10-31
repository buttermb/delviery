import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { TrendingUp, TrendingDown, Eye, ShoppingCart, DollarSign, Users } from 'lucide-react';

interface AnalyticsChartsProps {
  accessLogs: any[];
  orders: any[];
  securityEvents: any[];
}

export const AnalyticsCharts = ({ accessLogs, orders, securityEvents }: AnalyticsChartsProps) => {
  // Process access logs by date
  const viewsByDate = accessLogs.reduce((acc: any, log: any) => {
    const date = new Date(log.accessed_at).toLocaleDateString();
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});

  const viewsData = Object.entries(viewsByDate).map(([date, views]) => ({
    date,
    views
  })).slice(-14); // Last 14 days

  // Process orders by date
  const ordersByDate = orders.reduce((acc: any, order: any) => {
    const date = new Date(order.created_at).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = { date, orders: 0, revenue: 0 };
    }
    acc[date].orders += 1;
    acc[date].revenue += order.total_amount || 0;
    return acc;
  }, {});

  const ordersData = Object.values(ordersByDate).slice(-14);

  // Peak hours analysis
  const hourlyViews = accessLogs.reduce((acc: any, log: any) => {
    const hour = new Date(log.accessed_at).getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {});

  const peakHoursData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    views: hourlyViews[i] || 0
  }));

  // Product performance
  const productPerformance = orders.reduce((acc: any, order: any) => {
    order.order_items?.forEach((item: any) => {
      if (!acc[item.product_name]) {
        acc[item.product_name] = { name: item.product_name, quantity: 0, revenue: 0 };
      }
      acc[item.product_name].quantity += item.quantity || 0;
      acc[item.product_name].revenue += (item.price_per_unit || 0) * (item.quantity || 0);
    });
    return acc;
  }, {});

  const productData = Object.values(productPerformance)
    .sort((a: any, b: any) => b.revenue - a.revenue)
    .slice(0, 5);

  // Customer activity (top customers by orders)
  const customerActivity = accessLogs.reduce((acc: any, log: any) => {
    const name = log.customer_name || 'Anonymous';
    if (!acc[name]) {
      acc[name] = { name, views: 0, orders: 0 };
    }
    acc[name].views += 1;
    return acc;
  }, {});

  orders.forEach((order: any) => {
    const name = order.contact_name || 'Anonymous';
    if (customerActivity[name]) {
      customerActivity[name].orders += 1;
    }
  });

  const customerData = Object.values(customerActivity)
    .sort((a: any, b: any) => b.orders - a.orders)
    .slice(0, 5);

  // Security events by type
  const eventsByType = securityEvents.reduce((acc: any, event: any) => {
    const type = event.event_type.replace(/_/g, ' ');
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const securityData = Object.entries(eventsByType).map(([type, count]) => ({
    type,
    count
  }));

  // Calculate key metrics
  const totalViews = accessLogs.length;
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const conversionRate = totalViews > 0 ? (totalOrders / totalViews) * 100 : 0;

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Views</p>
              <p className="text-2xl font-bold">{totalViews}</p>
            </div>
            <Eye className="h-8 w-8 text-primary/20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <p className="text-2xl font-bold">{totalOrders}</p>
            </div>
            <ShoppingCart className="h-8 w-8 text-green-600/20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p>
            </div>
            <DollarSign className="h-8 w-8 text-amber-600/20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Conversion Rate</p>
              <p className="text-2xl font-bold">{conversionRate.toFixed(1)}%</p>
            </div>
            {conversionRate >= 15 ? (
              <TrendingUp className="h-8 w-8 text-green-600/20" />
            ) : (
              <TrendingDown className="h-8 w-8 text-red-600/20" />
            )}
          </div>
        </Card>
      </div>

      {/* Views Over Time */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Views Over Time (Last 14 Days)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={viewsData}>
            <defs>
              <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="views" stroke="#8884d8" fillOpacity={1} fill="url(#colorViews)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Orders & Revenue */}
      {ordersData.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Orders & Revenue (Last 14 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={ordersData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="orders" stroke="#8884d8" name="Orders" />
              <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#82ca9d" name="Revenue ($)" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Peak Hours Heatmap */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Peak Access Hours</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={peakHoursData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="views" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Top Products */}
        {productData.length > 0 && (
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Top Products by Revenue</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={productData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name.slice(0, 15)}...`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="revenue"
                >
                  {productData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `$${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Top Customers */}
        {customerData.length > 0 && (
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Top Customers by Activity</h3>
            <div className="space-y-3">
              {customerData.map((customer: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {customer.views} views • {customer.orders} orders
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">#{idx + 1}</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Security Events */}
        {securityData.length > 0 && (
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Security Events by Type</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={securityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="type" type="category" width={150} />
                <Tooltip />
                <Bar dataKey="count" fill="#ff8042" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
    </div>
  );
};
