/**
 * Tenant Hover Card
 * Quick preview of tenant details on hover
 */

import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import CalendarDays from "lucide-react/dist/esm/icons/calendar-days";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import Activity from "lucide-react/dist/esm/icons/activity";
import Ticket from "lucide-react/dist/esm/icons/ticket";
import { formatSmartDate } from '@/lib/utils/formatDate';
import { formatCurrency } from '@/lib/utils/formatCurrency';

interface TenantHoverCardProps {
    tenant: {
        id: string;
        business_name: string;
        slug: string;
        subscription_plan: string;
        subscription_status: string;
        created_at: string;
        mrr?: number;
        health_score: number;
        owner_name?: string;
        owner_email?: string;
        open_tickets_count?: number;
        last_activity_at?: string;
    };
    children: React.ReactNode;
}

export function TenantHoverCard({ tenant, children }: TenantHoverCardProps) {
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <HoverCard openDelay={400}>
            <HoverCardTrigger asChild>
                <div className="cursor-pointer inline-block">
                    {children}
                </div>
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
                <div className="flex justify-between space-x-4">
                    <Avatar>
                        <AvatarImage src={`https://avatar.vercel.sh/${tenant.slug}.png`} />
                        <AvatarFallback>{getInitials(tenant.business_name)}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                        <h4 className="text-sm font-semibold">{tenant.business_name}</h4>
                        <p className="text-sm text-muted-foreground">
                            {tenant.owner_name} • {tenant.owner_email}
                        </p>
                        <div className="flex items-center pt-2">
                            <CalendarDays className="mr-2 h-4 w-4 opacity-70" />
                            <span className="text-xs text-muted-foreground">
                                Joined {formatSmartDate(tenant.created_at)}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 mt-2 border-t">
                            <div className="flex items-center gap-2">
                                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-medium">{formatCurrency(tenant.mrr || 0)}/mo</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-medium">
                                    Health: {tenant.health_score}
                                </span>
                            </div>
                            {tenant.open_tickets_count !== undefined && (
                                <div className="flex items-center gap-2 col-span-2">
                                    <Ticket className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs font-medium">
                                        {tenant.open_tickets_count} Open Tickets
                                    </span>
                                </div>
                            )}
                        </div>

                        {tenant.last_activity_at && (
                            <div className="pt-2 mt-2 border-t text-xs text-muted-foreground">
                                Last active: {formatSmartDate(tenant.last_activity_at)}
                            </div>
                        )}
                    </div>
                </div>
            </HoverCardContent>
        </HoverCard>
    );
}
