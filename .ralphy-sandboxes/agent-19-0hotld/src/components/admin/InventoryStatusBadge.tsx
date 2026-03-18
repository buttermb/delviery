import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { getStatusColor } from "@/lib/utils/statusColors";

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
        },
        low: {
            label: "Low Stock",
            icon: AlertTriangle,
        },
        good: {
            label: "In Stock",
            icon: CheckCircle2,
        },
    };

    const current = config[status];
    const Icon = current.icon;

    return (
        <Badge
            variant="outline"
            className={cn(
                "whitespace-nowrap font-medium gap-1.5 transition-colors duration-200 border",
                getStatusColor(status),
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
