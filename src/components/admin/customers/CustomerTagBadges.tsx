/**
 * CustomerTagBadges Component
 *
 * Displays assigned tags for a customer as color-coded badges.
 * Used in customer list rows, customer cards in order creation, and customer detail.
 * Read-only display - for editing tags use TagManager component.
 */

import { Badge } from '@/components/ui/badge';
import { useContactTags } from '@/hooks/useCustomerTags';
import type { CustomerTag } from '@/hooks/useCustomerTags';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CustomerTagBadgesProps {
  customerId: string;
  /** Maximum number of tags to show before collapsing */
  maxVisible?: number;
  /** Size variant for badges */
  size?: 'sm' | 'md';
  /** Additional class names */
  className?: string;
  /** Show loading skeleton while fetching */
  showLoading?: boolean;
  /** Optional preloaded tags (bypasses per-contact query when provided) */
  tags?: CustomerTag[];
}

export function CustomerTagBadges({
  customerId,
  maxVisible = 3,
  size = 'sm',
  className,
  showLoading = true,
  tags,
}: CustomerTagBadgesProps) {
  const { data: customerTags, isLoading } = useContactTags(customerId, { enabled: !tags });
  const resolvedTags = tags ?? customerTags;

  if (isLoading && showLoading) {
    return (
      <div className="flex gap-1">
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-5 w-16" />
      </div>
    );
  }

  if (!resolvedTags || resolvedTags.length === 0) {
    return null;
  }

  const visibleTags = resolvedTags.slice(0, maxVisible);
  const hiddenTags = resolvedTags.slice(maxVisible);
  const hiddenCount = hiddenTags.length;

  const badgeClasses = cn(
    'text-white',
    size === 'sm' ? 'text-[10px] h-5 px-1.5' : 'text-xs h-6 px-2'
  );

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {visibleTags.map((ct) => {
        const tag = ct.tag;
        if (!tag) return null;
        return (
          <Badge
            key={ct.id}
            className={badgeClasses}
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
          </Badge>
        );
      })}

      {hiddenCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="secondary"
              className={cn(badgeClasses, 'cursor-help')}
            >
              +{hiddenCount}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="flex flex-wrap gap-1 max-w-xs">
              {hiddenTags.map((ct) => {
                const tag = ct.tag;
                if (!tag) return null;
                return (
                  <Badge
                    key={ct.id}
                    className="text-white text-xs"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                  </Badge>
                );
              })}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
