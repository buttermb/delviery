import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { isOrderEditable, canCancelOrder, getEditRestrictionMessage } from '@/lib/utils/orderEditability';

export type WholesaleOrderStatus = 'pending' | 'confirmed' | 'ready' | 'shipped' | 'delivered' | 'cancelled';

/**
 * Valid status transitions for wholesale orders
 * - pending: Initial state when order is created
 * - confirmed: Order confirmed by admin, inventory reserved
 * - ready: Order packed and ready for pickup/delivery
 * - shipped: Order dispatched with runner
 * - delivered: Order successfully delivered
 * - cancelled: Order cancelled (terminal state)
 */
const VALID_TRANSITIONS: Record<WholesaleOrderStatus, WholesaleOrderStatus[]> = {
  'pending': ['confirmed', 'cancelled'],
  'confirmed': ['ready', 'cancelled'],
  'ready': ['shipped', 'cancelled'],
  'shipped': ['delivered', 'cancelled'],
  'delivered': [], // Terminal state - no transitions allowed
  'cancelled': []  // Terminal state - no transitions allowed
};

/**
 * Human-readable status labels
 */
export const STATUS_LABELS: Record<WholesaleOrderStatus, string> = {
  'pending': 'Pending',
  'confirmed': 'Confirmed',
  'ready': 'Ready for Pickup',
  'shipped': 'Shipped',
  'delivered': 'Delivered',
  'cancelled': 'Cancelled'
};

/**
 * Status colors for UI
 */
export const STATUS_COLORS: Record<WholesaleOrderStatus, string> = {
  'pending': 'bg-yellow-100 text-yellow-800',
  'confirmed': 'bg-blue-100 text-blue-800',
  'ready': 'bg-purple-100 text-purple-800',
  'shipped': 'bg-orange-100 text-orange-800',
  'delivered': 'bg-green-100 text-green-800',
  'cancelled': 'bg-red-100 text-red-800'
};

