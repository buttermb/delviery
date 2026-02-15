/**
 * Customer Auto-Segment Hook
 *
 * Listens to order_completed events via eventBus and automatically:
 * - Recalculates customer segment after order completion
 * - If customer crossed VIP threshold, updates segment and notifies admin
 * - If customer was at_risk and placed new order, updates to active
 * - Auto-applies segment-specific tags
 * - Updates customer record in database
 *
 * Features:
 * - Event-driven architecture using eventBus
 * - Tenant-isolated operations
 * - Automatic admin notifications for VIP upgrades
 * - Tag synchronization based on segment changes
 */

import { useEffect, useCallback, useRef } from 'react';

import type { EventPayloads } from '@/lib/eventBus';
import { subscribe, publish } from '@/lib/eventBus';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Customer segment types matching useCustomerSegments.ts
 */
export type CustomerSegment = 'new' | 'active' | 'at_risk' | 'churned' | 'vip';

/**
 * Segment change event for tracking upgrades/downgrades
 */
export interface SegmentChange {
  customerId: string;
  customerName: string | null;
  previousSegment: CustomerSegment | null;
  newSegment: CustomerSegment;
  isVipUpgrade: boolean;
  wasAtRisk: boolean;
  totalSpend: number;
  orderCount: number;
}

/**
 * Options for the useCustomerAutoSegment hook
 */
export interface UseCustomerAutoSegmentOptions {
  /** Enable/disable the auto-segment (default: true) */
  enabled?: boolean;
  /** Callback when segment changes */
  onSegmentChange?: (change: SegmentChange) => void;
}

/**
 * Return type for the hook
 */
export interface UseCustomerAutoSegmentResult {
  /** Whether the hook is ready and listening */
  isReady: boolean;
  /** Manually trigger segment recalculation for a customer */
  recalculateSegment: (customerId: string) => Promise<SegmentChange | null>;
}

// ============================================================================
// Segment Thresholds
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
// Segment Tag Mapping
// ============================================================================

/**
 * Tags to apply based on customer segment
 */
const SEGMENT_TAGS: Record<CustomerSegment, string> = {
  vip: 'VIP Customer',
  active: 'Active Customer',
  new: 'New Customer',
  at_risk: 'At Risk',
  churned: 'Churned',
};

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
 * Determine segment based on order activity and spend.
 */
