import { logger } from '@/lib/logger';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Paperclip,
  MessageSquare,
  Bot,
  User,
  Clock,
  Search,
  MoreVertical,
  Zap,
  X,
  FileText,
  Download,
  Check,
  CheckCheck,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { validateChatSession, validateChatMessage } from '@/utils/realtimeValidation';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { cn } from '@/lib/utils';

// Types
interface ChatSession {
  id: string;
  mode: 'ai' | 'human';
  status: 'active' | 'closed';
  created_at: string;
  updated_at?: string;
  user_id?: string;
  guest_id?: string;
  assigned_admin_id?: string;
  customer_name?: string;
  customer_email?: string;
  unread_count?: number;
  last_message?: string;
  last_message_at?: string;
}

interface Message {
  id: string;
  sender_type: 'user' | 'ai' | 'admin';
  sender_id?: string;
  message: string;
  created_at: string;
  read_at?: string;
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
}

interface QuickResponse {
  id: string;
  title: string;
  message: string;
  category: string;
}

// Default quick responses
const DEFAULT_QUICK_RESPONSES: QuickResponse[] = [
  {
    id: '1',
    title: 'Greeting',
    message: 'Hello! Thank you for reaching out. How can I assist you today?',
    category: 'General',
  },
  {
    id: '2',
    title: 'Processing Order',
    message: 'I can see your order is currently being processed. You should receive a confirmation email shortly.',
    category: 'Orders',
  },
  {
    id: '3',
    title: 'Delivery Time',
    message: 'Our standard delivery time is 30-60 minutes depending on your location. Would you like me to check the status of your delivery?',
    category: 'Delivery',
  },
  {
    id: '4',
    title: 'Thank You',
    message: 'Thank you for your patience! Is there anything else I can help you with today?',
    category: 'General',
  },
  {
    id: '5',
    title: 'Product Info',
    message: 'I\'d be happy to provide more information about that product. What specifically would you like to know?',
    category: 'Products',
  },
  {
    id: '6',
    title: 'Refund Process',
    message: 'I understand you\'d like to request a refund. Let me look into this for you. Could you please provide your order number?',
    category: 'Orders',
  },
  {
    id: '7',
    title: 'Closing',
    message: 'It was my pleasure to assist you today! Don\'t hesitate to reach out if you have any more questions. Have a great day!',
    category: 'General',
  },
  {
    id: '8',
    title: 'Out of Stock',
    message: 'I apologize, but that item is currently out of stock. Would you like me to notify you when it becomes available again?',
    category: 'Products',
  },
];

// Quick Response Categories
const QUICK_RESPONSE_CATEGORIES = ['All', 'General', 'Orders', 'Delivery', 'Products'];

