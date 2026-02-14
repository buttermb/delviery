/**
 * Quick Action Component
 * Action button in mega menus (not a link, triggers onClick)
 */

import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuickActionProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  shortcut?: string;
  className?: string;
}

export function QuickAction({ 
  icon: Icon, 
  label, 
  onClick,
  shortcut,
  className 
}: QuickActionProps) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn(
        'w-full justify-start gap-3 h-auto py-2 px-3',
        'hover:bg-accent hover:text-accent-foreground',
        'transition-colors duration-200',
        className
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1 text-left text-sm">{label}</span>
      {shortcut && (
        <kbd className="ml-auto text-xs text-muted-foreground font-mono">
          {shortcut}
        </kbd>
      )}
    </Button>
  );
}

