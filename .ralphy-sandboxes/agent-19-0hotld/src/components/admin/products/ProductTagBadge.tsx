/**
 * ProductTagBadge
 *
 * Displays a product tag as a colored chip/badge.
 * Supports removable mode and click handling.
 */

import { memo } from 'react';
import X from 'lucide-react/dist/esm/icons/x';
import { cn } from '@/lib/utils';
import type { ProductTag } from '@/hooks/useProductTags';

interface ProductTagBadgeProps {
  tag: ProductTag;
  onRemove?: () => void;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ProductTagBadge = memo(function ProductTagBadge({
  tag,
  onRemove,
  onClick,
  size = 'md',
  className,
}: ProductTagBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-sm',
  };

  const dotSizes = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
  };

  const isInteractive = !!onClick;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors',
        sizeClasses[size],
        isInteractive && 'cursor-pointer hover:bg-muted',
        className
      )}
      style={{ borderColor: tag.color }}
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <span
        className={cn('rounded-full flex-shrink-0', dotSizes[size])}
        style={{ backgroundColor: tag.color }}
        aria-hidden="true"
      />
      <span className="truncate max-w-[150px]">{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
          aria-label={`Remove ${tag.name} tag`}
        >
          <X className={cn(
            size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'
          )} />
        </button>
      )}
    </span>
  );
});

/**
 * ProductTagBadgeList
 *
 * Displays a list of product tags with optional limit.
 */
interface ProductTagBadgeListProps {
  tags: ProductTag[];
  maxDisplay?: number;
  onTagClick?: (tag: ProductTag) => void;
  onRemoveTag?: (tag: ProductTag) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ProductTagBadgeList({
  tags,
  maxDisplay,
  onTagClick,
  onRemoveTag,
  size = 'md',
  className,
}: ProductTagBadgeListProps) {
  const displayTags = maxDisplay ? tags.slice(0, maxDisplay) : tags;
  const remainingCount = maxDisplay ? Math.max(0, tags.length - maxDisplay) : 0;

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {displayTags.map((tag) => (
        <ProductTagBadge
          key={tag.id}
          tag={tag}
          size={size}
          onClick={onTagClick ? () => onTagClick(tag) : undefined}
          onRemove={onRemoveTag ? () => onRemoveTag(tag) : undefined}
        />
      ))}
      {remainingCount > 0 && (
        <span
          className={cn(
            'inline-flex items-center rounded-full border border-muted-foreground/30 bg-muted/50 font-medium text-muted-foreground',
            size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
          )}
        >
          +{remainingCount} more
        </span>
      )}
    </div>
  );
}

export default ProductTagBadge;
