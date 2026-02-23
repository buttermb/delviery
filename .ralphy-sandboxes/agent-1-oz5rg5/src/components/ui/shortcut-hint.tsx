import * as React from 'react';

import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ShortcutHintProps {
  keys: string[];
  label?: string;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

function KbdKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

/**
 * Wraps a button/element with a tooltip showing the keyboard shortcut hint.
 *
 * Usage:
 * ```tsx
 * <ShortcutHint keys={["⌘", "S"]} label="Save">
 *   <Button>Save</Button>
 * </ShortcutHint>
 * ```
 */
export function ShortcutHint({
  keys,
  label,
  children,
  side = 'bottom',
  className,
}: ShortcutHintProps) {
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className={cn('flex items-center gap-2', className)}>
          {label && <span className="text-xs">{label}</span>}
          <span className="flex items-center gap-0.5">
            {keys.map((key, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-muted-foreground text-[10px]">+</span>}
                <KbdKey>{key}</KbdKey>
              </React.Fragment>
            ))}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Returns the correct modifier key symbol for the current platform.
 * ⌘ for macOS, Ctrl for others.
 */
export function useModifierKey(): string {
  const [modifier, setModifier] = React.useState('⌘');

  React.useEffect(() => {
    const isMac = navigator.platform.toUpperCase().includes('MAC') ||
      navigator.userAgent.toUpperCase().includes('MAC');
    setModifier(isMac ? '⌘' : 'Ctrl');
  }, []);

  return modifier;
}
