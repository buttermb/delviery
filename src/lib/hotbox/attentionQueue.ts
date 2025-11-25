/**
 * Attention Queue with Weighted Scoring Algorithm
 * 
 * Scoring Formula:
 * Score = Base Priority + Category Urgency + Age Factor + Value Factor
 * 
 * Base Priority:
 * - Critical: 1000 points
 * - Important: 100 points
 * - Info: 10 points
 * 
 * Category Urgency:
 * - Orders: +50 (money waiting)
 * - Delivery: +45 (active operations)
 * - Compliance: +40 (legal risk)
 * - System: +35 (technical issues)
 * - Inventory: +30 (can't sell without it)
 * - Customers: +25 (relationship management)
 * - Financial: +20 (money tracking)
 * - Team: +15 (people management)
 * 
 * Age Factor:
 * - < 1 hour: +20 points (just happened)
 * - > 24 hours: -2 points per hour (decay)
 * 
 * Value Factor:
 * - log10(dollar_amount) * 20
 * - $100 = +40, $1K = +60, $10K = +80
 */

import { supabase } from '@/integrations/supabase/client';
import {
  AttentionItem,
  AttentionQueue,
  AlertPriority,
  AlertCategory,
  PRIORITY_WEIGHTS,
  CATEGORY_URGENCY,
  AGE_DECAY_HOURS,
  BusinessTier,
} from '@/types/hotbox';

// ============================================================
// SCORING FUNCTIONS
// ============================================================

/**
 * Calculate the weighted score for an attention item
 */
export function calculateItemScore(item: AttentionItem): number {
  let score = 0;
  
  // 1. Base priority score
  score += PRIORITY_WEIGHTS[item.priority];
  
  // 2. Category urgency score
  score += CATEGORY_URGENCY[item.category];
  
  // 3. Age factor
  const now = Date.now();
  const itemTime = item.timestamp instanceof Date 
    ? item.timestamp.getTime() 
    : new Date(item.timestamp).getTime();
  const ageHours = (now - itemTime) / (1000 * 60 * 60);
  
  if (ageHours < 1) {
    // Fresh items get a boost
    score += 20;
  } else if (ageHours > AGE_DECAY_HOURS) {
    // Old items decay (but cap the penalty)
    const decayPenalty = Math.min(50, (ageHours - AGE_DECAY_HOURS) * 2);
    score -= decayPenalty;
  }
  
  // 4. Value factor (for items with dollar amounts)
  if (item.value && typeof item.value === 'number' && item.value > 0) {
    // log10(value) * 20, capped at 100
    const valueFactor = Math.min(100, Math.log10(item.value + 1) * 20);
    score += valueFactor;
  }
  
  return Math.max(0, Math.round(score));
}

/**
 * Sort items by their calculated score (highest first)
 */
export function sortByScore(items: AttentionItem[]): AttentionItem[] {
  return [...items]
    .map(item => ({
      ...item,
      score: calculateItemScore(item),
    }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));
}

// ============================================================
// ATTENTION ITEM BUILDERS
// ============================================================

/**
 * Create an attention item with defaults
 */
