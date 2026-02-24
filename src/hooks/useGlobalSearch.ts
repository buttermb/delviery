/**
 * Global Search Hook
 *
 * Searches across orders, products, customers, and vendors simultaneously.
 * Returns categorized results with relevance scoring.
 *
 * Features:
 * - Debounced search (300ms)
 * - Minimum 2 characters required
 * - Tenant-filtered results
 * - Relevance scoring for result ordering
 */

import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { escapePostgresLike } from '@/lib/utils/searchSanitize';

// Relevance scoring weights
const EXACT_MATCH_SCORE = 100;
const STARTS_WITH_SCORE = 75;
const CONTAINS_SCORE = 50;

export interface SearchResultItem {
  id: string;
  name: string;
  subtitle?: string;
  status?: string;
  relevanceScore: number;
  metadata?: Record<string, unknown>;
}

export interface GlobalSearchResults {
  orders: SearchResultItem[];
  products: SearchResultItem[];
  customers: SearchResultItem[];
  vendors: SearchResultItem[];
}

interface UseGlobalSearchOptions {
  /** Minimum characters before search triggers (default: 2) */
  minChars?: number;
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
  /** Maximum results per category (default: 10) */
  limitPerCategory?: number;
  /** Enable/disable search */
  enabled?: boolean;
}

interface UseGlobalSearchReturn {
  /** Categorized search results */
  results: GlobalSearchResults;
  /** Whether search is in progress */
  isSearching: boolean;
  /** Error if any */
  error: Error | null;
  /** Total result count across all categories */
  totalCount: number;
  /** Set search query */
  setQuery: (query: string) => void;
  /** Clear results and query */
  clear: () => void;
  /** Current search query */
  query: string;
  /** Debounced query being searched */
  debouncedQuery: string;
}

const EMPTY_RESULTS: GlobalSearchResults = {
  orders: [],
  products: [],
  customers: [],
  vendors: [],
};

/**
 * Calculate relevance score based on how the search term matches
 */
function calculateRelevanceScore(searchTerm: string, value: string): number {
  const lowerSearch = searchTerm.toLowerCase();
  const lowerValue = value.toLowerCase();

  if (lowerValue === lowerSearch) {
    return EXACT_MATCH_SCORE;
  }
  if (lowerValue.startsWith(lowerSearch)) {
    return STARTS_WITH_SCORE;
  }
  if (lowerValue.includes(lowerSearch)) {
    return CONTAINS_SCORE;
  }
  return 0;
}

/**
 * Get the best relevance score from multiple fields
 */
function getBestRelevanceScore(searchTerm: string, fields: (string | null | undefined)[]): number {
  return Math.max(
    ...fields
      .filter((f): f is string => typeof f === 'string' && f.length > 0)
      .map((f) => calculateRelevanceScore(searchTerm, f)),
    0
  );
}

