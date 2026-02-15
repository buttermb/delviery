/**
 * Related Products Hook
 *
 * Suggests related products based on order co-occurrence.
 * Products frequently ordered together are considered related.
 *
 * Features:
 * - "Frequently Bought Together" suggestions for product detail pages
 * - Cross-selling support for storefront
 * - Calculated from order_items data
 * - Cached results with configurable stale time
 * - Updates weekly (7-day stale time by default)
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface RelatedProduct {
  productId: string;
  productName: string;
  sku: string | null;
  imageUrl: string | null;
  price: number;
  coOccurrenceCount: number;
  coOccurrenceScore: number; // Normalized 0-1 score
  category: string | null;
  isActive: boolean;
  stockQuantity: number;
}

export interface UseRelatedProductsOptions {
  productId: string | undefined;
  limit?: number;
  minCoOccurrence?: number; // Minimum times products appeared together
  enabled?: boolean;
}

export interface UseRelatedProductsResult {
  relatedProducts: RelatedProduct[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  totalCoOccurrences: number;
}

export interface UseBulkRelatedProductsOptions {
  productIds: string[];
  limitPerProduct?: number;
  enabled?: boolean;
}

export interface UseBulkRelatedProductsResult {
  relatedProductsMap: Map<string, RelatedProduct[]>;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_LIMIT = 6;
const DEFAULT_MIN_CO_OCCURRENCE = 2;
const ANALYSIS_DAYS = 90; // Use last 90 days of orders
const WEEKLY_STALE_TIME = 7 * 24 * 60 * 60 * 1000; // 7 days cache

// ============================================================================
// Query Key Factory
// ============================================================================

const relatedProductsQueryKeys = {
  all: ['related-products'] as const,
  single: (tenantId?: string, productId?: string, limit?: number) =>
    [...relatedProductsQueryKeys.all, 'single', tenantId, productId, limit] as const,
  bulk: (tenantId?: string, productIds?: string[]) =>
    [...relatedProductsQueryKeys.all, 'bulk', tenantId, productIds?.join(',')] as const,
};

// ============================================================================
// Helper Functions
// ============================================================================

interface ProductData {
  id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  price: number | null;
  category: string | null;
  is_active: boolean | null;
  stock_quantity: number | null;
  available_quantity: number | null;
}

function normalizeScore(count: number, maxCount: number): number {
  if (maxCount === 0) return 0;
  return Math.round((count / maxCount) * 100) / 100;
}

// ============================================================================
// Main Hook: useRelatedProducts
// ============================================================================

/**
 * Hook to get related products for a single product based on order co-occurrence.
 * Returns products that are frequently bought together with the target product.
 */
