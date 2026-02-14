/**
 * Customer Lifetime Value (LTV) Hook
 *
 * Calculates customer lifetime value metrics including:
 * - Total spend, order count, average order value
 * - Order frequency (days between orders)
 * - Predicted next order date
 * - Customer since date
 * - LTV segments (new/regular/valuable/vip)
 *
 * Used in customer detail pages and customer list sorting.
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export type LTVSegment = 'new' | 'regular' | 'valuable' | 'vip';

export interface CustomerLTV {
  customerId: string;
  customerName: string | null;
  totalSpend: number;
  orderCount: number;
  avgOrderValue: number;
  orderFrequencyDays: number | null;
  predictedNextOrderDate: string | null;
  customerSinceDate: string | null;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  segment: LTVSegment;
  daysSinceLastOrder: number | null;
}

export interface UseCustomerLTVOptions {
  customerId: string | undefined;
  enabled?: boolean;
}

export interface UseCustomerLTVResult {
  ltv: CustomerLTV | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface UseBulkCustomerLTVOptions {
  customerIds?: string[];
  enabled?: boolean;
}

export interface UseBulkCustomerLTVResult {
  ltvMap: Map<string, CustomerLTV>;
  ltvList: CustomerLTV[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// ============================================================================
// Query Key Factory
// ============================================================================

const ltvQueryKeys = {
  all: ['customer-ltv'] as const,
  single: (tenantId?: string, customerId?: string) =>
    [...ltvQueryKeys.all, 'single', tenantId, customerId] as const,
  bulk: (tenantId?: string, customerIds?: string[]) =>
    [...ltvQueryKeys.all, 'bulk', tenantId, customerIds?.join(',')] as const,
  allCustomers: (tenantId?: string) =>
    [...ltvQueryKeys.all, 'all-customers', tenantId] as const,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determines LTV segment based on total spend and order count.
 * Thresholds:
 * - VIP: Top tier - high spend (>$10,000) OR high order count (>50)
 * - Valuable: Good customers - spend >$2,500 OR >15 orders
 * - Regular: Active customers - spend >$500 OR >3 orders
 * - New: Everyone else (likely first-time or very low activity)
 */
function calculateLTVSegment(totalSpend: number, orderCount: number): LTVSegment {
  // VIP: Top customers
  if (totalSpend >= 10000 || orderCount >= 50) {
    return 'vip';
  }

  // Valuable: Good repeat customers
  if (totalSpend >= 2500 || orderCount >= 15) {
    return 'valuable';
  }

  // Regular: Active customers
  if (totalSpend >= 500 || orderCount >= 3) {
    return 'regular';
  }

  // New: Low activity or first-time
  return 'new';
}

/**
 * Calculate average days between orders.
 * Returns null if less than 2 orders.
 */
