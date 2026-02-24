/**
 * UnreadIndicator Component
 * Badge showing unread message count
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { Badge } from '@/components/ui/badge';
import { useEffect } from 'react';

interface UnreadIndicatorProps {
    userId: string;
    tenantId?: string;
    className?: string;
}

export function UnreadIndicator({ userId, tenantId, className }: UnreadIndicatorProps) {
    const { data: unreadCount = 0, refetch } = useQuery({
        queryKey: queryKeys.chat.unread.count(userId, tenantId),
        queryFn: async () => {
            const { data, error } = await (supabase as any).rpc('get_unread_message_count', {
                p_user_id: userId,
                p_tenant_id: tenantId || null,
            });

            if (error) throw error;
            return (data as number) ?? 0;
        },
        refetchInterval: 10000, // Refetch every 10 seconds
    });

    // Real-time subscription for new messages
    useEffect(() => {
        if (!tenantId) return;

        const channel = supabase
            .channel(`unread-messages-${tenantId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `tenant_id=eq.${tenantId}`,
                },
                () => {
                    refetch();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [refetch, tenantId]);

    if (unreadCount === 0) {
        return null;
    }

    return (
        <Badge variant="destructive" className={className}>
            {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
    );
}