export function useRelatedProducts({
  productId,
  limit = DEFAULT_LIMIT,
  minCoOccurrence = DEFAULT_MIN_CO_OCCURRENCE,
  enabled = true,
}: UseRelatedProductsOptions): UseRelatedProductsResult {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: relatedProductsQueryKeys.single(tenantId, productId, limit),
    queryFn: async (): Promise<{
      relatedProducts: RelatedProduct[];
      totalCoOccurrences: number;
    }> => {
      if (!tenantId || !productId) {
        return { relatedProducts: [], totalCoOccurrences: 0 };
      }

      logger.debug('Calculating related products', {
        component: 'useRelatedProducts',
        productId,
        tenantId,
        limit,
      });

      // Calculate date range (last 90 days)
      const now = new Date();
      const analysisPeriodStart = new Date(
        now.getTime() - ANALYSIS_DAYS * 24 * 60 * 60 * 1000
      );

      // Step 1: Get all orders that contain the target product
      const { data: ordersWithProduct, error: orderError } = await supabase
        .from('unified_order_items')
        .select(`
          order_id,
          order:unified_orders!inner(
            id,
            tenant_id,
            status,
            created_at
          )
        `)
        .eq('product_id', productId)
        .gte('created_at', analysisPeriodStart.toISOString());

      if (orderError) {
        logger.error('Failed to fetch orders with product', orderError, {
          component: 'useRelatedProducts',
          productId,
        });
        throw orderError;
      }

      // Filter to only valid orders for this tenant
      const validStatuses = ['completed', 'delivered', 'processing', 'confirmed'];
      const validOrderIds = new Set<string>();

      for (const item of ordersWithProduct ?? []) {
        const order = item.order as unknown as {
          id: string;
          tenant_id: string;
          status: string;
          created_at: string;
        };

        if (
          order.tenant_id === tenantId &&
          validStatuses.includes(order.status?.toLowerCase() ?? '')
        ) {
          validOrderIds.add(order.id);
        }
      }

      if (validOrderIds.size === 0) {
        logger.debug('No valid orders found for product', {
          component: 'useRelatedProducts',
          productId,
        });
        return { relatedProducts: [], totalCoOccurrences: 0 };
      }

      // Step 2: Get all other products in those orders
      const { data: coOccurringItems, error: coOccurError } = await supabase
        .from('unified_order_items')
        .select('product_id, order_id')
        .in('order_id', Array.from(validOrderIds))
        .neq('product_id', productId);

      if (coOccurError) {
        logger.error('Failed to fetch co-occurring items', coOccurError, {
          component: 'useRelatedProducts',
          productId,
        });
        throw coOccurError;
      }

      // Step 3: Count co-occurrences
      const coOccurrenceCount = new Map<string, number>();

      for (const item of coOccurringItems ?? []) {
        const pid = item.product_id;
        if (!pid) continue;
        coOccurrenceCount.set(pid, (coOccurrenceCount.get(pid) ?? 0) + 1);
      }

      // Filter by minimum co-occurrence and sort by count
      const sortedProducts = Array.from(coOccurrenceCount.entries())
        .filter(([, count]) => count >= minCoOccurrence)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit + 5); // Get a few extra in case some are inactive

      if (sortedProducts.length === 0) {
        logger.debug('No related products found above threshold', {
          component: 'useRelatedProducts',
          productId,
          minCoOccurrence,
        });
        return { relatedProducts: [], totalCoOccurrences: 0 };
      }

      const maxCount = sortedProducts[0]?.[1] ?? 1;
      const productIds = sortedProducts.map(([pid]) => pid);

      // Step 4: Fetch product details
      const { data: products, error: productsError } = await (supabase as any)
        .from('products')
        .select(
          'id, name, sku, image_url, price, category, is_active, stock_quantity, available_quantity'
        )
        .eq('tenant_id', tenantId)
        .in('id', productIds);

      if (productsError) {
        logger.error('Failed to fetch product details', productsError, {
          component: 'useRelatedProducts',
          productId,
        });
        throw productsError;
      }

      // Build related products list
      const productMap = new Map(
        (products ?? []).map((p) => {
          const prod = p as unknown as ProductData;
          return [prod.id, prod];
        })
      );

      const relatedProducts: RelatedProduct[] = [];
      let totalCoOccurrences = 0;

      for (const [pid, count] of sortedProducts) {
        const product = productMap.get(pid);
        if (!product) continue;

        // Skip inactive products for display
        if (product.is_active === false) continue;

        totalCoOccurrences += count;

        relatedProducts.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          imageUrl: product.image_url,
          price: product.price ?? 0,
          coOccurrenceCount: count,
          coOccurrenceScore: normalizeScore(count, maxCount),
          category: product.category,
          isActive: product.is_active !== false,
          stockQuantity: product.available_quantity ?? product.stock_quantity ?? 0,
        });

        if (relatedProducts.length >= limit) break;
      }

      logger.debug('Related products calculated', {
        component: 'useRelatedProducts',
        productId,
        foundCount: relatedProducts.length,
        totalCoOccurrences,
      });

      return { relatedProducts, totalCoOccurrences };
    },
    enabled: enabled && !!tenantId && !!productId,
    staleTime: WEEKLY_STALE_TIME,
    refetchOnWindowFocus: false,
    gcTime: WEEKLY_STALE_TIME * 2, // Keep in cache for 2 weeks
  });

  return {
    relatedProducts: data?.relatedProducts ?? [],
    isLoading,
    error: error as Error | null,
    refetch,
    totalCoOccurrences: data?.totalCoOccurrences ?? 0,
  };
}

// ============================================================================
// Bulk Hook: useBulkRelatedProducts
// ============================================================================

/**
 * Hook to get related products for multiple products at once.
 * Useful for product grids or catalog pages.
 */
