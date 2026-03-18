/**
 * Menu Item Component
 * Individual menu item with icon and link for mega menus
 */

import { Link } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MenuItemProps {
  icon: LucideIcon;
  label: string;
  to: string;
  badge?: number | string;
  onClick?: () => void;
  className?: string;
}

export function MenuItem({ 
  icon: Icon, 
  label, 
  to, 
  badge,
  onClick,
  className 
}: MenuItemProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md text-sm',
        'hover:bg-accent hover:text-accent-foreground',
        'transition-colors duration-200',
        'group',
        className
      )}
    >
      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-accent-foreground transition-colors" />
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <Badge variant="secondary" className="text-xs">
          {badge}
        </Badge>
      )}
    </Link>
  );
}

