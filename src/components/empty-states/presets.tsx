/**
 * Domain-Specific Empty State Presets
 *
 * Preconfigured empty states for common entities/pages in FloraIQ.
 * Each preset provides a sensible icon, title, and description that can be
 * overridden via props. Use these instead of writing ad-hoc empty states.
 *
 * @example
 * ```tsx
 * import { OrdersEmptyState } from '@/components/empty-states';
 *
 * <OrdersEmptyState
 *   onAction={() => navigate(`/${tenantSlug}/admin/orders/new`)}
 * />
 * ```
 */

import {
  Package,
  FileText,
  Users,
  Building2,
  Menu,
  Truck,
  CreditCard,
  Warehouse,
  Store,
  Search,
  BarChart3,
  Bell,
  CalendarDays,
  MessageSquare,
  ShieldCheck,
  ClipboardList,
  Receipt,
  Tags,
  MapPin,
  Car,
  type LucideIcon,
} from 'lucide-react';

import { EmptyState, type EmptyStateProps } from '@/components/ui/empty-state';

// ---------------------------------------------------------------------------
// Shared helper
// ---------------------------------------------------------------------------

interface PresetProps {
  /** Override the default title */
  title?: string;
  /** Override the default description */
  description?: string;
  /** Override the default icon */
  icon?: LucideIcon;
  /** Primary action label (shorthand) */
  actionLabel?: string;
  /** Primary action callback (shorthand) */
  onAction?: () => void;
  /** Full action config (overrides actionLabel/onAction) */
  action?: EmptyStateProps['action'];
  /** Secondary action config */
  secondaryAction?: EmptyStateProps['secondaryAction'];
  /** Visual variant */
  variant?: EmptyStateProps['variant'];
  /** Additional className */
  className?: string;
}

function createPreset(
  defaults: { icon: LucideIcon; title: string; description: string },
  props: PresetProps
) {
  const {
    title = defaults.title,
    description = defaults.description,
    icon = defaults.icon,
    actionLabel,
    onAction,
    action,
    secondaryAction,
    variant,
    className,
  } = props;

  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      action={action}
      actionLabel={actionLabel}
      onAction={onAction}
      secondaryAction={secondaryAction}
      variant={variant}
      className={className}
    />
  );
}

// ---------------------------------------------------------------------------
// Entity Presets
// ---------------------------------------------------------------------------

/** Empty state for order lists / dashboards */
export function OrdersEmptyState(props: PresetProps) {
  return createPreset(
    {
      icon: FileText,
      title: 'No orders yet',
      description:
        'Orders will appear here once customers start placing them.',
    },
    props
  );
}

/** Empty state for product lists / catalogs */
export function ProductsEmptyState(props: PresetProps) {
  return createPreset(
    {
      icon: Package,
      title: 'No products',
      description:
        'Add products to start building your catalog and receiving orders.',
    },
    props
  );
}

/** Empty state for customer lists */
export function CustomersEmptyState(props: PresetProps) {
  return createPreset(
    {
      icon: Users,
      title: 'No customers',
      description:
        'Customers will appear here once they register or place orders.',
    },
    props
  );
}

/** Empty state for vendor lists */
export function VendorsEmptyState(props: PresetProps) {
  return createPreset(
    {
      icon: Building2,
      title: 'No vendors yet',
      description:
        'Add vendors to manage your supply chain and track purchases.',
    },
    props
  );
}

/** Empty state for menu lists */
export function MenusEmptyState(props: PresetProps) {
  return createPreset(
    {
      icon: Menu,
      title: 'No menus available',
      description:
        'Create menus to organize your products for customers.',
    },
    props
  );
}

/** Empty state for delivery lists */
export function DeliveriesEmptyState(props: PresetProps) {
  return createPreset(
    {
      icon: Truck,
      title: 'No deliveries yet',
      description:
        'Deliveries will appear here once orders are dispatched.',
    },
    props
  );
}

/** Empty state for payment lists */
export function PaymentsEmptyState(props: PresetProps) {
  return createPreset(
    {
      icon: CreditCard,
      title: 'No payments recorded',
      description:
        'Payment records will appear here as transactions are processed.',
    },
    props
  );
}

