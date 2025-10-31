import { supabase } from "@/integrations/supabase/client";

export interface DailyMetrics {
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  deals: number;
  volume_lbs: number;
}

export async function calculateDailyMetrics(date: Date): Promise<DailyMetrics> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const { data: orders } = await supabase
    .from('orders')
    .select('total_amount, cost_basis, total_weight_lbs')
    .gte('created_at', startOfDay.toISOString())
    .lte('created_at', endOfDay.toISOString())
    .eq('order_type', 'wholesale_bulk');

  if (!orders || orders.length === 0) {
    return { revenue: 0, cost: 0, profit: 0, margin: 0, deals: 0, volume_lbs: 0 };
  }

  const revenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const cost = orders.reduce((sum, o) => sum + (o.cost_basis || 0), 0);
  const profit = revenue - cost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const volume_lbs = orders.reduce((sum, o) => sum + (o.total_weight_lbs || 0), 0);

  return {
    revenue,
    cost,
    profit,
    margin,
    deals: orders.length,
    volume_lbs
  };
}

export async function calculateMonthlyPerformance(month: Date) {
  const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .gte('created_at', startOfMonth.toISOString())
    .lte('created_at', endOfMonth.toISOString())
    .eq('order_type', 'wholesale_bulk');

  if (!orders) return null;

  const revenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const cost = orders.reduce((sum, o) => sum + (o.cost_basis || 0), 0);
  const grossProfit = revenue - cost;
  const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  return {
    revenue,
    cost,
    grossProfit,
    margin,
    deals: orders.length,
    volume_lbs: orders.reduce((sum, o) => sum + (o.total_weight_lbs || 0), 0),
    avgDealSize: orders.length > 0 ? revenue / orders.length : 0
  };
}

export async function getTopMovers(days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data } = await supabase
    .from('order_items')
    .select(`
      product_id,
      quantity,
      price,
      products (name)
    `)
    .gte('created_at', startDate.toISOString());

  if (!data) return [];

  // Group by product
  const productMap = new Map();
  data.forEach(item => {
    const existing = productMap.get(item.product_id) || {
      product_id: item.product_id,
      product_name: item.products?.name,
      total_lbs: 0,
      total_revenue: 0,
      order_count: 0
    };

    existing.total_lbs += item.quantity;
    existing.total_revenue += item.quantity * item.price;
    existing.order_count += 1;

    productMap.set(item.product_id, existing);
  });

  return Array.from(productMap.values())
    .sort((a, b) => b.total_lbs - a.total_lbs)
    .slice(0, 10);
}

export async function getTopClientsByProfit(days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data } = await supabase
    .from('orders')
    .select(`
      total_amount,
      cost_basis,
      total_weight_lbs,
      wholesale_clients (
        id,
        business_name
      )
    `)
    .gte('created_at', startDate.toISOString())
    .eq('order_type', 'wholesale_bulk');

  if (!data) return [];

  // Group by client
  const clientMap = new Map();
  data.forEach(order => {
    const clientId = order.wholesale_clients?.id;
    if (!clientId) return;

    const existing = clientMap.get(clientId) || {
      client_id: clientId,
      business_name: order.wholesale_clients.business_name,
      total_revenue: 0,
      total_cost: 0,
      total_profit: 0,
      volume_lbs: 0,
      order_count: 0
    };

    existing.total_revenue += order.total_amount || 0;
    existing.total_cost += order.cost_basis || 0;
    existing.total_profit += (order.total_amount || 0) - (order.cost_basis || 0);
    existing.volume_lbs += order.total_weight_lbs || 0;
    existing.order_count += 1;

    clientMap.set(clientId, existing);
  });

  return Array.from(clientMap.values())
    .sort((a, b) => b.total_profit - a.total_profit)
    .slice(0, 10);
}

export async function calculateMargins() {
  const { data: products } = await supabase
    .from('products')
    .select('id, name, wholesale_price_per_lb, cost_per_lb');

  if (!products) return [];

  return products.map(product => ({
    product_id: product.id,
    product_name: product.name,
    price: product.wholesale_price_per_lb,
    cost: product.cost_per_lb,
    margin: product.wholesale_price_per_lb > 0
      ? ((product.wholesale_price_per_lb - product.cost_per_lb) / product.wholesale_price_per_lb) * 100
      : 0,
    profit_per_lb: product.wholesale_price_per_lb - product.cost_per_lb
  }));
}

export async function generateFinancialReport(startDate: Date, endDate: Date) {
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .eq('order_type', 'wholesale_bulk');

  if (!orders) return null;

  const revenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const cost = orders.reduce((sum, o) => sum + (o.cost_basis || 0), 0);
  const grossProfit = revenue - cost;

  // Get credit data
  const { data: creditOut } = await supabase
    .from('credit_transactions')
    .select('amount')
    .eq('transaction_type', 'credit_given')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  const { data: paymentsIn } = await supabase
    .from('credit_transactions')
    .select('amount')
    .eq('transaction_type', 'payment_received')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  const totalCreditGiven = creditOut?.reduce((sum, t) => sum + t.amount, 0) || 0;
  const totalPaymentsReceived = paymentsIn?.reduce((sum, t) => sum + t.amount, 0) || 0;

  return {
    period: {
      start: startDate,
      end: endDate
    },
    revenue: {
      total: revenue,
      credit: totalCreditGiven,
      cash: revenue - totalCreditGiven
    },
    costs: {
      cogs: cost,
      gross_profit: grossProfit,
      gross_margin: revenue > 0 ? (grossProfit / revenue) * 100 : 0
    },
    cashFlow: {
      collections: totalPaymentsReceived,
      outstanding: totalCreditGiven - totalPaymentsReceived
    },
    operations: {
      orders: orders.length,
      volume_lbs: orders.reduce((sum, o) => sum + (o.total_weight_lbs || 0), 0),
      avg_order_size: orders.length > 0 ? revenue / orders.length : 0
    }
  };
}

export async function forecastRevenue(historicalDays: number = 90, forecastDays: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - historicalDays);

  const { data: orders } = await supabase
    .from('orders')
    .select('created_at, total_amount')
    .gte('created_at', startDate.toISOString())
    .eq('order_type', 'wholesale_bulk');

  if (!orders || orders.length === 0) return null;

  // Calculate daily average
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const dailyAverage = totalRevenue / historicalDays;

  // Simple linear forecast
  const forecast = dailyAverage * forecastDays;

  // Calculate growth trend
  const firstHalf = orders.slice(0, Math.floor(orders.length / 2));
  const secondHalf = orders.slice(Math.floor(orders.length / 2));

  const firstHalfAvg = firstHalf.reduce((sum, o) => sum + (o.total_amount || 0), 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, o) => sum + (o.total_amount || 0), 0) / secondHalf.length;

  const growthRate = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;

  return {
    historical: {
      days: historicalDays,
      total_revenue: totalRevenue,
      daily_average: dailyAverage
    },
    forecast: {
      days: forecastDays,
      projected_revenue: forecast,
      growth_rate: growthRate
    }
  };
}
