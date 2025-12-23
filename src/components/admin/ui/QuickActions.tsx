/**
 * Quick Actions Component
 * Floating action buttons for hub pages
 */

import { LucideIcon, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline';
}

interface QuickActionsProps {
  actions: QuickAction[];
  className?: string;
}

export function QuickActions({ actions, className }: QuickActionsProps) {
  if (actions.length === 0) return null;

  // If only one action, show as single button
  if (actions.length === 1) {
    const action = actions[0];
    return (
      <Button
        onClick={action.onClick}
        variant={action.variant || 'default'}
        className={cn('gap-2', className)}
      >
        <action.icon className="h-4 w-4" />
        {action.label}
      </Button>
    );
  }

  // Multiple actions - show dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className={cn('gap-2', className)}>
          <Plus className="h-4 w-4" />
          Quick Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.id}
            onClick={action.onClick}
            className="gap-2 cursor-pointer"
          >
            <action.icon className="h-4 w-4" />
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface QuickActionBarProps {
  actions: QuickAction[];
  className?: string;
}

export function QuickActionBar({ actions, className }: QuickActionBarProps) {
  if (actions.length === 0) return null;

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {actions.map((action) => (
        <Button
          key={action.id}
          onClick={action.onClick}
          variant={action.variant || 'outline'}
          size="sm"
          className="gap-2"
        >
          <action.icon className="h-4 w-4" />
          {action.label}
        </Button>
      ))}
    </div>
  );
}
