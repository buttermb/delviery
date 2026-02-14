/**
 * Mega Menu Component
 * Multi-column dropdown menu container
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MegaMenuProps {
  columns?: 2 | 3;
  children: ReactNode;
  className?: string;
}

export function MegaMenu({ columns = 2, children, className }: MegaMenuProps) {
  const maxWidth = columns === 3 ? 'max-w-[900px]' : 'max-w-[600px]';
  const gridCols = columns === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className={cn(
      'p-4',
      maxWidth,
      className
    )}>
      <div className={cn('grid gap-6', gridCols)}>
        {children}
      </div>
    </div>
  );
}

