/**
 * Global Data Search Hook
 * Search across customers, orders, products from the database
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { escapePostgresLike } from '@/lib/utils/searchSanitize';

export interface SearchResult {
  id: string;
  type: 'customer' | 'order' | 'product';
  label: string;
  sublabel?: string;
  icon: string;
  url: string;
}

interface CustomerRow {
  id: string;
  business_name: string | null;
  contact_name: string | null;
}

interface OrderRow {
  id: string;
  total_amount: number | null;
  status: string | null;
  wholesale_clients: { business_name: string | null } | null;
}

interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
}

interface UseDataSearchReturn {
  results: SearchResult[];
  isSearching: boolean;
  search: (query: string) => Promise<void>;
  clearResults: () => void;
}

export function useDataSearch(): UseDataSearchReturn {
  const { tenant } = useTenantAdminAuth();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const search = useCallback(
    async (query: string) => {
      if (!query || query.length < 2 || !tenant?.id) {
        setResults([]);
        return;
      }

      setIsSearching(true);

      try {
        // Search in parallel across different tables
        const [customersRes, ordersRes, productsRes] = await Promise.all([
          // Search wholesale clients
          supabase
            .from('wholesale_clients')
            .select('id, business_name, contact_name')
            .eq('tenant_id', tenant.id)
            .or(`business_name.ilike.%${escapePostgresLike(query)}%,contact_name.ilike.%${escapePostgresLike(query)}%`)
            .limit(5),

          // Search wholesale orders by ID
          supabase
            .from('wholesale_orders')
            .select('id, total_amount, status, wholesale_clients(business_name)')
            .eq('tenant_id', tenant.id)
            .or(`id.ilike.%${escapePostgresLike(query)}%`)
            .limit(5),

          // Search products
          supabase
            .from('products')
            .select('id, name, sku')
            .eq('tenant_id', tenant.id)
            .or(`name.ilike.%${escapePostgresLike(query)}%,sku.ilike.%${escapePostgresLike(query)}%`)
            .limit(5),
        ]);

        const searchResults: SearchResult[] = [];

        // Map customers
        if (customersRes.data) {
          (customersRes.data as unknown as CustomerRow[]).forEach((c) => {
            searchResults.push({
              id: c.id,
              type: 'customer',
              label: c.business_name || 'Unnamed Client',
              sublabel: c.contact_name || undefined,
              icon: '👤',
              url: `/customers/${c.id}`,
            });
          });
        }

        // Map orders
        if (ordersRes.data) {
          (ordersRes.data as unknown as OrderRow[]).forEach((o) => {
            searchResults.push({
              id: o.id,
              type: 'order',
              label: `Order #${o.id.slice(0, 8)}`,
              sublabel: o.wholesale_clients?.business_name || o.status || undefined,
              icon: '📦',
              url: `/orders/${o.id}`,
            });
          });
        }

        // Map products
        if (productsRes.data) {
          (productsRes.data as unknown as ProductRow[]).forEach((p) => {
            searchResults.push({
              id: p.id,
              type: 'product',
              label: p.name,
              sublabel: p.sku ? `SKU: ${p.sku}` : undefined,
              icon: '🏷️',
              url: `/products/${p.id}`,
            });
          });
        }

        setResults(searchResults);
      } catch (error) {
        logger.error('Search error', error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [tenant?.id]
  );

  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  return { results, isSearching, search, clearResults };
}
