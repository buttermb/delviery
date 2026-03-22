/**
 * CreditGatedButton Component
 *
 * A button wrapper that integrates with the credit system:
 * - Shows CreditCostBadge next to the label
 * - Disables button + shows tooltip when credits are insufficient
 * - Falls back to a regular button if the credit system is unavailable
 * - Supports all standard Button variants and sizes
 */

import { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCredits } from '@/hooks/useCredits';
import { getCreditCost } from '@/lib/credits';
import { CreditCostBadge } from '@/components/credits/CreditCostBadge';

export interface CreditGatedButtonProps {
  /** The credit action key (e.g., 'menu_create') */
  actionKey: string;
  /** Click handler — only fires if credits are sufficient */
  onClick?: () => void;
  /** Button label text */
  label: string;
  /** Optional icon to render before the label */
  icon?: ReactNode;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
  /** Button size */
  size?: 'default' | 'sm' | 'lg';
  /** Additional disabled state (beyond credit gating) */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Additional class names */
  className?: string;
  /** Override the tooltip message when insufficient credits */
  insufficientTooltip?: string;
}

export function CreditGatedButton({
  actionKey,
  onClick,
  label,
  icon,
  variant = 'default',
  size = 'default',
  disabled = false,
  loading = false,
  className,
  insufficientTooltip,
}: CreditGatedButtonProps) {
  const { balance, isFreeTier, isLoading, error } = useCredits();

  const cost = getCreditCost(actionKey);
  const canAfford = balance >= cost;

  // If credit system errored or not on free tier, render a plain button
  const creditSystemUnavailable = error !== null;
  if (creditSystemUnavailable || !isFreeTier) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled={disabled || loading}
        onClick={onClick}
        className={className}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {!loading && icon}
        {label}
      </Button>
    );
  }

  // Free tier: gate on credits
  const isGated = !canAfford && cost > 0;
  const isDisabled = disabled || loading || isGated || isLoading;

  const button = (
    <Button
      variant={variant}
      size={size}
      disabled={isDisabled}
      onClick={onClick}
      className={cn('group', className)}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {!loading && icon}
      <span>{label}</span>
      {cost > 0 && (
        <CreditCostBadge actionKey={actionKey} showTooltip={false} compact />
      )}
    </Button>
  );

  // Wrap in tooltip when gated
  if (isGated) {
    const tooltipMessage =
      insufficientTooltip ??
      `Requires ${cost.toLocaleString()} credits (you have ${balance.toLocaleString()})`;

    return (
      <TooltipProvider>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            {/* Wrap in span so disabled button still triggers tooltip */}
            <span tabIndex={0} className="inline-flex">
              {button}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-sm">{tooltipMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
