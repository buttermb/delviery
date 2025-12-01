/**
 * Tenant Support Tickets List
 * Displays support tickets for a specific tenant in the admin detail view
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Ticket, MessageSquare, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { handleError } from '@/utils/errorHandling/handlers';

interface TenantSupportTicketsProps {
    tenantId: string;
}

export function TenantSupportTickets({ tenantId }: TenantSupportTicketsProps) {
    const { data: tickets, isLoading } = useQuery({
        queryKey: ['tenant-tickets', tenantId],
        queryFn: async () => {
            try {
                const { data, error } = await supabase
                    .from('support_tickets')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .order('created_at', { ascending: false });

                if (error) {
                    // If table doesn't exist yet, return empty array (dev mode)
                    if (error.code === '42P01') return [];
                    throw error;
                }

                return data || [];
            } catch (error) {
                handleError(error, { component: 'TenantSupportTickets', toastTitle: 'Failed to load tickets' });
                return [];
            }
        },
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'open':
                return <Badge variant="destructive">Open</Badge>;
            case 'in_progress':
                return <Badge variant="default" className="bg-blue-500">In Progress</Badge>;
            case 'resolved':
                return <Badge variant="outline" className="text-green-600 border-green-600">Resolved</Badge>;
            case 'closed':
                return <Badge variant="secondary">Closed</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getPriorityIcon = (priority: string) => {
        switch (priority) {
            case 'high':
                return <AlertCircle className="h-4 w-4 text-red-500" />;
            case 'medium':
                return <Clock className="h-4 w-4 text-yellow-500" />;
            case 'low':
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            default:
                return null;
        }
    };

    if (isLoading) {
        return <div className="text-center py-8 text-muted-foreground">Loading tickets...</div>;
    }

    if (!tickets || tickets.length === 0) {
        return (
            <div className="text-center py-12 border rounded-lg bg-muted/10">
                <Ticket className="h-12 w-12 mx-auto text-muted-foreground opacity-20 mb-4" />
                <h3 className="text-lg font-medium">No Tickets Found</h3>
                <p className="text-sm text-muted-foreground">This tenant hasn't created any support tickets yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {tickets.map((ticket) => (
                <Card key={ticket.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <h4 className="font-semibold">{ticket.subject}</h4>
                                {getStatusBadge(ticket.status)}
                                <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                                    {getPriorityIcon(ticket.priority)}
                                    <span className="capitalize">{ticket.priority} Priority</span>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                                {ticket.description}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatSmartDate(ticket.created_at)}
                                </span>
                                <span className="flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    {ticket.category}
                                </span>
                            </div>
                        </div>
                        <Button variant="outline" size="sm">
                            View Details
                        </Button>
                    </div>
                </Card>
            ))}
        </div>
    );
}
