/**
 * Returning Customer Lookup Hook
 *
 * Looks up returning customers by phone number during storefront checkout.
 * When a phone number with 10+ digits is entered, queries the
 * lookup_returning_customer RPC to find an existing customer profile.
 * Returns customer data (name, email, address) for auto-fill.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

export interface ReturningCustomerData {
  customerId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  address: string | null;
  preferredContact: string | null;
}

interface UseReturningCustomerLookupOptions {
  phone: string;
  tenantId: string | undefined;
  enabled?: boolean;
}

export function useReturningCustomerLookup({
  phone,
  tenantId,
  enabled = true,
}: UseReturningCustomerLookupOptions) {
  // Normalize phone: strip all non-digit characters
  const normalizedPhone = phone.replace(/\D/g, '');
  const debouncedPhone = useDebounce(normalizedPhone, 500);

  // Only search when we have 10+ digits (valid US phone)
  const shouldSearch = enabled && !!tenantId && debouncedPhone.length >= 10;

  const { data, isLoading, isFetched } = useQuery({
    queryKey: queryKeys.customerLookup.search(tenantId, 'phone', debouncedPhone),
    queryFn: async (): Promise<ReturningCustomerData | null> => {
      const { data: result, error } = await (supabase.rpc as unknown as (
        fn: string,
        params: Record<string, unknown>
      ) => Promise<{ data: Array<{
        customer_id: string;
        first_name: string;
        last_name: string;
        email: string | null;
        address: string | null;
        preferred_contact: string | null;
      }> | null; error: unknown }>)(
        'lookup_returning_customer',
        { p_phone: debouncedPhone, p_tenant_id: tenantId }
      );

      if (error || !result || result.length === 0) {
        if (error) {
          logger.warn('Returning customer lookup failed', error, {
            component: 'useReturningCustomerLookup',
          });
        }
        return null;
      }

      const customer = result[0];
      return {
        customerId: customer.customer_id,
        firstName: customer.first_name || '',
        lastName: customer.last_name || '',
        email: customer.email,
        address: customer.address,
        preferredContact: customer.preferred_contact,
      };
    },
    enabled: shouldSearch,
    staleTime: 60_000,
    retry: false,
  });

  return {
    customer: data ?? null,
    isRecognized: !!data,
    isSearching: isLoading && shouldSearch,
    hasSearched: isFetched && shouldSearch,
  };
}
