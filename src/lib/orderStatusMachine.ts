/**
 * Order Status State Machine
 * Defines valid order status transitions based on business rules
 */

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'preparing'
  | 'ready'
  | 'ready_for_pickup'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'rejected';

/**
 * Valid transitions from each status
 * Key: current status, Value: array of allowed next statuses
 */
const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled', 'rejected'],
  confirmed: ['processing', 'preparing', 'cancelled'],
  processing: ['preparing', 'ready', 'cancelled'],
  preparing: ['ready', 'ready_for_pickup', 'cancelled'],
  ready: ['in_transit', 'out_for_delivery', 'ready_for_pickup', 'completed', 'cancelled'],
  ready_for_pickup: ['completed', 'delivered', 'cancelled'],
  in_transit: ['delivered', 'out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: ['completed', 'refunded'],
  completed: ['refunded'],
  cancelled: [], // Terminal state
  refunded: [], // Terminal state
  rejected: [], // Terminal state
};

/**
 * Check if a status transition is valid
 */
export function isValidTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus
): boolean {
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
}

/**
 * Get all valid next statuses for a given status
 */
export function getValidNextStatuses(currentStatus: OrderStatus): OrderStatus[] {
  return STATUS_TRANSITIONS[currentStatus] || [];
}

/**
 * Check if a status is terminal (no further transitions)
 */
export function isTerminalStatus(status: OrderStatus): boolean {
  return STATUS_TRANSITIONS[status]?.length === 0;
}

/**
 * Get user-friendly status label
 */
export function getStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    processing: 'Processing',
    preparing: 'Preparing',
    ready: 'Ready',
    ready_for_pickup: 'Ready for Pickup',
    in_transit: 'In Transit',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    completed: 'Completed',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
    rejected: 'Rejected',
  };
  return labels[status] || status;
}
