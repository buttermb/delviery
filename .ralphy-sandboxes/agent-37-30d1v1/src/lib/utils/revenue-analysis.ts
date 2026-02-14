/**
 * Revenue Analysis Utilities
 * Helper functions for processing and analyzing revenue data
 */

export interface DailyRevenue {
  date: string;
  revenue: number;
  orders: number;
  customers: number;
  avgOrderValue: number;
}

export interface OrderData {
  created_at: string;
  total_amount: number | string;
  customer_id: string;
  tenant_id: string;
}

/**
 * Group orders by date and calculate daily metrics
 */
export function groupOrdersByDate(orders: OrderData[]): DailyRevenue[] {
  const dailyMap = new Map<string, {
    revenue: number;
    orders: number;
    customers: Set<string>;
  }>();

  orders.forEach(order => {
    const date = new Date(order.created_at).toISOString().split('T')[0];
    
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
    day.customers.add(order.customer_id);
  });

  // Convert to array and calculate averages
  return Array.from(dailyMap.entries())
    .map(([date, stats]) => ({
      date,
      revenue: stats.revenue,
      orders: stats.orders,
      customers: stats.customers.size,
      avgOrderValue: stats.orders > 0 ? stats.revenue / stats.orders : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate average metrics from historical data
 */
export function calculateAverages(dailyData: DailyRevenue[]): {
  avgDailyRevenue: number;
  avgDailyOrders: number;
  avgDailyCustomers: number;
  avgOrderValue: number;
} {
  if (dailyData.length === 0) {
    return {
      avgDailyRevenue: 0,
      avgDailyOrders: 0,
      avgDailyCustomers: 0,
      avgOrderValue: 0,
    };
  }

  const totals = dailyData.reduce(
    (acc, day) => ({
      revenue: acc.revenue + day.revenue,
      orders: acc.orders + day.orders,
      customers: acc.customers + day.customers,
    }),
    { revenue: 0, orders: 0, customers: 0 }
  );

  const days = dailyData.length;

  return {
    avgDailyRevenue: totals.revenue / days,
    avgDailyOrders: totals.orders / days,
    avgDailyCustomers: totals.customers / days,
    avgOrderValue: totals.orders > 0 ? totals.revenue / totals.orders : 0,
  };
}

/**
 * Calculate weekend adjustment factor
 * Weekends typically have lower sales
 */
export function getWeekendMultiplier(dayOfWeek: number): number {
  // Sunday = 0, Saturday = 6
  return dayOfWeek === 0 || dayOfWeek === 6 ? 0.7 : 1.0;
}

/**
 * Get day name for display
 */
export function getDayName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek];
}

/**
 * Format date for display
 */
export function formatDateForDisplay(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get date range for query
 */
export function getDateRange(daysBack: number): { start: string; end: string } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  start.setHours(0, 0, 0, 0);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/**
 * Filter data by date range
 */
export function filterByDateRange(
  data: DailyRevenue[],
  startDate: string,
  endDate: string
): DailyRevenue[] {
  return data.filter(
    day => day.date >= startDate.split('T')[0] && day.date <= endDate.split('T')[0]
  );
}

