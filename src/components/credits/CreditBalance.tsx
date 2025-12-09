import { useCredits } from "@/contexts/CreditContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Coins, Plus } from "lucide-react";

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
  const { credits, setIsPurchaseModalOpen } = useCredits();

  // Color logic
  const getColorClass = (amount: number) => {
    if (amount > 5000) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (amount > 1000) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-red-600 bg-red-50 border-red-200 animate-pulse";
  };

  if (variant === "badge") {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium transition-colors cursor-pointer hover:opacity-80",
          getColorClass(credits),
          className
        )}
        onClick={() => setIsPurchaseModalOpen(true)}
        title="Click to buy credits"
      >
        <Coins className="w-3.5 h-3.5" />
        <span>{credits.toLocaleString()}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors",
          getColorClass(credits)
        )}
      >
        <Coins className="w-4 h-4" />
        {showLabel && <span>{credits.toLocaleString()}</span>}
      </div>
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

