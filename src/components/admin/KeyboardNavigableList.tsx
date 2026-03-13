/**
 * KeyboardNavigableList
 * Wrapper component that applies keyboard navigation to a list of items.
 * Adds visual focus indicator (ring/outline) to the focused item.
 */

import { ReactNode, useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';

interface KeyboardNavigableListProps<T> {
  items: T[];
  onSelect: (index: number) => void;
  renderItem: (item: T, index: number, isFocused: boolean) => ReactNode;
  className?: string;
}

export function KeyboardNavigableList<T>({
  items,
  onSelect,
  renderItem,
  className,
}: KeyboardNavigableListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { focusedIndex, handleKeyDown } = useListKeyboardNavigation({
    itemCount: items.length,
    onSelect,
    enabled: true,
  });

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex < 0 || !containerRef.current) return;

    const children = containerRef.current.children;
    const focusedEl = children[focusedIndex] as HTMLElement | undefined;
    focusedEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusedIndex]);

  return (
    <div
      ref={containerRef}
      role="listbox"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn('outline-none', className)}
    >
      {items.map((item, index) => (
        <div
          key={index}
          role="option"
          aria-selected={focusedIndex === index}
          className={cn(
            'transition-shadow rounded-md',
            focusedIndex === index && 'ring-2 ring-primary ring-offset-1'
          )}
        >
          {renderItem(item, index, focusedIndex === index)}
        </div>
      ))}
    </div>
  );
}
