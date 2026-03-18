/**
 * Attention Queue Scoring Algorithm
 * 
 * Calculates a weighted score for attention items to determine priority.
 * Formula: Score = Base Priority + Category Urgency + Age Factor + Value Factor
 */

import { AttentionItem, AlertPriority, AlertCategory } from '@/types/hotbox';

// Re-export for consumers
export type { AttentionItem, AlertPriority, AlertCategory };

// Base Priority Scores
const PRIORITY_SCORES: Record<AlertPriority, number> = {
  critical: 1000,
  important: 100,
  info: 10,
};

// Category Urgency Scores
const CATEGORY_SCORES: Record<AlertCategory, number> = {
  orders: 50,      // Money waiting
  delivery: 45,    // Active operations
  compliance: 40,  // Legal risk
  system: 35,      // Technical issues
  inventory: 30,   // Can't sell without it
  customers: 25,   // Relationship
  financial: 20,   // Tracking
  team: 15,        // People management
};

/**
 * Calculate the score for an attention item
 */
export function calculateAttentionScore(item: AttentionItem): number {
  let score = 0;

  // 1. Base Priority
  score += PRIORITY_SCORES[item.priority] ?? 0;

  // 2. Category Urgency
  score += CATEGORY_SCORES[item.category] ?? 0;

  // 3. Age Factor
  const created = new Date(item.timestamp);
  const now = new Date();
  const ageInHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

  if (ageInHours < 1) {
    score += 20; // Boost for very new items
  } else if (ageInHours > 24) {
    // Decay for old items (-2 points per hour over 24h)
    const decay = Math.min(100, (ageInHours - 24) * 2);
    score -= decay;
  }

  // 4. Value Factor (if applicable)
  // If item has a value (e.g., "$500"), parse it and add points
  if (item.value) {
    const valueStr = item.value.replace(/[^0-9.]/g, '');
    const value = parseFloat(valueStr);

    if (!isNaN(value) && value > 0) {
      // log10(amount) * 20
      // $100 -> 2 * 20 = 40
      // $1000 -> 3 * 20 = 60
      // $10000 -> 4 * 20 = 80
      score += Math.log10(value) * 20;
    }
  }

  return Math.round(score);
}

/**
 * Sort attention items by score (descending)
 */
