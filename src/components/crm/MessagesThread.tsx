import { useState, useRef, useEffect } from 'react';
import { useClientMessages, useSendMessage } from '@/hooks/crm/useMessages';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Send, User, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface MessagesThreadProps {
    clientId: string;
}

export function MessagesThread({ clientId }: MessagesThreadProps) {
    const [messageText, setMessageText] = useState('');
    const { data: messages, isLoading } = useClientMessages(clientId);
    const sendMessage = useSendMessage();
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageText.trim()) return;

        try {
            await sendMessage.mutateAsync({
                clientId,
                values: { message_text: messageText },
            });
            setMessageText('');
        } catch (error: unknown) {
            logger.error('Failed to send message', error, { 
                component: 'MessagesThread',
                clientId 
            });
            // Error also handled by hook
        }
    };

    return (
        <Card className="h-[600px] flex flex-col">
            <CardHeader>
                <CardTitle>Messages</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto space-y-4 pr-2"
                >
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : messages?.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <p>No messages yet.</p>
                            <p className="text-sm">Start a conversation with this client.</p>
                        </div>
                    ) : (
                        messages?.map((msg) => {
                            const isAdmin = msg.sender_type === 'admin';
                            return (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "flex gap-3 max-w-[80%]",
                                        isAdmin ? "ml-auto flex-row-reverse" : "mr-auto"
                                    )}
                                >
                                    <div className={cn(
                                        "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                                        isAdmin ? "bg-primary text-primary-foreground" : "bg-muted"
                                    )}>
                                        {isAdmin ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
                                    </div>
                                    <div className={cn(
                                        "rounded-lg p-3 text-sm",
                                        isAdmin ? "bg-primary text-primary-foreground" : "bg-muted"
                                    )}>
                                        <p>{msg.message_text}</p>
                                        <p className={cn(
                                            "text-[10px] mt-1 opacity-70",
                                            isAdmin ? "text-right" : "text-left"
                                        )}>
                                            {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <form onSubmit={handleSubmit} className="flex gap-2 pt-4 border-t">
                    <Textarea
                        placeholder="Type a message..."
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        className="min-h-[80px] resize-none"
                        aria-label="Type a message"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                    />
                    <Button
                        type="submit"
                        size="icon"
                        className="h-[80px] w-[80px]"
                        disabled={sendMessage.isPending || !messageText.trim()}
                    >
                        {sendMessage.isPending ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                            <Send className="h-6 w-6" />
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
