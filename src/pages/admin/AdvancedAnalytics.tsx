import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { TrendingUp, Download, Calendar } from 'lucide-react';
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

export default function AdvancedAnalytics() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [forecastPeriod, setForecastPeriod] = useState<'30d' | '90d' | '180d'>('90d');

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['advanced-analytics', tenantId, forecastPeriod],
    queryFn: async () => {
      if (!tenantId) return null;

      const days = forecastPeriod === '30d' ? 30 : forecastPeriod === '90d' ? 90 : 180;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get historical sales data
      const { data: orders, error } = await supabase
        .from('orders')
        .select('total_amount, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Process data for forecasting
      const dailyRevenue: Record<string, number> = {};
      orders?.forEach((order: any) => {
        const date = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dailyRevenue[date] = (dailyRevenue[date] || 0) + Number(order.total_amount || 0);
      });

      const historicalData = Object.entries(dailyRevenue)
        .map(([date, revenue]) => ({ date, revenue }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Simple linear regression for forecasting
      const forecastData = generateForecast(historicalData, 30);

      return {
        historical: historicalData,
        forecast: forecastData,
      };
    },
    enabled: !!tenantId,
  });

  // Simple linear regression forecast
  const generateForecast = (data: Array<{ date: string; revenue: number }>, days: number) => {
    if (data.length < 2) return [];

    // Calculate linear regression
    const n = data.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    data.forEach((point, index) => {
      const x = index;
      const y = point.revenue;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate forecast
    const forecast = [];
    const lastDate = new Date(data[data.length - 1].date);
    for (let i = 1; i <= days; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(forecastDate.getDate() + i);
      const x = n + i - 1;
      const predictedRevenue = slope * x + intercept;
      forecast.push({
        date: forecastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: Math.max(0, predictedRevenue), // Don't allow negative revenue
        type: 'forecast',
      });
    }

    return forecast;
  };

  // Trend analysis
  const trendAnalysis = analyticsData
    ? (() => {
        const historical = analyticsData.historical;
        if (historical.length < 2) return { trend: 'stable', growth: 0 };

        const firstHalf = historical.slice(0, Math.floor(historical.length / 2));
        const secondHalf = historical.slice(Math.floor(historical.length / 2));

        const avgFirst = firstHalf.reduce((sum, d) => sum + d.revenue, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((sum, d) => sum + d.revenue, 0) / secondHalf.length;

        const growth = avgFirst > 0 ? ((avgSecond - avgFirst) / avgFirst) * 100 : 0;

        return {
          trend: growth > 5 ? 'increasing' : growth < -5 ? 'decreasing' : 'stable',
          growth,
        };
      })()
    : { trend: 'stable', growth: 0 };

  // Cohort analysis (simplified)
  const cohortData = analyticsData?.historical.reduce((acc: any, point: any) => {
    const month = new Date(point.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    if (!acc[month]) acc[month] = 0;
    acc[month] += point.revenue;
    return acc;
  }, {});

  const cohortChartData = cohortData
    ? Object.entries(cohortData)
        .map(([month, revenue]) => ({ month, revenue: revenue as number }))
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
    : [];

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading advanced analytics...</div>
      </div>
    );
  }

  const combinedData = analyticsData
    ? [
        ...analyticsData.historical.map((d) => ({ ...d, type: 'actual' })),
        ...analyticsData.forecast,
      ]
    : [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Advanced Analytics</h1>
          <p className="text-muted-foreground">Predictive analytics and trend analysis</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={forecastPeriod === '30d' ? 'default' : 'outline'}
            onClick={() => setForecastPeriod('30d')}
            size="sm"
          >
            30 Days
          </Button>
          <Button
            variant={forecastPeriod === '90d' ? 'default' : 'outline'}
            onClick={() => setForecastPeriod('90d')}
            size="sm"
          >
            90 Days
          </Button>
          <Button
            variant={forecastPeriod === '180d' ? 'default' : 'outline'}
            onClick={() => setForecastPeriod('180d')}
            size="sm"
          >
            180 Days
          </Button>
        </div>
      </div>

      {/* Trend Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp
                className={`h-5 w-5 ${
                  trendAnalysis.trend === 'increasing'
                    ? 'text-green-600'
                    : trendAnalysis.trend === 'decreasing'
                    ? 'text-red-600'
                    : 'text-gray-600'
                }`}
              />
              <div className="text-2xl font-bold capitalize">{trendAnalysis.trend}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Growth Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                trendAnalysis.growth >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {trendAnalysis.growth >= 0 ? '+' : ''}
              {trendAnalysis.growth.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Forecast Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">30 days</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="forecast" className="w-full">
        <TabsList>
          <TabsTrigger value="forecast">Sales Forecast</TabsTrigger>
          <TabsTrigger value="cohort">Cohort Analysis</TabsTrigger>
          <TabsTrigger value="trends">Trend Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="forecast" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Forecast (Next 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={combinedData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#0088FE"
                    strokeWidth={2}
                    strokeDasharray={combinedData.some((d: any) => d.type === 'forecast') ? '5 5' : '0'}
                    name="Revenue"
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-4 text-sm text-muted-foreground">
                <p>Solid line: Historical data | Dashed line: Forecast (Linear Regression)</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cohort" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Revenue Cohorts</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={cohortChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" fill="#00C49F" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Historical Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={analyticsData?.historical || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#0088FE" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle>AI Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Revenue Trend</h4>
              <p className="text-sm text-muted-foreground">
                Based on historical data, revenue is trending{' '}
                <span className="font-semibold capitalize">{trendAnalysis.trend}</span> with a{' '}
                <span className="font-semibold">
                  {trendAnalysis.growth >= 0 ? '+' : ''}
                  {trendAnalysis.growth.toFixed(1)}%
                </span>{' '}
                growth rate over the selected period.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Forecast Summary</h4>
              <p className="text-sm text-muted-foreground">
                Projected revenue for the next 30 days: $
                {analyticsData?.forecast
                  .reduce((sum, d) => sum + d.revenue, 0)
                  .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                . This forecast uses linear regression based on historical data.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

