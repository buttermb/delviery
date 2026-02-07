/**
 * Customer Quick View Card
 * Hover card to show key customer insights instantly
 */

import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Building2,
    User,
    Phone,
    Mail,
    Calendar,
    DollarSign,
    MessageSquare,
    Package
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { CustomerRiskBadge } from "@/components/admin/CustomerRiskBadge";
import { useNavigate } from "react-router-dom";

interface CustomerQuickViewCardProps {
    children: React.ReactNode;
    customer: {
        id: string;
        business_name: string;
        contact_name: string;
        email?: string;
        phone?: string;
        total_spent: number;
        risk_score?: number | null;
        created_at: string;
        last_order_date?: string; // Optional if available
    };
}

export function CustomerQuickViewCard({ children, customer }: CustomerQuickViewCardProps) {
    const navigate = useNavigate();

    const initials = customer.business_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

    return (
        <HoverCard>
            <HoverCardTrigger asChild>
                <span className="cursor-help underline decoration-dotted underline-offset-4 decoration-muted-foreground/50">
                    {children}
                </span>
            </HoverCardTrigger>
            <HoverCardContent className="w-80 p-0 overflow-hidden" align="start">
                {/* Header */}
                <div className="bg-muted/30 p-4 border-b flex items-start gap-3">
                    <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                        <AvatarImage src={`https://avatar.vercel.sh/${customer.business_name}.png`} />
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold truncate">{customer.business_name}</h4>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span className="truncate">{customer.contact_name}</span>
                        </div>
                    </div>
                    <CustomerRiskBadge score={customer.risk_score || null} showLabel={false} />
                </div>

                {/* Details */}
                <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">Total Spend</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(customer.total_spent)}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">Customer Since</span>
                            <span className="font-medium">
                                {new Date(customer.created_at).toLocaleDateString()}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                        {customer.email && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                <span className="truncate">{customer.email}</span>
                            </div>
                        )}
                        {customer.phone && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span>{customer.phone}</span>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-8 text-xs"
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/admin/new-wholesale-order?clientId=${customer.id}`);
                            }}
                        >
                            <Package className="h-3 w-3 mr-1" />
                            Order
                        </Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            className="flex-1 h-8 text-xs"
                            onClick={(e) => {
                                e.stopPropagation();
                                // Handle message action
                            }}
                        >
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Message
                        </Button>
                    </div>
                </div>
            </HoverCardContent>
        </HoverCard>
    );
}
