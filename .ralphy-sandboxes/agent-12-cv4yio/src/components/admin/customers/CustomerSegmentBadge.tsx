/**
 * Customer Segment Badge Component
 *
 * Displays a badge showing the customer's segment (VIP, Active, New, At Risk, Churned).
 * Used in customer lists and detail pages.
 *
 * Features:
 * - Color-coded by segment
 * - Optional icon
 * - Tooltip with segment description
 * - Size variants
 */

import React from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  type CustomerSegment,
  getSegmentLabel,
  getSegmentColorClasses,
  getSegmentDescription,
} from '@/hooks/useCustomerSegments';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import Crown from 'lucide-react/dist/esm/icons/crown';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import UserX from 'lucide-react/dist/esm/icons/user-x';

// ============================================================================
// Types
// ============================================================================

export interface CustomerSegmentBadgeProps {
  /** The customer segment to display */
  segment: CustomerSegment;
  /** Whether to show the icon */
  showIcon?: boolean;
  /** Whether to show the tooltip with description */
  showTooltip?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the icon component for a segment.
 */
function getSegmentIconComponent(segment: CustomerSegment): React.ElementType {
  switch (segment) {
    case 'vip':
      return Crown;
    case 'active':
      return CheckCircle;
    case 'new':
      return Sparkles;
    case 'at_risk':
      return AlertTriangle;
    case 'churned':
      return UserX;
    default:
      return CheckCircle;
  }
}

/**
 * Get size classes for the badge.
 */
function getSizeClasses(size: 'sm' | 'md' | 'lg'): string {
  switch (size) {
    case 'sm':
      return 'px-1.5 py-0.5 text-xs';
    case 'lg':
      return 'px-3 py-1 text-sm';
    case 'md':
    default:
      return 'px-2.5 py-0.5 text-xs';
  }
}

/**
 * Get icon size classes.
 */
function getIconSizeClasses(size: 'sm' | 'md' | 'lg'): string {
  switch (size) {
    case 'sm':
      return 'w-3 h-3';
    case 'lg':
      return 'w-4 h-4';
    case 'md':
    default:
      return 'w-3.5 h-3.5';
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * Badge component for displaying customer segments.
 */
const CustomerSegmentBadge: React.FC<CustomerSegmentBadgeProps> = ({
  segment,
  showIcon = true,
  showTooltip = true,
  size = 'md',
  className,
}) => {
  const label = getSegmentLabel(segment);
  const colorClasses = getSegmentColorClasses(segment);
  const description = getSegmentDescription(segment);
  const IconComponent = getSegmentIconComponent(segment);
  const sizeClasses = getSizeClasses(size);
  const iconSizeClasses = getIconSizeClasses(size);

  const badgeContent = (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1 font-medium border',
        colorClasses,
        sizeClasses,
        className
      )}
    >
      {showIcon && <IconComponent className={iconSizeClasses} />}
      {label}
    </Badge>
  );

  if (!showTooltip) {
    return badgeContent;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

CustomerSegmentBadge.displayName = 'CustomerSegmentBadge';

export default React.memo(CustomerSegmentBadge);

// ============================================================================
// Segment Counts Display Component
// ============================================================================

export interface SegmentCountsDisplayProps {
  counts: {
    new: number;
    active: number;
    at_risk: number;
    churned: number;
    vip: number;
    total: number;
  };
  /** Segment to highlight (e.g., when filtering) */
  activeSegment?: CustomerSegment;
  /** Callback when a segment is clicked */
  onSegmentClick?: (segment: CustomerSegment) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class names */
  className?: string;
}

/**
 * Component to display segment counts as clickable badges.
 * Useful for dashboard widgets and filter controls.
 */
export const SegmentCountsDisplay: React.FC<SegmentCountsDisplayProps> = ({
  counts,
  activeSegment,
  onSegmentClick,
  size = 'md',
  className,
}) => {
  const segments: CustomerSegment[] = ['vip', 'active', 'new', 'at_risk', 'churned'];

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {segments.map((segment) => {
        const count = counts[segment];
        const isActive = activeSegment === segment;

        return (
          <button
            key={segment}
            type="button"
            onClick={() => onSegmentClick?.(segment)}
            className={cn(
              'transition-all',
              onSegmentClick && 'cursor-pointer hover:scale-105',
              isActive && 'ring-2 ring-offset-2 ring-primary rounded-full'
            )}
            disabled={!onSegmentClick}
          >
            <CustomerSegmentBadge
              segment={segment}
              size={size}
              showTooltip
              className={cn(
                'tabular-nums',
                !onSegmentClick && 'cursor-default'
              )}
            />
            <span
              className={cn(
                'ml-1 text-xs font-medium tabular-nums',
                getSegmentColorClasses(segment).split(' ')[1] // Get the text color
              )}
            >
              ({count})
            </span>
          </button>
        );
      })}
    </div>
  );
};

SegmentCountsDisplay.displayName = 'SegmentCountsDisplay';
