/**
 * InfiniteScrollTrigger Component
 *
 * Renders an invisible sentinel element that triggers a callback
 * when it enters the viewport via IntersectionObserver.
 * Used to auto-load more items as the user scrolls.
 */

import { Loader2 } from 'lucide-react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

interface InfiniteScrollTriggerProps {
  /** Called when the sentinel enters the viewport */
  onLoadMore: () => void;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Whether items are currently being fetched */
  isFetching: boolean;
  /** Optional label shown while loading (default: "Loading more...") */
  loadingLabel?: string;
}

export function InfiniteScrollTrigger({
  onLoadMore,
  hasMore,
  isFetching,
  loadingLabel = 'Loading more...',
}: InfiniteScrollTriggerProps) {
  const { ref } = useIntersectionObserver({
    onIntersect: onLoadMore,
    enabled: hasMore && !isFetching,
  });

  if (!hasMore) return null;

  return (
    <div ref={ref} className="flex justify-center py-4" aria-live="polite">
      {isFetching && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingLabel}
        </div>
      )}
    </div>
  );
}
