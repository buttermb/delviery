import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface OrderItemWithPrice {
  product_id: string;
  quantity: number;
  unit_price: number;
  price_at_order_time?: number;
}

/**
 * Captures current product prices for order items
 * Used to preserve historical pricing in order records
 */
export const captureOrderPrices = async (
  items: OrderItemWithPrice[]
): Promise<OrderItemWithPrice[]> => {
  if (!items.length) return items;

  const productIds = [...new Set(items.map(item => item.product_id))];

  // Fetch current prices from products table
  const { data: products, error } = await supabase
    .from("products")
    .select("id, price")
    .in("id", productIds);

  if (error) {
    logger.error("Failed to fetch product prices", error);
    // Return items with unit_price as fallback
    return items.map(item => ({
      ...item,
      price_at_order_time: item.unit_price,
    }));
  }

  const priceMap = new Map(products?.map(p => [p.id, p.price]) || []);

  return items.map(item => ({
    ...item,
    price_at_order_time: priceMap.get(item.product_id) ?? item.unit_price,
  }));
};

/**
 * Captures wholesale inventory prices for wholesale orders
 */
export const captureWholesalePrices = async (
  items: { product_id: string; quantity: number; unit_price: number }[]
): Promise<OrderItemWithPrice[]> => {
  if (!items.length) return items;

  const productIds = [...new Set(items.map(item => item.product_id))];

  // Fetch current prices from wholesale_inventory table
  const { data: inventory, error } = await supabase
    .from("wholesale_inventory")
    .select("id, base_price")
    .in("id", productIds);

  if (error) {
    logger.error("Failed to fetch wholesale prices", error);
    return items.map(item => ({
      ...item,
      price_at_order_time: item.unit_price,
    }));
  }

  const priceMap = new Map(inventory?.map(p => [p.id, p.base_price]) || []);

  return items.map(item => ({
    ...item,
    price_at_order_time: priceMap.get(item.product_id) ?? item.unit_price,
  }));
};

/**
 * Gets the display price for an order item
 * Uses price_at_order_time if available, falls back to unit_price
 */
export const getOrderItemPrice = (item: {
  unit_price?: number;
  price_at_order_time?: number;
}): number => {
  return item.price_at_order_time ?? item.unit_price ?? 0;
};

/**
 * Calculates order total using snapshotted prices
 */
export const calculateOrderTotalFromSnapshot = (
  items: { quantity: number; unit_price?: number; price_at_order_time?: number }[]
): number => {
  return items.reduce((total, item) => {
    const price = getOrderItemPrice(item);
    return total + (item.quantity * price);
  }, 0);
};
