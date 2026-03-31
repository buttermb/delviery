// Low Stock Email Digest — Database Queries

import type { LowStockProduct } from './types.ts';

/**
 * Get low stock products for a tenant
 */
export async function getLowStockProducts(
  supabase: any,
  tenantId: string,
  thresholdOverride?: number
): Promise<LowStockProduct[]> {
  // Query wholesale_inventory for products below reorder point
  const { data: products, error } = await supabase
    .from('wholesale_inventory')
    .select(`
      id,
      product_name,
      sku,
      quantity_lbs,
      reorder_point,
      updated_at
    `)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .gt('reorder_point', 0);

  if (error) {
    throw error;
  }

  const lowStockProducts: LowStockProduct[] = [];

  for (const product of products || []) {
    const reorderPoint = thresholdOverride ?? product.reorder_point;

    // Check if below threshold
    if (product.quantity_lbs <= reorderPoint) {
      // Calculate average daily usage from recent movements
      const avgDailyUsage = await calculateAverageDailyUsage(
        supabase,
        tenantId,
        product.id
      );

      // Calculate days until stockout
      let daysUntilStockout: number | null = null;
      if (avgDailyUsage > 0 && product.quantity_lbs > 0) {
        daysUntilStockout = Math.floor(product.quantity_lbs / avgDailyUsage);
      } else if (product.quantity_lbs <= 0) {
        daysUntilStockout = 0;
      }

      lowStockProducts.push({
        id: product.id,
        product_name: product.product_name,
        sku: product.sku,
        current_quantity: product.quantity_lbs,
        reorder_point: reorderPoint,
        avg_daily_usage: avgDailyUsage,
        days_until_stockout: daysUntilStockout,
        last_movement_date: product.updated_at,
      });
    }
  }

  // Sort by days until stockout (most urgent first)
  lowStockProducts.sort((a, b) => {
    if (a.days_until_stockout === null) return 1;
    if (b.days_until_stockout === null) return -1;
    return a.days_until_stockout - b.days_until_stockout;
  });

  return lowStockProducts;
}

/**
 * Calculate average daily usage for a product over the last 30 days
 */
async function calculateAverageDailyUsage(
  supabase: any,
  tenantId: string,
  productId: string
): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get outgoing movements (sales, orders)
  const { data: movements, error } = await supabase
    .from('wholesale_inventory_movements')
    .select('quantity_change')
    .eq('tenant_id', tenantId)
    .eq('inventory_id', productId)
    .lt('quantity_change', 0) // Only outgoing (negative changes)
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (error || !movements || movements.length === 0) {
    return 0;
  }

  // Sum total outgoing (absolute values)
  const totalUsage = movements.reduce(
    (sum: number, m: { quantity_change: number }) => sum + Math.abs(m.quantity_change),
    0
  );

  // Average per day
  return totalUsage / 30;
}