export function sortAttentionQueue(items: AttentionItem[]): AttentionItem[] {
  return items
    .map(item => ({
      ...item,
      score: calculateAttentionScore(item)
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

/**
 * Get color for category
 */
export function getCategoryColor(category: AlertCategory): string {
  const colors: Record<AlertCategory, string> = {
    orders: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
    delivery: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
    compliance: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
    system: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400',
    inventory: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400',
    customers: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400',
    financial: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400',
    team: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400',
  };
  return colors[category] || 'text-gray-600 bg-gray-100';
}
import { supabase } from '@/integrations/supabase/client';
import { BusinessTier } from '@/lib/presets/businessTiers';

// Helper to create consistent attention items
function createAttentionItem(params: Omit<Partial<AttentionItem>, 'timestamp'> & { title: string; priority: AlertPriority; category: AlertCategory; actionLabel: string; actionRoute: string; timestamp: Date }): AttentionItem {
  const { timestamp, ...rest } = params;
  return {
    id: params.id || Math.random().toString(36).substring(7),
    priority: params.priority,
    category: params.category,
    title: params.title,
    description: params.description,
    value: params.value ? String(params.value) : undefined,
    timestamp: timestamp.toISOString(),
    actionUrl: params.actionRoute,
    actionLabel: params.actionLabel,
    score: 0, // Will be calculated
    ...rest,
  };
}

// ============================================================
// DATA FETCHING
// ============================================================

/**
 * Fetch all attention items for a tenant from the database
 */
export async function fetchAttentionItems(
  tenantId: string,
  _tier: BusinessTier
): Promise<AttentionItem[]> {
  const items: AttentionItem[] = [];
  const now = new Date();

  // Parallel fetch all data sources
  const [
    pendingMenuOrders,
    pendingOrders,
    lateDeliveries,
    activeDeliveries,
    outOfStock,
    lowStock,
    customerTabs,
    wholesalePending,
  ] = await Promise.all([
    // Pending menu orders
    supabase
      .from('menu_orders')
      .select('id, total_amount, created_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending'),

    // Pending regular orders
    supabase
      .from('orders')
      .select('id, total_amount, created_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending'),

    // Late deliveries (ETA passed)
    supabase
      .from('deliveries')
      .select('id, created_at, estimated_delivery_time')
      .eq('tenant_id', tenantId)
      .eq('status', 'in_transit')
      .lt('estimated_delivery_time', now.toISOString()),

    // Active deliveries (on schedule)
    supabase
      .from('deliveries')
      .select('id, created_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'in_transit')
      .gte('estimated_delivery_time', now.toISOString()),

    // Out of stock products
    supabase
      .from('products')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .lte('stock_quantity', 0)
      .eq('status', 'active'),

    // Low stock products
    supabase
      .from('products')
      .select('id, name, stock_quantity')
      .eq('tenant_id', tenantId)
      .gt('stock_quantity', 0)
      .lt('stock_quantity', 10)
      .eq('status', 'active'),

    // Customer tabs with balance
    supabase
      .from('customers')
      .select('id, first_name, last_name, balance')
      .eq('tenant_id', tenantId)
      .gt('balance', 0),

    // Wholesale orders pending approval
    supabase
      .from('wholesale_orders')
      .select('id, total_amount, created_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending'),
  ]);

  // === CRITICAL ITEMS ===

  // Pending menu orders (money waiting!)
  if (pendingMenuOrders.data && pendingMenuOrders.data.length > 0) {
    const totalValue = pendingMenuOrders.data.reduce(
      (sum, o) => sum + Number(o.total_amount ?? 0), 0
    );
    const oldestOrder = pendingMenuOrders.data.reduce((oldest, o) => {
      const orderTime = new Date(o.created_at).getTime();
      return orderTime < oldest ? orderTime : oldest;
    }, Date.now());

    items.push(createAttentionItem({
      priority: 'critical',
      category: 'orders',
      title: `${pendingMenuOrders.data.length} Disposable Menu ${pendingMenuOrders.data.length === 1 ? 'order' : 'orders'} waiting`,
      description: 'Customers waiting for confirmation',
      value: String(totalValue),
      actionLabel: 'Process',
      actionRoute: '/admin/orders?tab=menu',
      timestamp: new Date(oldestOrder),
    }));
  }

  // Late deliveries
  if (lateDeliveries.data && lateDeliveries.data.length > 0) {
    items.push(createAttentionItem({
      priority: 'critical',
      category: 'delivery',
      title: `${lateDeliveries.data.length} ${lateDeliveries.data.length === 1 ? 'delivery' : 'deliveries'} running late`,
      description: 'Customers waiting - check with drivers',
      actionLabel: 'Track',
      actionRoute: '/admin/fulfillment-hub',
      timestamp: new Date(),
    }));
  }

  // Out of stock
  if (outOfStock.data && outOfStock.data.length > 0) {
    items.push(createAttentionItem({
      priority: 'critical',
      category: 'inventory',
      title: `${outOfStock.data.length} ${outOfStock.data.length === 1 ? 'product' : 'products'} out of stock`,
      description: 'Customers cannot order these items',
      actionLabel: 'Restock',
      actionRoute: '/admin/inventory-hub?tab=stock&filter=out_of_stock',
      timestamp: new Date(),
    }));
  }

  // === IMPORTANT ITEMS ===

  // Pending regular orders
  if (pendingOrders.data && pendingOrders.data.length > 0) {
    const priority = pendingOrders.data.length > 5 ? 'critical' : 'important';
    const totalValue = pendingOrders.data.reduce(
      (sum, o) => sum + Number(o.total_amount ?? 0), 0
    );

    items.push(createAttentionItem({
      priority: priority as AlertPriority,
      category: 'orders',
      title: `${pendingOrders.data.length} ${pendingOrders.data.length === 1 ? 'order' : 'orders'} waiting to process`,
      value: String(totalValue),
      actionLabel: 'View',
      actionRoute: '/admin/orders?status=pending',
      timestamp: new Date(),
    }));
  }

  // Wholesale orders pending
  if (wholesalePending.data && wholesalePending.data.length > 0) {
    const totalValue = wholesalePending.data.reduce(
      (sum, o) => sum + Number(o.total_amount ?? 0), 0
    );

    items.push(createAttentionItem({
      priority: 'important',
      category: 'orders',
      title: `${wholesalePending.data.length} wholesale ${wholesalePending.data.length === 1 ? 'order needs' : 'orders need'} approval`,
      value: String(totalValue),
      actionLabel: 'Review',
      actionRoute: '/admin/orders?tab=wholesale',
      timestamp: new Date(),
    }));
  }

  // Low stock
  if (lowStock.data && lowStock.data.length > 0) {
    items.push(createAttentionItem({
      priority: 'important',
      category: 'inventory',
      title: `${lowStock.data.length} ${lowStock.data.length === 1 ? 'item' : 'items'} running low`,
      description: 'Reorder to avoid stockouts',
      actionLabel: 'Reorder',
      actionRoute: '/admin/inventory-hub?tab=stock',
      timestamp: new Date(),
    }));
  }

  // Customer tabs
  if (customerTabs.data && customerTabs.data.length > 0) {
    const totalOwed = customerTabs.data.reduce(
      (sum, c) => sum + Number(c.balance ?? 0), 0
    );

    if (totalOwed > 100) { // Only show if significant amount
      items.push(createAttentionItem({
        priority: 'important',
        category: 'customers',
        title: `${customerTabs.data.length} ${customerTabs.data.length === 1 ? 'customer' : 'customers'} with open tabs`,
        value: String(totalOwed),
        actionLabel: 'Collect',
        actionRoute: '/admin/customer-hub',
        timestamp: new Date(),
      }));
    }
  }

  // === INFO ITEMS ===

  // Active deliveries (good news)
  if (activeDeliveries.data && activeDeliveries.data.length > 0 && !lateDeliveries.data?.length) {
    items.push(createAttentionItem({
      priority: 'info',
      category: 'delivery',
      title: `${activeDeliveries.data.length} ${activeDeliveries.data.length === 1 ? 'delivery' : 'deliveries'} in progress`,
      description: 'All on schedule',
      actionLabel: 'Track',
      actionRoute: '/admin/fulfillment-hub',
      timestamp: new Date(),
    }));
  }

  // If nothing, show "all good"
  if (items.length === 0) {
    items.push(createAttentionItem({
      priority: 'info',
      category: 'system',
      title: 'All caught up!',
      description: 'No urgent items need your attention',
      actionLabel: 'View Orders',
      actionRoute: '/admin/orders',
      timestamp: new Date(),
    }));
  }

  return items;
}

// ============================================================
// QUEUE BUILDER
// ============================================================

import { AttentionQueue } from '@/types/hotbox';

/**
 * Build the complete attention queue with scoring
 */
export async function buildAttentionQueue(
  tenantId: string,
  tier: BusinessTier
): Promise<AttentionQueue> {
  const allItems = await fetchAttentionItems(tenantId, tier);
  const sortedItems = sortAttentionQueue(allItems);

  // Count critical items
  const criticalCount = sortedItems.filter(i => i.priority === 'critical').length;

  return {
    items: sortedItems,
    criticalCount,
    totalCount: allItems.length,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get top N attention items (already sorted by score)
 */
export function getTopAttentionItems(
  queue: AttentionQueue,
  maxItems: number = 5
): AttentionItem[] {
  return queue.items.slice(0, maxItems);
}

/**
 * Build queue from pre-fetched items (no database call)
 */
export function buildQueueFromItems(items: AttentionItem[]): AttentionQueue {
  const sortedItems = sortAttentionQueue(items);

  return {
    items: sortedItems,
    criticalCount: sortedItems.filter(i => i.priority === 'critical').length,
    totalCount: items.length,
    lastUpdated: new Date().toISOString(),
  };
}

// ============================================================
// UTILITY EXPORTS
// ============================================================

export {
  PRIORITY_SCORES as PRIORITY_WEIGHTS,
  CATEGORY_SCORES as CATEGORY_URGENCY,
};
