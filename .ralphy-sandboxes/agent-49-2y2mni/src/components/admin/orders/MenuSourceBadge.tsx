/**
 * Menu Source Badge Component
 *
 * Displays a badge indicating the order came from a disposable menu.
 * Shows the menu name when available.
 */

import { Badge } from '@/components/ui/badge';
import { FileStack } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuSourceBadgeProps {
  menuName?: string | null;
  menuId?: string | null;
  className?: string;
  compact?: boolean;
}

export function MenuSourceBadge({ menuName, menuId, className, compact = false }: MenuSourceBadgeProps) {
  // Only render if this order came from a menu
  if (!menuId) {
    return null;
  }

  const displayName = menuName || 'Menu Order';

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 text-xs font-medium',
        'bg-orange-100 text-orange-700 border-orange-200',
        'dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
        className
      )}
      title={`From menu: ${displayName}`}
    >
      <FileStack className="h-3 w-3" />
      {compact ? 'Menu' : displayName}
    </Badge>
  );
}
