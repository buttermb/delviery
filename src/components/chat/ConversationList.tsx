/**
 * ConversationList Component
 * List of active conversations with preview and unread counts
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { MessageSquare, Search } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface Conversation {
    id: string;
    order_id: string | null;
    order_number: string | null;
    customer_name: string | null;
    status: string;
    last_message_at: string | null;
    created_at: string;
    unread_count?: number;
    last_message?: string;
}

interface ConversationListProps {
    currentUserId: string;
    userType: 'customer' | 'vendor';
    tenantId?: string;
    onSelectConversation: (conversationId: string) => void;
    selectedConversationId?: string | null;
    className?: string;
}

export function ConversationList({
    currentUserId,
    userType,
    tenantId,
    onSelectConversation,
    selectedConversationId,
    className,
}: ConversationListProps) {
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch conversations
    const { data: conversations = [], isLoading } = useQuery({
        queryKey: queryKeys.chat.conversations.list(currentUserId, userType, tenantId),
        queryFn: async () => {
            let query = supabase
                .from('conversations')
                .select('*')
                .eq('status', 'active')
                .order('last_message_at', { ascending: false, nullsFirst: false });

            if (tenantId) {
                query = query.eq('tenant_id', tenantId);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Get last message for each conversation
            const conversationsWithDetails = await Promise.all(
                (data ?? []).map(async (conv) => {
                    // Get last message
                    const { data: lastMessageData } = await supabase
                        .from('messages')
                        .select('content')
                        .eq('conversation_id', conv.id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    // Get unread count
                    const { data: unreadData } = await supabase
                        .from('messages')
                        .select('id', { count: 'exact' })
                        .eq('conversation_id', conv.id)
                        .neq('sender_id', currentUserId)
                        .is('read_at', null);

                    return {
                        ...conv,
                        unread_count: unreadData?.length ?? 0,
                        last_message: lastMessageData?.content || 'No messages yet',
                    } as Conversation;
                })
            );

            return conversationsWithDetails;
        },
        refetchInterval: 5000,
        refetchIntervalInBackground: false, // Stop polling when tab is not visible
    });

    // Filter conversations by search
    const filteredConversations = conversations.filter((conv) => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
            conv.order_number?.toLowerCase().includes(searchLower) ||
            conv.customer_name?.toLowerCase().includes(searchLower)
        );
    });

    const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unread_count ?? 0), 0);

    if (isLoading) {
        return (
            <div className={cn('space-y-4', className)}>
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                ))}
            </div>
        );
    }

    return (
        <div className={cn('space-y-4', className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    <h3 className="font-semibold">Messages</h3>
                    {totalUnread > 0 && (
                        <Badge variant="destructive" className="rounded-full">
                            {totalUnread}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Search conversations..."
                    aria-label="Search conversations"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Conversation List */}
            <ScrollArea className="h-[500px]">
                {filteredConversations.length === 0 ? (
                    <div className="text-center py-12">
                        <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">
                            {searchTerm ? 'No conversations found' : 'No conversations yet'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredConversations.map((conversation) => (
                            <Card
                                key={conversation.id}
                                className={cn(
                                    'cursor-pointer transition-all hover:shadow-md',
                                    selectedConversationId === conversation.id && 'ring-2 ring-primary'
                                )}
                                onClick={() => onSelectConversation(conversation.id)}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-medium truncate">
                                                    {conversation.customer_name || 'Customer'}
                                                </p>
                                                {(conversation.unread_count ?? 0) > 0 && (
                                                    <Badge variant="destructive" className="rounded-full px-2 py-0 text-xs">
                                                        {conversation.unread_count}
                                                    </Badge>
                                                )}
                                            </div>
                                            {conversation.order_number && (
                                                <p className="text-xs text-muted-foreground">
                                                    Order #{conversation.order_number}
                                                </p>
                                            )}
                                        </div>
                                        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                                            {conversation.last_message_at
                                                ? formatSmartDate(conversation.last_message_at)
                                                : formatSmartDate(conversation.created_at)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        {conversation.last_message}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
