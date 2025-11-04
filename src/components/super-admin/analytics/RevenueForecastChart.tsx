/**
 * Revenue Forecast Chart
 * ML-powered revenue predictions using linear regression
 * Displays historical revenue and 7-day forecast
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, DollarSign } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { SimpleRevenuePredictor } from '@/lib/ai/revenue-predictor';

interface ForecastDataPoint {
  date: string;
  actual?: number;
  predicted?: number;
  isForecast: boolean;
}

export function RevenueForecastChart() {
  const { data: forecastData, isLoading } = useQuery({
    queryKey: ['revenue-forecast'],
    queryFn: async () => {
      // Fetch last 30 days of revenue data
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      
      const { data: orders, error } = await supabase
        .from('wholesale_orders')
        .select('created_at, total')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by date
      const dailyRevenue: Record<string, number> = {};
      orders?.forEach((order) => {
        const date = order.created_at.split('T')[0];
        dailyRevenue[date] = (dailyRevenue[date] || 0) + (order.total || 0);
      });

      // Convert to historical data format
      const historicalData = Object.entries(dailyRevenue)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, revenue]) => ({ date, revenue }));

      // Use predictor to generate forecast
      const predictor = new SimpleRevenuePredictor();
      const forecast = predictor.predictWeek(historicalData);
      const confidence = predictor.calculateConfidence(historicalData);

      // Combine historical and forecast data
      const chartData: ForecastDataPoint[] = [];

      // Add historical data (last 14 days)
      const fourteenDaysAgo = subDays(new Date(), 14);
      for (let i = 13; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        chartData.push({
          date,
          actual: dailyRevenue[date] || 0,
          isForecast: false,
        });
      }

      // Add forecast data
      forecast.forEach((f) => {
        chartData.push({
          date: f.date,
          predicted: f.predictedRevenue,
          isForecast: true,
        });
      });

      return {
        chartData,
        confidence,
        trend: forecast[0]?.trend || 'stable',
        avgRevenue: historicalData.length > 0
          ? historicalData.reduce((sum, d) => sum + d.revenue, 0) / historicalData.length
          : 0,
      };
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Revenue Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!forecastData) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Revenue Forecast (7 Days)
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {Math.round(forecastData.confidence * 100)}% Confidence
            </Badge>
            <Badge
              variant={
                forecastData.trend === 'up'
                  ? 'default'
                  : forecastData.trend === 'down'
                  ? 'destructive'
                  : 'secondary'
              }
            >
              {forecastData.trend === 'up' ? '↑' : forecastData.trend === 'down' ? '↓' : '→'}{' '}
              {forecastData.trend}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={forecastData.chartData}>
            <defs>
              <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => format(new Date(value), 'MMM dd')}
              className="text-muted-foreground"
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              className="text-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: any, name: string) => {
                if (name === 'actual') return [`$${value.toLocaleString()}`, 'Actual'];
                if (name === 'predicted') return [`$${value.toLocaleString()}`, 'Predicted'];
                return value;
              }}
              labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="actual"
              stroke="#3b82f6"
              fill="url(#colorActual)"
              name="Actual Revenue"
            />
            <Area
              type="monotone"
              dataKey="predicted"
              stroke="#10b981"
              strokeDasharray="5 5"
              fill="url(#colorPredicted)"
              name="Predicted Revenue"
            />
          </AreaChart>
        </ResponsiveContainer>

        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Average Daily Revenue</p>
            <p className="text-xl font-bold">${forecastData.avgRevenue.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">7-Day Forecast</p>
            <p className="text-xl font-bold">
              ${forecastData.chartData
                .filter((d) => d.isForecast)
                .reduce((sum, d) => sum + (d.predicted || 0), 0)
                .toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Confidence</p>
            <p className="text-xl font-bold">{Math.round(forecastData.confidence * 100)}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
