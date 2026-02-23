import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { formatCurrency } from '@/lib/formatters';

interface SalesData {
  date: string;
  revenue: number;
  count: number;
}

interface PaymentMethodData {
  name: string;
  value: number;
}

interface HourlyData {
  hour: string;
  transactions: number;
  revenue: number;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

interface POSChartsProps {
  dailySales: SalesData[];
  paymentMethods: PaymentMethodData[];
  hourlyData: HourlyData[];
}

export function POSCharts({ dailySales, paymentMethods, hourlyData }: POSChartsProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Daily Revenue Trend */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Daily Revenue Trend</CardTitle>
          <CardDescription>POS revenue over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          {dailySales.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailySales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--chart-1))' }}
                  activeDot={{ r: 6 }}
                  name="Revenue"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No revenue data available yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Volume by Day */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Volume</CardTitle>
          <CardDescription>Number of transactions per day</CardDescription>
        </CardHeader>
        <CardContent>
          {dailySales.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailySales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Bar 
                  dataKey="count" 
                  fill="hsl(var(--chart-2))" 
                  name="Transactions"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No transaction data available yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Method Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
          <CardDescription>Revenue distribution by payment type</CardDescription>
        </CardHeader>
        <CardContent>
          {paymentMethods.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentMethods}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentMethods.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No payment method data available yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hourly Performance */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Hourly Performance</CardTitle>
          <CardDescription>Transaction activity throughout the day</CardDescription>
        </CardHeader>
        <CardContent>
          {hourlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Bar 
                  yAxisId="left"
                  dataKey="transactions" 
                  fill="hsl(var(--chart-3))" 
                  name="Transactions"
                  radius={[4, 4, 0, 0]}
                />
                <Bar 
                  yAxisId="right"
                  dataKey="revenue" 
                  fill="hsl(var(--chart-4))" 
                  name="Revenue ($)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No hourly data available yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
