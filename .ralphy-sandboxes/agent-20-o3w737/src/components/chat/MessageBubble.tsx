/**
 * MessageBubble Component
 * Individual message display with sender info and timestamp
 */

import { formatSmartDate } from '@/lib/utils/formatDate';
import { cn } from '@/lib/utils';
import { Check, CheckCheck } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    sender_type: 'customer' | 'vendor' | 'system';
    sender_name: string | null;
    content: string;
    message_type: 'text' | 'system' | 'order_update';
    read_at: string | null;
    delivered_at: string | null;
    created_at: string;
}

interface MessageBubbleProps {
    message: Message;
    isOwn: boolean;
    showAvatar?: boolean;
    className?: string;
}

export function MessageBubble({ message, isOwn, showAvatar = true, className }: MessageBubbleProps) {
    // System messages (order updates, etc.)
    if (message.message_type === 'system' || message.message_type === 'order_update') {
        return (
            <div className={cn('flex justify-center my-4', className)}>
                <div className="bg-muted px-4 py-2 rounded-full text-xs text-muted-foreground max-w-md text-center">
                    {message.content}
                </div>
            </div>
        );
    }

    const initials = message.sender_name
        ? message.sender_name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
        : message.sender_type === 'vendor' ? 'V' : 'C';

    return (
        <div
            className={cn(
                'flex gap-2 mb-4',
                isOwn ? 'flex-row-reverse' : 'flex-row',
                className
            )}
        >
            {/* Avatar */}
            {showAvatar && (
                <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback className={cn(
                        'text-xs',
                        message.sender_type === 'vendor' ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                    )}>
                        {initials}
                    </AvatarFallback>
                </Avatar>
            )}

            {/* Message Bubble */}
            <div className={cn('flex flex-col max-w-[70%]', isOwn && 'items-end')}>
                {/* Sender Name */}
                {!isOwn && (
                    <p className="text-xs text-muted-foreground mb-1 px-3">
                        {message.sender_name || (message.sender_type === 'vendor' ? 'Vendor' : 'Customer')}
                    </p>
                )}

                {/* Content */}
                <div
                    className={cn(
                        'rounded-2xl px-4 py-2 break-words',
                        isOwn
                            ? 'bg-primary text-primary-foreground rounded-tr-sm'
                            : 'bg-muted rounded-tl-sm'
                    )}
                >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>

                {/* Timestamp and Status */}
                <div className={cn(
                    'flex items-center gap-1 mt-1 px-3',
                    isOwn && 'flex-row-reverse'
                )}>
                    <span className="text-xs text-muted-foreground">
                        {formatSmartDate(message.created_at)}
                    </span>

                    {isOwn && (
                        <span className="text-xs">
                            {message.read_at ? (
                                <CheckCheck className="w-3 h-3 text-blue-500" />
                            ) : message.delivered_at ? (
                                <CheckCheck className="w-3 h-3 text-muted-foreground" />
                            ) : (
                                <Check className="w-3 h-3 text-muted-foreground" />
                            )}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
