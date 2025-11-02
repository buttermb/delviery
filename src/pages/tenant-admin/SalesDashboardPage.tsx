import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, ShoppingBag, Percent, CreditCard, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Mock data
const salesData = [
  { month: 'Jan', sales: 32400, profit: 12960, margin: 40 },
  { month: 'Feb', sales: 38200, profit: 15280, margin: 40 },
  { month: 'Mar', sales: 42100, profit: 17682, margin: 42 },
  { month: 'Apr', sales: 45300, profit: 19026, margin: 42 },
  { month: 'May', sales: 51200, profit: 22528, margin: 44 },
  { month: 'Jun', sales: 48900, profit: 21423, margin: 43.8 },
];

const topProducts = [
  { name: 'Signature Burger', sales: 1243, revenue: 18645, growth: 12.5 },
  { name: 'Chicken Wings', sales: 987, revenue: 14805, growth: 8.3 },
  { name: 'Caesar Salad', sales: 856, revenue: 10272, growth: -2.1 },
  { name: 'BBQ Pizza', sales: 734, revenue: 13212, growth: 15.7 },
  { name: 'Fish Tacos', sales: 689, revenue: 9636, growth: 5.4 },
];

const paymentMethods = [
  { method: 'Credit Card', amount: 32400, percentage: 52 },
  { method: 'Cash', amount: 18900, percentage: 30 },
  { method: 'Digital Wallet', amount: 8100, percentage: 13 },
  { method: 'Gift Card', amount: 3100, percentage: 5 },
];

const salesByCategory = [
  { category: 'Main Dishes', amount: 28400, orders: 1243 },
  { category: 'Appetizers', amount: 12800, orders: 987 },
  { category: 'Beverages', amount: 8900, orders: 1567 },
  { category: 'Desserts', amount: 7200, orders: 834 },
  { category: 'Sides', amount: 5200, orders: 756 },
];

export default function SalesDashboardPage() {
  const [timeRange, setTimeRange] = useState('30d');

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales Dashboard</h1>
          <p className="text-muted-foreground">Comprehensive overview of your sales performance</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
            <SelectItem value="1y">Last Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Sales Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$258,100</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-500">+15.2%</span> from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$107,899</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-500">+18.5%</span> from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">41.8%</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-500">+2.3%</span> margin increase
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Items Sold</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5,387</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-500">+9.8%</span> from last period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Charts */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Revenue Trends</TabsTrigger>
          <TabsTrigger value="products">Top Products</TabsTrigger>
          <TabsTrigger value="categories">By Category</TabsTrigger>
          <TabsTrigger value="payments">Payment Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sales & Profit Trends</CardTitle>
              <CardDescription>Monthly sales and profit performance</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="sales" stackId="1" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" name="Sales ($)" />
                  <Area type="monotone" dataKey="profit" stackId="2" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" name="Profit ($)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Selling Products</CardTitle>
              <CardDescription>Best performing items by revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProducts.map((product, index) => (
                  <div key={product.name} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <span className="font-bold text-sm">{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">{product.sales} units sold</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">${product.revenue.toLocaleString()}</p>
                      <Badge variant={product.growth > 0 ? "default" : "destructive"} className="text-xs">
                        {product.growth > 0 ? '+' : ''}{product.growth}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sales by Category</CardTitle>
              <CardDescription>Revenue distribution across product categories</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={salesByCategory} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="category" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="amount" fill="hsl(var(--chart-1))" name="Revenue ($)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Sales breakdown by payment type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {paymentMethods.map((method) => (
                  <div key={method.method} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{method.method}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold">${method.amount.toLocaleString()}</span>
                        <span className="text-sm text-muted-foreground ml-2">({method.percentage}%)</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${method.percentage}%` }}
                      />
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
