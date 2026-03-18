import { LucideIcon } from 'lucide-react';

import { EntityType, ENTITY_LABELS } from '@/lib/constants/entityTypes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Contextual CTA labels based on entity type
 */
const ENTITY_CTA_LABELS: Record<EntityType, string> = {
  ORDER: 'Create your first order',
  PRODUCT: 'Add a product',
  CUSTOMER: 'Add your first customer',
  VENDOR: 'Add a vendor',
  MENU: 'Create a menu',
  DELIVERY: 'Schedule a delivery',
  PAYMENT: 'Record a payment',
  INVENTORY: 'Add inventory',
  STOREFRONT: 'Set up your storefront',
};

interface EmptyStateProps {
  /** Lucide-react icon to display */
  icon: LucideIcon;
  /** Main title text */
  title: string;
  /** Description text below the title */
  description: string;
  /** Label for the action button */
  actionLabel?: string;
  /** Callback when action button is clicked */
  onAction?: () => void;
  /** Entity type for contextual CTA - when provided, shows entity-specific action text */
  entityType?: EntityType;
  /** Additional className for the container */
  className?: string;
}

/**
 * EmptyState - Reusable empty state component for admin modules
 *
 * Displays a friendly empty state with icon, title, description, and optional action.
 * When entityType is provided, shows contextual CTA like "Create your first order".
 *
 * Usage:
 * ```tsx
 * // Basic usage
 * <EmptyState
 *   icon={Package}
 *   title="No products found"
 *   description="Get started by adding your first product."
 *   actionLabel="Add Product"
 *   onAction={() => navigate('/admin/products/new')}
 * />
 *
 * // With entity type for contextual CTA
 * <EmptyState
 *   icon={FileText}
 *   title="No orders yet"
 *   description="Orders will appear here once customers start placing them."
 *   entityType="ORDER"
 *   onAction={() => navigate('/admin/orders/new')}
 * />
 * ```
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  entityType,
  className,
}: EmptyStateProps) {
  // Determine the action button label
  const buttonLabel = actionLabel ?? (entityType ? ENTITY_CTA_LABELS[entityType] : undefined);

  // Get entity display name for accessibility
  const entityDisplayName = entityType ? ENTITY_LABELS[entityType].toLowerCase() : undefined;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
      role="status"
      aria-label={entityType ? `No ${entityDisplayName}s found` : title}
    >
      {/* Icon container */}
      <div
        className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4"
        aria-hidden="true"
      >
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>

      {/* Text content */}
      <div className="space-y-2 max-w-sm">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {/* Action button */}
      {buttonLabel && onAction && (
        <Button onClick={onAction} className="mt-6">
          {buttonLabel}
        </Button>
      )}
    </div>
  );
}
