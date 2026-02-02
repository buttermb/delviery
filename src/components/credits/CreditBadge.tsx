import { cn } from "@/lib/utils";
import Coins from "lucide-react/dist/esm/icons/coins";

interface CreditBadgeProps {
    cost: number;
    className?: string;
}

export function CreditBadge({ cost, className }: CreditBadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground border",
                className
            )}
        >
            <Coins className="w-3 h-3" />
            {cost}
        </span>
    );
}
