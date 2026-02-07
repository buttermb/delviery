/**
 * Global Search Hook
 *
 * Provides a unified search interface across all modules:
 * - Customers (profiles)
 * - Orders
 * - Products
 * - Wholesale clients
 * - Wholesale orders
 * - Suppliers
 * - Couriers
 *
 * Returns categorized results with proper typing and navigation URLs.
 */

import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';

export type SearchResultType =
  | 'customer'
  | 'order'
  | 'product'
  | 'invoice'
  | 'supplier'
  | 'courier'
  | 'wholesale_client'
  | 'wholesale_order'
  | 'menu';

export interface GlobalSearchResult {
  id: string;
  type: SearchResultType;
  label: string;
  sublabel?: string;
  url: string;
  metadata?: Record<string, unknown>;
}

interface GlobalSearchOptions {
  /** Minimum characters before search triggers */
  minChars?: number;
  /** Maximum results per category */
  limitPerCategory?: number;
  /** Categories to search (defaults to all) */
  categories?: SearchResultType[];
  /** Enable/disable search */
  enabled?: boolean;
}

interface UseGlobalSearchReturn {
  /** Search results grouped by type */
  results: GlobalSearchResult[];
  /** Results grouped by type */
  groupedResults: Record<SearchResultType, GlobalSearchResult[]>;
  /** Whether search is in progress */
  isSearching: boolean;
  /** Error if any */
  error: Error | null;
  /** Total result count */
  totalCount: number;
  /** Trigger search manually */
  search: (query: string) => void;
  /** Clear results */
  clearResults: () => void;
  /** Current search query */
  query: string;
}

const DEFAULT_OPTIONS: Required<GlobalSearchOptions> = {
  minChars: 2,
  limitPerCategory: 5,
  categories: ['customer', 'order', 'product', 'wholesale_client', 'wholesale_order', 'supplier', 'courier', 'menu'],
  enabled: true,
};

