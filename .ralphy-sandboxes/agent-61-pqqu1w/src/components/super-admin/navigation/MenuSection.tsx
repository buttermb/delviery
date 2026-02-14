/**
 * Menu Section Component
 * Groups menu items with a title in mega menus
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MenuSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function MenuSection({ title, children, className }: MenuSectionProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-1">
        {title}
      </h3>
      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
}

