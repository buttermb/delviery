/**
 * Revenue Prediction Edge Function
 * Predicts next 7 days of revenue using linear regression
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { secureHeadersMiddleware } from '../_shared/secure-headers.ts';

interface DailyRevenue {
  date: string;
  revenue: number;
  orders: number;
  customers: number;
  avgOrderValue: number;
}

interface PredictionResult {
  date: string;
  predictedRevenue: number;
  trend: 'up' | 'down' | 'stable';
  confidence: number;
  factors?: {
    avgOrders: number;
    avgOrderValue: number;
    dayOfWeek: number;
    weekendMultiplier: number;
  };
}

serve(secureHeadersMiddleware(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenantId, days = 7 } = await req.json();

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'tenantId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get historical data (last 90 days for better accuracy)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: orders, error: ordersError } = await supabase
      .from('wholesale_orders')
      .select('created_at, total_amount, customer_id')
      .eq('tenant_id', tenantId)
      .gte('created_at', ninetyDaysAgo)
      .order('created_at', { ascending: true });

    if (ordersError) {
      throw new Error(`Failed to fetch orders: ${ordersError.message}`);
    }

    if (!orders || orders.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Not enough historical data',
          message: 'Need at least 7 days of order data for predictions',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group orders by date
    const dailyMap = new Map<string, {
      revenue: number;
      orders: number;
      customers: Set<string>;
    }>();

    orders.forEach((order: Record<string, unknown>) => {
      const date = new Date(order.created_at as string).toISOString().split('T')[0];

      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          revenue: 0,
          orders: 0,
          customers: new Set(),
        });
      }

      const day = dailyMap.get(date)!;
      day.revenue += Number(order.total_amount) || 0;
      day.orders += 1;
      day.customers.add(order.customer_id as string);
    });

    // Convert to array and calculate averages
    const dailyData: DailyRevenue[] = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
        revenue: stats.revenue,
        orders: stats.orders,
        customers: stats.customers.size,
        avgOrderValue: stats.orders > 0 ? stats.revenue / stats.orders : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate averages for last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const recentData = dailyData.filter(d => d.date >= thirtyDaysAgo);

    const avgOrders = recentData.length > 0
      ? recentData.reduce((sum, d) => sum + d.orders, 0) / recentData.length
      : dailyData.reduce((sum, d) => sum + d.orders, 0) / Math.max(dailyData.length, 1);

    const avgOrderValue = recentData.length > 0
      ? recentData.reduce((sum, d) => sum + d.avgOrderValue, 0) / recentData.length
      : dailyData.reduce((sum, d) => sum + d.avgOrderValue, 0) / Math.max(dailyData.length, 1);

    // Simple linear regression
    const n = dailyData.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    dailyData.forEach((day, index) => {
      const x = index;
      const y = day.revenue;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate confidence
    let confidence = 0.3;
    if (dailyData.length >= 7) confidence = 0.6;
    if (dailyData.length >= 30) confidence = 0.8;
    if (dailyData.length >= 60) confidence = 0.85;

    // Determine trend
    const trend: 'up' | 'down' | 'stable' = slope > 100 ? 'up' : slope < -100 ? 'down' : 'stable';

    // Generate predictions
    const predictions: PredictionResult[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 1; i <= days; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + i);

      const dayOfWeek = futureDate.getDay();
      const weekendMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 0.7 : 1.0;

      // Predict using linear regression
      const x = dailyData.length + i - 1;
      const predictedRevenue = (slope * x + intercept) * weekendMultiplier;

      predictions.push({
        date: futureDate.toISOString().split('T')[0],
        predictedRevenue: Math.round(Math.max(0, predictedRevenue)),
        trend: slope > 50 ? 'up' : slope < -50 ? 'down' : 'stable',
        confidence,
        factors: {
          avgOrders: Math.round(avgOrders),
          avgOrderValue: Math.round(avgOrderValue),
          dayOfWeek,
          weekendMultiplier,
        },
      });
    }

    return new Response(
      JSON.stringify({
        predictions,
        confidence,
        trend,
        historicalDays: dailyData.length,
        totalPredicted: predictions.reduce((sum, p) => sum + p.predictedRevenue, 0),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Revenue prediction error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate predictions' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}));