export function createAttentionItem(
  partial: Omit<AttentionItem, 'id' | 'timestamp'> & { 
    id?: string; 
    timestamp?: Date;
  }
): AttentionItem {
  return {
    id: partial.id || `${partial.category}-${Date.now()}`,
    timestamp: partial.timestamp || new Date(),
    ...partial,
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
  tier: BusinessTier
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
    
    // @ts-expect-error - Deep type instantiation from Supabase query
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
    
    // @ts-expect-error - Deep type instantiation from Supabase query
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
      (sum, o) => sum + Number(o.total_amount || 0), 0
    );
    const oldestOrder = pendingMenuOrders.data.reduce((oldest, o) => {
      const orderTime = new Date(o.created_at).getTime();
      return orderTime < oldest ? orderTime : oldest;
    }, Date.now());
    
    items.push(createAttentionItem({
      priority: 'critical',
      category: 'orders',
      title: `${pendingMenuOrders.data.length} Disposable Menu orders waiting`,
      description: 'Customers waiting for confirmation',
      value: totalValue,
      valueDisplay: `$${totalValue.toLocaleString()}`,
      actionLabel: 'Process',
      actionRoute: '/admin/disposable-menu-orders',
      timestamp: new Date(oldestOrder),
    }));
  }

  // Late deliveries
  if (lateDeliveries.data && lateDeliveries.data.length > 0) {
    items.push(createAttentionItem({
      priority: 'critical',
      category: 'delivery',
      title: `${lateDeliveries.data.length} deliveries running late`,
      description: 'Customers waiting - check with drivers',
      actionLabel: 'Track',
      actionRoute: '/admin/deliveries',
      timestamp: new Date(),
    }));
  }

  // Out of stock
  if (outOfStock.data && outOfStock.data.length > 0) {
    items.push(createAttentionItem({
      priority: 'critical',
      category: 'inventory',
      title: `${outOfStock.data.length} products out of stock`,
      description: 'Customers cannot order these items',
      actionLabel: 'Restock',
      actionRoute: '/admin/inventory-dashboard?filter=out_of_stock',
      timestamp: new Date(),
    }));
  }

  // === IMPORTANT ITEMS ===

  // Pending regular orders
  if (pendingOrders.data && pendingOrders.data.length > 0) {
    const priority = pendingOrders.data.length > 5 ? 'critical' : 'important';
    const totalValue = pendingOrders.data.reduce(
      (sum, o) => sum + Number(o.total_amount || 0), 0
    );
    
    items.push(createAttentionItem({
      priority: priority as AlertPriority,
      category: 'orders',
      title: `${pendingOrders.data.length} orders waiting to process`,
      value: totalValue,
      valueDisplay: `$${totalValue.toLocaleString()}`,
      actionLabel: 'View',
      actionRoute: '/admin/orders?status=pending',
      timestamp: new Date(),
    }));
  }

  // Wholesale orders pending
  if (wholesalePending.data && wholesalePending.data.length > 0) {
    const totalValue = wholesalePending.data.reduce(
      (sum, o) => sum + Number(o.total_amount || 0), 0
    );
    
    items.push(createAttentionItem({
      priority: 'important',
      category: 'orders',
      title: `${wholesalePending.data.length} wholesale orders need approval`,
      value: totalValue,
      valueDisplay: `$${totalValue.toLocaleString()}`,
      actionLabel: 'Review',
      actionRoute: '/admin/wholesale-orders',
      timestamp: new Date(),
    }));
  }

  // Low stock
  if (lowStock.data && lowStock.data.length > 0) {
    items.push(createAttentionItem({
      priority: 'important',
      category: 'inventory',
      title: `${lowStock.data.length} items running low`,
      description: 'Reorder to avoid stockouts',
      actionLabel: 'Reorder',
      actionRoute: '/admin/inventory-dashboard',
      timestamp: new Date(),
    }));
  }

  // Customer tabs
  if (customerTabs.data && customerTabs.data.length > 0) {
    const totalOwed = customerTabs.data.reduce(
      (sum, c) => sum + Number(c.balance || 0), 0
    );
    
    if (totalOwed > 100) { // Only show if significant amount
      items.push(createAttentionItem({
        priority: 'important',
        category: 'customers',
        title: `${customerTabs.data.length} customers with open tabs`,
        value: totalOwed,
        valueDisplay: `$${totalOwed.toLocaleString()} owed`,
        actionLabel: 'Collect',
        actionRoute: '/admin/customer-tabs',
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
      title: `${activeDeliveries.data.length} deliveries in progress`,
      description: 'All on schedule',
      actionLabel: 'Track',
      actionRoute: '/admin/deliveries',
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

/**
 * Build the complete attention queue with scoring
 */
export async function buildAttentionQueue(
  tenantId: string,
  tier: BusinessTier
): Promise<AttentionQueue> {
  const allItems = await fetchAttentionItems(tenantId, tier);
  const sortedItems = sortByScore(allItems);
  
  // Split by priority
  const critical = sortedItems.filter(i => i.priority === 'critical');
  const important = sortedItems.filter(i => i.priority === 'important');
  const info = sortedItems.filter(i => i.priority === 'info');
  
  return {
    critical,
    important,
    info,
    all: sortedItems,
    totalCount: allItems.length,
    lastUpdated: new Date(),
  };
}

/**
 * Get top N attention items (already sorted by score)
 */
export function getTopAttentionItems(
  queue: AttentionQueue,
  maxItems: number = 5
): AttentionItem[] {
  return queue.all.slice(0, maxItems);
}

/**
 * Build queue from pre-fetched items (no database call)
 */
export function buildQueueFromItems(items: AttentionItem[]): AttentionQueue {
  const sortedItems = sortByScore(items);
  
  return {
    critical: sortedItems.filter(i => i.priority === 'critical'),
    important: sortedItems.filter(i => i.priority === 'important'),
    info: sortedItems.filter(i => i.priority === 'info'),
    all: sortedItems,
    totalCount: items.length,
    lastUpdated: new Date(),
  };
}

// ============================================================
// UTILITY EXPORTS
// ============================================================

export {
  PRIORITY_WEIGHTS,
  CATEGORY_URGENCY,
  AGE_DECAY_HOURS,
};

