/**
 * Virtual List Component
 * Efficiently renders large lists by only rendering visible items
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface VirtualListProps<T> {
  /** Array of items to render */
  items: T[];
  /** Height of each item in pixels */
  itemHeight: number;
  /** Height of the container */
  containerHeight?: number;
  /** Number of items to render outside visible area */
  overscan?: number;
  /** Render function for each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Optional key extractor */
  keyExtractor?: (item: T, index: number) => string | number;
  /** Container className */
  className?: string;
  /** Called when scrolling near the end */
  onEndReached?: () => void;
  /** Distance from end to trigger onEndReached */
  onEndReachedThreshold?: number;
  /** Loading indicator at bottom */
  ListFooterComponent?: React.ReactNode;
  /** Empty state component */
  ListEmptyComponent?: React.ReactNode;
  /** Header component */
  ListHeaderComponent?: React.ReactNode;
}

export function VirtualList<T>({
  items,
  itemHeight,
  containerHeight = 600,
  overscan = 5,
  renderItem,
  keyExtractor,
  className,
  onEndReached,
  onEndReachedThreshold = 0.8,
  ListFooterComponent,
  ListEmptyComponent,
  ListHeaderComponent,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const hasCalledEndReached = useRef(false);

  // Calculate visible range
  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  // Handle scroll
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    setScrollTop(container.scrollTop);

    // Check if near end
    if (onEndReached) {
      const scrollPercentage =
        (container.scrollTop + container.clientHeight) / container.scrollHeight;
      if (scrollPercentage >= onEndReachedThreshold && !hasCalledEndReached.current) {
        hasCalledEndReached.current = true;
        onEndReached();
      } else if (scrollPercentage < onEndReachedThreshold) {
        hasCalledEndReached.current = false;
      }
    }
  }, [onEndReached, onEndReachedThreshold]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Generate visible items
  const visibleItems = useMemo(() => {
    const result = [];
    for (let i = startIndex; i <= endIndex && i < items.length; i++) {
      const item = items[i];
      const key = keyExtractor ? keyExtractor(item, i) : i;
      result.push({
        item,
        index: i,
        key,
        offsetTop: i * itemHeight,
      });
    }
    return result;
  }, [items, startIndex, endIndex, itemHeight, keyExtractor]);

  if (items.length === 0 && ListEmptyComponent) {
    return (
      <div
        ref={containerRef}
        className={cn('overflow-auto', className)}
        style={{ height: containerHeight }}
      >
        {ListHeaderComponent}
        {ListEmptyComponent}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('overflow-auto', className)}
      style={{ height: containerHeight }}
    >
      {ListHeaderComponent}
      <div
        style={{
          height: totalHeight,
          position: 'relative',
          width: '100%',
        }}
      >
        {visibleItems.map(({ item, index, key, offsetTop }) => (
          <div
            key={key}
            style={{
              position: 'absolute',
              top: offsetTop,
              left: 0,
              right: 0,
              height: itemHeight,
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
      {ListFooterComponent}
    </div>
  );
}

/**
 * Simple virtualized table for tabular data
 */
export interface VirtualTableColumn<T> {
  key: string;
  header: string;
  width?: number | string;
  render: (item: T, index: number) => React.ReactNode;
}

export interface VirtualTableProps<T> {
  items: T[];
  columns: VirtualTableColumn<T>[];
  rowHeight?: number;
  containerHeight?: number;
  className?: string;
  onRowClick?: (item: T, index: number) => void;
  keyExtractor?: (item: T, index: number) => string | number;
}

export function VirtualTable<T>({
  items,
  columns,
  rowHeight = 48,
  containerHeight = 500,
  className,
  onRowClick,
  keyExtractor,
}: VirtualTableProps<T>) {
  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <div className="flex bg-muted/50 border-b sticky top-0 z-10">
        {columns.map((col) => (
          <div
            key={col.key}
            className="px-4 py-3 font-medium text-sm text-muted-foreground"
            style={{ width: col.width || 'auto', flex: col.width ? 'none' : 1 }}
          >
            {col.header}
          </div>
        ))}
      </div>

      {/* Virtual rows */}
      <VirtualList
        items={items}
        itemHeight={rowHeight}
        containerHeight={containerHeight - 48} // Subtract header height
        keyExtractor={keyExtractor}
        renderItem={(item, index) => (
          <div
            className={cn(
              'flex items-center border-b hover:bg-muted/30 transition-colors',
              onRowClick && 'cursor-pointer'
            )}
            onClick={() => onRowClick?.(item, index)}
          >
            {columns.map((col) => (
              <div
                key={col.key}
                className="px-4 py-2 text-sm"
                style={{ width: col.width || 'auto', flex: col.width ? 'none' : 1 }}
              >
                {col.render(item, index)}
              </div>
            ))}
          </div>
        )}
        ListEmptyComponent={
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No data available
          </div>
        }
      />
    </div>
  );
}

