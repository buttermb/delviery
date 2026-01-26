import { useCredits } from "@/contexts/CreditContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Coins, Plus, TrendingDown, Calendar } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";

interface CreditBalanceProps {
  className?: string;
  variant?: "default" | "badge" | "ghost";
  showLabel?: boolean;
}

export function CreditBalance({
  className,
  variant = "default",
  showLabel = true
}: CreditBalanceProps) {
  const { credits, isFreeTier, setIsPurchaseModalOpen } = useCredits();
  const { tenant } = useTenantAdminAuth();

  // Fetch usage stats for tooltip (must be before conditional return per rules-of-hooks)
  const { data: usageStats } = useQuery({
    queryKey: ['credit-usage-quick', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: transactions } = await supabase
        .from('credit_transactions')
        .select('amount, created_at')
        .eq('tenant_id', tenant.id)
        .eq('transaction_type', 'usage')
        .gte('created_at', thirtyDaysAgo.toISOString());

      const monthUsage = (transactions || []).reduce(
        (sum, t) => sum + Math.abs(t.amount),
        0
      );
      const avgDailyUsage = Math.round(monthUsage / 30);
      const daysUntilDepletion = avgDailyUsage > 0
        ? Math.floor(credits / avgDailyUsage)
        : null;

      const depletionDate = daysUntilDepletion
        ? new Date(Date.now() + daysUntilDepletion * 24 * 60 * 60 * 1000)
        : null;

      return { avgDailyUsage, daysUntilDepletion, depletionDate };
    },
    enabled: isFreeTier && !!tenant?.id && credits > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Color logic based on warning thresholds: 2000, 1000, 500, 100
  const getColorClass = (amount: number) => {
    if (amount > 2000) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (amount > 1000) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    if (amount > 500) return "text-amber-600 bg-amber-50 border-amber-200";
    if (amount > 100) return "text-orange-600 bg-orange-50 border-orange-200";
    return "text-red-600 bg-red-50 border-red-200 animate-pulse";
  };

  const tooltipContent = (
    <div className="space-y-2 text-xs">
      <div className="font-semibold text-sm">Credit Balance</div>
      <div className="flex items-center gap-2">
        <Coins className="w-3 h-3" />
        <span>{credits.toLocaleString()} credits remaining</span>
      </div>
      {usageStats?.avgDailyUsage !== undefined && usageStats.avgDailyUsage > 0 && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <TrendingDown className="w-3 h-3" />
          <span>~{usageStats.avgDailyUsage}/day burn rate</span>
        </div>
      )}
      {usageStats?.depletionDate && usageStats.daysUntilDepletion && usageStats.daysUntilDepletion > 0 && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="w-3 h-3" />
          <span>
            Depletes ~{usageStats.depletionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' '}({usageStats.daysUntilDepletion} days)
          </span>
        </div>
      )}
      <div className="pt-1 border-t text-muted-foreground">
        Click to buy more credits
      </div>
    </div>
  );

  if (variant === "badge") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium transition-colors cursor-pointer hover:opacity-80",
              getColorClass(credits),
              className
            )}
            onClick={() => setIsPurchaseModalOpen(true)}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>{credits.toLocaleString()}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="w-56">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors cursor-pointer",
              getColorClass(credits)
            )}
            onClick={() => setIsPurchaseModalOpen(true)}
          >
            <Coins className="w-4 h-4" />
            {showLabel && <span>{credits.toLocaleString()}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="w-56">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
      <Button
        size="sm"
        variant="outline"
        className="h-8 w-8 rounded-full p-0"
        title="Buy Credits"
        onClick={() => setIsPurchaseModalOpen(true)}
      >
        <Plus className="w-4 h-4" />
        <span className="sr-only">Buy Credits</span>
      </Button>
    </div>
  );
}
