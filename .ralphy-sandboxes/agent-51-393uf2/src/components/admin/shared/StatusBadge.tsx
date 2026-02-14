import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Supported entity types for status badge styling
 */
export type StatusEntityType = 'order' | 'inventory' | 'customer' | 'delivery' | 'payment' | 'menu';

/**
 * Order status values
 */
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

/**
 * Inventory status values
 */
export type InventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued';

/**
 * Customer status values
 */
export type CustomerStatus = 'active' | 'inactive' | 'vip' | 'suspended' | 'pending_verification';

/**
 * Delivery status values
 */
export type DeliveryStatus = 'pending' | 'assigned' | 'in_transit' | 'delivered' | 'failed' | 'returned';

/**
 * Payment status values
 */
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';

/**
 * Menu status values
 */
export type MenuStatus = 'draft' | 'active' | 'expired' | 'archived';

/**
 * Color configuration for badge styling
 */
interface StatusColorConfig {
  bg: string;
  text: string;
  border?: string;
}

/**
 * Order status color mappings
 */
const ORDER_STATUS_COLORS: Record<OrderStatus, StatusColorConfig> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  processing: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' },
  shipped: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
  delivered: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  refunded: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
};

/**
 * Inventory status color mappings
 */
const INVENTORY_STATUS_COLORS: Record<InventoryStatus, StatusColorConfig> = {
  in_stock: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  low_stock: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  out_of_stock: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  discontinued: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
};

/**
 * Customer status color mappings
 */
const CUSTOMER_STATUS_COLORS: Record<CustomerStatus, StatusColorConfig> = {
  active: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
  vip: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  suspended: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  pending_verification: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
};

/**
 * Delivery status color mappings
 */
const DELIVERY_STATUS_COLORS: Record<DeliveryStatus, StatusColorConfig> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  assigned: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  in_transit: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' },
  delivered: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  failed: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  returned: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
};

/**
 * Payment status color mappings
 */
const PAYMENT_STATUS_COLORS: Record<PaymentStatus, StatusColorConfig> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  completed: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  failed: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  refunded: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
};

/**
 * Menu status color mappings
 */
const MENU_STATUS_COLORS: Record<MenuStatus, StatusColorConfig> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
  active: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  expired: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  archived: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
};

/**
 * Default fallback colors for unknown statuses
 */
const DEFAULT_STATUS_COLORS: StatusColorConfig = {
  bg: 'bg-gray-100',
  text: 'text-gray-800',
  border: 'border-gray-200',
};

/**
 * Get color configuration based on entity type and status
 */
function getStatusColors(status: string, entityType: StatusEntityType): StatusColorConfig {
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '_');

  switch (entityType) {
    case 'order':
      return ORDER_STATUS_COLORS[normalizedStatus as OrderStatus] ?? DEFAULT_STATUS_COLORS;
    case 'inventory':
      return INVENTORY_STATUS_COLORS[normalizedStatus as InventoryStatus] ?? DEFAULT_STATUS_COLORS;
    case 'customer':
      return CUSTOMER_STATUS_COLORS[normalizedStatus as CustomerStatus] ?? DEFAULT_STATUS_COLORS;
    case 'delivery':
      return DELIVERY_STATUS_COLORS[normalizedStatus as DeliveryStatus] ?? DEFAULT_STATUS_COLORS;
    case 'payment':
      return PAYMENT_STATUS_COLORS[normalizedStatus as PaymentStatus] ?? DEFAULT_STATUS_COLORS;
    case 'menu':
      return MENU_STATUS_COLORS[normalizedStatus as MenuStatus] ?? DEFAULT_STATUS_COLORS;
    default:
      return DEFAULT_STATUS_COLORS;
  }
}

/**
 * Format status string for display (e.g., "in_stock" -> "In Stock")
 */
function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

interface StatusBadgeProps {
  /** The status value to display */
  status: string;
  /** The entity type for determining color scheme */
  entityType: StatusEntityType;
  /** Optional custom label override */
  label?: string;
  /** Optional size variant */
  size?: 'sm' | 'default' | 'lg';
  /** Additional className for custom styling */
  className?: string;
}

/**
 * StatusBadge - Renders colored badges for any entity status
 *
 * A reusable component that displays status badges with consistent color coding
 * based on entity type. Supports orders, inventory, customers, deliveries,
 * payments, and menus.
 *
 * Usage:
 * ```tsx
 * // Order status
 * <StatusBadge status="pending" entityType="order" />
 *
 * // Inventory status
 * <StatusBadge status="low_stock" entityType="inventory" />
 *
 * // Customer status with custom label
 * <StatusBadge status="vip" entityType="customer" label="VIP Customer" />
 * ```
 */
export function StatusBadge({
  status,
  entityType,
  label,
  size = 'default',
  className,
}: StatusBadgeProps) {
  const colors = getStatusColors(status, entityType);
  const displayLabel = label ?? formatStatusLabel(status);

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    default: 'px-2.5 py-0.5 text-xs',
    lg: 'px-3 py-1 text-sm',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        colors.bg,
        colors.text,
        colors.border,
        sizeClasses[size],
        'font-medium',
        className
      )}
    >
      {displayLabel}
    </Badge>
  );
}

/**
 * Export color mappings for use in other components
 */
export {
  ORDER_STATUS_COLORS,
  INVENTORY_STATUS_COLORS,
  CUSTOMER_STATUS_COLORS,
  DELIVERY_STATUS_COLORS,
  PAYMENT_STATUS_COLORS,
  MENU_STATUS_COLORS,
  getStatusColors,
  formatStatusLabel,
};