const AdminLiveChat = function AdminLiveChat() {
  const { tenant } = useTenantAdminAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [quickResponseCategory, setQuickResponseCategory] = useState('All');
  const [showQuickResponses, setShowQuickResponses] = useState(false);
  const [customerTyping, setCustomerTyping] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<{
    file: File;
    preview: string;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Filter quick responses by category
  const filteredQuickResponses = quickResponseCategory === 'All'
    ? DEFAULT_QUICK_RESPONSES
    : DEFAULT_QUICK_RESPONSES.filter(qr => qr.category === quickResponseCategory);

  // Filter sessions by search query
  const filteredSessions = sessions.filter(session => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    const customerName = session.customer_name?.toLowerCase() ?? '';
    const customerEmail = session.customer_email?.toLowerCase() ?? '';
    const guestId = session.guest_id?.toLowerCase() ?? '';
    return customerName.includes(searchLower) ||
           customerEmail.includes(searchLower) ||
           guestId.includes(searchLower);
  });

  // Load sessions
  const loadSessions = useCallback(async () => {
    if (!tenant?.id) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('id, mode, status, created_at, updated_at, user_id, guest_id, assigned_admin_id, customer_name, customer_email, unread_count, last_message, last_message_at')
        .eq('status', 'active')
        .eq('tenant_id', tenant.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const validSessions = data.filter(validateChatSession);
        setSessions(validSessions as ChatSession[]);
      }
    } catch (error) {
      logger.error('Error loading chat sessions', error as Error, { component: 'AdminLiveChat' });
      toast.error("Failed to load chat sessions");
    } finally {
      setIsLoading(false);
    }
  }, [tenant?.id]);

  // Setup realtime subscriptions
  useEffect(() => {
    if (!tenant?.id) return;

    let sessionsChannel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimeout: NodeJS.Timeout;

    loadSessions();

    const setupChannel = () => {
      try {
        sessionsChannel = supabase
          .channel('admin_chat_sessions', {
            config: {
              broadcast: { self: false },
              presence: { key: '' }
            }
          })
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'chat_sessions',
              filter: `tenant_id=eq.${tenant.id}`
            },
            (payload) => {
              try {
                if (payload.new && validateChatSession(payload.new)) {
                  loadSessions();
                }
              } catch (error) {
                logger.error('Error processing chat session update', error as Error, { component: 'AdminLiveChat' });
              }
            }
          )
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR') {
              logger.warn('Failed to subscribe to chat sessions channel, retrying', { component: 'AdminLiveChat' });
              retryTimeout = setTimeout(setupChannel, 5000);
            } else if (status === 'SUBSCRIBED') {
              logger.info('Chat sessions subscription active', { component: 'AdminLiveChat' });
            }
          });
      } catch (error) {
        logger.error('Error setting up chat sessions channel', error as Error, { component: 'AdminLiveChat' });
        retryTimeout = setTimeout(setupChannel, 5000);
      }
    };

    setupChannel();

    return () => {
      clearTimeout(retryTimeout);
      if (sessionsChannel) {
        supabase.removeChannel(sessionsChannel).catch((err) =>
          logger.error('Error removing sessions channel', err as Error, { component: 'AdminLiveChat' })
        );
      }
    };
  }, [loadSessions, tenant?.id]);

  // Load messages for selected session
  useEffect(() => {
    if (!selectedSession) {
      setMessages([]);
      return;
    }

    let messagesChannel: ReturnType<typeof supabase.channel> | null = null;
    let typingChannel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimeout: NodeJS.Timeout;

    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('id, sender_type, sender_id, message, created_at, read_at, attachment_url, attachment_type, attachment_name')
          .eq('session_id', selectedSession)
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (data) {
          const validMessages = data.filter(validateChatMessage);
          setMessages(validMessages as Message[]);

          // Mark messages as read
          markMessagesAsRead(selectedSession);
        }
      } catch (error) {
        logger.error('Error loading messages', error as Error, { component: 'AdminLiveChat', sessionId: selectedSession });
        toast.error("Failed to load messages");
      }
    };

    loadMessages();

    const setupMessagesChannel = () => {
      try {
        messagesChannel = supabase
          .channel(`admin_chat_${selectedSession}`, {
            config: {
              broadcast: { self: false },
              presence: { key: '' }
            }
          })
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'chat_messages',
              filter: `session_id=eq.${selectedSession}`
            },
            (payload) => {
              try {
                const newMessage = payload.new as Message;
                if (validateChatMessage(newMessage)) {
                  setMessages(prev => [...prev, newMessage]);
                  if (newMessage.sender_type !== 'admin') {
                    markMessagesAsRead(selectedSession);
                  }
                }
              } catch (error) {
                logger.error('Error processing new message', error as Error, { component: 'AdminLiveChat' });
              }
            }
          )
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR') {
              logger.warn('Failed to subscribe to messages channel, retrying', { component: 'AdminLiveChat', sessionId: selectedSession });
              retryTimeout = setTimeout(setupMessagesChannel, 5000);
            }
          });

        // Setup typing indicator channel
        typingChannel = supabase
          .channel(`typing_${selectedSession}`)
          .on('broadcast', { event: 'typing' }, (payload) => {
            if (payload.payload?.user_type === 'customer') {
              setCustomerTyping(true);
              setTimeout(() => setCustomerTyping(false), 3000);
            }
          })
          .subscribe();
      } catch (error) {
        logger.error('Error setting up messages channel', error as Error, { component: 'AdminLiveChat' });
        retryTimeout = setTimeout(setupMessagesChannel, 5000);
      }
    };

    setupMessagesChannel();

    return () => {
      clearTimeout(retryTimeout);
      if (messagesChannel) {
        supabase.removeChannel(messagesChannel).catch((err) =>
          logger.error('Error removing messages channel', err as Error, { component: 'AdminLiveChat' })
        );
      }
      if (typingChannel) {
        supabase.removeChannel(typingChannel).catch((err) =>
          logger.error('Error removing typing channel', err as Error, { component: 'AdminLiveChat' })
        );
      }
    };
  }, [selectedSession]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, customerTyping]);

  // Mark messages as read
  const markMessagesAsRead = async (sessionId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('chat_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('session_id', sessionId)
        .neq('sender_type', 'admin')
        .is('read_at', null);

      // Update local session unread count
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, unread_count: 0 } : s
      ));
    } catch (error) {
      logger.error('Error marking messages as read', error as Error, { component: 'AdminLiveChat' });
    }
  };

  // Broadcast typing indicator
  const broadcastTyping = useCallback(() => {
    if (!selectedSession) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    supabase.channel(`typing_${selectedSession}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_type: 'admin' }
    }).catch(err => logger.error('Error broadcasting typing', err as Error, { component: 'AdminLiveChat' }));

    // Debounce: prevent re-broadcasting within 3 seconds
    typingTimeoutRef.current = setTimeout(() => undefined, 3000);
  }, [selectedSession]);

  // Handle input change with typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    broadcastTyping();
  };

  // Send message
  const handleSend = async () => {
    if ((!input.trim() && !attachmentPreview) || !selectedSession || isSending) return;

    setIsSending(true);
    const messageText = input.trim();
    setInput('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let attachmentUrl: string | undefined;
      let attachmentType: string | undefined;
      let attachmentName: string | undefined;

      // Upload attachment if present
      if (attachmentPreview) {
        const file = attachmentPreview.file;
        const fileExt = file.name.split('.').pop();
        const fileName = `${selectedSession}/${Date.now()}.${fileExt}`;

        setIsUploading(true);
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(uploadData.path);

        attachmentUrl = urlData.publicUrl;
        attachmentType = file.type.startsWith('image/') ? 'image' : 'file';
        attachmentName = file.name;

        setAttachmentPreview(null);
        setIsUploading(false);
      }

      const { error } = await supabase.from('chat_messages').insert({
        session_id: selectedSession,
        sender_type: 'admin',
        sender_id: user.id,
        message: messageText || (attachmentName ? `Sent ${attachmentType}: ${attachmentName}` : ''),
        attachment_url: attachmentUrl,
        attachment_type: attachmentType,
        attachment_name: attachmentName,
      });

      if (error) throw error;

      // Update session last message
      await supabase
        .from('chat_sessions')
        .update({
          last_message: messageText || `Sent ${attachmentType}`,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedSession);

    } catch (error) {
      logger.error('Error sending message', error as Error, { component: 'AdminLiveChat' });
      toast.error("Failed to send message");
      setInput(messageText); // Restore input on error
    } finally {
      setIsSending(false);
      setIsUploading(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Maximum file size is 10MB");
      return;
    }

    // Create preview
    const preview = file.type.startsWith('image/')
      ? URL.createObjectURL(file)
      : '';

    setAttachmentPreview({ file, preview });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove attachment
  const removeAttachment = () => {
    if (attachmentPreview?.preview) {
      URL.revokeObjectURL(attachmentPreview.preview);
    }
    setAttachmentPreview(null);
  };

  // Take over AI chat
  const takeOver = async (sessionId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase
        .from('chat_sessions')
        .update({
          mode: 'human',
          assigned_admin_id: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      // Send system message
      await supabase.from('chat_messages').insert({
        session_id: sessionId,
        sender_type: 'admin',
        sender_id: user.id,
        message: "A support agent has joined the chat. How can I help you?"
      });

      setSelectedSession(sessionId);
      loadSessions();
    } catch (error) {
      logger.error('Error taking over chat', error as Error, { component: 'AdminLiveChat' });
      toast.error("Failed to take over chat");
    }
  };

  // Close chat session
  const closeSession = async (sessionId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Send closing message
      await supabase.from('chat_messages').insert({
        session_id: sessionId,
        sender_type: 'admin',
        sender_id: user?.id,
        message: "This chat session has been closed. Thank you for contacting support!"
      });

      await supabase
        .from('chat_sessions')
        .update({
          status: 'closed',
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (selectedSession === sessionId) {
        setSelectedSession(null);
        setMessages([]);
      }

      loadSessions();
      toast.success("The chat session has been closed");
    } catch (error) {
      logger.error('Error closing chat', error as Error, { component: 'AdminLiveChat' });
      toast.error("Failed to close chat");
    }
  };

  // Insert quick response
  const insertQuickResponse = (response: QuickResponse) => {
    setInput(prev => prev + (prev ? '\n' : '') + response.message);
    setShowQuickResponses(false);
  };

  // Get session display info
  const getSessionDisplayInfo = (session: ChatSession) => {
    const name = session.customer_name ||
                 (session.user_id ? 'Registered User' : session.guest_id) ||
                 'Unknown';
    const initials = name.substring(0, 2).toUpperCase();
    return { name, initials };
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Separate sessions by mode
  const humanSessions = filteredSessions.filter(s => s.mode === 'human');
  const aiSessions = filteredSessions.filter(s => s.mode === 'ai');

  // Get selected session details
  const currentSession = sessions.find(s => s.id === selectedSession);

  return (
    <TooltipProvider>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-background">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Live Chat Support</h1>
              <p className="text-sm text-muted-foreground">
                Manage customer conversations in real-time
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {humanSessions.length} Active
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Bot className="w-3 h-3" />
                {aiSessions.length} AI
              </Badge>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Sessions Panel */}
          <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
            <div className="h-full flex flex-col border-r">
              {/* Search */}
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    aria-label="Search conversations"
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Sessions List */}
              <ScrollArea className="flex-1">
                {isLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Tabs defaultValue="all" className="w-full">
                    <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
                      <TabsTrigger
                        value="all"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                      >
                        All ({filteredSessions.length})
                      </TabsTrigger>
                      <TabsTrigger
                        value="human"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                      >
                        Human ({humanSessions.length})
                      </TabsTrigger>
                      <TabsTrigger
                        value="ai"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                      >
                        AI ({aiSessions.length})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="all" className="m-0">
                      <SessionList
                        sessions={filteredSessions}
                        selectedSession={selectedSession}
                        onSelect={setSelectedSession}
                        onTakeOver={takeOver}
                        getDisplayInfo={getSessionDisplayInfo}
                        formatTime={formatRelativeTime}
                      />
                    </TabsContent>

                    <TabsContent value="human" className="m-0">
                      <SessionList
                        sessions={humanSessions}
                        selectedSession={selectedSession}
                        onSelect={setSelectedSession}
                        onTakeOver={takeOver}
                        getDisplayInfo={getSessionDisplayInfo}
                        formatTime={formatRelativeTime}
                      />
                    </TabsContent>

                    <TabsContent value="ai" className="m-0">
                      <SessionList
                        sessions={aiSessions}
                        selectedSession={selectedSession}
                        onSelect={setSelectedSession}
                        onTakeOver={takeOver}
                        getDisplayInfo={getSessionDisplayInfo}
                        formatTime={formatRelativeTime}
                      />
                    </TabsContent>
                  </Tabs>
                )}
              </ScrollArea>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Chat Panel */}
          <ResizablePanel defaultSize={75}>
            {selectedSession && currentSession ? (
              <div className="h-full flex flex-col">
                {/* Chat Header */}
                <div className="p-4 border-b flex items-center justify-between bg-background">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {getSessionDisplayInfo(currentSession).initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          {getSessionDisplayInfo(currentSession).name}
                        </h3>
                        <Badge variant={currentSession.mode === 'human' ? 'default' : 'secondary'}>
                          {currentSession.mode === 'human' ? (
                            <>
                              <User className="w-3 h-3 mr-1" />
                              Human
                            </>
                          ) : (
                            <>
                              <Bot className="w-3 h-3 mr-1" />
                              AI
                            </>
                          )}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        Started {formatRelativeTime(currentSession.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentSession.mode === 'ai' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => takeOver(currentSession.id)}
                      >
                        <User className="w-4 h-4 mr-1" />
                        Take Over
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="More actions">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => closeSession(currentSession.id)}>
                          Close Chat
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Messages Area */}
                <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        formatTime={formatRelativeTime}
                      />
                    ))}

                    {/* Typing indicator */}
                    {customerTyping && (
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-muted text-xs">
                            {getSessionDisplayInfo(currentSession).initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="bg-muted rounded-lg p-3">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:0.1s]" />
                            <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Attachment Preview */}
                {attachmentPreview && (
                  <div className="px-4 pb-2">
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                      {attachmentPreview.preview ? (
                        <img
                          src={attachmentPreview.preview}
                          alt="Attachment preview"
                          className="h-16 w-16 object-cover rounded"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-16 w-16 bg-background rounded flex items-center justify-center">
                          <FileText className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {attachmentPreview.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(attachmentPreview.file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={removeAttachment}
                        aria-label="Remove attachment"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Input Area */}
                <div className="p-4 border-t bg-background">
                  <div className="flex items-end gap-2">
                    {/* File Upload */}
                    <input
                      ref={fileInputRef}
                      id="chat-file-upload"
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.txt"
                      onChange={handleFileSelect}
                      aria-label="Attach file to chat message"
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isSending || isUploading}
                          aria-label="Attach file"
                        >
                          <Paperclip className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Attach file</TooltipContent>
                    </Tooltip>

                    {/* Quick Responses */}
                    <Popover open={showQuickResponses} onOpenChange={setShowQuickResponses}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Quick responses">
                              <Zap className="w-4 h-4" />
                            </Button>
                          </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Quick responses</TooltipContent>
                      </Tooltip>
                      <PopoverContent className="w-80 p-0" align="start">
                        <div className="p-3 border-b">
                          <h4 className="font-semibold text-sm">Quick Responses</h4>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {QUICK_RESPONSE_CATEGORIES.map((category) => (
                              <Button
                                key={category}
                                variant={quickResponseCategory === category ? 'default' : 'ghost'}
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setQuickResponseCategory(category)}
                              >
                                {category}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <ScrollArea className="h-64">
                          <div className="p-2 space-y-1">
                            {filteredQuickResponses.map((response) => (
                              <button
                                key={response.id}
                                className="w-full text-left p-2 hover:bg-muted rounded-md transition-colors"
                                onClick={() => insertQuickResponse(response)}
                              >
                                <div className="font-medium text-sm">{response.title}</div>
                                <div className="text-xs text-muted-foreground line-clamp-2">
                                  {response.message}
                                </div>
                              </button>
                            ))}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>

                    {/* Message Input */}
                    <Textarea
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                      aria-label="Type a message"
                      className="flex-1 min-h-[44px] max-h-32 resize-none"
                      disabled={isSending || currentSession.mode === 'ai'}
                    />

                    {/* Send Button */}
                    <Button
                      onClick={handleSend}
                      disabled={(!input.trim() && !attachmentPreview) || isSending || isUploading || currentSession.mode === 'ai'}
                    >
                      {isSending || isUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  {currentSession.mode === 'ai' && (
                    <p className="text-xs text-muted-foreground mt-2">
                      This chat is being handled by AI. Click &quot;Take Over&quot; to respond.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center p-4">
                <div>
                  <MessageSquare className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Chat Selected</h3>
                  <p className="text-muted-foreground max-w-sm">
                    Select a conversation from the left panel to view messages and respond to customers.
                  </p>
                </div>
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  );
};

// Session List Component
interface SessionListProps {
  sessions: ChatSession[];
  selectedSession: string | null;
  onSelect: (id: string) => void;
  onTakeOver: (id: string) => void;
  getDisplayInfo: (session: ChatSession) => { name: string; initials: string };
  formatTime: (dateString: string) => string;
}

function SessionList({
  sessions,
  selectedSession,
  onSelect,
  onTakeOver,
  getDisplayInfo,
  formatTime
}: SessionListProps) {
  if (sessions.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No chat sessions found</p>
        <p className="text-xs mt-1">Chat sessions will appear here when customers start conversations.</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {sessions.map((session) => {
        const { name, initials } = getDisplayInfo(session);
        const isSelected = selectedSession === session.id;

        return (
          <button
            key={session.id}
            onClick={() => session.mode === 'ai' ? onTakeOver(session.id) : onSelect(session.id)}
            className={cn(
              "w-full p-3 text-left hover:bg-muted/50 transition-colors",
              isSelected && "bg-muted"
            )}
          >
            <div className="flex items-start gap-3">
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className={cn(
                    session.mode === 'ai' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                  )}>
                    {session.mode === 'ai' ? <Bot className="w-4 h-4" /> : initials}
                  </AvatarFallback>
                </Avatar>
                {session.unread_count && session.unread_count > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {session.unread_count > 9 ? '9+' : session.unread_count}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{name}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatTime(session.last_message_at || session.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Badge
                    variant={session.mode === 'human' ? 'default' : 'secondary'}
                    className="h-5 text-[10px]"
                  >
                    {session.mode === 'human' ? 'Human' : 'AI'}
                  </Badge>
                </div>
                {session.last_message && (
                  <p className="text-xs text-muted-foreground truncate mt-1">
                    {session.last_message}
                  </p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Message Bubble Component
interface MessageBubbleProps {
  message: Message;
  formatTime: (dateString: string) => string;
}

function MessageBubble({ message, formatTime }: MessageBubbleProps) {
  const isAdmin = message.sender_type === 'admin';
  const isAI = message.sender_type === 'ai';

  return (
    <div className={cn(
      "flex items-start gap-3",
      isAdmin && "flex-row-reverse"
    )}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className={cn(
          isAdmin ? 'bg-primary text-primary-foreground' :
          isAI ? 'bg-blue-100 text-blue-700' : 'bg-muted'
        )}>
          {isAdmin ? 'A' : isAI ? <Bot className="w-3 h-3" /> : 'C'}
        </AvatarFallback>
      </Avatar>

      <div className={cn(
        "max-w-[70%] space-y-1",
        isAdmin && "items-end"
      )}>
        <div className={cn(
          "rounded-lg p-3",
          isAdmin ? 'bg-primary text-primary-foreground' :
          isAI ? 'bg-blue-100 dark:bg-blue-900' : 'bg-muted'
        )}>
          {/* Attachment */}
          {message.attachment_url && (
            <div className="mb-2">
              {message.attachment_type === 'image' ? (
                <a href={message.attachment_url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={message.attachment_url}
                    alt={message.attachment_name || 'Attachment'}
                    className="max-w-full rounded cursor-pointer hover:opacity-90"
                    loading="lazy"
                  />
                </a>
              ) : (
                <a
                  href={message.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-2 p-2 rounded",
                    isAdmin ? 'bg-primary-foreground/10' : 'bg-background/50'
                  )}
                >
                  <FileText className="w-4 h-4" />
                  <span className="text-sm truncate">{message.attachment_name}</span>
                  <Download className="w-3 h-3 ml-auto" />
                </a>
              )}
            </div>
          )}

          {/* Message text */}
          {message.message && (
            <p className="text-sm whitespace-pre-wrap">{message.message}</p>
          )}
        </div>

        {/* Timestamp and read status */}
        <div className={cn(
          "flex items-center gap-1 text-xs text-muted-foreground",
          isAdmin && "justify-end"
        )}>
          <span>{formatTime(message.created_at)}</span>
          {isAdmin && (
            message.read_at ? (
              <CheckCheck className="w-3 h-3 text-blue-500" />
            ) : (
              <Check className="w-3 h-3" />
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminLiveChat;