export const wholesaleOrderFlowManager = {
  /**
   * Check if a status transition is valid
   */
  canTransition(currentStatus: WholesaleOrderStatus, newStatus: WholesaleOrderStatus): boolean {
    return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
  },

  /**
   * Get all valid next statuses from current status
   */
  getNextStatuses(currentStatus: WholesaleOrderStatus): WholesaleOrderStatus[] {
    return VALID_TRANSITIONS[currentStatus] ?? [];
  },

  /**
   * Check if status is terminal (no further transitions)
   */
  isTerminal(status: WholesaleOrderStatus): boolean {
    return VALID_TRANSITIONS[status]?.length === 0;
  },

  /**
   * Transition an order to a new status with validation
   */
  async transitionOrderStatus(
    orderId: string,
    newStatus: WholesaleOrderStatus,
    options?: {
      skipInventoryUpdate?: boolean;
      notes?: string;
      tenantId?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Fetch current status
      let query = supabase
        .from('wholesale_orders')
        .select('status, client_id, total_amount')
        .eq('id', orderId);

      if (options?.tenantId) {
        query = query.eq('tenant_id', options.tenantId);
      }

      const { data: order, error: fetchError } = await query.maybeSingle();

      if (fetchError) {
        logger.error('Failed to fetch order for status transition', fetchError);
        return { success: false, error: 'Order not found' };
      }

      const currentStatus = order.status as WholesaleOrderStatus;

      // Check editability restrictions
      if (newStatus !== 'cancelled' && !this.canEdit(currentStatus)) {
        const restriction = this.getEditRestriction(currentStatus);
        logger.warn(`Edit blocked: ${restriction}`, { orderId, currentStatus, newStatus });
        return { success: false, error: restriction || 'Order cannot be edited' };
      }

      // For cancellation, check if it's allowed
      if (newStatus === 'cancelled' && !this.canCancel(currentStatus)) {
        return { success: false, error: `Cannot cancel order in ${STATUS_LABELS[currentStatus]} status` };
      }

      // Validate transition
      if (!this.canTransition(currentStatus, newStatus)) {
        const errorMsg = `Invalid status transition from ${STATUS_LABELS[currentStatus]} to ${STATUS_LABELS[newStatus]}`;
        logger.warn(errorMsg, { orderId, currentStatus, newStatus });
        return { success: false, error: errorMsg };
      }

      // Prepare update data
      const updateData: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      // Add timestamp fields based on new status
      if (newStatus === 'confirmed') {
        updateData.confirmed_at = new Date().toISOString();
      } else if (newStatus === 'shipped') {
        updateData.shipped_at = new Date().toISOString();
      } else if (newStatus === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
      } else if (newStatus === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
      }

      // Update status
      let updateQuery = supabase
        .from('wholesale_orders')
        .update(updateData)
        .eq('id', orderId);

      if (options?.tenantId) {
        updateQuery = updateQuery.eq('tenant_id', options.tenantId);
      }

      const { error: updateError } = await updateQuery;

      if (updateError) {
        logger.error('Failed to update order status', updateError);
        return { success: false, error: 'Failed to update order status' };
      }

      // Handle stock operations (non-blocking)
      if (!options?.skipInventoryUpdate) {
        this.handleStockOnStatusChange(orderId, newStatus, currentStatus);
      }

      logger.info(`Wholesale order ${orderId} transitioned from ${currentStatus} to ${newStatus}`);
      return { success: true };
    } catch (error) {
      logger.error('Error transitioning wholesale order status', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  },

  /**
   * Get status badge class for UI
   */
  getStatusBadgeClass(status: WholesaleOrderStatus): string {
    return STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800';
  },

  /**
   * Get human-readable status label
   */
  getStatusLabel(status: WholesaleOrderStatus): string {
    return STATUS_LABELS[status] ?? status;
  },

  /**
   * Check if order can be edited (uses orderEditability utility)
   */
  canEdit(status: WholesaleOrderStatus): boolean {
    return isOrderEditable(status);
  },

  /**
   * Check if order can be cancelled
   */
  canCancel(status: WholesaleOrderStatus): boolean {
    return canCancelOrder(status);
  },

  /**
   * Get restriction message for why order cannot be edited
   */
  getEditRestriction(status: WholesaleOrderStatus): string | null {
    return getEditRestrictionMessage(status);
  },

  /**
   * Get list of query keys to invalidate after status change
   */
  getInvalidationKeys(): string[][] {
    return [
      ['pipeline-orders'],
      ['orders'],
      ['products'],
      ['wholesale-inventory'],
      ['dashboard-stats'],
      ['wholesale-clients']
    ];
  },

  /**
   * Handle stock operations during status transitions
   * Calls RPC functions to reserve/release/commit stock based on status
   * Note: wholesale_order_items uses product_name - we look up product_id from products table
   */
  async handleStockOnStatusChange(
    orderId: string,
    newStatus: WholesaleOrderStatus,
    oldStatus: WholesaleOrderStatus
  ): Promise<void> {
    try {
      // Fetch order items
      const { data: items } = await supabase
        .from('wholesale_order_items')
        .select('product_name, quantity')
        .eq('order_id', orderId);

      if (!items || items.length === 0) return;

      // Look up product IDs by name for stock operations
      const productNames = items.map(i => i.product_name).filter(Boolean);
      const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .in('name', productNames);

      const productMap = new Map(products?.map(p => [p.name, p.id]) || []);

      // Reserve stock when confirmed
      if (newStatus === 'confirmed' && oldStatus === 'pending') {
        for (const item of items) {
          const productId = productMap.get(item.product_name);
          if (productId) {
            const { data: success, error } = await supabase.rpc('reserve_inventory_for_order', {
              p_product_id: productId,
              p_quantity: item.quantity || 1,
            });
            if (error) {
              logger.error(`Failed to reserve stock for ${item.product_name}`, error);
            } else if (!success) {
              logger.warn(`Insufficient stock for ${item.product_name}`);
            }
          }
        }
        logger.info(`Order ${orderId} confirmed - stock reserved`);
      }
      // Commit stock when delivered
      else if (newStatus === 'delivered') {
        for (const item of items) {
          const productId = productMap.get(item.product_name);
          if (productId) {
            await supabase.rpc('commit_reserved_inventory', {
              p_product_id: productId,
              p_quantity: item.quantity || 1,
            });
          }
        }
        logger.info(`Order ${orderId} delivered - stock committed`);
      }
      // Release stock when cancelled
      else if (newStatus === 'cancelled' && ['confirmed', 'ready', 'shipped'].includes(oldStatus)) {
        for (const item of items) {
          const productId = productMap.get(item.product_name);
          if (productId) {
            await supabase.rpc('release_reserved_inventory', {
              p_product_id: productId,
              p_quantity: item.quantity || 1,
            });
          }
        }
        logger.info(`Order ${orderId} cancelled - stock released`);
      }
    } catch (error) {
      logger.error(`Failed to handle stock for order ${orderId}`, error);
    }
  }
};
