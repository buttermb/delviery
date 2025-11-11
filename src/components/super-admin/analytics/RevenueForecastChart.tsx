/**
 * Revenue Forecast Chart - Placeholder
 * Shows mock data for revenue forecasting
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { format, subDays } from 'date-fns';

export function RevenueForecastChart() {
  // Generate mock data for demo
  const mockData = [];
  
  // Last 14 days of historical data
  for (let i = 13; i >= 0; i--) {
    const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
    mockData.push({
      date,
      actual: Math.floor(Math.random() * 5000) + 3000,
      isForecast: false,
    });
  }
  
  // Next 7 days forecast
  for (let i = 1; i <= 7; i++) {
    const date = format(new Date(Date.now() + i * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
    mockData.push({
      date,
      predicted: Math.floor(Math.random() * 5000) + 3500,
      isForecast: true,
    });
  }

  const avgRevenue = 4200;
  const confidence = 85;
  const trend = 'up';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Revenue Forecast (7 Days)
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{confidence}% Confidence</Badge>
            <Badge variant="default">↑ {trend}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={mockData}>
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
              formatter={(value: number | string | undefined, name: string) => {
                if (typeof value === 'number') {
                  if (name === 'actual') return [`$${value.toLocaleString()}`, 'Actual'];
                  if (name === 'predicted') return [`$${value.toLocaleString()}`, 'Predicted'];
                }
                return [value, name];
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
            <p className="text-xl font-bold">${avgRevenue.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">7-Day Forecast</p>
            <p className="text-xl font-bold">
              ${(avgRevenue * 7).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Confidence</p>
            <p className="text-xl font-bold">{confidence}%</p>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          Demo data - Connect your revenue sources to see actual forecasts
        </div>
      </CardContent>
    </Card>
  );
}