export function useGlobalSearch(options: GlobalSearchOptions = {}): UseGlobalSearchReturn {
  const { tenant } = useTenantAdminAuth();
  const [query, setQuery] = useState('');

  const opts = { ...DEFAULT_OPTIONS, ...options };

  const { data, isLoading, error } = useQuery({
    queryKey: ['global-search', query, tenant?.id, opts.categories],
    queryFn: async (): Promise<GlobalSearchResult[]> => {
      if (!query || query.length < opts.minChars || !tenant?.id) {
        return [];
      }

      const searchLower = query.toLowerCase();
      const results: GlobalSearchResult[] = [];
      const limit = opts.limitPerCategory;
      const categories = opts.categories;

      try {
        const promises: Promise<void>[] = [];

        // Search customers (cast to any to bypass deep type issues)
        if (categories.includes('customer')) {
          promises.push(
            (supabase as any)
              .from('profiles')
              .select('id, user_id, full_name, phone')
              .eq('account_id', tenant.id)
              .or(`full_name.ilike.%${searchLower}%,phone.ilike.%${searchLower}%`)
              .limit(limit)
              .then(({ data: customers }: any) => {
                if (customers) {
                  for (const c of customers as any[]) {
                    results.push({
                      id: c.user_id || c.id,
                      type: 'customer',
                      label: c.full_name || 'Unknown Customer',
                      sublabel: c.phone || undefined,
                      url: `/admin/customers/${c.user_id || c.id}`,
                    });
                  }
                }
              })
          );
        }

        // Search orders
        if (categories.includes('order')) {
          promises.push(
            (supabase as any)
              .from('orders')
              .select('id, order_number, status, total_amount, customer_name')
              .eq('tenant_id', tenant.id)
              .or(`order_number.ilike.%${searchLower}%,customer_name.ilike.%${searchLower}%`)
              .limit(limit)
              .then(({ data: orders }: any) => {
                if (orders) {
                  for (const o of orders as any[]) {
                    results.push({
                      id: o.id,
                      type: 'order',
                      label: `Order #${o.order_number || o.id.slice(0, 8)}`,
                      sublabel: o.customer_name || o.status || undefined,
                      url: `/admin/orders/${o.id}`,
                      metadata: { status: o.status, total: o.total_amount },
                    });
                  }
                }
              })
          );
        }

        // Search products
        if (categories.includes('product')) {
          promises.push(
            (supabase as any)
              .from('products')
              .select('id, name, sku, category')
              .eq('tenant_id', tenant.id)
              .or(`name.ilike.%${searchLower}%,sku.ilike.%${searchLower}%`)
              .limit(limit)
              .then(({ data: products }: any) => {
                if (products) {
                  for (const p of products as any[]) {
                    results.push({
                      id: p.id,
                      type: 'product',
                      label: p.name,
                      sublabel: p.sku ? `SKU: ${p.sku}` : p.category || undefined,
                      url: `/admin/products/${p.id}`,
                    });
                  }
                }
              })
          );
        }

        // Search wholesale clients
        if (categories.includes('wholesale_client')) {
          promises.push(
            (async () => {
              const { data: clients } = await supabase
                .from('wholesale_clients')
                .select('id, business_name, contact_name, email')
                .eq('tenant_id', tenant.id)
                .or(`business_name.ilike.%${searchLower}%,contact_name.ilike.%${searchLower}%,email.ilike.%${searchLower}%`)
                .limit(limit);
              if (clients) {
                for (const wc of clients) {
                  results.push({
                    id: wc.id,
                    type: 'wholesale_client',
                    label: wc.business_name || 'Unnamed Client',
                    sublabel: wc.contact_name || wc.email || undefined,
                    url: `/admin/clients/${wc.id}`,
                  });
                }
              }
            })()
          );
        }

        // Search wholesale orders
        if (categories.includes('wholesale_order')) {
          promises.push(
            (async () => {
              const { data: orders } = await supabase
                .from('wholesale_orders')
                .select('id, status, total_amount, wholesale_clients(business_name)')
                .eq('tenant_id', tenant.id)
                .ilike('id', `%${searchLower}%`)
                .limit(limit);
              if (orders) {
                for (const wo of orders) {
                  const clientName = (wo.wholesale_clients as { business_name: string | null } | null)?.business_name;
                  results.push({
                    id: wo.id,
                    type: 'wholesale_order',
                    label: `Wholesale #${wo.id.slice(0, 8)}`,
                    sublabel: clientName || wo.status || undefined,
                    url: `/admin/wholesale-orders/${wo.id}`,
                  });
                }
              }
            })()
          );
        }

        // Search suppliers
        if (categories.includes('supplier')) {
          promises.push(
            (async () => {
              const { data: suppliers } = await (supabase as any)
                .from('suppliers')
                .select('id, company_name, contact_name, email')
                .eq('tenant_id', tenant.id)
                .or(`company_name.ilike.%${searchLower}%,contact_name.ilike.%${searchLower}%`)
                .limit(limit);
              if (suppliers) {
                for (const s of suppliers as any[]) {
                  results.push({
                    id: s.id,
                    type: 'supplier',
                    label: s.company_name || 'Unnamed Supplier',
                    sublabel: s.contact_name || s.email || undefined,
                    url: `/admin/suppliers/${s.id}`,
                  });
                }
              }
            })()
          );
        }

        // Search couriers
        if (categories.includes('courier')) {
          promises.push(
            (async () => {
              const { data: couriers } = await (supabase as any)
                .from('couriers')
                .select('id, full_name, phone, vehicle_type')
                .eq('tenant_id', tenant.id)
                .or(`full_name.ilike.%${searchLower}%,phone.ilike.%${searchLower}%`)
                .limit(limit);
              if (couriers) {
                for (const c of couriers as any[]) {
                  results.push({
                    id: c.id,
                    type: 'courier',
                    label: c.full_name || 'Unnamed Courier',
                    sublabel: c.phone || c.vehicle_type || undefined,
                    url: `/admin/couriers/${c.id}`,
                  });
                }
              }
            })()
          );
        }

        // Search disposable menus
        if (categories.includes('menu')) {
          promises.push(
            (async () => {
              const { data: menus } = await (supabase as any)
                .from('disposable_menus')
                .select('id, title, customer_name, status')
                .eq('tenant_id', tenant.id)
                .or(`title.ilike.%${searchLower}%,customer_name.ilike.%${searchLower}%`)
                .limit(limit);
              if (menus) {
                for (const m of menus as any[]) {
                  results.push({
                    id: m.id,
                    type: 'menu',
                    label: m.title || `Menu for ${m.customer_name || 'Unknown'}`,
                    sublabel: m.customer_name || m.status || undefined,
                    url: `/admin/menus/${m.id}`,
                  });
                }
              }
            })()
          );
        }

        await Promise.all(promises);
      } catch (err) {
        logger.error('Global search error', { error: err });
        throw err;
      }

      return results;
    },
    enabled: query.length >= opts.minChars && !!tenant?.id && opts.enabled,
    staleTime: 30000,
  });

  const search = useCallback((newQuery: string) => {
    setQuery(newQuery);
  }, []);

  const clearResults = useCallback(() => {
    setQuery('');
  }, []);

  // Group results by type
  const groupedResults = (data ?? []).reduce<Record<SearchResultType, GlobalSearchResult[]>>(
    (acc, result) => {
      if (!acc[result.type]) {
        acc[result.type] = [];
      }
      acc[result.type].push(result);
      return acc;
    },
    {} as Record<SearchResultType, GlobalSearchResult[]>
  );

  return {
    results: data ?? [],
    groupedResults,
    isSearching: isLoading,
    error: error as Error | null,
    totalCount: data?.length ?? 0,
    search,
    clearResults,
    query,
  };
}
