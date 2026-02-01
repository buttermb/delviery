/**
 * UnreadIndicator Component
 * Badge showing unread message count
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { useEffect } from 'react';

interface UnreadIndicatorProps {
    userId: string;
    tenantId?: string;
    className?: string;
}

export function UnreadIndicator({ userId, tenantId, className }: UnreadIndicatorProps) {
    const { data: unreadCount = 0, refetch } = useQuery({
        queryKey: ['unread-messages', userId, tenantId],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_unread_message_count' as any, {
                p_user_id: userId,
                p_tenant_id: tenantId || null,
            });

            if (error) throw error;
            return (data as number) || 0;
        },
        refetchInterval: 10000, // Refetch every 10 seconds
    });

    // Real-time subscription for new messages
    useEffect(() => {
        const channel = supabase
            .channel('unread-messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                },
                () => {
                    refetch();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [refetch]);

    if (unreadCount === 0) {
        return null;
    }

    return (
        <Badge variant="destructive" className={className}>
            {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
    );
}