export function useBulkRelatedProducts({
  productIds,
  limitPerProduct = 4,
  enabled = true,
}: UseBulkRelatedProductsOptions): UseBulkRelatedProductsResult {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: relatedProductsQueryKeys.bulk(tenantId, productIds),
    queryFn: async (): Promise<Map<string, RelatedProduct[]>> => {
      if (!tenantId || productIds.length === 0) {
        return new Map();
      }

      logger.debug('Calculating bulk related products', {
        component: 'useBulkRelatedProducts',
        productCount: productIds.length,
        tenantId,
      });

      const now = new Date();
      const analysisPeriodStart = new Date(
        now.getTime() - ANALYSIS_DAYS * 24 * 60 * 60 * 1000
      );

      // Get all orders containing any of the target products
      const { data: ordersWithProducts, error: orderError } = await supabase
        .from('unified_order_items')
        .select(`
          product_id,
          order_id,
          order:unified_orders!inner(
            id,
            tenant_id,
            status,
            created_at
          )
        `)
        .in('product_id', productIds)
        .gte('created_at', analysisPeriodStart.toISOString());

      if (orderError) {
        logger.error('Failed to fetch orders for bulk related products', orderError, {
          component: 'useBulkRelatedProducts',
        });
        throw orderError;
      }

      // Build a map of product -> valid order IDs
      const validStatuses = ['completed', 'delivered', 'processing', 'confirmed'];
      const productOrdersMap = new Map<string, Set<string>>();

      for (const item of ordersWithProducts ?? []) {
        const order = item.order as unknown as {
          id: string;
          tenant_id: string;
          status: string;
        };

        if (
          order.tenant_id === tenantId &&
          validStatuses.includes(order.status?.toLowerCase() ?? '')
        ) {
          const pid = item.product_id;
          if (!pid) continue;

          if (!productOrdersMap.has(pid)) {
            productOrdersMap.set(pid, new Set());
          }
          productOrdersMap.get(pid)?.add(order.id);
        }
      }

      // Get all unique order IDs
      const allOrderIds = new Set<string>();
      Array.from(productOrdersMap.values()).forEach((orderIds) => {
        Array.from(orderIds).forEach((orderId) => {
          allOrderIds.add(orderId);
        });
      });

      if (allOrderIds.size === 0) {
        return new Map();
      }

      // Get all items in those orders
      const { data: allOrderItems, error: itemsError } = await supabase
        .from('unified_order_items')
        .select('product_id, order_id')
        .in('order_id', Array.from(allOrderIds));

      if (itemsError) {
        logger.error('Failed to fetch all order items', itemsError, {
          component: 'useBulkRelatedProducts',
        });
        throw itemsError;
      }

      // Build co-occurrence counts per product
      const coOccurrenceMap = new Map<string, Map<string, number>>();

      for (const pid of productIds) {
        coOccurrenceMap.set(pid, new Map());
      }

      for (const item of allOrderItems ?? []) {
        const itemProductId = item.product_id;
        const orderId = item.order_id;
        if (!itemProductId || !orderId) continue;

        // For each target product, if this order contains it, count co-occurrences
        for (const targetPid of productIds) {
          if (itemProductId === targetPid) continue;

          const targetOrders = productOrdersMap.get(targetPid);
          if (targetOrders?.has(orderId)) {
            const counts = coOccurrenceMap.get(targetPid);
            if (counts) {
              counts.set(itemProductId, (counts.get(itemProductId) ?? 0) + 1);
            }
          }
        }
      }

      // Collect all related product IDs
      const allRelatedIds = new Set<string>();
      Array.from(coOccurrenceMap.values()).forEach((counts) => {
        Array.from(counts.entries()).forEach(([pid, count]) => {
          if (count >= DEFAULT_MIN_CO_OCCURRENCE) {
            allRelatedIds.add(pid);
          }
        });
      });

      if (allRelatedIds.size === 0) {
        return new Map();
      }

      // Fetch product details for all related products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select(
          'id, name, sku, image_url, price, category, is_active, stock_quantity, available_quantity'
        )
        .eq('tenant_id', tenantId)
        .in('id', Array.from(allRelatedIds));

      if (productsError) {
        logger.error('Failed to fetch related product details', productsError, {
          component: 'useBulkRelatedProducts',
        });
        throw productsError;
      }

      const productDetailsMap = new Map(
        (products ?? []).map((p) => {
          const prod = p as unknown as ProductData;
          return [prod.id, prod];
        })
      );

      // Build result map
      const resultMap = new Map<string, RelatedProduct[]>();

      Array.from(coOccurrenceMap.entries()).forEach(([targetPid, counts]) => {
        const sortedRelated = Array.from(counts.entries())
          .filter(([, count]) => count >= DEFAULT_MIN_CO_OCCURRENCE)
          .sort((a, b) => b[1] - a[1]);

        const maxCount = sortedRelated[0]?.[1] ?? 1;
        const relatedProducts: RelatedProduct[] = [];

        for (let i = 0; i < sortedRelated.length && relatedProducts.length < limitPerProduct; i++) {
          const [relatedPid, count] = sortedRelated[i];
          const product = productDetailsMap.get(relatedPid);
          if (!product || product.is_active === false) continue;

          relatedProducts.push({
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            imageUrl: product.image_url,
            price: product.price ?? 0,
            coOccurrenceCount: count,
            coOccurrenceScore: normalizeScore(count, maxCount),
            category: product.category,
            isActive: product.is_active !== false,
            stockQuantity: product.available_quantity ?? product.stock_quantity ?? 0,
          });
        }

        resultMap.set(targetPid, relatedProducts);
      });

      logger.debug('Bulk related products calculated', {
        component: 'useBulkRelatedProducts',
        inputCount: productIds.length,
        outputCount: resultMap.size,
      });

      return resultMap;
    },
    enabled: enabled && !!tenantId && productIds.length > 0,
    staleTime: WEEKLY_STALE_TIME,
    refetchOnWindowFocus: false,
    gcTime: WEEKLY_STALE_TIME * 2,
  });

  return {
    relatedProductsMap: data ?? new Map(),
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

// ============================================================================
// Storefront Hook: useStorefrontRelatedProducts
// ============================================================================

/**
 * Hook for storefront use - doesn't require tenant admin auth.
 * Used for cross-selling on public product pages.
 */
export interface UseStorefrontRelatedProductsOptions {
  storeId: string | undefined;
  productId: string | undefined;
  limit?: number;
  enabled?: boolean;
}

export function useStorefrontRelatedProducts({
  storeId,
  productId,
  limit = DEFAULT_LIMIT,
  enabled = true,
}: UseStorefrontRelatedProductsOptions): UseRelatedProductsResult {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.shopProducts.related(storeId, productId),
    queryFn: async (): Promise<{
      relatedProducts: RelatedProduct[];
      totalCoOccurrences: number;
    }> => {
      if (!storeId || !productId) {
        return { relatedProducts: [], totalCoOccurrences: 0 };
      }

      logger.debug('Calculating storefront related products', {
        component: 'useStorefrontRelatedProducts',
        storeId,
        productId,
      });

      // First get the tenant_id from the store
      const { data: store, error: storeError } = await (supabase as any)
        .from('storefront_settings')
        .select('tenant_id')
        .eq('id', storeId)
        .maybeSingle();

      if (storeError) {
        logger.error('Failed to fetch store', storeError, {
          component: 'useStorefrontRelatedProducts',
          storeId,
        });
        throw storeError;
      }

      if (!(store as any)?.tenant_id) {
        return { relatedProducts: [], totalCoOccurrences: 0 };
      }

      const tenantId = (store as any).tenant_id;

      // Calculate date range
      const now = new Date();
      const analysisPeriodStart = new Date(
        now.getTime() - ANALYSIS_DAYS * 24 * 60 * 60 * 1000
      );

      // Get orders with target product
      const { data: ordersWithProduct, error: orderError } = await supabase
        .from('unified_order_items')
        .select(`
          order_id,
          order:unified_orders!inner(
            id,
            tenant_id,
            status
          )
        `)
        .eq('product_id', productId)
        .gte('created_at', analysisPeriodStart.toISOString());

      if (orderError) {
        logger.error('Failed to fetch storefront orders', orderError, {
          component: 'useStorefrontRelatedProducts',
        });
        throw orderError;
      }

      const validStatuses = ['completed', 'delivered'];
      const validOrderIds = new Set<string>();

      for (const item of ordersWithProduct ?? []) {
        const order = item.order as unknown as {
          id: string;
          tenant_id: string;
          status: string;
        };

        if (
          order.tenant_id === tenantId &&
          validStatuses.includes(order.status?.toLowerCase() ?? '')
        ) {
          validOrderIds.add(order.id);
        }
      }

      if (validOrderIds.size === 0) {
        return { relatedProducts: [], totalCoOccurrences: 0 };
      }

      // Get co-occurring products
      const { data: coOccurringItems, error: coOccurError } = await supabase
        .from('unified_order_items')
        .select('product_id')
        .in('order_id', Array.from(validOrderIds))
        .neq('product_id', productId);

      if (coOccurError) {
        logger.error('Failed to fetch co-occurring storefront items', coOccurError, {
          component: 'useStorefrontRelatedProducts',
        });
        throw coOccurError;
      }

      // Count co-occurrences
      const coOccurrenceCount = new Map<string, number>();

      for (const item of coOccurringItems ?? []) {
        const pid = item.product_id;
        if (!pid) continue;
        coOccurrenceCount.set(pid, (coOccurrenceCount.get(pid) ?? 0) + 1);
      }

      const sortedProducts = Array.from(coOccurrenceCount.entries())
        .filter(([, count]) => count >= 1) // Lower threshold for storefront
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit + 3);

      if (sortedProducts.length === 0) {
        return { relatedProducts: [], totalCoOccurrences: 0 };
      }

      const maxCount = sortedProducts[0]?.[1] ?? 1;
      const productIds = sortedProducts.map(([pid]) => pid);

      // Fetch active products with stock
      const { data: products, error: productsError } = await (supabase as any)
        .from('products')
        .select(
          'id, name, sku, image_url, price, category, is_active, stock_quantity, available_quantity'
        )
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .in('id', productIds);

      if (productsError) {
        logger.error('Failed to fetch storefront product details', productsError, {
          component: 'useStorefrontRelatedProducts',
        });
        throw productsError;
      }

      const productMap = new Map(
        (products ?? []).map((p) => {
          const prod = p as unknown as ProductData;
          return [prod.id, prod];
        })
      );

      const relatedProducts: RelatedProduct[] = [];
      let totalCoOccurrences = 0;

      for (const [pid, count] of sortedProducts) {
        const product = productMap.get(pid) as any;
        if (!product) continue;

        const stock = product.available_quantity ?? product.stock_quantity ?? 0;
        // Only show products with stock for storefront
        if (stock <= 0) continue;

        totalCoOccurrences += count;

        relatedProducts.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          imageUrl: product.image_url,
          price: product.price ?? 0,
          coOccurrenceCount: count,
          coOccurrenceScore: normalizeScore(count, maxCount),
          category: product.category,
          isActive: true,
          stockQuantity: stock,
        });

        if (relatedProducts.length >= limit) break;
      }

      logger.debug('Storefront related products calculated', {
        component: 'useStorefrontRelatedProducts',
        storeId,
        productId,
        foundCount: relatedProducts.length,
      });

      return { relatedProducts, totalCoOccurrences };
    },
    enabled: enabled && !!storeId && !!productId,
    staleTime: WEEKLY_STALE_TIME,
    refetchOnWindowFocus: false,
    gcTime: WEEKLY_STALE_TIME * 2,
  });

  return {
    relatedProducts: data?.relatedProducts ?? [],
    isLoading,
    error: error as Error | null,
    refetch,
    totalCoOccurrences: data?.totalCoOccurrences ?? 0,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get display text for co-occurrence score
 */
export function getCoOccurrenceLabel(score: number): string {
  if (score >= 0.8) return 'Very frequently bought together';
  if (score >= 0.5) return 'Frequently bought together';
  if (score >= 0.3) return 'Often bought together';
  return 'Sometimes bought together';
}

/**
 * Format co-occurrence count for display
 */
export function formatCoOccurrenceCount(count: number): string {
  if (count >= 100) return '100+ orders';
  if (count >= 50) return '50+ orders';
  if (count >= 10) return `${count} orders`;
  return `${count} orders`;
}