function calculateSegment(
  firstOrderDate: Date | null,
  lastOrderDate: Date | null,
  totalSpend: number,
  vipThreshold: number
): CustomerSegment {
  const now = new Date();

  // Check for VIP first (based on spend)
  if (totalSpend >= vipThreshold && totalSpend > 0) {
    return 'vip';
  }

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
 */
function calculateVipThreshold(spendValues: number[]): number {
  if (spendValues.length === 0) {
    return Infinity;
  }

  const sorted = [...spendValues].sort((a, b) => b - a);
  const vipIndex = Math.floor(sorted.length * (SEGMENT_THRESHOLDS.VIP_PERCENTILE / 100));
  return sorted[Math.min(vipIndex, sorted.length - 1)] || 0;
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Fetch customer's current segment from contacts table
 */
async function fetchCurrentSegment(
  tenantId: string,
  customerId: string
): Promise<{ segment: CustomerSegment | null; name: string | null }> {
  const { data, error } = await supabase
    .from('contacts')
    .select('full_name, segment')
    .eq('tenant_id', tenantId)
    .eq('id', customerId)
    .maybeSingle();

  if (error) {
    logger.error('[AutoSegment] Failed to fetch current segment', error, {
      customerId,
      tenantId,
    });
    return { segment: null, name: null };
  }

  return {
    segment: ((data as any)?.segment as CustomerSegment) ?? null,
    name: (data as any)?.full_name ?? null,
  };
}

/**
 * Fetch customer's order history for segment calculation
 */
async function fetchCustomerOrders(
  tenantId: string,
  customerId: string
): Promise<{ totalSpend: number; orderCount: number; firstOrderDate: Date | null; lastOrderDate: Date | null }> {
  const { data, error } = await supabase
    .from('unified_orders')
    .select('total_amount, created_at')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .in('status', ['completed', 'delivered', 'paid']);

  if (error) {
    logger.error('[AutoSegment] Failed to fetch customer orders', error, {
      customerId,
      tenantId,
    });
    return { totalSpend: 0, orderCount: 0, firstOrderDate: null, lastOrderDate: null };
  }

  const orders = data ?? [];
  const totalSpend = orders.reduce((sum, order) => sum + (order.total_amount ?? 0), 0);
  const orderCount = orders.length;

  const orderDates = orders
    .map((order) => new Date(order.created_at))
    .filter((date) => !isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const firstOrderDate = orderDates.length > 0 ? orderDates[0] : null;
  const lastOrderDate = orderDates.length > 0 ? orderDates[orderDates.length - 1] : null;

  return { totalSpend, orderCount, firstOrderDate, lastOrderDate };
}

/**
 * Fetch all customer spend values for VIP threshold calculation
 */
async function fetchVipThreshold(tenantId: string): Promise<number> {
  const { data, error } = await supabase
    .from('unified_orders')
    .select('customer_id, total_amount')
    .eq('tenant_id', tenantId)
    .in('status', ['completed', 'delivered', 'paid']);

  if (error) {
    logger.error('[AutoSegment] Failed to fetch VIP threshold data', error, { tenantId });
    return Infinity;
  }

  // Aggregate spend by customer
  const spendByCustomer = new Map<string, number>();
  for (const order of data ?? []) {
    if (order.customer_id) {
      const current = spendByCustomer.get(order.customer_id) ?? 0;
      spendByCustomer.set(order.customer_id, current + (order.total_amount ?? 0));
    }
  }

  return calculateVipThreshold(Array.from(spendByCustomer.values()));
}

/**
 * Update customer segment in database
 */
async function updateCustomerSegment(
  tenantId: string,
  customerId: string,
  segment: CustomerSegment
): Promise<boolean> {
  const { error } = await supabase
    .from('contacts')
    .update({
      segment,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', customerId);

  if (error) {
    logger.error('[AutoSegment] Failed to update customer segment', error, {
      customerId,
      tenantId,
      segment,
    });
    return false;
  }

  logger.debug('[AutoSegment] Customer segment updated', {
    customerId,
    segment,
  });

  return true;
}

/**
 * Apply segment-specific tag to customer
 */
async function applySegmentTag(
  tenantId: string,
  customerId: string,
  segment: CustomerSegment
): Promise<void> {
  const tagName = SEGMENT_TAGS[segment];

  // First, find or create the tag
  let { data: tag, error: tagError } = await (supabase as any)
    .from('tags')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('name', tagName)
    .maybeSingle();

  if (tagError) {
    logger.error('[AutoSegment] Failed to find segment tag', tagError, { tagName, tenantId });
    return;
  }

  // Create tag if it doesn't exist
  if (!tag) {
    const { data: newTag, error: createError } = await (supabase as any)
      .from('tags')
      .insert({
        tenant_id: tenantId,
        name: tagName,
        color: getSegmentTagColor(segment),
        description: `Auto-applied tag for ${segment} segment customers`,
      })
      .select('id')
      .maybeSingle();

    if (createError) {
      logger.error('[AutoSegment] Failed to create segment tag', createError, { tagName, tenantId });
      return;
    }

    tag = newTag;
  }

  if (!tag) {
    logger.warn('[AutoSegment] Could not get or create segment tag', { tagName, tenantId });
    return;
  }

  // Remove old segment tags first
  const allSegmentTagNames = Object.values(SEGMENT_TAGS);
  const { data: existingTags } = await (supabase as any)
    .from('customer_tags')
    .select('tag_id, tag:tags(name)')
    .eq('tenant_id', tenantId)
    .eq('contact_id', customerId);

  if (existingTags) {
    for (const existing of existingTags) {
      const existingTagName = (existing.tag as unknown as { name: string })?.name;
      if (existingTagName && allSegmentTagNames.includes(existingTagName) && existing.tag_id !== tag.id) {
        await (supabase as any)
          .from('customer_tags')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('contact_id', customerId)
          .eq('tag_id', existing.tag_id);
      }
    }
  }

  // Apply the new segment tag (upsert to avoid duplicates)
  const { error: assignError } = await (supabase as any)
    .from('customer_tags')
    .upsert(
      {
        tenant_id: tenantId,
        contact_id: customerId,
        tag_id: tag.id,
      },
      { onConflict: 'contact_id,tag_id', ignoreDuplicates: true }
    );

  if (assignError) {
    logger.error('[AutoSegment] Failed to apply segment tag', assignError, {
      customerId,
      tagName,
    });
  } else {
    logger.debug('[AutoSegment] Segment tag applied', {
      customerId,
      tagName,
    });
  }
}

/**
 * Get color for segment tag
 */
function getSegmentTagColor(segment: CustomerSegment): string {
  switch (segment) {
    case 'vip':
      return '#F59E0B'; // Amber
    case 'active':
      return '#10B981'; // Emerald
    case 'new':
      return '#3B82F6'; // Blue
    case 'at_risk':
      return '#F97316'; // Orange
    case 'churned':
      return '#EF4444'; // Red
    default:
      return '#6B7280'; // Gray
  }
}

/**
 * Create admin notification for VIP upgrade
 */
async function notifyAdminVipUpgrade(
  tenantId: string,
  customerId: string,
  customerName: string | null,
  totalSpend: number
): Promise<void> {
  const { error } = await (supabase as any).from('notifications').insert({
    tenant_id: tenantId,
    user_id: null, // Notify all admins
    title: 'Customer Upgraded to VIP',
    message: `${customerName ?? 'A customer'} has been upgraded to VIP status with $${totalSpend.toFixed(2)} in total purchases.`,
    type: 'success',
    entity_type: 'customer',
    entity_id: customerId,
    read: false,
  });

  if (error) {
    logger.error('[AutoSegment] Failed to create VIP notification', error, {
      customerId,
      tenantId,
    });
  } else {
    logger.debug('[AutoSegment] VIP upgrade notification created', {
      customerId,
      customerName,
    });
  }
}

/**
 * Publish customer_updated event
 */
function publishCustomerUpdate(
  customerId: string,
  tenantId: string,
  changes: Record<string, unknown>
): void {
  publish('customer_updated', {
    customerId,
    tenantId,
    changes,
  });
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Hook that listens to order_completed events and auto-updates customer segments.
 *
 * @param options - Configuration options
 * @returns Object with ready state and manual recalculation function
 *
 * @example
 * ```tsx
 * // Basic usage - auto-segments customers on order completion
 * const { isReady } = useCustomerAutoSegment();
 *
 * // With callback for segment changes
 * const { isReady } = useCustomerAutoSegment({
 *   onSegmentChange: (change) => {
 *     if (change.isVipUpgrade) {
 *       showConfetti();
 *     }
 *   }
 * });
 *
 * // Manual recalculation
 * const { recalculateSegment } = useCustomerAutoSegment();
 * const change = await recalculateSegment(customerId);
 * ```
 */
export function useCustomerAutoSegment(
  options: UseCustomerAutoSegmentOptions = {}
): UseCustomerAutoSegmentResult {
  const { enabled = true, onSegmentChange } = options;

  const { tenantId, isReady: contextReady } = useTenantContext();
  const mountedRef = useRef(true);
  const onSegmentChangeRef = useRef(onSegmentChange);

  // Update callback ref when it changes
  useEffect(() => {
    onSegmentChangeRef.current = onSegmentChange;
  }, [onSegmentChange]);

  // Track if hook is ready
  const isReady = contextReady && enabled && !!tenantId;

  /**
   * Recalculate segment for a customer
   */
  const recalculateSegment = useCallback(
    async (customerId: string): Promise<SegmentChange | null> => {
      if (!tenantId) {
        logger.warn('[AutoSegment] Cannot recalculate - no tenant context');
        return null;
      }

      logger.debug('[AutoSegment] Recalculating segment', {
        customerId,
        tenantId,
      });

      // Fetch current segment
      const { segment: previousSegment, name: customerName } = await fetchCurrentSegment(
        tenantId,
        customerId
      );

      // Fetch order data
      const { totalSpend, orderCount, firstOrderDate, lastOrderDate } = await fetchCustomerOrders(
        tenantId,
        customerId
      );

      // Fetch VIP threshold
      const vipThreshold = await fetchVipThreshold(tenantId);

      // Calculate new segment
      const newSegment = calculateSegment(firstOrderDate, lastOrderDate, totalSpend, vipThreshold);

      // Build segment change info
      const wasAtRisk = previousSegment === 'at_risk';
      const isVipUpgrade = newSegment === 'vip' && previousSegment !== 'vip';

      const segmentChange: SegmentChange = {
        customerId,
        customerName,
        previousSegment,
        newSegment,
        isVipUpgrade,
        wasAtRisk,
        totalSpend,
        orderCount,
      };

      // Skip if segment hasn't changed
      if (previousSegment === newSegment) {
        logger.debug('[AutoSegment] Segment unchanged', {
          customerId,
          segment: newSegment,
        });
        return segmentChange;
      }

      // Update customer segment in database
      const updated = await updateCustomerSegment(tenantId, customerId, newSegment);

      if (!updated) {
        return null;
      }

      // Apply segment-specific tag
      await applySegmentTag(tenantId, customerId, newSegment);

      // Notify admin if VIP upgrade
      if (isVipUpgrade) {
        await notifyAdminVipUpgrade(tenantId, customerId, customerName, totalSpend);
      }

      // Log at_risk recovery
      if (wasAtRisk && (newSegment === 'active' || newSegment === 'vip')) {
        logger.info('[AutoSegment] At-risk customer recovered', {
          customerId,
          customerName,
          newSegment,
        });
      }

      // Publish customer_updated event
      publishCustomerUpdate(customerId, tenantId, {
        segment: newSegment,
        previousSegment,
        isVipUpgrade,
        wasAtRisk,
      });

      // Call onSegmentChange callback
      if (onSegmentChangeRef.current) {
        onSegmentChangeRef.current(segmentChange);
      }

      logger.debug('[AutoSegment] Segment change complete', {
        customerId,
        previousSegment,
        newSegment,
        isVipUpgrade,
        wasAtRisk,
      });

      return segmentChange;
    },
    [tenantId]
  );

  /**
   * Handle order_completed events
   */
  const handleOrderCompleted = useCallback(
    async (payload: EventPayloads['order_completed']) => {
      if (!mountedRef.current || !tenantId) return;

      // Only process events for our tenant
      if (payload.tenantId !== tenantId) {
        logger.debug('[AutoSegment] Ignoring order_completed from different tenant');
        return;
      }

      logger.debug('[AutoSegment] Processing order_completed event', {
        orderId: payload.orderId,
        customerId: payload.customerId,
      });

      await recalculateSegment(payload.customerId);
    },
    [tenantId, recalculateSegment]
  );

  // Set up event subscription
  useEffect(() => {
    mountedRef.current = true;

    if (!isReady) {
      logger.debug('[AutoSegment] Not ready, skipping subscription', {
        contextReady,
        enabled,
        hasTenantId: !!tenantId,
      });
      return;
    }

    logger.debug('[AutoSegment] Setting up order_completed subscription', {
      tenantId,
    });

    const unsubscribe = subscribe('order_completed', handleOrderCompleted);

    return () => {
      mountedRef.current = false;
      logger.debug('[AutoSegment] Cleaning up subscription');
      unsubscribe();
    };
  }, [isReady, contextReady, enabled, tenantId, handleOrderCompleted]);

  return {
    isReady,
    recalculateSegment,
  };
}

export default useCustomerAutoSegment;
