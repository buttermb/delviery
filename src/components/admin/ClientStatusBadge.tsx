import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Clock from "lucide-react/dist/esm/icons/clock";
import XCircle from "lucide-react/dist/esm/icons/x-circle";

export type ClientStatus = 'active' | 'inactive' | 'suspended' | 'pending';
export type CreditStatus = 'good' | 'warning' | 'critical' | 'paid';

interface ClientStatusBadgeProps {
    status: string;
    type?: 'account' | 'credit';
    balance?: number;
    creditLimit?: number;
    className?: string;
    showIcon?: boolean;
}

export function ClientStatusBadge({
    status,
    type = 'account',
    balance = 0,
    creditLimit = 0,
    className,
    showIcon = true
}: ClientStatusBadgeProps) {

    if (type === 'credit') {
        let creditState: CreditStatus = 'good';
        if (balance === 0) creditState = 'paid';
        else if (creditLimit > 0 && balance >= creditLimit * 0.9) creditState = 'critical';
        else if (balance > 10000) creditState = 'warning'; // Arbitrary threshold if no limit

        const config = {
            paid: {
                label: 'Paid',
                color: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20',
                icon: CheckCircle2
            },
            good: {
                label: 'Good Standing',
                color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                icon: CheckCircle2
            },
            warning: {
                label: 'Outstanding',
                color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
                icon: AlertCircle
            },
            critical: {
                label: 'Over Limit',
                color: 'bg-red-500/10 text-red-600 border-red-500/20',
                icon: XCircle
            }
        };

        const state = config[creditState];
        const Icon = state.icon;

        return (
            <Badge
                variant="outline"
                className={cn("flex w-fit items-center gap-1.5", state.color, className)}
            >
                {showIcon && <Icon className="h-3.5 w-3.5" />}
                {state.label}
            </Badge>
        );
    }

    // Account Status
    const config: Record<string, { label: string; color: string; icon: any }> = {
        active: {
            label: 'Active',
            color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
            icon: CheckCircle2
        },
        inactive: {
            label: 'Inactive',
            color: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
            icon: Clock
        },
        suspended: {
            label: 'Suspended',
            color: 'bg-red-500/10 text-red-600 border-red-500/20',
            icon: XCircle
        },
        pending: {
            label: 'Pending',
            color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
            icon: Clock
        }
    };

    const state = config[status.toLowerCase()] || config.inactive;
    const Icon = state.icon;

    return (
        <Badge
            variant="outline"
            className={cn("flex w-fit items-center gap-1.5", state.color, className)}
        >
            {showIcon && <Icon className="h-3.5 w-3.5" />}
            {state.label}
        </Badge>
    );
}
