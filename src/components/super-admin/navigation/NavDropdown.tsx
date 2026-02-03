/**
 * Nav Dropdown Component
 * Dropdown trigger for mega menus in the top nav bar
 */

import { useState } from 'react';
import type { LucideIcon } from "lucide-react";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface NavDropdownProps {
  icon: LucideIcon;
  label: string;
  badge?: number | string;
  shortcut?: string;
  children: React.ReactNode;
  className?: string;
}

export function NavDropdown({ 
  icon: Icon, 
  label, 
  badge,
  shortcut,
  children,
  className 
}: NavDropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium',
            'transition-colors duration-200',
            'hover:bg-accent hover:text-accent-foreground',
            'text-muted-foreground',
            open && 'bg-accent text-accent-foreground',
            className
          )}
        >
          <Icon className="h-4 w-4" />
          <span>{label}</span>
          {badge !== undefined && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {badge}
            </Badge>
          )}
          <ChevronDown className={cn(
            'h-4 w-4 ml-auto transition-transform duration-200',
            open && 'rotate-180'
          )} />
          {shortcut && (
            <kbd className="ml-2 text-xs text-muted-foreground font-mono hidden lg:inline">
              {shortcut}
            </kbd>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        sideOffset={8}
        className="p-0 min-w-[200px]"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

