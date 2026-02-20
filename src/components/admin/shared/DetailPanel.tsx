/**
 * Shared Admin Detail Panel Component
 *
 * A slide-over panel for quick-viewing any entity without navigating away.
 * Supports customizable actions (Edit, Delete, View Full Page) and shows
 * related entities section at the bottom.
 *
 * Features:
 * - Slide-in from right with CSS transitions
 * - Configurable action buttons in header
 * - Related entities section for cross-module navigation
 * - Keyboard support (Escape to close)
 * - Proper focus management and accessibility
 *
 * Usage:
 * ```tsx
 * <DetailPanel
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Order Details"
 *   entityType="ORDER"
 *   entityId={orderId}
 *   actions={[
 *     { label: 'Edit', icon: Pencil, onClick: handleEdit },
 *     { label: 'Delete', icon: Trash2, onClick: handleDelete, variant: 'destructive' },
 *     { label: 'View Full Page', icon: ExternalLink, onClick: handleViewFull },
 *   ]}
 * >
 *   <OrderDetailContent order={order} />
 * </DetailPanel>
 * ```
 */

import { useEffect, useCallback, useRef, ReactNode } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { EntityType, ENTITY_LABELS, getEntityIconName } from '@/lib/constants/entityTypes';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { getFocusableElements } from '@/hooks/useKeyboardNavigation';

/**
 * Action configuration for the detail panel
 */
export interface DetailPanelAction {
  /** Display label for the action */
  label: string;
  /** Lucide-react icon component */
  icon?: LucideIcon;
  /** Click handler */
  onClick: () => void;
  /** Button variant */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  /** Disable the action */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
}

/**
 * Related entity item for the related entities section
 */
export interface RelatedEntity {
  /** Entity type for icon and navigation */
  entityType: EntityType;
  /** Entity ID for navigation */
  entityId: string;
  /** Display label (e.g., "Order #1234", "John Doe") */
  label: string;
  /** Optional subtitle (e.g., "Pending", "$150.00") */
  subtitle?: string;
  /** Click handler for navigation */
  onClick?: () => void;
}

interface DetailPanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Callback when the panel should close */
  onClose: () => void;
  /** Panel title */
  title: string;
  /** Entity type for contextual styling */
  entityType?: EntityType;
  /** Entity ID for reference */
  entityId?: string;
  /** Array of action button configurations */
  actions?: DetailPanelAction[];
  /** Related entities to display at the bottom */
  relatedEntities?: RelatedEntity[];
  /** Related entities loading state */
  relatedEntitiesLoading?: boolean;
  /** Panel content */
  children: ReactNode;
  /** Loading state for the panel content */
  loading?: boolean;
  /** Additional className for the panel */
  className?: string;
  /** Width of the panel */
  width?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Width variants for the panel
 */
const widthVariants = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
} as const;

/**
 * Related Entity Item Component
 */
function RelatedEntityItem({ entity }: { entity: RelatedEntity }) {
  const iconName = getEntityIconName(entity.entityType);
  const entityLabel = ENTITY_LABELS[entity.entityType];

  return (
    <button
      type="button"
      onClick={entity.onClick}
      className={cn(
        'flex items-start gap-3 w-full p-3 rounded-lg text-left',
        'hover:bg-muted/50 transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        entity.onClick ? 'cursor-pointer' : 'cursor-default'
      )}
      disabled={!entity.onClick}
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-md bg-muted flex items-center justify-center">
        <span className="text-xs font-medium text-muted-foreground">
          {iconName.charAt(0)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{entityLabel}</span>
        </div>
        <p className="text-sm font-medium truncate">{entity.label}</p>
        {entity.subtitle && (
          <p className="text-xs text-muted-foreground truncate">{entity.subtitle}</p>
        )}
      </div>
    </button>
  );
}

/**
 * Related Entities Section Component
 */
function RelatedEntitiesSection({
  entities,
  loading,
}: {
  entities: RelatedEntity[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="p-4">
        <h3 className="text-sm font-semibold mb-3">Related</h3>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  if (entities.length === 0) {
    return null;
  }

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold mb-3">Related</h3>
      <div className="space-y-1">
        {entities.map((entity, index) => (
          <RelatedEntityItem
            key={`${entity.entityType}-${entity.entityId}-${index}`}
            entity={entity}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Shared Admin Detail Panel Component
 */
export function DetailPanel({
  isOpen,
  onClose,
  title,
  entityType,
  entityId,
  actions = [],
  relatedEntities = [],
  relatedEntitiesLoading = false,
  children,
  loading = false,
  className,
  width = 'md',
}: DetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // Focus management: auto-focus on open, restore on close
  useEffect(() => {
    if (isOpen) {
      // Store currently focused element for restoration on close
      previousActiveElement.current = document.activeElement;

      // Focus first focusable element in panel after transition
      requestAnimationFrame(() => {
        if (panelRef.current) {
          const focusable = getFocusableElements(panelRef.current);
          if (focusable.length > 0) {
            focusable[0].focus();
          }
        }
      });
    } else if (previousActiveElement.current instanceof HTMLElement) {
      // Restore focus to the element that triggered the panel
      previousActiveElement.current.focus();
      previousActiveElement.current = null;
    }
  }, [isOpen]);

  // Keyboard handler: Escape to close + Tab focus trap
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key === 'Tab' && panelRef.current) {
        const focusable = getFocusableElements(panelRef.current);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey) {
          // Shift+Tab on first element → wrap to last
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else {
          // Tab on last element → wrap to first
          if (document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    },
    [onClose]
  );

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Get entity context for accessibility
  const entityContext = entityType
    ? `${ENTITY_LABELS[entityType]}${entityId ? ` ${entityId}` : ''}`
    : undefined;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/50 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={entityContext ? `${title} - ${entityContext}` : title}
        onKeyDown={handleKeyDown}
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex flex-col bg-background shadow-xl',
          'w-full border-l',
          widthVariants[width],
          'transform transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">{title}</h2>
            {entityType && (
              <p className="text-sm text-muted-foreground">
                {ENTITY_LABELS[entityType]}
                {entityId && <span className="ml-1">#{entityId.slice(0, 8)}</span>}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {actions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={`action-${index}-${action.label}`}
                  variant={action.variant ?? 'outline'}
                  size="sm"
                  onClick={action.onClick}
                  disabled={action.disabled || action.loading}
                >
                  {action.loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : Icon ? (
                    <Icon className="h-4 w-4 mr-1" />
                  ) : null}
                  {action.label}
                </Button>
              );
            })}

            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="flex-shrink-0"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <div className="p-6">{children}</div>
          )}

          {/* Related Entities Section */}
          {(relatedEntities.length > 0 || relatedEntitiesLoading) && (
            <>
              <Separator />
              <RelatedEntitiesSection
                entities={relatedEntities}
                loading={relatedEntitiesLoading}
              />
            </>
          )}
        </ScrollArea>
      </div>
    </>
  );
}

export default DetailPanel;
