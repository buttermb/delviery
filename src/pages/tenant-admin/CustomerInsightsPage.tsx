import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, UserPlus, Heart, DollarSign, TrendingUp, Calendar, Clock, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

// Mock data
const customerGrowth = [
  { month: 'Jan', new: 124, returning: 342, churned: 23 },
  { month: 'Feb', new: 156, returning: 389, churned: 18 },
  { month: 'Mar', new: 189, returning: 423, churned: 21 },
  { month: 'Apr', new: 213, returning: 467, churned: 19 },
  { month: 'May', new: 245, returning: 512, churned: 24 },
  { month: 'Jun', new: 267, returning: 548, churned: 20 },
];

const customerSegments = [
  { name: 'VIP (>$500)', value: 234, color: 'hsl(var(--chart-1))' },
  { name: 'Regular ($100-500)', value: 567, color: 'hsl(var(--chart-2))' },
  { name: 'Occasional ($50-100)', value: 892, color: 'hsl(var(--chart-3))' },
  { name: 'New (<$50)', value: 445, color: 'hsl(var(--chart-4))' },
];

const orderFrequency = [
  { frequency: '1x', customers: 445 },
  { frequency: '2-3x', customers: 567 },
  { frequency: '4-6x', customers: 392 },
  { frequency: '7-10x', customers: 234 },
  { frequency: '11+x', customers: 178 },
];

const topCustomers = [
  { name: 'John Smith', orders: 47, spent: 2341, lastOrder: '2 days ago', status: 'VIP' },
  { name: 'Sarah Johnson', orders: 42, spent: 2156, lastOrder: '1 day ago', status: 'VIP' },
  { name: 'Michael Brown', orders: 38, spent: 1987, lastOrder: '3 days ago', status: 'VIP' },
  { name: 'Emily Davis', orders: 35, spent: 1823, lastOrder: '1 day ago', status: 'VIP' },
  { name: 'David Wilson', orders: 31, spent: 1654, lastOrder: '4 days ago', status: 'Regular' },
];

const customerBehavior = [
  { hour: '6AM', orders: 23 },
  { hour: '9AM', orders: 45 },
  { hour: '12PM', orders: 89 },
  { hour: '3PM', orders: 56 },
  { hour: '6PM', orders: 102 },
  { hour: '9PM', orders: 67 },
];

export default function CustomerInsightsPage() {
  const [timeRange, setTimeRange] = useState('30d');

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customer Insights</h1>
          <p className="text-muted-foreground">Understand your customer behavior and patterns</p>
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

      {/* Key Customer Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2,138</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-500">+14.2%</span> from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Customers</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">267</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-500">+8.9%</span> from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retention Rate</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">82.5%</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-500">+2.1%</span> from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Lifetime Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$342</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-500">+11.3%</span> from last period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Customer Analytics */}
      <Tabs defaultValue="growth" className="space-y-4">
        <TabsList>
          <TabsTrigger value="growth">Customer Growth</TabsTrigger>
          <TabsTrigger value="segments">Segments</TabsTrigger>
          <TabsTrigger value="frequency">Order Frequency</TabsTrigger>
          <TabsTrigger value="top">Top Customers</TabsTrigger>
          <TabsTrigger value="behavior">Behavior</TabsTrigger>
        </TabsList>

        <TabsContent value="growth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Growth Trends</CardTitle>
              <CardDescription>New, returning, and churned customers over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={customerGrowth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="new" stroke="hsl(var(--chart-1))" strokeWidth={2} name="New Customers" />
                  <Line type="monotone" dataKey="returning" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Returning" />
                  <Line type="monotone" dataKey="churned" stroke="hsl(var(--chart-4))" strokeWidth={2} name="Churned" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="segments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Segments</CardTitle>
              <CardDescription>Distribution by lifetime spending</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={customerSegments}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {customerSegments.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="frequency" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Order Frequency Distribution</CardTitle>
              <CardDescription>How often customers order</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={orderFrequency}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="frequency" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="customers" fill="hsl(var(--chart-1))" name="Customers" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Customers</CardTitle>
              <CardDescription>Your most valuable customers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topCustomers.map((customer, index) => (
                  <div key={customer.name} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <span className="font-bold text-sm">{index + 1}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{customer.name}</p>
                          <Badge variant={customer.status === 'VIP' ? 'default' : 'secondary'} className="text-xs">
                            {customer.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{customer.orders} orders • Last: {customer.lastOrder}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">${customer.spent.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Lifetime value</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Behavior Patterns</CardTitle>
              <CardDescription>Peak ordering times throughout the day</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={customerBehavior}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="orders" fill="hsl(var(--chart-2))" name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
