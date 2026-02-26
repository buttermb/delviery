/**
 * Customer Segmentation Hook
 *
 * Segments customers into behavioral groups based on order activity:
 * - new: First order within 30 days
 * - active: Ordered within 60 days
 * - at_risk: No order in 60-90 days
 * - churned: No order in 90+ days
 * - vip: Top 10% by LTV (lifetime value)
 *
 * Features:
 * - Show segment badge on customer list and detail
 * - Filter customers by segment
 * - Segment counts for customer dashboard
 * - Auto-calculated from order dates
 */

import { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Customer segment types based on activity and value.
 * Note: A customer can be both 'vip' AND have another activity status,
 * but for display purposes, VIP takes priority.
 */
export type CustomerSegment = 'new' | 'active' | 'at_risk' | 'churned' | 'vip';

/**
 * Activity-based segment (without VIP consideration).
 */
export type ActivitySegment = 'new' | 'active' | 'at_risk' | 'churned';

/**
 * Customer segment data with order activity metrics.
 */
export interface CustomerSegmentData {
  customerId: string;
  customerName: string | null;
  segment: CustomerSegment;
  activitySegment: ActivitySegment;
  isVip: boolean;
  daysSinceLastOrder: number | null;
  daysSinceFirstOrder: number | null;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  totalSpend: number;
  orderCount: number;
}

/**
 * Aggregated segment counts for dashboard display.
 */
export interface SegmentCounts {
  new: number;
  active: number;
  at_risk: number;
  churned: number;
  vip: number;
  total: number;
}

/**
 * Options for the useCustomerSegment hook (single customer).
 */
export interface UseCustomerSegmentOptions {
  customerId: string | undefined;
  enabled?: boolean;
}

/**
 * Result for useCustomerSegment hook.
 */
export interface UseCustomerSegmentResult {
  segment: CustomerSegmentData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Options for the useCustomerSegments hook (all customers).
 */
export interface UseCustomerSegmentsOptions {
  filterBySegment?: CustomerSegment;
  enabled?: boolean;
}

/**
 * Result for useCustomerSegments hook.
 */
export interface UseCustomerSegmentsResult {
  segments: CustomerSegmentData[];
  segmentMap: Map<string, CustomerSegmentData>;
  counts: SegmentCounts;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  filterBySegment: (segment: CustomerSegment) => CustomerSegmentData[];
  getSegment: (customerId: string) => CustomerSegmentData | undefined;
}

// ============================================================================
// Query Key Factory
// ============================================================================

const segmentQueryKeys = {
  all: ['customer-segments'] as const,
  single: (tenantId?: string, customerId?: string) =>
    [...segmentQueryKeys.all, 'single', tenantId, customerId] as const,
  allCustomers: (tenantId?: string) =>
    [...segmentQueryKeys.all, 'all-customers', tenantId] as const,
  counts: (tenantId?: string) =>
    [...segmentQueryKeys.all, 'counts', tenantId] as const,
};

// ============================================================================
// Segment Thresholds (in days)
// ============================================================================

const SEGMENT_THRESHOLDS = {
  /** New customer: first order within this many days */
  NEW_DAYS: 30,
  /** Active customer: ordered within this many days */
  ACTIVE_DAYS: 60,
  /** At risk: no order in ACTIVE_DAYS to AT_RISK_DAYS */
  AT_RISK_DAYS: 90,
  /** VIP percentile: top X% by total spend */
  VIP_PERCENTILE: 10,
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate days between two dates.
 */
function daysBetween(date1: Date, date2: Date): number {
  const diffMs = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Determine activity segment based on order dates.
 */
function calculateActivitySegment(
  firstOrderDate: Date | null,
  lastOrderDate: Date | null
): ActivitySegment {
  const now = new Date();

  // No orders = treat as new (potential customer)
  if (!firstOrderDate || !lastOrderDate) {
    return 'new';
  }

  const daysSinceFirst = daysBetween(now, firstOrderDate);
  const daysSinceLast = daysBetween(now, lastOrderDate);

  // New: first order within 30 days
  if (daysSinceFirst <= SEGMENT_THRESHOLDS.NEW_DAYS) {
    return 'new';
  }

  // Active: ordered within 60 days
  if (daysSinceLast <= SEGMENT_THRESHOLDS.ACTIVE_DAYS) {
    return 'active';
  }

  // At risk: no order in 60-90 days
  if (daysSinceLast <= SEGMENT_THRESHOLDS.AT_RISK_DAYS) {
    return 'at_risk';
  }

  // Churned: no order in 90+ days
  return 'churned';
}

/**
 * Calculate the VIP threshold (top 10% by spend).
 * Returns the minimum spend required to be in VIP tier.
 */
function calculateVipThreshold(spendValues: number[]): number {
  if (spendValues.length === 0) {
    return Infinity;
  }

  // Sort descending
  const sorted = [...spendValues].sort((a, b) => b - a);

  // Find the index that represents top 10%
  const vipIndex = Math.floor(sorted.length * (SEGMENT_THRESHOLDS.VIP_PERCENTILE / 100));

  // Return the spend value at that position
  return sorted[Math.min(vipIndex, sorted.length - 1)] ?? 0;
}

/**
 * Determine final segment (VIP takes priority if applicable).
 */
function determineFinalSegment(
  activitySegment: ActivitySegment,
  isVip: boolean
): CustomerSegment {
  return isVip ? 'vip' : activitySegment;
}

// ============================================================================
// Main Hook: useCustomerSegment (Single Customer)
// ============================================================================

/**
 * Hook to get segment data for a single customer.
 */
export function useCustomerSegment({
  customerId,
  enabled = true,
}: UseCustomerSegmentOptions): UseCustomerSegmentResult {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: segmentQueryKeys.single(tenantId, customerId),
    queryFn: async (): Promise<CustomerSegmentData | null> => {
      if (!tenantId || !customerId) {
        return null;
      }

      logger.debug('Calculating customer segment', {
        component: 'useCustomerSegment',
        customerId,
        tenantId,
      });

      // Fetch customer info
      const { data: customer, error: customerError } = await supabase
        .from('contacts')
        .select('id, full_name')
        .eq('id', customerId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (customerError) {
        logger.error('Failed to fetch customer for segment', customerError, {
          component: 'useCustomerSegment',
          customerId,
        });
        throw customerError;
      }

      // Fetch customer's completed orders
      const { data: orders, error: ordersError } = await supabase
        .from('unified_orders')
        .select('id, total_amount, created_at')
        .eq('tenant_id', tenantId)
        .eq('customer_id', customerId)
        .in('status', ['completed', 'delivered', 'paid']);

      if (ordersError) {
        logger.error('Failed to fetch orders for segment', ordersError, {
          component: 'useCustomerSegment',
          customerId,
        });
        throw ordersError;
      }

      const validOrders = orders ?? [];

      // Calculate metrics
      const totalSpend = validOrders.reduce(
        (sum, order) => sum + (order.total_amount ?? 0),
        0
      );
      const orderCount = validOrders.length;

      // Extract order dates
      const orderDates = validOrders
        .map((order) => new Date(order.created_at))
        .filter((date) => !isNaN(date.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());

      const firstOrderDate = orderDates.length > 0 ? orderDates[0] : null;
      const lastOrderDate = orderDates.length > 0 ? orderDates[orderDates.length - 1] : null;

      // Calculate segment
      const activitySegment = calculateActivitySegment(firstOrderDate, lastOrderDate);

      // For VIP, we need to check against all customers in tenant
      // In single customer mode, we'll fetch a threshold
      const { data: allSpends } = await supabase
        .from('unified_orders')
        .select('customer_id, total_amount')
        .eq('tenant_id', tenantId)
        .in('status', ['completed', 'delivered', 'paid']);

      // Aggregate spend by customer
      const spendByCustomer = new Map<string, number>();
      for (const order of allSpends ?? []) {
        const current = spendByCustomer.get(order.customer_id) ?? 0;
        spendByCustomer.set(order.customer_id, current + (order.total_amount ?? 0));
      }

      const vipThreshold = calculateVipThreshold(Array.from(spendByCustomer.values()));
      const isVip = totalSpend >= vipThreshold && totalSpend > 0;
      const segment = determineFinalSegment(activitySegment, isVip);

      const now = new Date();

      const segmentData: CustomerSegmentData = {
        customerId,
        customerName: customer?.full_name ?? null,
        segment,
        activitySegment,
        isVip,
        daysSinceLastOrder: lastOrderDate ? daysBetween(now, lastOrderDate) : null,
        daysSinceFirstOrder: firstOrderDate ? daysBetween(now, firstOrderDate) : null,
        firstOrderDate: firstOrderDate?.toISOString() ?? null,
        lastOrderDate: lastOrderDate?.toISOString() ?? null,
        totalSpend: Math.round(totalSpend * 100) / 100,
        orderCount,
      };

      logger.debug('Customer segment calculated', {
        component: 'useCustomerSegment',
        customerId,
        segment: segmentData.segment,
        isVip: segmentData.isVip,
      });

      return segmentData;
    },
    enabled: enabled && !!tenantId && !!customerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    segment: data ?? null,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

// ============================================================================
// Bulk Hook: useCustomerSegments (All Customers)
// ============================================================================

/**
 * Hook to get segment data for all customers in tenant.
 * More efficient than calling useCustomerSegment multiple times.
 */
export function useCustomerSegments({
  filterBySegment: initialFilter,
  enabled = true,
}: UseCustomerSegmentsOptions = {}): UseCustomerSegmentsResult {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: segmentQueryKeys.allCustomers(tenantId),
    queryFn: async (): Promise<CustomerSegmentData[]> => {
      if (!tenantId) {
        return [];
      }

      logger.debug('Calculating all customer segments', {
        component: 'useCustomerSegments',
        tenantId,
      });

      // Fetch all customers
      const { data: customers, error: customersError } = await supabase
        .from('contacts')
        .select('id, full_name')
        .eq('tenant_id', tenantId);

      if (customersError) {
        logger.error('Failed to fetch customers for segments', customersError, {
          component: 'useCustomerSegments',
        });
        throw customersError;
      }

      if (!customers || customers.length === 0) {
        return [];
      }

      // Fetch all completed orders
      const { data: orders, error: ordersError } = await supabase
        .from('unified_orders')
        .select('id, customer_id, total_amount, created_at')
        .eq('tenant_id', tenantId)
        .in('status', ['completed', 'delivered', 'paid']);

      if (ordersError) {
        logger.error('Failed to fetch orders for segments', ordersError, {
          component: 'useCustomerSegments',
        });
        throw ordersError;
      }

      // Group orders by customer
      const ordersByCustomer = new Map<
        string,
        Array<{ total_amount: number | null; created_at: string }>
      >();

      for (const customer of customers) {
        ordersByCustomer.set(customer.id, []);
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

      // Calculate spend for each customer (for VIP threshold)
      const spendByCustomer = new Map<string, number>();
      for (const [customerId, customerOrders] of ordersByCustomer) {
        const totalSpend = customerOrders.reduce(
          (sum, order) => sum + (order.total_amount ?? 0),
          0
        );
        spendByCustomer.set(customerId, totalSpend);
      }

      // Calculate VIP threshold (top 10%)
      const vipThreshold = calculateVipThreshold(Array.from(spendByCustomer.values()));

      // Build segment data for each customer
      const now = new Date();
      const segmentList: CustomerSegmentData[] = [];

      for (const customer of customers) {
        const customerOrders = ordersByCustomer.get(customer.id) ?? [];

        const totalSpend = spendByCustomer.get(customer.id) ?? 0;
        const orderCount = customerOrders.length;

        // Extract and sort order dates
        const orderDates = customerOrders
          .map((order) => new Date(order.created_at))
          .filter((date) => !isNaN(date.getTime()))
          .sort((a, b) => a.getTime() - b.getTime());

        const firstOrderDate = orderDates.length > 0 ? orderDates[0] : null;
        const lastOrderDate = orderDates.length > 0 ? orderDates[orderDates.length - 1] : null;

        // Calculate segment
        const activitySegment = calculateActivitySegment(firstOrderDate, lastOrderDate);
        const isVip = totalSpend >= vipThreshold && totalSpend > 0;
        const segment = determineFinalSegment(activitySegment, isVip);

        segmentList.push({
          customerId: customer.id,
          customerName: customer.full_name,
          segment,
          activitySegment,
          isVip,
          daysSinceLastOrder: lastOrderDate ? daysBetween(now, lastOrderDate) : null,
          daysSinceFirstOrder: firstOrderDate ? daysBetween(now, firstOrderDate) : null,
          firstOrderDate: firstOrderDate?.toISOString() ?? null,
          lastOrderDate: lastOrderDate?.toISOString() ?? null,
          totalSpend: Math.round(totalSpend * 100) / 100,
          orderCount,
        });
      }

      logger.debug('All customer segments calculated', {
        component: 'useCustomerSegments',
        customerCount: segmentList.length,
      });

      return segmentList;
    },
    enabled: enabled && !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Build lookup map
  const segmentMap = useMemo(() => {
    const map = new Map<string, CustomerSegmentData>();
    for (const segment of data ?? []) {
      map.set(segment.customerId, segment);
    }
    return map;
  }, [data]);

  // Calculate counts
  const counts = useMemo((): SegmentCounts => {
    const segments = data ?? [];
    return {
      new: segments.filter((s) => s.segment === 'new').length,
      active: segments.filter((s) => s.segment === 'active').length,
      at_risk: segments.filter((s) => s.segment === 'at_risk').length,
      churned: segments.filter((s) => s.segment === 'churned').length,
      vip: segments.filter((s) => s.segment === 'vip').length,
      total: segments.length,
    };
  }, [data]);

  // Filter function
  const filterBySegmentFn = useMemo(() => {
    return (segment: CustomerSegment): CustomerSegmentData[] => {
      return (data ?? []).filter((s) => s.segment === segment);
    };
  }, [data]);

  // Get single segment from map
  const getSegment = useMemo(() => {
    return (customerId: string): CustomerSegmentData | undefined => {
      return segmentMap.get(customerId);
    };
  }, [segmentMap]);

  // Apply initial filter if provided
  const filteredSegments = useMemo(() => {
    if (!initialFilter) {
      return data ?? [];
    }
    return (data ?? []).filter((s) => s.segment === initialFilter);
  }, [data, initialFilter]);

  return {
    segments: filteredSegments,
    segmentMap,
    counts,
    isLoading,
    error: error as Error | null,
    refetch,
    filterBySegment: filterBySegmentFn,
    getSegment,
  };
}

// ============================================================================
// Segment Counts Hook (Lightweight)
// ============================================================================

/**
 * Hook to get just segment counts without full customer data.
 * Useful for dashboard display.
 */
export function useSegmentCounts(enabled = true): {
  counts: SegmentCounts;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { segments: _segments, counts, isLoading, error, refetch } = useCustomerSegments({ enabled });

  return {
    counts,
    isLoading,
    error,
    refetch,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get human-readable label for segment.
 */
export function getSegmentLabel(segment: CustomerSegment): string {
  switch (segment) {
    case 'vip':
      return 'VIP';
    case 'active':
      return 'Active';
    case 'new':
      return 'New';
    case 'at_risk':
      return 'At Risk';
    case 'churned':
      return 'Churned';
    default:
      return 'Unknown';
  }
}

/**
 * Get badge variant for segment.
 */
export function getSegmentBadgeVariant(
  segment: CustomerSegment
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (segment) {
    case 'vip':
      return 'default';
    case 'active':
      return 'secondary';
    case 'new':
      return 'outline';
    case 'at_risk':
      return 'destructive';
    case 'churned':
      return 'destructive';
    default:
      return 'outline';
  }
}

/**
 * Get Tailwind color classes for segment badge.
 */
export function getSegmentColorClasses(segment: CustomerSegment): string {
  switch (segment) {
    case 'vip':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'active':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'new':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'at_risk':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'churned':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

/**
 * Get icon name suggestion for segment.
 */
export function getSegmentIcon(segment: CustomerSegment): string {
  switch (segment) {
    case 'vip':
      return 'crown';
    case 'active':
      return 'check-circle';
    case 'new':
      return 'sparkles';
    case 'at_risk':
      return 'alert-triangle';
    case 'churned':
      return 'user-x';
    default:
      return 'user';
  }
}

/**
 * Get segment priority for sorting (lower = higher priority).
 */
export function getSegmentPriority(segment: CustomerSegment): number {
  switch (segment) {
    case 'vip':
      return 0;
    case 'at_risk':
      return 1;
    case 'active':
      return 2;
    case 'new':
      return 3;
    case 'churned':
      return 4;
    default:
      return 5;
  }
}

/**
 * Sort customers by segment priority (VIP first, then at-risk, etc.).
 */
export function sortBySegment(
  a: CustomerSegmentData,
  b: CustomerSegmentData
): number {
  return getSegmentPriority(a.segment) - getSegmentPriority(b.segment);
}

/**
 * Get segment description for tooltips/help text.
 */
export function getSegmentDescription(segment: CustomerSegment): string {
  switch (segment) {
    case 'vip':
      return 'Top 10% customers by lifetime value';
    case 'active':
      return 'Ordered within the last 60 days';
    case 'new':
      return 'First order within the last 30 days';
    case 'at_risk':
      return 'No orders in 60-90 days';
    case 'churned':
      return 'No orders in 90+ days';
    default:
      return 'Unknown segment';
  }
}

/**
 * Get segment thresholds (for display purposes).
 */
export function getSegmentThresholds(): typeof SEGMENT_THRESHOLDS {
  return { ...SEGMENT_THRESHOLDS };
}
