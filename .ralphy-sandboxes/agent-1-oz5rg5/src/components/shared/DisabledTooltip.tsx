import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DisabledTooltipProps {
  /** Tooltip text shown when the wrapped element is disabled */
  reason: string;
  /** Whether the wrapped element is disabled */
  disabled: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps a button (or any element) so that a tooltip appears when it is disabled.
 * When enabled the children render normally with no tooltip overhead.
 */
export function DisabledTooltip({
  reason,
  disabled,
  children,
  className,
}: DisabledTooltipProps) {
  if (!disabled) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className={className}>
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
