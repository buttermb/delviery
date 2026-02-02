import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip";
import Coins from "lucide-react/dist/esm/icons/coins";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import { useCredits } from "@/hooks/useCredits";
import { getCreditCost, getCreditCostInfo } from "@/lib/credits";
import { cn } from "@/lib/utils";

interface CreditActionTooltipProps {
    actionKey?: string;
    cost?: number;
    children: React.ReactNode;
    side?: "top" | "right" | "bottom" | "left";
    disabled?: boolean;
}

/**
 * Wraps any interactive element to show credit cost tooltip on hover.
 */
export function CreditActionTooltip({
    actionKey,
    cost: directCost,
    children,
    side = "top",
    disabled = false
}: CreditActionTooltipProps) {
    const { balance, isFreeTier, isLoading } = useCredits();

    const cost = directCost ?? (actionKey ? getCreditCost(actionKey) : 0);
    const costInfo = actionKey ? getCreditCostInfo(actionKey) : null;

    // If not free tier or no cost, just render children
    if (!isFreeTier || cost === 0 || isLoading || disabled) {
        return children as React.ReactElement;
    }

    const canAfford = balance >= cost;

    return (
        <TooltipProvider>
            <Tooltip delayDuration={500}>
                <TooltipTrigger asChild>
                    <span className="inline-flex">{children}</span>
                </TooltipTrigger>
                <TooltipContent side={side} className="max-w-xs p-3">
                    <div className="space-y-2">
                        <div>
                            <p className="font-semibold flex items-center gap-2">
                                <Coins className="h-3 w-3 text-muted-foreground" />
                                {costInfo?.actionName || 'Credit Cost'}
                            </p>
                            {costInfo?.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {costInfo.description}
                                </p>
                            )}
                        </div>

                        <div className="text-xs pt-2 border-t flex justify-between items-center">
                            <span>Cost:</span>
                            <span className="font-medium">{cost} credits</span>
                        </div>

                        <div className="text-xs flex justify-between items-center">
                            <span>Remaining:</span>
                            <span className={cn("font-medium", !canAfford && "text-red-500")}>
                                {(balance - cost).toLocaleString()} credits
                            </span>
                        </div>

                        {!canAfford && (
                            <p className="text-xs text-red-500 bg-red-50 p-1.5 rounded flex items-start gap-1">
                                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                                Insufficient credits
                            </p>
                        )}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