function calculateOrderFrequency(orderDates: Date[]): number | null {
  if (orderDates.length < 2) {
    return null;
  }

  // Sort dates ascending
  const sorted = [...orderDates].sort((a, b) => a.getTime() - b.getTime());

  // Calculate total days between first and last order
  const firstOrder = sorted[0];
  const lastOrder = sorted[sorted.length - 1];
  const totalDays = Math.ceil(
    (lastOrder.getTime() - firstOrder.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Average days between orders = total days / (number of gaps)
  const gaps = orderDates.length - 1;
  return gaps > 0 ? Math.round(totalDays / gaps) : null;
}

/**
 * Predict next order date based on order frequency.
 * Returns null if frequency cannot be calculated.
 */
function predictNextOrderDate(
  lastOrderDate: Date | null,
  frequencyDays: number | null
): string | null {
  if (!lastOrderDate || !frequencyDays || frequencyDays <= 0) {
    return null;
  }

  const predictedDate = new Date(lastOrderDate);
  predictedDate.setDate(predictedDate.getDate() + frequencyDays);

  return predictedDate.toISOString();
}

/**
 * Calculate days since last order.
 */
function calculateDaysSinceLastOrder(lastOrderDate: Date | null): number | null {
  if (!lastOrderDate) {
    return null;
  }

  const now = new Date();
  const diffMs = now.getTime() - lastOrderDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ============================================================================
// Main Hook: useCustomerLTV
// ============================================================================

/**
 * Hook to calculate LTV metrics for a single customer.
 */
export function useCustomerLTV({
  customerId,
  enabled = true,
}: UseCustomerLTVOptions): UseCustomerLTVResult {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ltvQueryKeys.single(tenantId, customerId),
    queryFn: async (): Promise<CustomerLTV | null> => {
      if (!tenantId || !customerId) {
        return null;
      }

      logger.debug('Calculating customer LTV', {
        component: 'useCustomerLTV',
        customerId,
        tenantId,
      });

      // Fetch customer details from contacts table
      const { data: customer, error: customerError } = await supabase
        .from('contacts')
        .select('id, full_name, created_at')
        .eq('id', customerId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (customerError) {
        logger.error('Failed to fetch customer for LTV calculation', customerError, {
          component: 'useCustomerLTV',
          customerId,
        });
        throw customerError;
      }

      // Fetch all completed orders for this customer
      const { data: orders, error: ordersError } = await supabase
        .from('unified_orders')
        .select('id, total_amount, created_at, status')
        .eq('tenant_id', tenantId)
        .eq('customer_id', customerId)
        .in('status', ['completed', 'delivered', 'paid']);

      if (ordersError) {
        logger.error('Failed to fetch orders for LTV calculation', ordersError, {
          component: 'useCustomerLTV',
          customerId,
        });
        throw ordersError;
      }

      const validOrders = orders ?? [];

      // Calculate basic metrics
      const totalSpend = validOrders.reduce(
        (sum, order) => sum + (order.total_amount ?? 0),
        0
      );
      const orderCount = validOrders.length;
      const avgOrderValue = orderCount > 0 ? totalSpend / orderCount : 0;

      // Extract order dates
      const orderDates = validOrders
        .map((order) => new Date(order.created_at))
        .filter((date) => !isNaN(date.getTime()));

      // Find first and last order dates
      let firstOrderDate: Date | null = null;
      let lastOrderDate: Date | null = null;

      if (orderDates.length > 0) {
        const sortedDates = [...orderDates].sort((a, b) => a.getTime() - b.getTime());
        firstOrderDate = sortedDates[0];
        lastOrderDate = sortedDates[sortedDates.length - 1];
      }

      // Calculate frequency and predictions
      const orderFrequencyDays = calculateOrderFrequency(orderDates);
      const predictedNextOrderDate = predictNextOrderDate(lastOrderDate, orderFrequencyDays);
      const daysSinceLastOrder = calculateDaysSinceLastOrder(lastOrderDate);

      // Determine segment
      const segment = calculateLTVSegment(totalSpend, orderCount);

      // Customer since date - prefer customer created_at, fallback to first order
      const customerSinceDate = customer?.created_at ?? firstOrderDate?.toISOString() ?? null;

      const ltv: CustomerLTV = {
        customerId,
        customerName: customer?.full_name ?? null,
        totalSpend: Math.round(totalSpend * 100) / 100,
        orderCount,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        orderFrequencyDays,
        predictedNextOrderDate,
        customerSinceDate,
        firstOrderDate: firstOrderDate?.toISOString() ?? null,
        lastOrderDate: lastOrderDate?.toISOString() ?? null,
        segment,
        daysSinceLastOrder,
      };

      logger.debug('Customer LTV calculated', {
        component: 'useCustomerLTV',
        customerId,
        segment: ltv.segment,
        totalSpend: ltv.totalSpend,
        orderCount: ltv.orderCount,
      });

      return ltv;
    },
    enabled: enabled && !!tenantId && !!customerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    ltv: data ?? null,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

// ============================================================================
// Bulk Hook: useBulkCustomerLTV
// ============================================================================

/**
 * Hook to calculate LTV for multiple customers at once.
 * If customerIds is undefined/empty, fetches for all customers in tenant.
 * More efficient than calling useCustomerLTV multiple times.
 */
export function useBulkCustomerLTV({
  customerIds,
  enabled = true,
}: UseBulkCustomerLTVOptions): UseBulkCustomerLTVResult {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const fetchAllCustomers = !customerIds || customerIds.length === 0;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: fetchAllCustomers
      ? ltvQueryKeys.allCustomers(tenantId)
      : ltvQueryKeys.bulk(tenantId, customerIds),
    queryFn: async (): Promise<CustomerLTV[]> => {
      if (!tenantId) {
        return [];
      }

      logger.debug('Calculating bulk customer LTV', {
        component: 'useBulkCustomerLTV',
        customerCount: fetchAllCustomers ? 'all' : customerIds?.length,
        tenantId,
      });

      // Fetch customers
      let customersQuery = supabase
        .from('contacts')
        .select('id, full_name, created_at')
        .eq('tenant_id', tenantId);

      if (!fetchAllCustomers && customerIds && customerIds.length > 0) {
        customersQuery = customersQuery.in('id', customerIds);
      }

      const { data: customers, error: customersError } = await customersQuery;

      if (customersError) {
        logger.error('Failed to fetch customers for bulk LTV', customersError, {
          component: 'useBulkCustomerLTV',
        });
        throw customersError;
      }

      if (!customers || customers.length === 0) {
        return [];
      }

      const customerIdsToFetch = customers.map((c) => c.id);

      // Create customer lookup with explicit type
      const customerLookup = new Map<
        string,
        { name: string | null; createdAt: string }
      >(
        customers.map((c) => [
          c.id,
          { name: c.full_name, createdAt: c.created_at },
        ])
      );

      // Fetch all orders for these customers
      const { data: orders, error: ordersError } = await supabase
        .from('unified_orders')
        .select('id, customer_id, total_amount, created_at, status')
        .eq('tenant_id', tenantId)
        .in('customer_id', customerIdsToFetch)
        .in('status', ['completed', 'delivered', 'paid']);

      if (ordersError) {
        logger.error('Failed to fetch orders for bulk LTV', ordersError, {
          component: 'useBulkCustomerLTV',
        });
        throw ordersError;
      }

      // Group orders by customer
      const ordersByCustomer = new Map<
        string,
        Array<{ total_amount: number | null; created_at: string }>
      >();

      for (const customerId of customerIdsToFetch) {
        ordersByCustomer.set(customerId, []);
      }

      for (const order of orders ?? []) {
        const customerOrders = ordersByCustomer.get(order.customer_id);
        if (customerOrders) {
          customerOrders.push({
            total_amount: order.total_amount,
            created_at: order.created_at,
          });
        }
      }

      // Calculate LTV for each customer
      const ltvList: CustomerLTV[] = [];

      for (const customerId of customerIdsToFetch) {
        const customerInfo = customerLookup.get(customerId);
        const customerOrders = ordersByCustomer.get(customerId) ?? [];

        // Calculate metrics
        const totalSpend = customerOrders.reduce(
          (sum, order) => sum + (order.total_amount ?? 0),
          0
        );
        const orderCount = customerOrders.length;
        const avgOrderValue = orderCount > 0 ? totalSpend / orderCount : 0;

        // Extract order dates
        const orderDates = customerOrders
          .map((order) => new Date(order.created_at))
          .filter((date) => !isNaN(date.getTime()));

        // Find first and last order dates
        let firstOrderDate: Date | null = null;
        let lastOrderDate: Date | null = null;

        if (orderDates.length > 0) {
          const sortedDates = [...orderDates].sort((a, b) => a.getTime() - b.getTime());
          firstOrderDate = sortedDates[0];
          lastOrderDate = sortedDates[sortedDates.length - 1];
        }

        // Calculate frequency and predictions
        const orderFrequencyDays = calculateOrderFrequency(orderDates);
        const predictedNextOrderDate = predictNextOrderDate(lastOrderDate, orderFrequencyDays);
        const daysSinceLastOrder = calculateDaysSinceLastOrder(lastOrderDate);

        // Determine segment
        const segment = calculateLTVSegment(totalSpend, orderCount);

        // Customer since date
        const customerSinceDate =
          customerInfo?.createdAt ?? firstOrderDate?.toISOString() ?? null;

        ltvList.push({
          customerId,
          customerName: customerInfo?.name ?? null,
          totalSpend: Math.round(totalSpend * 100) / 100,
          orderCount,
          avgOrderValue: Math.round(avgOrderValue * 100) / 100,
          orderFrequencyDays,
          predictedNextOrderDate,
          customerSinceDate,
          firstOrderDate: firstOrderDate?.toISOString() ?? null,
          lastOrderDate: lastOrderDate?.toISOString() ?? null,
          segment,
          daysSinceLastOrder,
        });
      }

      logger.debug('Bulk customer LTV calculated', {
        component: 'useBulkCustomerLTV',
        customerCount: ltvList.length,
      });

      return ltvList;
    },
    enabled: enabled && !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Create map for quick lookups
  const ltvMap = new Map<string, CustomerLTV>();
  for (const ltv of data ?? []) {
    ltvMap.set(ltv.customerId, ltv);
  }

  return {
    ltvMap,
    ltvList: data ?? [],
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get human-readable label for LTV segment.
 */
export function getSegmentLabel(segment: LTVSegment): string {
  switch (segment) {
    case 'vip':
      return 'VIP';
    case 'valuable':
      return 'Valuable';
    case 'regular':
      return 'Regular';
    case 'new':
      return 'New';
    default:
      return 'Unknown';
  }
}

/**
 * Get color variant for LTV segment badges.
 */
export function getSegmentColor(
  segment: LTVSegment
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (segment) {
    case 'vip':
      return 'default'; // Primary/gold color
    case 'valuable':
      return 'secondary';
    case 'regular':
      return 'outline';
    case 'new':
      return 'outline';
    default:
      return 'secondary';
  }
}

/**
 * Get Tailwind color classes for LTV segment.
 */
export function getSegmentColorClasses(segment: LTVSegment): string {
  switch (segment) {
    case 'vip':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'valuable':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'regular':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'new':
      return 'bg-slate-100 text-slate-800 border-slate-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

/**
 * Sort customers by LTV (total spend descending).
 */
export function sortByLTV(a: CustomerLTV, b: CustomerLTV): number {
  return b.totalSpend - a.totalSpend;
}

/**
 * Sort customers by order count descending.
 */
export function sortByOrderCount(a: CustomerLTV, b: CustomerLTV): number {
  return b.orderCount - a.orderCount;
}

/**
 * Sort customers by segment priority (VIP first).
 */
export function sortBySegment(a: CustomerLTV, b: CustomerLTV): number {
  const segmentOrder: Record<LTVSegment, number> = {
    vip: 0,
    valuable: 1,
    regular: 2,
    new: 3,
  };
  return segmentOrder[a.segment] - segmentOrder[b.segment];
}

/**
 * Format currency value for display.
 */
export function formatLTVCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format order frequency for display.
 */
export function formatOrderFrequency(days: number | null): string {
  if (days === null) {
    return 'N/A';
  }

  if (days === 0) {
    return 'Daily';
  }

  if (days === 1) {
    return 'Every day';
  }

  if (days < 7) {
    return `Every ${days} days`;
  }

  if (days === 7) {
    return 'Weekly';
  }

  if (days < 30) {
    const weeks = Math.round(days / 7);
    return weeks === 1 ? 'Weekly' : `Every ${weeks} weeks`;
  }

  if (days === 30) {
    return 'Monthly';
  }

  const months = Math.round(days / 30);
  return months === 1 ? 'Monthly' : `Every ${months} months`;
}
