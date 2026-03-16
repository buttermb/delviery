import { useState } from 'react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConfirmPopoverProps {
  /** The element that triggers the popover */
  children: React.ReactNode;
  /** Headline question */
  title: string;
  /** Supporting description */
  description?: string;
  /** Label for confirm button */
  confirmLabel?: string;
  /** Label for cancel button */
  cancelLabel?: string;
  /** Destructive style (red confirm button, warning icon) */
  destructive?: boolean;
  /** Whether the action is in progress */
  loading?: boolean;
  /** Called when user confirms */
  onConfirm: () => void;
  /** Popover alignment */
  align?: 'start' | 'center' | 'end';
  /** Popover side */
  side?: 'top' | 'right' | 'bottom' | 'left';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConfirmPopover({
  children,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  align = 'center',
  side = 'top',
}: ConfirmPopoverProps) {
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    onConfirm();
    if (!loading) setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        className="w-[260px] border-[#334155] bg-[#1E293B] p-4"
      >
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start gap-2.5">
            {destructive && (
              <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#EF4444]/20">
                <svg className="h-3 w-3 text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                </svg>
              </div>
            )}
            <div>
              <p className={cn(
                'text-sm font-medium',
                destructive ? 'text-[#EF4444]' : 'text-[#F8FAFC]',
              )}>
                {title}
              </p>
              {description && (
                <p className="mt-1 text-xs text-[#94A3B8]">{description}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className="h-7 text-xs text-[#64748B] hover:bg-[#263548] hover:text-[#F8FAFC]"
            >
              {cancelLabel}
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={loading}
              className={cn(
                'h-7 text-xs text-white',
                destructive
                  ? 'bg-[#EF4444] hover:bg-[#DC2626]'
                  : 'bg-[#10B981] hover:bg-[#059669]',
              )}
            >
              {loading ? 'Working...' : confirmLabel}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
