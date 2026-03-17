import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// IconButtonTooltip — wraps an icon button with a styled tooltip
// ---------------------------------------------------------------------------

interface IconButtonTooltipProps {
  label: string;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayDuration?: number;
}

export function IconButtonTooltip({
  label,
  children,
  side = 'top',
  delayDuration = 300,
}: IconButtonTooltipProps) {
  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        className="rounded-md border-border bg-background px-2 py-1 text-xs font-medium text-foreground shadow-lg"
        sideOffset={6}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
