import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react";

interface InventoryStatusBadgeProps {
    quantity: number;
    lowStockThreshold?: number;
    className?: string;
    showIcon?: boolean;
    showLabel?: boolean;
}

export function InventoryStatusBadge({
    quantity,
    lowStockThreshold = 10,
    className,
    showIcon = true,
    showLabel = true,
}: InventoryStatusBadgeProps) {
    let status: "out" | "low" | "good" = "good";
    if (quantity <= 0) status = "out";
    else if (quantity <= lowStockThreshold) status = "low";

    const config = {
        out: {
            label: "Out of Stock",
            icon: XCircle,
            variant: "destructive" as const,
            color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800",
        },
        low: {
            label: "Low Stock",
            icon: AlertTriangle,
            variant: "secondary" as const, // We'll override styles
            color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
        },
        good: {
            label: "In Stock",
            icon: CheckCircle2,
            variant: "outline" as const, // We'll override styles
            color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
        },
    };

    const current = config[status];
    const Icon = current.icon;

    return (
        <Badge
            variant={status === 'out' ? 'destructive' : 'outline'}
            className={cn(
                "whitespace-nowrap font-medium gap-1.5 transition-colors duration-200",
                current.color,
                className
            )}
        >
            {showIcon && <Icon className="h-3.5 w-3.5" />}
            {showLabel && current.label}
            {status !== 'out' && (
                <span className="ml-1 opacity-75">
                    ({quantity})
                </span>
            )}
        </Badge>
    );
}
