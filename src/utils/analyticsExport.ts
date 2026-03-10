import { formatCurrency } from '@/lib/formatters';

// ============================================
// Analytics Types
// ============================================

export interface MenuAnalytics {
  totalMenus: number;
  activeMenus: number;
  burnedMenus: number;
  totalViews: number;
  totalOrders: number;
  conversionRate: number;
  avgViewsPerMenu: number;
  avgTimeToFirstView: number;
  burnReasons: Record<string, number>;
  viewsByHour: Array<{ hour: number; views: number }>;
  topProducts: Array<{ id: string; name: string; orders: number; revenue: number }>;
}

export interface TopProduct {
  id: string;
  name: string;
  orders: number;
  revenue: number;
}

export interface BurnReasonEntry {
  name: string;
  value: number;
}

export interface ViewsByHourEntry {
  hour: number;
  views: number;
}

// ============================================
// CSV Export Utility
// ============================================

export function exportAnalyticsCsv(analytics: MenuAnalytics, filename: string): void {
  const rows: string[][] = [
    ['Metric', 'Value'],
    ['Total Menus', String(analytics.totalMenus)],
    ['Active Menus', String(analytics.activeMenus)],
    ['Burned Menus', String(analytics.burnedMenus)],
    ['Total Views', String(analytics.totalViews)],
    ['Total Orders', String(analytics.totalOrders)],
    ['Conversion Rate', `${analytics.conversionRate.toFixed(2)}%`],
    ['Avg Views Per Menu', analytics.avgViewsPerMenu.toFixed(2)],
    ['Avg Time To First View (min)', analytics.avgTimeToFirstView.toFixed(2)],
    [],
    ['Burn Reason', 'Count'],
    ...Object.entries(analytics.burnReasons).map(([reason, count]) => [reason, String(count)]),
    [],
    ['Hour', 'Views'],
    ...analytics.viewsByHour.map((h) => [String(h.hour), String(h.views)]),
    [],
    ['Product', 'Orders', 'Revenue'],
    ...analytics.topProducts.map((p) => [p.name, String(p.orders), formatCurrency(p.revenue)]),
  ];

  const csvContent = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