export function useGlobalSearch(options: UseGlobalSearchOptions = {}): UseGlobalSearchReturn {
  const { tenant } = useTenantAdminAuth();
  const [query, setQuery] = useState('');

  const {
    minChars = 2,
    debounceMs = 300,
    limitPerCategory = 10,
    enabled = true,
  } = options;

  // Debounce the search query
  const debouncedQuery = useDebounce(query, debounceMs);

  const shouldSearch = useMemo(() => {
    return (
      enabled &&
      !!tenant?.id &&
      debouncedQuery.length >= minChars
    );
  }, [enabled, tenant?.id, debouncedQuery, minChars]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.globalSearch.all(debouncedQuery, tenant?.id),
    queryFn: async (): Promise<GlobalSearchResults> => {
      if (!tenant?.id || debouncedQuery.length < minChars) {
        return EMPTY_RESULTS;
      }

      const searchTerm = debouncedQuery.toLowerCase();
      const results: GlobalSearchResults = {
        orders: [],
        products: [],
        customers: [],
        vendors: [],
      };

      try {
        // Run all searches in parallel
        const [ordersResult, productsResult, customersResult, vendorsResult] = await Promise.all([
          // Search orders
          supabase
            .from('orders')
            .select('id, order_number, status, total_amount, customer_name')
            .eq('tenant_id', tenant.id)
            .or(`order_number.ilike.%${escapePostgresLike(searchTerm)}%,customer_name.ilike.%${escapePostgresLike(searchTerm)}%`)
            .limit(limitPerCategory),

          // Search products
          (supabase as any)
            .from('products')
            .select('id, name, sku, category, is_active')
            .eq('tenant_id', tenant.id)
            .or(`name.ilike.%${escapePostgresLike(searchTerm)}%,sku.ilike.%${escapePostgresLike(searchTerm)}%`)
            .limit(limitPerCategory),

          // Search customers (profiles)
          (supabase as any)
            .from('profiles')
            .select('id, user_id, full_name, phone, email')
            .eq('account_id', tenant.id)
            .or(`full_name.ilike.%${escapePostgresLike(searchTerm)}%,phone.ilike.%${escapePostgresLike(searchTerm)}%,email.ilike.%${escapePostgresLike(searchTerm)}%`)
            .limit(limitPerCategory),

          // Search vendors
          supabase
            .from('vendors')
            .select('id, name, contact_name, contact_email, status')
            .eq('account_id', tenant.id)
            .or(`name.ilike.%${escapePostgresLike(searchTerm)}%,contact_name.ilike.%${escapePostgresLike(searchTerm)}%`)
            .limit(limitPerCategory),
        ]);

        // Process orders with relevance scoring
        if (ordersResult.data) {
          results.orders = ordersResult.data
            .map((order) => ({
              id: order.id,
              name: `Order #${order.order_number || order.id.slice(0, 8)}`,
              subtitle: order.customer_name || undefined,
              status: order.status || undefined,
              relevanceScore: getBestRelevanceScore(searchTerm, [
                order.order_number,
                order.customer_name,
              ]),
              metadata: {
                totalAmount: order.total_amount,
                orderNumber: order.order_number,
              },
            }))
            .sort((a, b) => b.relevanceScore - a.relevanceScore);
        }

        // Process products with relevance scoring
        if (productsResult.data) {
          results.products = productsResult.data
            .map((product) => ({
              id: product.id,
              name: product.name,
              subtitle: product.sku ? `SKU: ${product.sku}` : product.category || undefined,
              status: product.is_active ? 'active' : 'inactive',
              relevanceScore: getBestRelevanceScore(searchTerm, [
                product.name,
                product.sku,
              ]),
              metadata: {
                sku: product.sku,
                category: product.category,
              },
            }))
            .sort((a, b) => b.relevanceScore - a.relevanceScore);
        }

        // Process customers with relevance scoring
        if (customersResult.data) {
          results.customers = customersResult.data
            .map((customer) => ({
              id: customer.user_id || customer.id,
              name: customer.full_name || 'Unknown Customer',
              subtitle: customer.email || customer.phone || undefined,
              relevanceScore: getBestRelevanceScore(searchTerm, [
                customer.full_name,
                customer.phone,
                customer.email,
              ]),
              metadata: {
                phone: customer.phone,
                email: customer.email,
              },
            }))
            .sort((a, b) => b.relevanceScore - a.relevanceScore);
        }

        // Process vendors with relevance scoring
        if (vendorsResult.data) {
          results.vendors = vendorsResult.data
            .map((vendor) => ({
              id: vendor.id,
              name: vendor.name,
              subtitle: vendor.contact_name || vendor.contact_email || undefined,
              status: vendor.status || undefined,
              relevanceScore: getBestRelevanceScore(searchTerm, [
                vendor.name,
                vendor.contact_name,
              ]),
              metadata: {
                contactName: vendor.contact_name,
                contactEmail: vendor.contact_email,
              },
            }))
            .sort((a, b) => b.relevanceScore - a.relevanceScore);
        }

        // Log any errors from individual queries
        if (ordersResult.error) {
          logger.warn('Order search failed', { error: ordersResult.error });
        }
        if (productsResult.error) {
          logger.warn('Product search failed', { error: productsResult.error });
        }
        if (customersResult.error) {
          logger.warn('Customer search failed', { error: customersResult.error });
        }
        if (vendorsResult.error) {
          logger.warn('Vendor search failed', { error: vendorsResult.error });
        }

        return results;
      } catch (err) {
        logger.error('Global search error', err);
        throw err;
      }
    },
    enabled: shouldSearch,
    staleTime: 30000,
  });

  const clear = useCallback(() => {
    setQuery('');
  }, []);

  const totalCount = useMemo(() => {
    if (!data) return 0;
    return (
      data.orders.length +
      data.products.length +
      data.customers.length +
      data.vendors.length
    );
  }, [data]);

  return {
    results: data ?? EMPTY_RESULTS,
    isSearching: isLoading,
    error: error as Error | null,
    totalCount,
    setQuery,
    clear,
    query,
    debouncedQuery,
  };
}
