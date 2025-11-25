/**
 * Hot Items Logic
 * 
 * Generates contextual "hot items" based on business context:
 * - Low stock alerts
 * - Pending orders
 * - Time-based suggestions
 * - Day-based suggestions
 * - Action-based suggestions
 */

import type { HotItem, BusinessContext } from '@/types/sidebar';
import {
  AlertCircle,
  ShoppingCart,
  Package,
  TrendingUp,
  FileText,
  Calendar,
  Zap,
  Share2,
} from 'lucide-react';

/**
 * Generate hot items based on business context
 */
export function generateHotItems(context: BusinessContext, tenantSlug: string): HotItem[] {
  const hotItems: HotItem[] = [];
  const now = new Date();
  const timeOfDay = context.timeOfDay ?? now.getHours();
  const dayOfWeek = context.dayOfWeek ?? now.getDay();

  // Low stock alert (urgent if >5 items)
  if (context.lowStock && context.lowStock > 5) {
    hotItems.push({
      id: 'hot-restock',
      name: `⚠️ Restock ${context.lowStock} Items`,
      path: `/${tenantSlug}/admin/stock-alerts`,
      icon: AlertCircle,
      priority: context.lowStock > 20 ? 'urgent' : 'high',
      badge: context.lowStock,
      featureId: 'stock-alerts',
    });
  }

  // Pending orders (high priority if >10 orders)
  if (context.pendingOrders && context.pendingOrders > 10) {
    hotItems.push({
      id: 'hot-pending-orders',
      name: `📦 ${context.pendingOrders} Orders Waiting`,
      path: `/${tenantSlug}/admin/disposable-menu-orders`,
      icon: ShoppingCart,
      priority: context.pendingOrders > 50 ? 'urgent' : 'high',
      badge: context.pendingOrders,
      featureId: 'basic-orders',
    });
  }

  // Morning prep (6am-12pm)
  if (timeOfDay >= 6 && timeOfDay < 12) {
    hotItems.push({
      id: 'hot-morning-prep',
      name: '☕ Morning Prep',
      path: `/${tenantSlug}/admin/dashboard`,
      icon: Calendar,
      priority: 'normal',
      featureId: 'dashboard',
    });
  }

  // End of day (8pm-11pm)
  if (timeOfDay >= 20 && timeOfDay < 23) {
    hotItems.push({
      id: 'hot-end-of-day',
      name: '🌙 End of Day',
      path: `/${tenantSlug}/admin/pos-analytics`,
      icon: FileText,
      priority: 'normal',
      featureId: 'pos-analytics',
    });
  }

  // Monday weekly review (9am+)
  if (dayOfWeek === 1 && timeOfDay >= 9) {
    hotItems.push({
      id: 'hot-weekly-review',
      name: '📊 Weekly Review',
      path: `/${tenantSlug}/admin/reports`,
      icon: TrendingUp,
      priority: 'normal',
      featureId: 'reports',
    });
  }

  // Recently created product - suggest adding to menu
  if (context.lastAction === 'product_created') {
    hotItems.push({
      id: 'hot-add-to-menu',
      name: '✨ Add to Menu',
      path: `/${tenantSlug}/admin/disposable-menus`,
      icon: Share2,
      priority: 'normal',
      featureId: 'disposable-menus',
    });
  }

  // Credit owed alert
  if (context.creditOwed && context.creditOwed > 1000) {
    hotItems.push({
      id: 'hot-credit-alert',
      name: `💳 $${context.creditOwed.toLocaleString()} Credit Owed`,
      path: `/${tenantSlug}/admin/big-plug-clients`,
      icon: AlertCircle,
      priority: context.creditOwed > 5000 ? 'urgent' : 'high',
      featureId: 'customers',
    });
  }

  // Fronted inventory alert
  if (context.frontedTotal && context.frontedTotal > 5000) {
    hotItems.push({
      id: 'hot-fronted-alert',
      name: `📋 $${context.frontedTotal.toLocaleString()} Fronted`,
      path: `/${tenantSlug}/admin/fronted-inventory`,
      icon: Package,
      priority: context.frontedTotal > 10000 ? 'urgent' : 'high',
      featureId: 'fronted-inventory',
    });
  }

  // Sort by priority (urgent > high > normal)
  const priorityOrder = { urgent: 0, high: 1, normal: 2 };
  return hotItems.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

/**
 * Get business context from tenant data
 */
export function getBusinessContext(tenant: {
  usage?: Record<string, number>;
  low_stock_count?: number;
  pending_orders?: number;
  active_drivers?: number;
  credit_owed?: number;
  fronted_total?: number;
}): BusinessContext {
  const now = new Date();
  
  return {
    lowStock: tenant.low_stock_count,
    pendingOrders: tenant.pending_orders,
    activeDrivers: tenant.active_drivers,
    timeOfDay: now.getHours(),
    dayOfWeek: now.getDay(),
    creditOwed: tenant.credit_owed,
    frontedTotal: tenant.fronted_total,
  };
}

