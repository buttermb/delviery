/**
 * WorkflowCreditCostSummary
 *
 * Displays a per-step breakdown and total credit cost for a workflow.
 * Shown inside the workflow builder/preview so users understand the cost
 * before executing or activating a workflow.
 *
 * Only renders for free-tier users (matches CreditCostBadge behaviour).
 */

import { Coins, AlertTriangle, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useCredits } from '@/hooks/useCredits';
import {
  getWorkflowActionsCreditBreakdown,
  calculateWorkflowTotalCredits,
  type WorkflowActionCreditInfo,
} from '@/lib/workflow/workflowCreditCosts';

export interface WorkflowCreditCostSummaryProps {
  /** Array of workflow actions with a `type` property */
  actions: ReadonlyArray<{ type: string }>;
  /** Optional className for the root element */
  className?: string;
}

export function WorkflowCreditCostSummary({
  actions,
  className,
}: WorkflowCreditCostSummaryProps) {
  const { balance, isFreeTier, isLoading } = useCredits();

  if (!isFreeTier || isLoading || actions.length === 0) {
    return null;
  }

  const breakdown = getWorkflowActionsCreditBreakdown(actions);
  const totalCredits = calculateWorkflowTotalCredits(actions);

  if (totalCredits === 0) {
    return null;
  }

  const canAfford = balance >= totalCredits;
  const wouldBeLow = balance - totalCredits < 1000;

  return (
    <Card
      className={cn(
        'border',
        !canAfford
          ? 'border-red-500/30 bg-red-500/5'
          : wouldBeLow
            ? 'border-yellow-500/30 bg-yellow-500/5'
            : 'border-border bg-muted/30',
        className
      )}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Coins className="h-4 w-4 text-muted-foreground" />
            Credit Cost Estimate
          </div>
          <TooltipProvider>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs gap-1',
                    !canAfford
                      ? 'bg-red-500/10 text-red-600 border-red-500/20'
                      : wouldBeLow
                        ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                        : 'bg-muted text-muted-foreground border-border'
                  )}
                >
                  {!canAfford && <AlertTriangle className="h-3 w-3" />}
                  <Coins className="h-3 w-3" />
                  {totalCredits.toLocaleString()} credits / run
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs p-3">
                <p className="text-xs">
                  Each execution of this workflow will consume{' '}
                  <strong>{totalCredits.toLocaleString()}</strong> credits.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your balance: {balance.toLocaleString()} credits
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Per-step breakdown */}
        <div className="space-y-1.5">
          {breakdown.map((item: WorkflowActionCreditInfo, idx: number) => (
            <StepCostRow key={idx} item={item} index={idx} />
          ))}
        </div>

        {/* Footer summary */}
        <div className="flex items-center justify-between pt-2 border-t text-sm">
          <span className="text-muted-foreground">Total per execution</span>
          <span className="font-semibold">
            {totalCredits.toLocaleString()} credits
          </span>
        </div>

        {/* Insufficient credits warning */}
        {!canAfford && (
          <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-md">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Insufficient credits to run this workflow. You need{' '}
              <strong>{(totalCredits - balance).toLocaleString()}</strong> more
              credits.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Internal: single step row
// ---------------------------------------------------------------------------

interface StepCostRowProps {
  item: WorkflowActionCreditInfo;
  index: number;
}

function StepCostRow({ item, index }: StepCostRowProps) {
  const label = item.creditKey ? item.actionName : item.actionType;

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-1.5 text-muted-foreground truncate max-w-[70%]">
        <Zap className="h-3 w-3 shrink-0" />
        <span className="truncate">
          {index + 1}. {label}
        </span>
      </span>
      <span
        className={cn(
          'font-medium tabular-nums',
          item.credits === 0 ? 'text-muted-foreground' : ''
        )}
      >
        {item.credits === 0 ? 'Free' : `${item.credits.toLocaleString()} cr`}
      </span>
    </div>
  );
}
