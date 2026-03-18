/**
 * ChatDrawer Component
 * Slide-in chat panel with real-time messaging
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble, type Message } from './MessageBubble';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { queryKeys } from '@/lib/queryKeys';
import { Send, Loader2 } from 'lucide-react';

interface ChatDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    conversationId: string | null;
    orderId?: string;
    orderNumber?: string;
    currentUserId: string;
    currentUserType: 'customer' | 'vendor';
    tenantId?: string;
}

export function ChatDrawer({
    isOpen,
    onClose,
    conversationId,
    orderId,
    orderNumber,
    currentUserId,
    currentUserType,
    tenantId,
}: ChatDrawerProps) {
    const queryClient = useQueryClient();
    const [messageText, setMessageText] = useState('');
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(conversationId);

    // Fetch or create conversation
    const { data: _conversation } = useQuery({
        queryKey: queryKeys.chat.conversations.detail(conversationId, orderId),
        queryFn: async () => {
            if (conversationId) {
                const { data, error } = await supabase
                    .from('conversations')
                    .select('id, order_id, store_id, tenant_id, customer_id, customer_name, order_number, status, last_message_at, created_at')
                    .eq('id', conversationId)
                    .maybeSingle();

                if (error) throw error;
                return data;
            }

            // Create conversation if it doesn't exist
            if (orderId) {
                const { data: existingConv } = await supabase
                    .from('conversations')
                    .select('id, order_id, store_id, tenant_id, customer_id, customer_name, order_number, status, last_message_at, created_at')
                    .eq('order_id', orderId)
                    .maybeSingle();

                if (existingConv) {
                    setActiveConversationId(existingConv.id);
                    return existingConv;
                }

                // Get order details
                const { data: order } = await supabase
                    .from('marketplace_orders')
                    .select('id, store_id, buyer_tenant_id, buyer_user_id, customer_name')
                    .eq('id', orderId)
                    .maybeSingle();

                if (!order) throw new Error('Order not found');

                const { data: newConv, error: createError } = await supabase
                    .from('conversations')
                    .insert({
                        order_id: orderId,
                        store_id: order.store_id || null,
                        tenant_id: tenantId || order.buyer_tenant_id,
                        customer_id: order.buyer_user_id || null,
                        customer_name: order.customer_name || null,
                        order_number: orderNumber,
                        status: 'active',
                    })
                    .select()
                    .maybeSingle();

                if (createError) throw createError;
                setActiveConversationId(newConv.id);
                return newConv;
            }

            return null;
        },
        enabled: isOpen && (!!conversationId || !!orderId),
    });

    // Fetch messages
    const { data: messages = [], isLoading } = useQuery({
        queryKey: queryKeys.chat.messages.byConversation(activeConversationId),
        queryFn: async () => {
            if (!activeConversationId) return [];

            const { data, error } = await supabase
                .from('messages')
                .select('id, conversation_id, sender_id, sender_type, sender_name, content, message_type, read_at, delivered_at, created_at')
                .eq('conversation_id', activeConversationId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data as Message[];
        },
        enabled: !!activeConversationId,
    });

    // Real-time subscription
    useEffect(() => {
        if (!activeConversationId) return;

        const channel = supabase
            .channel(`messages:${activeConversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${activeConversationId}`,
                },
                (payload) => {
                    queryClient.setQueryData(
                        queryKeys.chat.messages.byConversation(activeConversationId),
                        (old: Message[] = []) => [...old, payload.new as Message]
                    );

                    // Auto-scroll to bottom
                    setTimeout(() => {
                        if (scrollAreaRef.current) {
                            scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
                        }
                    }, 100);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeConversationId, queryClient]);

    // Auto-scroll on new messages
    useEffect(() => {
        if (scrollAreaRef.current && messages.length > 0) {
            scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
    }, [messages.length]);

    // Mark messages as read when drawer opens
    useEffect(() => {
        if (activeConversationId && isOpen) {
            supabase.rpc('mark_messages_read', {
                p_conversation_id: activeConversationId,
                p_user_id: currentUserId,
            }).then(({ error }: { error: unknown }) => {
                if (error) logger.error('Failed to mark messages read', error);
            });
        }
    }, [activeConversationId, isOpen, currentUserId]);

    // Send message mutation
    const sendMessageMutation = useMutation({
        mutationFn: async (content: string) => {
            if (!activeConversationId) throw new Error('No active conversation');

            const { data: user } = await supabase.auth.getUser();
            if (!user.user) throw new Error('Not authenticated');

            const { error } = await supabase.from('messages').insert({
                conversation_id: activeConversationId,
                sender_id: currentUserId,
                sender_type: currentUserType,
                sender_name: user.user.user_metadata?.full_name || currentUserType,
                content,
                message_type: 'text',
            });

            if (error) throw error;
        },
        onSuccess: () => {
            setMessageText('');
            queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages.byConversation(activeConversationId) });
        },
        onError: (error) => {
            logger.error('Failed to send message', error);
            toast.error('Failed to send message', { description: humanizeError(error) });
        },
    });

    const handleSend = () => {
        const trimmed = messageText.trim();
        if (!trimmed || sendMessageMutation.isPending) return;
        sendMessageMutation.mutate(trimmed);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
                <SheetHeader className="px-6 py-4 border-b">
                    <SheetTitle>Chat</SheetTitle>
                    <SheetDescription>
                        {orderNumber ? `Order #${orderNumber}` : 'Conversation'}
                    </SheetDescription>
                </SheetHeader>

                {/* Messages Area */}
                <ScrollArea className="flex-1 px-6 py-4" ref={scrollAreaRef}>
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <p className="text-muted-foreground mb-2">No messages yet</p>
                            <p className="text-sm text-muted-foreground">
                                Start the conversation below
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {messages.map((message) => (
                                <MessageBubble
                                    key={message.id}
                                    message={message}
                                    isOwn={message.sender_id === currentUserId}
                                />
                            ))}
                        </div>
                    )}
                </ScrollArea>

                {/* Input Area */}
                <div className="border-t px-6 py-4">
                    <div className="flex gap-2">
                        <Textarea
                            placeholder="Type a message..."
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            onKeyPress={handleKeyPress}
                            rows={2}
                            className="resize-none"
                            disabled={!activeConversationId}
                            aria-label="Type a message"
                        />
                        <Button
                            onClick={handleSend}
                            disabled={!messageText.trim() || sendMessageMutation.isPending || !activeConversationId}
                            size="icon"
                            className="h-full"
                            aria-label="Send message"
                        >
                            {sendMessageMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Press Enter to send, Shift + Enter for new line
                    </p>
                </div>
            </SheetContent>
        </Sheet>
    );
}
