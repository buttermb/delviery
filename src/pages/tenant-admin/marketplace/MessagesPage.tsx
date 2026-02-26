import { logger } from '@/lib/logger';
import { encryptMessage, decryptMessage } from '@/lib/utils/encryption';
/**
 * Marketplace Messages Page
 * View and manage buyer-seller conversations
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import {
  MessageSquare,
  Search,
  Send,
  Package,
  ShoppingCart,
  Clock,
  CheckCircle2,
  Building2,
  ArrowLeft
} from 'lucide-react';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { queryKeys } from '@/lib/queryKeys';

interface Message {
  id: string;
  sender_tenant_id: string;
  receiver_tenant_id: string;
  listing_id?: string;
  order_id?: string;
  subject?: string;
  message_text: string;
  message_encrypted: boolean;
  read: boolean;
  read_at?: string;
  created_at: string;
  sender_tenant?: {
    id: string;
    business_name: string;
  };
  receiver_tenant?: {
    id: string;
    business_name: string;
  };
  listing?: {
    id: string;
    product_name: string;
  };
  order?: {
    id: string;
    order_number: string;
  };
}

interface Conversation {
  buyerTenantId: string;
  buyerName: string;
  lastMessage: Message;
  unreadCount: number;
  messages: Message[];
  listingId?: string;
  orderId?: string;
}

export default function MessagesPage() {
  const { tenant } = useTenantAdminAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [_replyingTo, setReplyingTo] = useState<string | null>(null);

  // Fetch all messages (sent and received) for this tenant
  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: queryKeys.marketplaceMessages.byTenant(tenantId),
    queryFn: async (): Promise<Message[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('marketplace_messages' as 'tenants') // Supabase type limitation
        .select(`
          *,
          sender_tenant:tenants!marketplace_messages_sender_tenant_id_fkey (
            id,
            business_name
          ),
          receiver_tenant:tenants!marketplace_messages_receiver_tenant_id_fkey (
            id,
            business_name
          ),
          listing:marketplace_listings!marketplace_messages_listing_id_fkey (
            id,
            product_name
          ),
          order:marketplace_orders!marketplace_messages_order_id_fkey (
            id,
            order_number
          )
        `)
        .or(`receiver_tenant_id.eq.${tenantId},sender_tenant_id.eq.${tenantId}`)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch messages', error, { component: 'MessagesPage' });
        throw error;
      }

      // Decrypt messages
      const decryptedData = await Promise.all((data as unknown as Record<string, unknown>[] ?? []).map(async (msg: Record<string, unknown>) => {
        if (msg.message_encrypted && msg.message_text) {
          try {
            const decrypted = await decryptMessage(String(msg.message_text));
            return { ...msg, message_text: decrypted };
          } catch {
            logger.warn('Failed to decrypt message', { messageId: msg.id });
            return msg;
          }
        }
        return msg;
      }));

      return decryptedData as unknown as Message[];
    },
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  // Group messages into conversations
  const conversations = messages.reduce((acc: Conversation[], message: Message) => {
    // Determine buyer tenant ID (the one that's not the current tenant)
    const buyerTenantId = message.sender_tenant_id === tenantId
      ? message.receiver_tenant_id
      : message.sender_tenant_id;

    const buyerName = message.sender_tenant_id === tenantId
      ? message.receiver_tenant?.business_name || 'Unknown Buyer'
      : message.sender_tenant?.business_name || 'Unknown Buyer';

    if (!acc.find(c => c.buyerTenantId === buyerTenantId)) {
      acc.push({
        buyerTenantId,
        buyerName,
        lastMessage: message,
        unreadCount: 0,
        messages: [],
        listingId: message.listing_id || undefined,
        orderId: message.order_id || undefined,
      });
    }

    const conversation = acc.find(c => c.buyerTenantId === buyerTenantId)!;
    conversation.messages.push(message);

    // Update last message if this is newer
    if (new Date(message.created_at) > new Date(conversation.lastMessage.created_at)) {
      conversation.lastMessage = message;
      conversation.listingId = message.listing_id || conversation.listingId;
      conversation.orderId = message.order_id || conversation.orderId;
    }

    // Count unread messages (messages sent to this tenant that are unread)
    if (message.receiver_tenant_id === tenantId && !message.read) {
      conversation.unreadCount++;
    }

    return acc;
  }, []).sort((a, b) => {
    // Sort by last message time (most recent first)
    return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
  });

  // Filter conversations by search
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.buyerName.toLowerCase().includes(query) ||
      conv.lastMessage.message_text.toLowerCase().includes(query) ||
      conv.lastMessage.subject?.toLowerCase().includes(query)
    );
  });

  // Get selected conversation messages
  const selectedConv = conversations.find(c => c.buyerTenantId === selectedConversation);
  const selectedMessages = selectedConv?.messages.sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  ) ?? [];

  // Mark messages as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (messageIds: string[]) => {
      const { error } = await supabase
        .from('marketplace_messages' as 'tenants') // Supabase type limitation
        .update({
          read: true,
          read_at: new Date().toISOString()
        })
        .in('id', messageIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceMessages.byTenant(tenantId) });
    },
    onError: (error: Error) => {
      logger.error('Failed to mark messages as read', { error });
      toast.error('Failed to mark as read', { description: humanizeError(error) });
    },
  });

  // Send reply mutation
  const sendReplyMutation = useMutation({
    mutationFn: async ({ buyerTenantId, text, listingId, orderId }: {
      buyerTenantId: string;
      text: string;
      listingId?: string;
      orderId?: string;
    }) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const encryptedText = await encryptMessage(text);

      const { data, error } = await supabase
        .from('marketplace_messages' as 'tenants') // Supabase type limitation
        .insert({
          sender_tenant_id: tenantId,
          receiver_tenant_id: buyerTenantId,
          message_text: encryptedText,
          message_encrypted: true,
          subject: selectedConv?.lastMessage.subject || undefined,
          listing_id: listingId || selectedConv?.listingId || null,
          order_id: orderId || selectedConv?.orderId || null,
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceMessages.byTenant(tenantId) });
      setReplyText('');
      setReplyingTo(null);
      toast.success('Message sent', { description: 'Your reply has been sent to the buyer' });
    },
    onError: (error: unknown) => {
      logger.error('Failed to send message', error, { component: 'MessagesPage' });
      toast.error('Error', { description: humanizeError(error, 'Failed to send message') });
    },
  });

  // Handle conversation selection
  const handleSelectConversation = (buyerTenantId: string) => {
    setSelectedConversation(buyerTenantId);

    // Mark unread messages as read
    const conv = conversations.find(c => c.buyerTenantId === buyerTenantId);
    const unreadIds = conv?.messages
      .filter(m => m.receiver_tenant_id === tenantId && !m.read)
      .map(m => m.id) ?? [];

    if (unreadIds.length > 0) {
      markAsReadMutation.mutate(unreadIds);
    }
  };

  // Handle send reply
  const handleSendReply = () => {
    if (!replyText.trim() || !selectedConversation) return;

    sendReplyMutation.mutate({
      buyerTenantId: selectedConversation,
      text: replyText.trim(),
      listingId: selectedConv?.listingId,
      orderId: selectedConv?.orderId,
    });
  };

  // Get total unread count
  const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  if (!tenantId) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Tenant Found</h3>
              <p className="text-sm text-muted-foreground">
                Please log in to view messages
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          Marketplace Messages
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Communicate with buyers about listings and orders
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-250px)]">
        {/* Conversations List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Conversations</CardTitle>
              {totalUnread > 0 && (
                <Badge variant="destructive">{totalUnread}</Badge>
              )}
            </div>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                aria-label="Search conversations"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-350px)]">
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Messages</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? 'No conversations match your search' : 'You have no messages yet'}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredConversations.map((conv) => (
                    <button
                      key={conv.buyerTenantId}
                      onClick={() => handleSelectConversation(conv.buyerTenantId)}
                      className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${selectedConversation === conv.buyerTenantId ? 'bg-muted' : ''
                        }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{conv.buyerName}</span>
                        </div>
                        {conv.unreadCount > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {conv.lastMessage.message_text}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatSmartDate(conv.lastMessage.created_at)}
                        {conv.lastMessage.listing && (
                          <>
                            <Separator orientation="vertical" className="h-3" />
                            <Package className="h-3 w-3" />
                            <span className="truncate">{conv.lastMessage.listing.product_name}</span>
                          </>
                        )}
                        {conv.lastMessage.order && (
                          <>
                            <Separator orientation="vertical" className="h-3" />
                            <ShoppingCart className="h-3 w-3" />
                            <span>Order {conv.lastMessage.order.order_number}</span>
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Message Thread */}
        <Card className="lg:col-span-2">
          {selectedConversation && selectedConv ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{selectedConv.buyerName}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedConv.listingId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/listings/${selectedConv.listingId}`)}
                        >
                          <Package className="h-4 w-4 mr-1" />
                          View Listing
                        </Button>
                      )}
                      {selectedConv.orderId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/orders/${selectedConv.orderId}`)}
                        >
                          <ShoppingCart className="h-4 w-4 mr-1" />
                          View Order
                        </Button>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedConversation(null)}
                    className="lg:hidden"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex flex-col h-[calc(100vh-350px)]">
                {/* Messages */}
                <ScrollArea className="flex-1 p-6">
                  <div className="space-y-4">
                    {selectedMessages.map((message) => {
                      const isFromMe = message.sender_tenant_id === tenantId;
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg p-3 ${isFromMe
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                              }`}
                          >
                            {message.subject && (
                              <div className="font-semibold mb-1 text-sm">
                                {message.subject}
                              </div>
                            )}
                            <p className="text-sm whitespace-pre-wrap">
                              {message.message_text}
                            </p>
                            <div className={`flex items-center gap-2 mt-2 text-xs ${isFromMe ? 'text-primary-foreground/70' : 'text-muted-foreground'
                              }`}>
                              <Clock className="h-3 w-3" />
                              {formatSmartDate(message.created_at)}
                              {isFromMe && message.read && (
                                <>
                                  <CheckCircle2 className="h-3 w-3 ml-1" />
                                  <span>Read</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                {/* Reply Input */}
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type your reply..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.metaKey) {
                          handleSendReply();
                        }
                      }}
                      rows={3}
                      className="resize-none"
                      aria-label="Type your reply"
                    />
                    <Button
                      onClick={handleSendReply}
                      disabled={!replyText.trim() || sendReplyMutation.isPending}
                      size="icon"
                      className="self-end"
                      aria-label="Send reply"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Press ⌘+Enter to send
                  </p>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="py-12">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Select a Conversation</h3>
                <p className="text-sm text-muted-foreground">
                  Choose a conversation from the list to view messages
                </p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

