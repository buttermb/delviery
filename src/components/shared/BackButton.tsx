/**
 * BackButton Component
 * Consistent back navigation for detail pages
 *
 * Uses router navigation (not browser history) for predictable behavior.
 * Integrates with SwipeBackWrapper for mobile swipe-back support.
 */

import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BackButtonProps {
  /** Click handler - should use navigateToAdmin or navigate to specific route */
  onClick: () => void;
  /** Button label (default: "Back") */
  label?: string;
  /** Show label text (default: true on desktop, false on mobile via responsive classes) */
  showLabel?: boolean;
  /** Additional className */
  className?: string;
  /** Compact mode - icon only */
  iconOnly?: boolean;
}

/**
 * BackButton - Consistent back navigation component
 *
 * @example
 * // With tenant navigation (recommended for admin routes)
 * const { navigateToAdmin } = useTenantNavigation();
 * <BackButton onClick={() => navigateToAdmin('orders')} label="Back to Orders" />
 *
 * @example
 * // Icon only mode
 * <BackButton onClick={() => navigateToAdmin('products')} iconOnly />
 */
export function BackButton({
  onClick,
  label = 'Back',
  showLabel = true,
  className,
  iconOnly = false,
}: BackButtonProps) {
  if (iconOnly) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
        className={cn('shrink-0', className)}
        aria-label={label}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        '-ml-2 text-muted-foreground hover:text-foreground',
        className
      )}
    >
      <ArrowLeft className="h-4 w-4 mr-1" />
      {showLabel && <span className={cn(!showLabel && 'sr-only')}>{label}</span>}
    </Button>
  );
}
