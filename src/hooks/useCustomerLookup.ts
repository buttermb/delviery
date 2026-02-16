/**
 * Customer Lookup Hook
 *
 * Searches for existing customers by phone number or email.
 * Used during order creation to auto-associate orders with existing customers.
 * If no customer found, provides helper to create new customer from order details.
 *
 * Features:
 * - Debounced search (400ms)
 * - Searches by phone or email
 * - Tenant-filtered results
 * - Returns matched customer or null
 * - Provides customer creation mutation
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

export interface CustomerMatch {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  total_orders?: number;
}

export interface NewCustomerData {
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  delivery_address?: string;
}

interface UseCustomerLookupOptions {
  /** Minimum characters before search triggers (default: 3) */
  minChars?: number;
  /** Debounce delay in milliseconds (default: 400) */
  debounceMs?: number;
  /** Enable search */
  enabled?: boolean;
}

interface UseCustomerLookupReturn {
  /** Matched customers from search */
  matches: CustomerMatch[];
  /** Currently selected/matched customer */
  selectedCustomer: CustomerMatch | null;
  /** Whether search is in progress */
  isSearching: boolean;
  /** Error if any */
  error: Error | null;
  /** Set phone number to search */
  searchByPhone: (phone: string) => void;
  /** Set email to search */
  searchByEmail: (email: string) => void;
  /** Clear search and selection */
  clear: () => void;
  /** Select a customer from matches */
  selectCustomer: (customer: CustomerMatch | null) => void;
  /** Create new customer from order details */
  createCustomer: (data: NewCustomerData) => Promise<CustomerMatch>;
  /** Whether customer creation is in progress */
  isCreating: boolean;
  /** Current search query */
  query: string;
  /** Type of search (phone or email) */
  searchType: 'phone' | 'email' | null;
}

/**
 * Normalize phone number for searching (remove non-digits)
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Normalize email for searching (lowercase, trim)
 */
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function useCustomerLookup(options: UseCustomerLookupOptions = {}): UseCustomerLookupReturn {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'phone' | 'email' | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerMatch | null>(null);

  const {
    minChars = 3,
    debounceMs = 400,
    enabled = true,
  } = options;

  // Debounce the search query
  const debouncedQuery = useDebounce(query, debounceMs);

  const shouldSearch = useMemo(() => {
    return (
      enabled &&
      !!tenant?.id &&
      !!searchType &&
      debouncedQuery.length >= minChars
    );
  }, [enabled, tenant?.id, searchType, debouncedQuery, minChars]);

  const { data: matches = [], isLoading, error } = useQuery({
    queryKey: ['customer-lookup', tenant?.id, searchType, debouncedQuery],
    queryFn: async (): Promise<CustomerMatch[]> => {
      if (!tenant?.id || !searchType || debouncedQuery.length < minChars) {
        return [];
      }

      try {
        let queryBuilder = supabase
          .from('customers')
          .select('id, first_name, last_name, email, phone, created_at')
          .eq('tenant_id', tenant.id);

        if (searchType === 'phone') {
          const normalizedPhone = normalizePhone(debouncedQuery);
          // Search for phone containing the digits
          queryBuilder = queryBuilder.ilike('phone', `%${normalizedPhone}%`);
        } else if (searchType === 'email') {
          const normalizedEmail = normalizeEmail(debouncedQuery);
          queryBuilder = queryBuilder.ilike('email', `%${normalizedEmail}%`);
        }

        const { data, error: queryError } = await queryBuilder.limit(5);

        if (queryError) {
          logger.error('Customer lookup failed', queryError, {
            component: 'useCustomerLookup',
            searchType,
          });
          throw queryError;
        }

        return (data || []).map((customer) => ({
          id: customer.id,
          first_name: customer.first_name,
          last_name: customer.last_name,
          full_name: [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Unknown',
          email: customer.email,
          phone: customer.phone,
          created_at: customer.created_at,
        }));
      } catch (err) {
        logger.error('Customer lookup error', err instanceof Error ? err : new Error(String(err)), {
          component: 'useCustomerLookup',
        });
        throw err;
      }
    },
    enabled: shouldSearch,
    staleTime: 30000,
  });

  // Create customer mutation
  const createMutation = useMutation({
    mutationFn: async (data: NewCustomerData): Promise<CustomerMatch> => {
      if (!tenant?.id) {
        throw new Error('No tenant context');
      }

      const { data: newCustomer, error: createError } = await (supabase as any)
        .from('customers')
        .insert({
          tenant_id: tenant.id,
          first_name: data.first_name,
          last_name: data.last_name || null,
          email: data.email || null,
          phone: data.phone || null,
          delivery_address: data.delivery_address || null,
        })
        .select('id, first_name, last_name, email, phone, created_at')
        .single();

      if (createError) {
        logger.error('Failed to create customer', createError, {
          component: 'useCustomerLookup',
        });
        throw createError;
      }

      const customerMatch: CustomerMatch = {
        id: newCustomer.id,
        first_name: newCustomer.first_name,
        last_name: newCustomer.last_name,
        full_name: [newCustomer.first_name, newCustomer.last_name].filter(Boolean).join(' ') || 'Unknown',
        email: newCustomer.email,
        phone: newCustomer.phone,
        created_at: newCustomer.created_at,
      };

      return customerMatch;
    },
    onSuccess: (newCustomer) => {
      // Invalidate customers list cache
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      // Auto-select the newly created customer
      setSelectedCustomer(newCustomer);
    },
    onError: (error) => {
      logger.error('Customer creation failed', error instanceof Error ? error : new Error(String(error)), {
        component: 'useCustomerLookup',
      });
    },
  });

  const searchByPhone = useCallback((phone: string) => {
    setSearchType('phone');
    setQuery(phone);
    // Clear selection when starting new search
    if (selectedCustomer) {
      setSelectedCustomer(null);
    }
  }, [selectedCustomer]);

  const searchByEmail = useCallback((email: string) => {
    setSearchType('email');
    setQuery(email);
    // Clear selection when starting new search
    if (selectedCustomer) {
      setSelectedCustomer(null);
    }
  }, [selectedCustomer]);

  const clear = useCallback(() => {
    setQuery('');
    setSearchType(null);
    setSelectedCustomer(null);
  }, []);

  const selectCustomer = useCallback((customer: CustomerMatch | null) => {
    setSelectedCustomer(customer);
  }, []);

  const createCustomer = useCallback(async (data: NewCustomerData): Promise<CustomerMatch> => {
    return createMutation.mutateAsync(data);
  }, [createMutation]);

  return {
    matches,
    selectedCustomer,
    isSearching: isLoading,
    error: error as Error | null,
    searchByPhone,
    searchByEmail,
    clear,
    selectCustomer,
    createCustomer,
    isCreating: createMutation.isPending,
    query,
    searchType,
  };
}
