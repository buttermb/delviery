/**
 * Nav Item Component
 * Individual navigation item in the top nav bar
 */

import { Link, useLocation } from 'react-router-dom';
import LucideIcon from "lucide-react/dist/esm/icons/lucide-icon";
import { cn } from '@/lib/utils';

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  to: string;
  shortcut?: string;
  className?: string;
}

export function NavItem({ icon: Icon, label, to, shortcut, className }: NavItemProps) {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(to + '/');

  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium',
        'transition-colors duration-200',
        'hover:bg-accent hover:text-accent-foreground',
        isActive 
          ? 'bg-accent text-accent-foreground' 
          : 'text-muted-foreground',
        className
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      {shortcut && (
        <kbd className="ml-auto text-xs text-muted-foreground font-mono hidden lg:inline">
          {shortcut}
        </kbd>
      )}
    </Link>
  );
}

