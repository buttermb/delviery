/**
 * AI Revenue Prediction Widget
 * Predicts next 7 days of revenue using linear regression
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertTriangle,
  Loader2 
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatDateForDisplay } from '@/lib/utils/revenue-analysis';
import { SimpleRevenuePredictor } from '@/lib/ai/simple-revenue-prediction';
import { groupOrdersByDate } from '@/lib/utils/revenue-analysis';

interface PredictionData {
  predictions: Array<{
    date: string;
    predictedRevenue: number;
    trend: 'up' | 'down' | 'stable';
    confidence: number;
  }>;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
  historicalDays: number;
  totalPredicted: number;
}

export function RevenuePredictionWidget() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  // Fetch predictions from edge function
  const { data: predictionData, isLoading, error } = useQuery<PredictionData>({
    queryKey: ['revenue-predictions', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant ID required');

      // Call edge function
      const { data, error: fnError } = await supabase.functions.invoke('predict-revenue', {
        body: { tenantId, days: 7 },
      });

      if (fnError) throw fnError;
      if (!data) throw new Error('No prediction data returned');

      return data;
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });

  // Fetch historical data for chart
  const { data: historicalData } = useQuery<Array<{date: string; revenue: number}> | undefined>({
    queryKey: ['revenue-historical', tenantId],
    queryFn: async (): Promise<Array<{date: string; revenue: number}>> => {
      if (!tenantId) return [];

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // @ts-ignore - Simplified type handling for wholesale_orders query
      const { data: orders, error: ordersError } = await supabase
        .from('wholesale_orders')
        .select('created_at, total_amount, client_id')
        .eq('tenant_id', tenantId)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: true });

      if (ordersError || !orders) return [];

      const dailyData = groupOrdersByDate(orders as any);
      return dailyData.slice(-7); // Last 7 days for chart
    },
    enabled: !!tenantId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading predictions...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !predictionData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <p className="font-medium">Failed to load predictions</p>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'Please try again later'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  // Combine historical and predictions for chart
  const chartData = [
    ...(historicalData || []).map(d => ({
      date: formatDateForDisplay(d.date),
      actual: d.revenue,
      predicted: null,
    })),
    ...predictionData.predictions.map(p => ({
      date: formatDateForDisplay(p.date),
      actual: null,
      predicted: p.predictedRevenue,
    })),
  ];

  const predictor = new SimpleRevenuePredictor();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          AI Revenue Prediction
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Next 7 Days Forecast</p>
            <p className="text-2xl font-bold">${predictionData.totalPredicted.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Confidence Level</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{Math.round(predictionData.confidence * 100)}%</p>
              <Badge 
                variant={predictionData.confidence >= 0.75 ? 'default' : 'secondary'}
                className="text-xs"
              >
                {predictionData.confidence >= 0.75 ? 'High' : predictionData.confidence >= 0.5 ? 'Medium' : 'Low'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: any) => value ? [`$${value.toLocaleString()}`, ''] : ['', '']}
                  labelStyle={{ color: '#000' }}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ fill: '#22c55e', r: 4 }}
                  name="Actual"
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#a855f7"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#a855f7', r: 4 }}
                  name="Predicted"
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Daily Breakdown */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Daily Breakdown:</p>
          <div className="space-y-2">
            {predictionData.predictions.map((pred) => (
              <div 
                key={pred.date} 
                className="flex items-center justify-between text-sm p-2 rounded-md hover:bg-muted/50 transition-colors"
              >
                <span className="text-muted-foreground">
                  {formatDateForDisplay(pred.date)}
                </span>
                <div className="flex items-center gap-2">
                  {getTrendIcon(pred.trend)}
                  <span className="font-medium">${pred.predictedRevenue.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Confidence Note */}
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            {predictor.getConfidenceDescription(predictionData.confidence)}
          </p>
          {predictionData.historicalDays < 30 && (
            <p className="text-xs text-muted-foreground mt-1">
              Based on {predictionData.historicalDays} days of historical data
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

