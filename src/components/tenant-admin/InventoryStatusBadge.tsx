/**
 * Inventory Status Badge
 * Displays granular inventory status with visual indicators
 */

import { Badge } from '@/components/ui/badge';
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import AlertOctagon from "lucide-react/dist/esm/icons/alert-octagon";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export type InventoryStatus = 'healthy' | 'low' | 'critical' | 'out_of_stock';

interface InventoryStatusBadgeProps {
    quantity: number;
    reorderPoint?: number;
    showLabel?: boolean;
    className?: string;
}

export function InventoryStatusBadge({
    quantity,
    reorderPoint = 10,
    showLabel = true,
    className
}: InventoryStatusBadgeProps) {

    let status: InventoryStatus = 'healthy';

    if (quantity <= 0) {
        status = 'out_of_stock';
    } else if (quantity <= reorderPoint / 2) {
        status = 'critical';
    } else if (quantity <= reorderPoint) {
        status = 'low';
    }

    const config = {
        healthy: {
            icon: CheckCircle2,
            label: 'Healthy Stock',
            color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
            iconColor: 'text-green-600 dark:text-green-400'
        },
        low: {
            icon: AlertTriangle,
            label: 'Low Stock',
            color: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
            iconColor: 'text-yellow-600 dark:text-yellow-400'
        },
        critical: {
            icon: AlertOctagon,
            label: 'Critical Low',
            color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
            iconColor: 'text-orange-600 dark:text-orange-400'
        },
        out_of_stock: {
            icon: XCircle,
            label: 'Out of Stock',
            color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
            iconColor: 'text-red-600 dark:text-red-400'
        }
    };

    const { icon: Icon, label, color, iconColor } = config[status];

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge
                        variant="outline"
                        className={`flex items-center gap-1.5 ${color} ${className}`}
                    >
                        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
                        {showLabel && <span>{label}</span>}
                    </Badge>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{quantity} units remaining</p>
                    {status !== 'healthy' && (
                        <p className="text-xs text-muted-foreground mt-1">
                            Reorder point: {reorderPoint}
                        </p>
                    )}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