/** Empty state for inventory pages */
export function InventoryEmptyState(props: PresetProps) {
  return createPreset(
    {
      icon: Warehouse,
      title: 'No inventory',
      description:
        'Add products and stock to start tracking your inventory.',
    },
    props
  );
}

/** Empty state for storefront pages */
export function StorefrontEmptyState(props: PresetProps) {
  return createPreset(
    {
      icon: Store,
      title: 'No storefront configured',
      description:
        'Set up your storefront to start selling to customers online.',
    },
    props
  );
}

// ---------------------------------------------------------------------------
// Functional Presets
// ---------------------------------------------------------------------------

/** Empty state for search results with no matches */
export function SearchEmptyState(props: PresetProps) {
  return createPreset(
    {
      icon: Search,
      title: 'No results found',
      description:
        'Try adjusting your search terms or filters to find what you\'re looking for.',
    },
    props
  );
}

/** Empty state for analytics / reporting */
export function AnalyticsEmptyState(props: PresetProps) {
  return createPreset(
    {
      icon: BarChart3,
      title: 'No analytics data yet',
      description:
        'Analytics will populate once you start processing orders.',
    },
    props
  );
}

/** Empty state for notifications */
export function NotificationsEmptyState(props: PresetProps) {
  return createPreset(
    {
      icon: Bell,
      title: 'No notifications',
      description:
        'You\'re all caught up. New notifications will appear here.',
    },
    props
  );
}

/** Empty state for scheduled events / appointments */
export function ScheduleEmptyState(props: PresetProps) {
  return createPreset(
    {
      icon: CalendarDays,
      title: 'No scheduled events',
      description:
        'Schedule events to see them on your calendar.',
    },
    props
  );
}

/** Empty state for comments / messages */
export function CommentsEmptyState(props: PresetProps) {
  return createPreset(
    {
      icon: MessageSquare,
      title: 'No comments yet',
      description:
        'Be the first to leave a comment.',
    },
    props
  );
}

/** Empty state for compliance / audit */
export function ComplianceEmptyState(props: PresetProps) {
  return createPreset(
    {
      icon: ShieldCheck,
      title: 'No compliance records',
      description:
        'Compliance records will be logged as checks are performed.',
    },
    props
  );
}

/** Empty state for support tickets */
export function TicketsEmptyState(props: PresetProps) {
  return createPreset(
    {
      icon: ClipboardList,
      title: 'No support tickets',
      description:
        'Support tickets will appear here when they are created.',
    },
    props
  );
}

/** Empty state for invoices */
export function InvoicesEmptyState(props: PresetProps) {
  return createPreset(
    {
      icon: Receipt,
      title: 'No invoices',
      description:
        'Invoices will appear here as they are generated.',
    },
    props
  );
}

/** Empty state for coupons / promotions */
export function CouponsEmptyState(props: PresetProps) {
  return createPreset(
    {
      icon: Tags,
      title: 'No coupons',
      description:
        'Create coupons to offer discounts to your customers.',
    },
    props
  );
}

/** Empty state for locations */
export function LocationsEmptyState(props: PresetProps) {
  return createPreset(
    {
      icon: MapPin,
      title: 'No locations',
      description:
        'Add locations to manage inventory across multiple sites.',
    },
    props
  );
}

/** Empty state for drivers / fleet */
export function DriversEmptyState(props: PresetProps) {
  return createPreset(
    {
      icon: Car,
      title: 'No drivers yet',
      description:
        'Add drivers to manage deliveries and track your fleet.',
    },
    props
  );
}

// ---------------------------------------------------------------------------
// Generic / Catch-all
// ---------------------------------------------------------------------------

/** Generic empty state when no domain-specific preset fits */
export function GenericEmptyState(props: PresetProps) {
  return createPreset(
    {
      icon: Package,
      title: 'Nothing here yet',
      description:
        'Data will appear here once it becomes available.',
    },
    props
  );
}

// ---------------------------------------------------------------------------
// Export type for consumers
// ---------------------------------------------------------------------------

export type { PresetProps as EmptyStatePresetProps };
